const { createClient } = require('@supabase/supabase-js');
const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const extractDBDate = (dbString) => {
    if (!dbString) return '';
    return String(dbString).substring(0, 10);
};

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: 'OK' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const body = JSON.parse(event.body);
        const expertId = body.expert_id;
        if (!expertId) return { statusCode: 400, body: 'Missing expert_id' };
        
        const queryExpertIds = [expertId, LEGACY_ID];

        // Haetaan kalenteri puolesta vuodesta eteenpäin (Tänään -> +6kk)
        let safeTodayObj = new Date();
        safeTodayObj.setHours(safeTodayObj.getHours() + 3);
        const todayStr = safeTodayObj.getFullYear() + '-' + String(safeTodayObj.getMonth() + 1).padStart(2, '0') + '-' + String(safeTodayObj.getDate()).padStart(2, '0');

        const fetchStartObj = new Date(safeTodayObj.getTime());
        fetchStartObj.setDate(fetchStartObj.getDate() - 2);
        const fetchStartStr = fetchStartObj.getFullYear() + '-' + String(fetchStartObj.getMonth() + 1).padStart(2, '0') + '-' + String(fetchStartObj.getDate()).padStart(2, '0');

        // Haetaan vain logistiikan kannalta oleelliset datat
        const [locRes, planRes, journeyRes] = await Promise.all([
            supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr).order('date'),
            supabase.schema('espan').from('expert_journey_plans').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr),
            supabase.schema('espan').from('expert_journeys').select('departure_time').in('expert_id', queryExpertIds).gte('departure_time', fetchStartStr)
        ]);

        const locations = locRes.data || [];
        const existingPlans = planRes.data || [];
        const existingJourneys = journeyRes.data || [];

        let newJourneys = [];

        for (let i = 0; i < locations.length; i++) {
            const loc = locations[i];
            
            // Jätetään menneisyys rauhaan
            if (loc.date <= todayStr) continue;

            const isOffice = loc.location_type === 'lahityo' || loc.location_type === 'sisatyot_lahityo';
            if (!isOffice) continue;

            const d = new Date(loc.date);
            const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1=Ma, 7=Su

            // Etsitään looginen eilinen ja huominen päivämäärä
            const prevDateObj = new Date(d);
            prevDateObj.setDate(prevDateObj.getDate() - 1);
            const prevStr = prevDateObj.toISOString().split('T')[0];
            const prevLoc = locations.find(l => l.date === prevStr);

            const nextDateObj = new Date(d);
            nextDateObj.setDate(nextDateObj.getDate() + 1);
            const nextStr = nextDateObj.toISOString().split('T')[0];
            const nextLoc = locations.find(l => l.date === nextStr);

            // ANKKURISÄÄNNÖT: Jos eilen ei ollut toimistoa, tai on Maanantai -> Putki alkaa.
            const isStartOfBlock = dayOfWeek === 1 || !prevLoc || !['lahityo', 'sisatyot_lahityo'].includes(prevLoc.location_type);
            const isEndOfBlock = dayOfWeek === 5 || !nextLoc || !['lahityo', 'sisatyot_lahityo'].includes(nextLoc.location_type);

            const hasTravelYesterday = existingPlans.some(p => p.date === prevStr) || existingJourneys.some(j => extractDBDate(j.departure_time) === prevStr) || newJourneys.some(nj => nj.date === prevStr);
            const hasTravelToday = existingPlans.some(p => p.date === loc.date) || existingJourneys.some(j => extractDBDate(j.departure_time) === loc.date) || newJourneys.some(nj => nj.date === loc.date);

            // AAMUMATKA (Putken alku)
            if (isStartOfBlock && !hasTravelYesterday && !hasTravelToday) {
                newJourneys.push({ expert_id: expertId, date: loc.date });
            }

            // ILTAMATKA (Putken loppu) - Varotaan lisäämästä toista junaa yksittäispäiville (Unique Date Constraint!)
            const hasTravelAtEnd = existingPlans.some(p => p.date === loc.date) || existingJourneys.some(j => extractDBDate(j.departure_time) === loc.date) || newJourneys.some(nj => nj.date === loc.date);

            if (isEndOfBlock && !hasTravelAtEnd) {
                newJourneys.push({ expert_id: expertId, date: loc.date });
            }
        }

        // TALLENNETAAN PELKÄT MATKAT
        if (newJourneys.length > 0) {
            const { error: journeyError } = await supabase.schema('espan').from('expert_journey_plans').upsert(newJourneys, { onConflict: 'expert_journey_plans_expert_id_date_key' });
            if (journeyError) console.error("CRON Matkavirhe:", journeyError);
        }

        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, message: 'Logistiikka piirsi junat kohdilleen!' }) };

    } catch (error) {
        console.error('Optimointi Error:', error);
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: 'Internal Server Error' };
    }
};