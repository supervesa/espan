import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
// HUOM: AI-parseria ei enää importata täällä!

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // SIIRRETTY TÄNNE: Alustetaan Supabase vasta kun funktiota kutsutaan.
    // Tämä korjaa Netlifyn "supabaseKey is required" -virheen lopullisesti!
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Käynnistetään sähköpostien nopea haku (ilman tekoälyä)...");

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

            // Voidaan nyt nostaa rajaa, koska AI ei hidasta prosessia
            const MAX_NEW_TICKETS_PER_RUN = 10; 
            let newlyProcessedCount = 0;

            for (const uid of targetMessages) {
                if (newlyProcessedCount >= MAX_NEW_TICKETS_PER_RUN) {
                    console.log(` Saavutettiin eräajon maksimiraja. Katkaistaan luuppi.`);
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

                // TUPLIEN ESTO
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

                // Muistutusten suodatus (OnniBus)
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

                // TÄSSÄ KOHTAA EI ENÄÄ KUTSUTA TEKOÄLYÄ!
                // Valmistellaan vain placeholder-tiedot kantaan.

                let keywords = [providerPrefix];
                if (isVR) keywords.push('juna');
                if (isOnni || isKorsisaari) keywords.push('bussi', 'linja-auto');
                if (isKorsisaari) keywords.push('paikallisliikenne', 'klaukkala');

                const { error: insertError } = await supabase
                    .schema('espan')
                    .from('expert_ticket_receipts')
                    .insert([{
                        expert_id: EXPERT_ID,
                        status: 'pending',
                        email_received_at: emailReceivedAt.toISOString(),
                        departure_time: emailReceivedAt.toISOString(), // Placeholder-aika
                        total_price: 0, // Placeholder-hinta
                        route_info: "Odottaa AI-analyysia...", 
                        keywords: keywords,
                        bucket_file_url: bucketFileUrl,
                        ai_metadata: null // Jätetään tyhjäksi, jotta UI osaa näyttää latausnapin
                    }]);

                if (insertError) {
                    console.error("Virhe tietokantatallennuksessa:", insertError);
                } else {
                    console.log(`✅ Kuitti haettu ja tallennettu jonoon: ${subject}`);
                    results.push({ subject, from: fromAddress, status: 'processed' });
                    newlyProcessedCount++; 
                }
            }

        } finally {
            lock.release();
        }

        await client.logout();

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Sähköpostien haku valmis.', 
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