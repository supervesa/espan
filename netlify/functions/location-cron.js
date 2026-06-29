// netlify/functions/location-cron.js
const { schedule } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');

const handler = async (event, context) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log("CRON: Aloitetaan asiantuntijoiden kalenterien optimointi...");

        // 1. Haetaan kaikkien asiantuntijoiden asetukset
        const { data: expertsSettings, error: settingsError } = await supabase.schema('espan').from('expert_location_settings').select('*');
        
        if (settingsError) throw settingsError;
        if (!expertsSettings || expertsSettings.length === 0) {
            console.log("CRON: Ei asiantuntijoita, joille ajaa optimointi.");
            return { statusCode: 200, body: 'No experts found' };
        }

        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 105); // 15 viikon (3,5 kk) horisontti
        
        const startDateStr = today.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Käsitellään jokainen asiantuntija erikseen
        for (const settings of expertsSettings) {
            const expertId = settings.expert_id;
            console.log(`CRON: Käsitellään asiantuntija: ${expertId}`);

            // 2. Haetaan varaukset (sis. kontaktimenetelmän) ja käyttäjän omat lukitukset tälle asiantuntijalle
            const { data: availability } = await supabase.schema('espan').from('availability')
                .select('start_time, is_blocked, meeting_type, contact_method')
                .eq('expert_id', expertId)
                .gte('start_time', `${startDateStr} 00:00:00`)
                .lte('start_time', `${endDateStr} 23:59:59`);
            
            const { data: existingLocations } = await supabase.schema('espan').from('expert_daily_locations')
                .select('*')
                .eq('expert_id', expertId)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            let newLocations = [];

            // 3. Etsitään kuluvan viikon maanantai
            let currentWeekStart = new Date(today);
            const dayOffset = currentWeekStart.getDay() === 0 ? -6 : 1 - currentWeekStart.getDay();
            currentWeekStart.setDate(currentWeekStart.getDate() + dayOffset); 

            // Kelataan viikko kerrallaan eteenpäin
            while (currentWeekStart < endDate) {
                
                // Arvotaan torstain ankkuri kerran koko viikolle ohjausprosentin mukaan
                const shouldBeOfficeThu = (Math.random() * 100) < settings.thursday_office_rate;
                
                for (let i = 0; i < 5; i++) {
                    let d = new Date(currentWeekStart);
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toISOString().split('T')[0];
                    const dayNum = d.getDate();
                    const dayOfWeek = i + 1; // 1=Ma, 2=Ti, 3=Ke, 4=To, 5=Pe

                    // SUOJA 1: Käyttäjän käsin lukitsema sijainti ohitetaan
                    const lockedLoc = existingLocations?.find(l => l.date === dateStr && !l.is_auto_generated);
                    if (lockedLoc) continue; 

                    // SUOJA 2: Lomat ja varaukset
                    const dayAppts = availability?.filter(a => a.start_time.startsWith(dateStr)) || [];
                    
                    // Koko päivän loma tekee vain reiän, siirrytään suoraan seuraavaan päivään (Nollavelka)
                    const isHoliday = dayAppts.some(a => a.is_blocked && a.meeting_type === 'estetty');
                    if (isHoliday) continue; 

                    // ASIAKASANKKURI: Onko päivällä yhtään kasvokkaista asiakastapaamista?
                    const hasInPersonMeeting = dayAppts.some(a => a.contact_method === 'kaynti');

                    let assignedType = 'eta';
                    let assignedName = 'Etätyö';

                    // LOGIIKKAHIERARKIA
                    if (hasInPersonMeeting) {
                        // 1. Asiakasankkuri: Pakottaa lähityön. Torstai -> Viipuri, muut päivät -> Malmi.
                        assignedType = 'lahityo';
                        assignedName = (dayOfWeek === 4) ? settings.thursday_office_name : settings.primary_office_name;
                    } else {
                        // 2. Normaali runkorytmi (koskee tyhjiä päiviä tai päiviä, joilla on pelkkiä puheluita)
                        if (dayOfWeek === 1) {
                            // Maanantai on aina etä
                            assignedType = 'eta';
                        } 
                        else if (dayOfWeek === 2 || dayOfWeek === 3) {
                            // Tiistai ja keskiviikko ovat aina ydinblokki
                            assignedType = 'lahityo';
                            assignedName = settings.primary_office_name;
                        } 
                        else if (dayOfWeek === 4) {
                            // Torstai ohjautuu viikon arvonnan mukaan
                            if (shouldBeOfficeThu) {
                                assignedType = 'lahityo';
                                assignedName = settings.thursday_office_name;
                            } else {
                                assignedType = 'eta';
                            }
                        } 
                        else if (dayOfWeek === 5) {
                            // Perjantain joustosääntö
                            const isAllowedFriday = (dayNum <= 7) || (dayNum >= 15 && dayNum <= 21);
                            // Läsnäolo sallitaan VAIN jos torstai oli läsnä JA viikko on sallittu
                            if (shouldBeOfficeThu && isAllowedFriday) {
                                assignedType = 'lahityo';
                                assignedName = settings.primary_office_name;
                            } else {
                                assignedType = 'eta';
                            }
                        }
                    }

                    // Lisätään ehdotus tallennuslistaan
                    newLocations.push({ 
                        expert_id: expertId, 
                        date: dateStr, 
                        location_type: assignedType, 
                        location_name: assignedName, 
                        is_auto_generated: true 
                    });
                }

                currentWeekStart.setDate(currentWeekStart.getDate() + 7); // Siirrytään seuraavaan viikkoon
            }

            // 4. Tallennetaan generoitu data kantaan UPSERT-komennolla (päivittää vain muuttuneet automaattirivit)
            if (newLocations.length > 0) {
                const { error: upsertError } = await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'expert_id, date' });
                
                if (upsertError) {
                    console.error(`CRON: Virhe tallennettaessa asiantuntijalle ${expertId}:`, upsertError);
                } else {
                    console.log(`CRON: Asiantuntijan ${expertId} kalenteri tallennettu.`);
                }
            }
        }

        console.log("CRON: Kaikki asiantuntijat optimoitu onnistuneesti!");
        return { statusCode: 200, body: 'Schedule optimized' };

    } catch (error) {
        console.error('CRON Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};

// Netlify Cron-määritys: Ajetaan kerran päivässä (keskiyöllä UTC)
exports.handler = schedule("@daily", handler);