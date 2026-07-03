import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { parseTicketData } from './utils/ticketParser.js'; 

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Käynnistetään sähköpostien haku ja automaattinen tekoälyjäsennys...");

    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        logger: false,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    try {
        const { data: settings, error: settingsError } = await supabase
            .schema('espan')
            .from('expert_location_settings')
            .select('ticket_sync_lookback_days, ticket_sync_active')
            .eq('expert_id', EXPERT_ID)
            .maybeSingle();

        if (settingsError) throw settingsError;
        
        if (settings && !settings.ticket_sync_active) {
            return { statusCode: 200, body: JSON.stringify({ message: 'Automaatio on kytketty pois päältä asetuksista.' }) };
        }

        const lookbackDays = settings?.ticket_sync_lookback_days || 60;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - lookbackDays);

        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        
        const results = [];

        try {
            console.log(`Etsitään kuitteja 2 kuukauden ajalta (alkaen ${sinceDate.toLocaleDateString()})...`);
            
            const vr = await client.search({ since: sinceDate, from: 'vr' });
            const onni1 = await client.search({ since: sinceDate, from: 'onnibus' });
            const onni2 = await client.search({ since: sinceDate, from: 'bookings@onnibus.com' });
            const payiq = await client.search({ since: sinceDate, from: 'payiq.net' });
            const korsisaari = await client.search({ since: sinceDate, subject: 'korsisaari' });

            const targetMessages = [...new Set([...vr, ...onni1, ...onni2, ...payiq, ...korsisaari])].reverse();

            console.log(`Gmail löysi yhteensä ${targetMessages.length} potentiaalista matkakohdetta.`);

            const MAX_NEW_TICKETS_PER_RUN = 6; 
            let newlyProcessedCount = 0;

            for (const uid of targetMessages) {
                if (newlyProcessedCount >= MAX_NEW_TICKETS_PER_RUN) {
                    console.log(`⚠️ Saavutettiin tekoälyn eräajon maksimiraja (${MAX_NEW_TICKETS_PER_RUN}). Loput käsitellään seuraavalla ajolla.`);
                    break;
                }

                const source = await client.fetchOne(uid, { source: true });
                const parsedMail = await simpleParser(source.source);
                
                const subject = parsedMail.subject || 'Ei otsikkoa';
                const fromAddress = parsedMail.from?.value[0]?.address || '';
                const emailReceivedAt = parsedMail.date || new Date();
                
                const isVR = fromAddress.toLowerCase().includes('vr') || subject.toLowerCase().includes('vr');
                const isOnni = fromAddress.toLowerCase().includes('onnibus') || fromAddress.toLowerCase().includes('bookings@onnibus.com') || subject.toLowerCase().includes('onnibus');
                const isKorsisaari = subject.toLowerCase().includes('kuitti: korsisaari') || fromAddress.toLowerCase().includes('noreply@payiq.net');
                
                if (!isVR && !isOnni && !isKorsisaari) {
                    continue; 
                }

                // Tuplien esto tietokannasta kuitin tasolla
                const { data: existingReceipt } = await supabase
                    .schema('espan')
                    .from('expert_ticket_receipts')
                    .select('id')
                    .eq('expert_id', EXPERT_ID)
                    .eq('email_received_at', emailReceivedAt.toISOString())
                    .maybeSingle();

                if (existingReceipt) {
                    continue;
                }

                const rawHtml = parsedMail.html || parsedMail.textAsHtml || '<div>Ei sisältöä</div>';
                const $ = cheerio.load(rawHtml);
                
                $('script, style, img, iframe, link, meta, svg, head').remove();
                $('a').attr('target', '_blank').attr('rel', 'noopener noreferrer');
                
                const cleanHtml = $.html();
                const cleanText = $.text().replace(/\s+/g, ' ').trim();

                if (isOnni && !cleanText.includes('TILAUKSEN YHTEENVETO')) {
                    continue;
                }

                let providerPrefix = 'tosite';
                if (isVR) providerPrefix = 'vr';
                if (isOnni) providerPrefix = 'onnibus';
                if (isKorsisaari) providerPrefix = 'korsisaari';

                const fileName = `${emailReceivedAt.getTime()}_${providerPrefix}_kuitti.html`;
                
                const { error: uploadError } = await supabase.storage
                    .from('ticket_receipts')
                    .upload(fileName, cleanHtml, {
                        contentType: 'text/html',
                        charset: 'utf-8',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('ticket_receipts')
                    .getPublicUrl(fileName);

                const bucketFileUrl = urlData.publicUrl;

                // ==========================================
                // 1. TEKOÄLYN KUTSU
                // ==========================================
                console.log(`[AI] Kutsutaan tekoälyä kohteelle: ${providerPrefix}`);
                
                let aiResult;
                try {
                    aiResult = await parseTicketData(cleanText, emailReceivedAt.toISOString(), subject, fromAddress);
                } catch (aiError) {
                    console.error("Tekoäly lakkasi vastaamasta tälle riville:", aiError.message);
                    continue; 
                }

                let keywords = [providerPrefix];
                if (isVR) keywords.push('juna');
                if (isOnni || isKorsisaari) keywords.push('bussi', 'linja-auto');
                if (isKorsisaari) keywords.push('paikallisliikenne', 'klaukkala');

                const aiMetadata = {
                    confidenceScore: aiResult.confidenceScore,
                    leadTimeHours: aiResult.leadTimeHours,
                    smartTags: aiResult.smartTags,
                    priceTrend: aiResult.priceTrend,
                    anomalyInfo: aiResult.anomalyInfo || null
                };

                // ==========================================
                // 2. TYHMYYSSUODATIN (Matkojen post-processing)
                // Estetään tekoälyn keksimät identtiset tuplamatkat
                // ==========================================
                if (aiResult.journeys && aiResult.journeys.length > 0) {
                    const uniqueJourneysMap = new Map();
                    
                    aiResult.journeys.forEach(j => {
                        // Avain koostuu ajasta ja reitistä (esim. "2026-07-15T09:00:00-Helsinki - Mikkeli")
                        const deduplicationKey = `${j.departure_time}-${j.route_info}`;
                        
                        if (!uniqueJourneysMap.has(deduplicationKey)) {
                            uniqueJourneysMap.set(deduplicationKey, j);
                        }
                    });
                    
                    const filteredJourneys = Array.from(uniqueJourneysMap.values());
                    
                    // Jos suodatuksen jälkeen jäljelle jää vain yksi matka (tekoäly oli luonut tuplia),
                    // korjataan tämän ainoan matkan hinta vastaamaan koko kuitin summaa.
                    if (filteredJourneys.length === 1 && aiResult.journeys.length > 1) {
                        console.log("[Sanity Check] Tekoäly loi haamumatkoja. Duplikaatit poistettu, hinta korjattu.");
                        filteredJourneys[0].price = aiResult.total_price;
                    }
                    
                    // Korvataan tekoälyn palauttama lista puhtaalla listalla
                    aiResult.journeys = filteredJourneys;
                }

                const firstJourney = (aiResult.journeys && aiResult.journeys.length > 0) ? aiResult.journeys[0] : null;
                
                let mainRouteInfo = "Tuntematon";
                if (isKorsisaari) {
                    mainRouteInfo = "Nurmijärvi - lähialue (Paikallisliikenne)";
                } else if (aiResult.journeys && aiResult.journeys.length > 1) {
                    mainRouteInfo = "Meno-paluu: Kaukoliikenne";
                } else if (firstJourney) {
                    mainRouteInfo = "Yhdensuuntainen: Kaukoliikenne";
                }

                // ==========================================
                // 3. TALLENNETAAN KUITTI
                // ==========================================
                const { data: insertedReceipt, error: insertError } = await supabase
                    .schema('espan')
                    .from('expert_ticket_receipts')
                    .insert([{
                        expert_id: EXPERT_ID,
                        status: 'pending',
                        email_received_at: emailReceivedAt.toISOString(),
                        departure_time: firstJourney ? firstJourney.departure_time : emailReceivedAt.toISOString(),
                        total_price: aiResult.total_price,
                        route_info: mainRouteInfo,
                        keywords: keywords,
                        bucket_file_url: bucketFileUrl,
                        ai_metadata: aiMetadata
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error("Virhe tietokantatallennuksessa:", insertError);
                } else if (insertedReceipt && aiResult.journeys && aiResult.journeys.length > 0) {
                    
                    // ==========================================
                    // 4. TALLENNETAAN MATKAT (Journeys) KUITIN ID:LLÄ!
                    // ==========================================
                    const journeyInserts = aiResult.journeys.map(j => ({
                        expert_id: EXPERT_ID,
                        receipt_id: insertedReceipt.id,
                        departure_time: j.departure_time,
                        route_info: j.route_info,
                        direction: j.direction,
                        price: j.price || 0.00
                    }));

                    const { error: journeyInsertError } = await supabase
                        .schema('espan')
                        .from('expert_journeys')
                        .insert(journeyInserts);

                    if (journeyInsertError) {
                        console.error("Virhe matkojen tallennuksessa:", journeyInsertError);
                    } else {
                        console.log(`✅ AI-analysoitu kuitti ja matkat tallennettu: ${mainRouteInfo} (${aiResult.total_price} €)`);
                        results.push({ subject, from: fromAddress, status: 'processed' });
                        newlyProcessedCount++; 
                    }
                }
            }

        } finally {
            lock.release();
        }

        await client.logout();

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Sähköpostien haku ja tekoälyjäsennys valmis.', 
                processedCount: results.length, 
                results 
            })
        };

    } catch (error) {
        console.error("Kriittinen virhe funktiossa:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};