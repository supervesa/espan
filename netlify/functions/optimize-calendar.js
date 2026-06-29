// netlify/functions/optimize-calendar.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const body = JSON.parse(event.body);
        const expertId = body.expert_id;

        if (!expertId) return { statusCode: 400, body: 'Missing expert_id' };

        const { data: settings } = await supabase.schema('espan').from('expert_location_settings').select('*').eq('expert_id', expertId).single();
        if (!settings) return { statusCode: 404, body: 'Asetuksia ei löydy' };

        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 105); // 3,5 kk horisontti
        
        const startDateStr = today.toISOString().split('T')[0];

        // Haetaan varaukset (sisältäen kontaktimenetelmät) sekä käyttäjän omat lukitukset
        const { data: availability } = await supabase.schema('espan').from('availability')
            .select('start_time, is_blocked, meeting_type, contact_method').eq('expert_id', expertId).gte('start_time', `${startDateStr} 00:00:00`);
        
        const { data: existingLocations } = await supabase.schema('espan').from('expert_daily_locations')
            .select('*').eq('expert_id', expertId).gte('date', startDateStr);

        let newLocations = [];

        // Etsitään kuluvan viikon maanantai
        let currentWeekStart = new Date(today);
        const dayOffset = currentWeekStart.getDay() === 0 ? -6 : 1 - currentWeekStart.getDay();
        currentWeekStart.setDate(currentWeekStart.getDate() + dayOffset); 

        while (currentWeekStart < endDate) {
            
            // Päätetään torstain ihannerytmin tila kerralla koko viikolle
            const shouldBeOfficeThu = (Math.random() * 100) < settings.thursday_office_rate;
            
            for (let i = 0; i < 5; i++) {
                let d = new Date(currentWeekStart);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayNum = d.getDate();
                const dayOfWeek = i + 1; // 1=Ma, 2=Ti, 3=Ke, 4=To, 5=Pe

                // 1. SUOJA: Tarkistetaan asiantuntijan käsin lukitsema sijainti
                const lockedLoc = existingLocations?.find(l => l.date === dateStr && !l.is_auto_generated);
                if (lockedLoc) continue; 

                // 2. SUOJA: Haetaan päivän varaukset availability-taulusta
                const dayAppts = availability?.filter(a => a.start_time.startsWith(dateStr)) || [];
                
                // KOLMAS TILA (Loma/Este): Poistetaan haamurivit ja ylikirjoitetaan päivä selkeästi lomaksi
                const isHoliday = dayAppts.some(a => a.is_blocked && a.meeting_type === 'estetty');
                if (isHoliday) {
                    newLocations.push({ 
                        expert_id: expertId, 
                        date: dateStr, 
                        location_type: 'loma', 
                        location_name: 'Loma/Este', 
                        is_auto_generated: true 
                    });
                    continue; 
                }

                // Tarkistetaan, onko päivälle merkitty yhtäkään kasvokkaista asiakastapaamista (kaynti)
                const hasInPersonMeeting = dayAppts.some(a => a.contact_method === 'kaynti');

                let assignedType = 'eta';
                let assignedName = 'Etätyö';

                // 3. LOGIIKKAHIERARKIA: Asiakasankkuri vs. Runkosäännöt
                if (hasInPersonMeeting) {
                    // ASIAKASANKKURI: Kasvokkainen tapaaminen pakottaa aina lähityön
                    assignedType = 'lahityo';
                    // Torstaisin suuntana on aina Viipurinkatu, muina arkipäivinä Malminkatu
                    assignedName = (dayOfWeek === 4) ? settings.thursday_office_name : settings.primary_office_name;
                } else {
                    // RUNKOSÄÄNNÖT (Pelkät puhelut tai tyhjät päivät noudattavat perusrytmiä)
                    if (dayOfWeek === 1) {
                        assignedType = 'eta';
                    } 
                    else if (dayOfWeek === 2 || dayOfWeek === 3) {
                        assignedType = 'lahityo';
                        assignedName = settings.primary_office_name;
                    } 
                    else if (dayOfWeek === 4) {
                        if (shouldBeOfficeThu) {
                            assignedType = 'lahityo';
                            assignedName = settings.thursday_office_name;
                        } else {
                            assignedType = 'eta';
                        }
                    } 
                    else if (dayOfWeek === 5) {
                        const isAllowedFriday = (dayNum <= 7) || (dayNum >= 15 && dayNum <= 21);
                        // Perjantai on lähityötä vain jos ihannetorstai oli läsnä JA on kuukauden 1. tai 3. viikko
                        if (shouldBeOfficeThu && isAllowedFriday) {
                            assignedType = 'lahityo';
                            assignedName = settings.primary_office_name;
                        } else {
                            assignedType = 'eta';
                        }
                    }
                }

                newLocations.push({ 
                    expert_id: expertId, 
                    date: dateStr, 
                    location_type: assignedType, 
                    location_name: assignedName, 
                    is_auto_generated: true 
                });
            }

            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }

        // Tallennetaan ehdotukset tietokantaan (ylikirjoittaa vanhat is_auto_generated -rivit)
        if (newLocations.length > 0) {
            await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'expert_id, date' });
        }

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Kalenteri optimoitu asiantuntijan runko- ja ankkurisäännöillä' }) };

    } catch (error) {
        console.error('Optimointi Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};