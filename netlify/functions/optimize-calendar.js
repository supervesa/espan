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

        let safeTodayObj = new Date();
        safeTodayObj.setHours(safeTodayObj.getHours() + 3);
        const todayStr = safeTodayObj.getFullYear() + '-' + String(safeTodayObj.getMonth() + 1).padStart(2, '0') + '-' + String(safeTodayObj.getDate()).padStart(2, '0');

        const [locRes, planRes, journeyRes] = await Promise.all([
            supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gt('date', todayStr).order('date'),
            supabase.schema('espan').from('expert_journey_plans').select('*').in('expert_id', queryExpertIds).gt('date', todayStr),
            supabase.schema('espan').from('expert_journeys').select('departure_time').in('expert_id', queryExpertIds).gt('departure_time', todayStr)
        ]);

        const locations = locRes.data || [];
        const existingPlans = planRes.data || [];
        const existingJourneys = journeyRes.data || [];

        let newJourneys = [];

        for (let i = 0; i < locations.length; i++) {
            const loc = locations[i];
            const isOffice = loc.location_type === 'lahityo' || loc.location_type === 'sisatyot_lahityo';
            if (!isOffice) continue;

            const d = new Date(loc.date);
            const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); 

            const prevLoc = i > 0 ? locations[i - 1] : null;
            const nextLoc = i < locations.length - 1 ? locations[i + 1] : null;

            // Ankkurit katkaistaan viikonloppuun (Ma alkaa, Pe loppuu!)
            const isStartOfBlock = !prevLoc || (prevLoc.location_type !== 'lahityo' && prevLoc.location_type !== 'sisatyot_lahityo') || dayOfWeek === 1;
            const isEndOfBlock = !nextLoc || (nextLoc.location_type !== 'lahityo' && nextLoc.location_type !== 'sisatyot_lahityo') || dayOfWeek === 5;

            const hasTravelToday = existingPlans.some(p => p.date === loc.date) || 
                                   existingJourneys.some(j => extractDBDate(j.departure_time) === loc.date) ||
                                   newJourneys.some(nj => nj.date === loc.date);
            
            const prevDate = new Date(d);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevStr = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0') + '-' + String(prevDate.getDate()).padStart(2, '0');
            const hasTravelYesterday = existingPlans.some(p => p.date === prevStr) || existingJourneys.some(j => extractDBDate(j.departure_time) === prevStr);

            if (isStartOfBlock && !hasTravelToday && !hasTravelYesterday) {
                newJourneys.push({ expert_id: expertId, date: loc.date });
            }

            const hasTravelAtEnd = existingPlans.some(p => p.date === loc.date) || 
                                   existingJourneys.some(j => extractDBDate(j.departure_time) === loc.date) ||
                                   newJourneys.some(nj => nj.date === loc.date);

            if (isEndOfBlock && !hasTravelAtEnd) {
                newJourneys.push({ expert_id: expertId, date: loc.date });
            }
        }

        if (newJourneys.length > 0) {
            await supabase.schema('espan').from('expert_journey_plans').upsert(newJourneys, { onConflict: 'expert_journey_plans_expert_id_date_key' });
        }

        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, message: 'Matkat luotu sijaintien perusteella!' }) };

    } catch (error) {
        console.error('Optimointi Error:', error);
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: 'Internal Server Error' };
    }
};