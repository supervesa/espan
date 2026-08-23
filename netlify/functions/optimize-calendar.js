const { createClient } = require('@supabase/supabase-js');

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const extractDBDate = (dbString) => {
    if (!dbString) return '';
    return String(dbString).substring(0, 10);
};

const createSafeDate = (offsetDays = 0) => {
    const d = new Date();
    d.setHours(d.getHours() + 3); 
    d.setHours(12, 0, 0, 0); 
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

        let currentWeekStartObj = new Date();
        currentWeekStartObj.setHours(currentWeekStartObj.getHours() + 3);
        currentWeekStartObj.setHours(12, 0, 0, 0); 
        const dayOffset = currentWeekStartObj.getDay() === 0 ? -6 : 1 - currentWeekStartObj.getDay();
        currentWeekStartObj.setDate(currentWeekStartObj.getDate() + dayOffset); 

        const startDateStr = currentWeekStartObj.getFullYear() + '-' + String(currentWeekStartObj.getMonth() + 1).padStart(2, '0') + '-' + String(currentWeekStartObj.getDate()).padStart(2, '0');
        const endDateStr = createSafeDate(180);

        const fetchStartObj = new Date(currentWeekStartObj.getTime());
        fetchStartObj.setDate(fetchStartObj.getDate() - 2);
        const fetchStartStr = fetchStartObj.getFullYear() + '-' + String(fetchStartObj.getMonth() + 1).padStart(2, '0') + '-' + String(fetchStartObj.getDate()).padStart(2, '0');

        const [setRes, availRes, locRes, holRes, ledgerRes, planRes] = await Promise.all([
            supabase.schema('espan').from('expert_location_settings').select('*').in('expert_id', queryExpertIds),
            supabase.schema('espan').from('availability').select('start_time, is_blocked, meeting_type, contact_method').in('expert_id', queryExpertIds).gte('start_time', `${fetchStartStr} 00:00:00`),
            supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr),
            supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', fetchStartStr),
            supabase.schema('espan').from('expert_remote_bank_ledger').select('transaction_type').in('expert_id', queryExpertIds).gt('expiration_date', fetchStartStr),
            supabase.schema('espan').from('expert_journey_plans').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr)
        ]);

        const settingsList = setRes.data || [];
        const settings = settingsList.find(s => s.expert_id === expertId) || settingsList[0];
        if (!settings) return { statusCode: 404, body: 'Asetuksia ei löydy' };

        const availability = availRes.data || [];
        const existingLocations = locRes.data || [];
        const holidays = holRes.data || [];
        const ledger = ledgerRes.data || [];
        const existingPlans = planRes.data || [];

        let currentBalance = ledger.reduce((sum, row) => sum + row.transaction_type, 0);
        let carriedDeficit = 0; 
        
        let newLocations = [];
        let newJourneys = []; 
        let loopLimit = 0; 
        const limitStr = endDateStr;

        while (true) {
            loopLimit++;
            if (loopLimit > 20) break; 

            let cycleDays = [];

            for (let w = 0; w < 2; w++) {
                const weekStart = new Date(currentWeekStartObj);
                weekStart.setDate(weekStart.getDate() + (w * 7));
                const shouldBeOfficeThu = (Math.random() * 100) < settings.thursday_office_rate;

                for (let i = 0; i < 5; i++) {
                    let d = new Date(weekStart);
                    d.setDate(d.getDate() + i);
                    
                    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    const dayNum = d.getDate();
                    const dayOfWeek = i + 1; // 1=Ma, 5=Pe

                    let dayObj = { 
                        dateStr, dayOfWeek, weekIndex: w, dayNum, dateObj: new Date(d.getTime()),
                        type: 'eta', name: 'Etätyö', 
                        isUserLocked: false, isAnchor: false 
                    };

                    const existingLoc = existingLocations.find(l => l.date === dateStr);
                    const isUserManuallyLocked = existingLoc && !existingLoc.is_auto_generated;
                    const isPastOrToday = dateStr <= todayStr;

                    const prevDate = new Date(dayObj.dateObj);
                    prevDate.setDate(prevDate.getDate() - 1);
                    const prevStr = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0') + '-' + String(prevDate.getDate()).padStart(2, '0');
                    const hasTravelYesterday = existingPlans.some(p => p.date === prevStr) || newJourneys.some(p => p.date === prevStr);

                    if (dayOfWeek === 1 && hasTravelYesterday && !isUserManuallyLocked && !isPastOrToday) {
                        dayObj.type = 'lahityo';
                        dayObj.name = settings.primary_office_name;
                        dayObj.isAnchor = true;
                    }

                    if (isUserManuallyLocked || isPastOrToday) {
                        dayObj.isUserLocked = true;
                        if (existingLoc) {
                            dayObj.type = existingLoc.location_type;
                            dayObj.name = existingLoc.location_name;
                        } else if (isPastOrToday) {
                            dayObj.type = 'eta';
                            dayObj.name = 'Etätyö';
                        }
                        cycleDays.push(dayObj);
                        continue;
                    }

                    const isHoliday = holidays.some(h => extractDBDate(h.date || h.start_time) === dateStr);
                    if (isHoliday) {
                        dayObj.type = 'pyha';
                        dayObj.isUserLocked = true;
                        cycleDays.push(dayObj);
                        continue;
                    }

                    const dayAppts = availability.filter(a => extractDBDate(a.start_time) === dateStr);
                    const isPersonalBlocked = dayAppts.some(a => a.is_blocked && String(a.meeting_type).trim().toLowerCase() === 'estetty');
                    
                    if (isPersonalBlocked) {
                        dayObj.type = 'loma';
                        dayObj.isUserLocked = true;
                        cycleDays.push(dayObj);
                        continue;
                    }

                    const hasInPersonMeeting = dayAppts.some(a => a.contact_method === 'kaynti');
                    if (hasInPersonMeeting) {
                        dayObj.type = 'lahityo';
                        dayObj.name = (dayOfWeek === 4) ? settings.thursday_office_name : settings.primary_office_name;
                        dayObj.isAnchor = true;
                        cycleDays.push(dayObj);
                        continue;
                    }

                    if (!dayObj.isAnchor) {
                        dayObj.shouldBeOfficeThu = shouldBeOfficeThu;
                    }
                    cycleDays.push(dayObj);
                }
            }

            cycleDays.forEach(day => {
                if (day.isUserLocked || day.isAnchor || day.type === 'pyha' || day.type === 'loma') return;

                if (day.shouldBeOfficeThu) {
                    if (day.dayOfWeek === 1) day.type = 'eta';
                    else if (day.dayOfWeek === 2 || day.dayOfWeek === 3) { day.type = 'lahityo'; day.name = settings.primary_office_name; }
                    else if (day.dayOfWeek === 4) { day.type = 'lahityo'; day.name = settings.thursday_office_name; day.isAnchor = true; }
                    else if (day.dayOfWeek === 5) {
                        const isAllowedFriday = (day.dayNum <= 7) || (day.dayNum >= 15 && day.dayNum <= 21);
                        day.type = isAllowedFriday ? 'lahityo' : 'eta';
                        day.name = isAllowedFriday ? settings.primary_office_name : 'Etätyö';
                    }
                } else {
                    if (day.dayOfWeek === 1 || day.dayOfWeek === 4 || day.dayOfWeek === 5) day.type = 'eta'; 
                    else if (day.dayOfWeek === 2 || day.dayOfWeek === 3) { day.type = 'lahityo'; day.name = settings.primary_office_name; }
                }
            });

            const activeWorkingDays = cycleDays.filter(d => d.type !== 'pyha' && d.type !== 'loma').length;
            let targetOfficeDays = Math.ceil(activeWorkingDays * (settings.target_office_percent / 100)) + carriedDeficit;
            let currentOfficeDays = cycleDays.filter(d => d.type === 'lahityo').length;

            const hasManualLocks = cycleDays.some(d => d.isUserLocked);

            if (currentOfficeDays > targetOfficeDays) {
                cycleDays.forEach(day => {
                    if (currentOfficeDays <= targetOfficeDays || day.isUserLocked || day.isAnchor) return;
                    if ((day.dayOfWeek === 5 || day.dayOfWeek === 2) && day.type === 'lahityo') {
                        day.type = 'eta_kevennys'; day.name = '⚖️ Etätyö (Tasapainotus)';
                        currentOfficeDays--;
                    }
                });
            }

            if (currentOfficeDays < targetOfficeDays) {
                cycleDays.forEach(day => {
                    if (currentOfficeDays >= targetOfficeDays || day.isUserLocked || day.isAnchor) return;
                    if (day.dayOfWeek === 5 && day.shouldBeOfficeThu && day.type !== 'lahityo') {
                        day.type = 'lahityo'; day.name = settings.primary_office_name;
                        currentOfficeDays++;
                    }
                });
                if (hasManualLocks) carriedDeficit = 0;
                else carriedDeficit = currentOfficeDays < targetOfficeDays ? targetOfficeDays - currentOfficeDays : 0;
            } else {
                carriedDeficit = 0;
            }

            if (currentBalance > 0) {
                cycleDays.forEach((day, idx) => {
                    if (currentBalance <= 0 || day.isUserLocked || day.isAnchor) return;
                    if ((day.dayOfWeek === 2 || day.dayOfWeek === 4) && day.type === 'pyha') {
                        const targetIdx = day.dayOfWeek === 2 ? idx - 1 : idx + 1;
                        const targetDay = cycleDays[targetIdx];
                        if (targetDay && targetDay.type === 'lahityo' && !targetDay.isUserLocked && !targetDay.isAnchor) {
                            targetDay.type = 'eta_pankki'; targetDay.name = 'Ehdotus: Pankki-etä (Silta)';
                            currentBalance--;
                        }
                    }
                });
            }

            // =========================================================
            // KORJATTU NINJA-MATKOJEN LISÄYS: "Maanantai & Perjantai Säännöt"
            // Katkaisee kovan liitoksen viikonloppujen yli
            // =========================================================
            cycleDays.forEach((day, idx) => {
                if (day.type !== 'lahityo' || day.dateStr <= todayStr) return; 

                const prevDay = idx > 0 ? cycleDays[idx - 1] : null;
                const nextDay = idx < cycleDays.length - 1 ? cycleDays[idx + 1] : null;

                // TÄSSÄ ON KORJAUS: Maanantai on aina blokinalku, Perjantai on aina blokinloppu.
                const isStartOfBlock = !prevDay || prevDay.type !== 'lahityo' || day.dayOfWeek === 1;
                const isEndOfBlock = !nextDay || nextDay.type !== 'lahityo' || day.dayOfWeek === 5;

                const prevDate = new Date(day.dateObj);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevStr = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0') + '-' + String(prevDate.getDate()).padStart(2, '0');

                const hasTravelYesterday = existingPlans.some(p => p.date === prevStr) || newJourneys.some(p => p.date === prevStr);
                const hasTravelToday = existingPlans.some(p => p.date === day.dateStr) || newJourneys.some(p => p.date === day.dateStr);

                if (isStartOfBlock && !hasTravelYesterday && !hasTravelToday) {
                    newJourneys.push({ expert_id: expertId, date: day.dateStr });
                }

                const hasTravelAtEnd = existingPlans.some(p => p.date === day.dateStr) || newJourneys.some(p => p.date === day.dateStr);
                if (isEndOfBlock && !hasTravelAtEnd) {
                    newJourneys.push({ expert_id: expertId, date: day.dateStr });
                }
            });

            // LOKAATIOIDEN KOONTI KANTAA VARTEN
            cycleDays.forEach(day => {
                if (!day.isUserLocked) {
                    newLocations.push({ expert_id: expertId, date: day.dateStr, location_type: day.type, location_name: day.name, is_auto_generated: true });
                }
            });

            const cycleEndStr = cycleDays[cycleDays.length - 1].dateStr;
            if (cycleEndStr >= limitStr) break;

            currentWeekStartObj.setDate(currentWeekStartObj.getDate() + 14);
        }

        // TALLENNETAAN MOLEMMAT KANTAAN UPSERTILLA (NINJA TALLENNUS)
        if (newLocations.length > 0) {
            await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'unique_expert_date' });
        }
        if (newJourneys.length > 0) {
            await supabase.schema('espan').from('expert_journey_plans').upsert(newJourneys, { onConflict: 'expert_journey_plans_expert_id_date_key' });
        }

        return { 
            statusCode: 200, 
            headers: { "Access-Control-Allow-Origin": "*" }, 
            body: JSON.stringify({ success: true, message: 'Optimoitu! Lokaatiot ja matkat luotu ninjana.' }) 
        };

    } catch (error) {
        console.error('Optimointi Error:', error);
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: 'Internal Server Error' };
    }
};