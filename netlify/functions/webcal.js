// netlify/functions/webcal.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // 1. Otetaan expert_id URL-osoitteesta
    const expert_id = event.queryStringParameters.expert_id;

    if (!expert_id) {
        return { statusCode: 400, body: 'Missing expert_id' };
    }

    // 2. Yhdistetään Supabaseen (Netlifyn ympäristömuuttujien kautta)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, body: 'Database configuration missing' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 3. Haetaan sijainnit tietokannasta (otetaan esim. kuukausi taaksepäin ja puoli vuotta eteenpäin)
        const today = new Date();
        today.setDate(today.getDate() - 30);
        const queryStart = today.toISOString().split('T')[0];

        const { data, error } = await supabase
            .schema('espan')
            .from('expert_daily_locations')
            .select('*')
            .eq('expert_id', expert_id)
            .gte('date', queryStart);

        if (error) throw error;

        // 4. Luodaan .ics -kalenterin ylätunniste
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Espan//Tyopisteet//FI',
            'CALSCALE:GREGORIAN',
            'X-WR-CALNAME:Työpisteet (Espan)',
            'X-APPLE-CALENDAR-COLOR:#FF6B00'
        ];

        // 5. Muutetaan tietokantarivit kalenteritapahtumiksi (Koko päivän tapahtumat)
        (data || []).forEach(loc => {
            // Muutetaan "2026-10-06" muotoon "20261006"
            const dateStr = loc.date.replace(/-/g, '');
            
            // Koko päivän tapahtuma tarvitsee seuraavan päivän DTEND-arvoksi
            const d = new Date(loc.date);
            d.setDate(d.getDate() + 1);
            const nextDateStr = d.toISOString().split('T')[0].replace(/-/g, '');

            const icon = loc.location_type === 'eta' ? '🏠' : '🏢';
            const summary = `${icon} ${loc.location_name}`;

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:${loc.id}@espan.app`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                `DTSTART;VALUE=DATE:${dateStr}`,
                `DTEND;VALUE=DATE:${nextDateStr}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:Asiantuntijan työskentelypaikka: ${loc.location_name}`,
                'END:VEVENT'
            );
        });

        // 6. Suljetaan kalenteri
        icsContent.push('END:VCALENDAR');

        // 7. Palautetaan tiedosto selaimelle/kalenterisovellukselle oikeilla headereilla
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="tyopisteet.ics"',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: icsContent.join('\r\n')
        };

    } catch (error) {
        console.error('WebCAL Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};