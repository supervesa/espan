// netlify/functions/sync-holidays.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;

        // Haetaan Suomen (FI) pyhät tälle ja seuraavalle vuodelle Nager.Date API:sta
        const [resCurrent, resNext] = await Promise.all([
            fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/FI`),
            fetch(`https://date.nager.at/api/v3/PublicHolidays/${nextYear}/FI`)
        ]);

        if (!resCurrent.ok || !resNext.ok) {
            throw new Error('Virhe pyhäpäivien haussa ulkoisesta rajapinnasta.');
        }

        const dataCurrent = await resCurrent.json();
        const dataNext = await resNext.json();
        const allHolidays = [...dataCurrent, ...dataNext];

        // Muotoillaan data Supabase-taulun mukaiseksi
        const holidaysToInsert = allHolidays.map(h => ({
            date: h.date,
            name: h.localName // Esim. "Vappu", "Juhannuspäivä"
        }));

        // Tallennetaan kantaan (upsert päivittää olemassa olevat päivämäärät)
        const { error } = await supabase
            .schema('espan')
            .from('national_holidays_cache')
            .upsert(holidaysToInsert, { onConflict: 'date' });

        if (error) throw error;

        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                success: true, 
                message: `${holidaysToInsert.length} pyhäpäivää synkronoitu tietokantaan.` 
            }) 
        };

    } catch (error) {
        console.error('Holiday Sync Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};