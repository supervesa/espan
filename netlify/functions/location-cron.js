const { schedule } = require('@netlify/functions');
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

const handler = async (event, context) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log("CRON: Aloitetaan asiantuntijoiden Master 2.0 optimointi (Sis. Ninja-matkat)...");

        const { data: expertsSettings, error: settingsError } = await supabase.schema('espan').from('expert_location_settings').select('*');
        if (settingsError) throw settingsError;
        if (!expertsSettings || expertsSettings.length === 0) return { statusCode: 200, body: 'No experts' };

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

        const { data: holidays } = await supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', fetchStartStr).lte('date', endDateStr);
        const holidayList = holidays || [];

        for (const settings of expertsSettings) {
            const expertId = settings.expert_id;
            if (expertId === LEGACY_ID) continue;
            
            const queryExpertIds = [expertId, LEGACY_ID];

            const [availRes, locRes, ledgerRes, planRes] = await Promise.all([
                supabase.schema('espan').from('availability').select('start_time, is_blocked, meeting_type, contact_method').in('expert_id', queryExpertIds).gte('start_time', `${fetchStartStr} 00:00:00`),
                supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr),
                supabase.schema('espan').from('expert_remote_bank_ledger').select('transaction_type').in('expert_id', queryExpertIds).gt('expiration_date', fetchStartStr),
                supabase.schema('espan').from('expert_journey_plans').select('*').in('expert_id', queryExpertIds).gte('date', fetchStartStr)
            ]);

            const availability = availRes.data || [];
            const existingLocations = locRes.data || [];
            const ledger = ledgerRes.data || [];
            const existingPlans = planRes.data || [];

            let currentBalance = ledger.reduce((sum, row) => sum + row.transaction_type, 0);
            let carriedDeficit = 0; 
            let newLocations = [];
            let newJourneys = [];
            let iterWeekStart = new Date(currentWeekStartObj.getTime());
            let loopLimit = 0;

            while (true) {
                loopLimit++;
                if (loopLimit > 20) break;

                let cycleDays = [];

                for (let w = 0; w < 2; w++) {
                    const weekStart = new Date(iterWeekStart);
                    weekStart.setDate(weekStart.getDate() + (w * 7));
                    const shouldBeOfficeThu = (Math.random() * 100) < settings.thursday_office_rate;

                    for (let i = 0; i < 5; i++) {
                        let d = new Date(weekStart);
                        d.setDate(d.getDate() + i);
                        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        
                        let dayObj = { 
                            dateStr, dayOfWeek: i + 1, weekIndex: w, dayNum: d.getDate(), dateObj: new Date(d.getTime()),
                            type: 'eta', name: 'Etätyö', 
                            isUserLocked: false, isAnchor: false 
                        };

                        const existingLoc = existingLocations.find(l => l.date === dateStr);
                        const isUserManuallyLocked = existingLoc && !existingLoc.is_auto_generated;

                        const prevDate = new Date(dayObj.dateObj);
                        prevDate.setDate(prevDate.getDate() - 1);
                        const prevStr = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0') + '-' + String(prevDate.getDate()).padStart(2, '0');
                        const hasTravelYesterday = existingPlans.some(p => p.date === prevStr) || newJourneys.some(p => p.date === prevStr);

                        if (dayObj.dayOfWeek === 1 && hasTravelYesterday && !isUserManuallyLocked && dateStr > todayStr) {
                            dayObj.type = 'lahityo'; dayObj.name = settings.primary_office_name; dayObj.isAnchor = true;
                        }

                        if (isUserManuallyLocked || dateStr <= todayStr) {
                            dayObj.isUserLocked = true; 
                            if (existingLoc) { dayObj.type = existingLoc.location_type; dayObj.name = existingLoc.location_name; }
                            cycleDays.push(dayObj);
                            continue;
                        }

                        const isHoliday = holidays.some(h => extractDBDate(h.date || h.start_time) === dateStr);
                        if (isHoliday) { dayObj.type = 'pyha'; dayObj.isUserLocked = true; cycleDays.push(dayObj); continue; }

                        const dayAppts = availability.filter(a => extractDBDate(a.start_time) === dateStr);
                        if (dayAppts.some(a => a.is_blocked && String(a.meeting_type).trim().toLowerCase() === 'estetty')) {
                            dayObj.type = 'loma'; dayObj.isUserLocked = true; cycleDays.push(dayObj); continue;
                        }

                        if (dayAppts.some(a => a.contact_method === 'kaynti')) {
                            dayObj.type = 'lahityo'; dayObj.name = (dayObj.dayOfWeek === 4) ? settings.thursday_office_name : settings.primary_office_name; dayObj.isAnchor = true; cycleDays.push(dayObj); continue;
                        }

                        if (!dayObj.isAnchor) dayObj.shouldBeOfficeThu = shouldBeOfficeThu;
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
                        if ((day.dayOfWeek === 5 || day.dayOfWeek === 2) && day.type === 'lahityo') { day.type = 'eta_kevennys'; day.name = '⚖️ Etätyö (Tasapainotus)'; currentOfficeDays--; }
                    });
                }

                if (currentOfficeDays < targetOfficeDays) {
                    cycleDays.forEach(day => {
                        if (currentOfficeDays >= targetOfficeDays || day.isUserLocked || day.isAnchor) return;
                        if (day.dayOfWeek === 5 && day.shouldBeOfficeThu && day.type !== 'lahityo') { day.type = 'lahityo'; day.name = settings.primary_office_name; currentOfficeDays++; }
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
                // KORJATTU NINJA-MATKAT (Viikonlopun katkaisu säännöillä)
                // =========================================================
                cycleDays.forEach((day, idx) => {
                    if (day.type !== 'lahityo' || day.dateStr <= todayStr) return; 

                    const prevDay = idx > 0 ? cycleDays[idx - 1] : null;
                    const nextDay = idx < cycleDays.length - 1 ? cycleDays[idx + 1] : null;

                    // Katkaistaan "ikuiset putket" Maanantaihin ja Perjantaihin!
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

                cycleDays.forEach(day => {
                    if (!day.isUserLocked) {
                        newLocations.push({ expert_id: expertId, date: day.dateStr, location_type: day.type, location_name: day.name, is_auto_generated: true });
                    }
                });

                const cycleEndStr = cycleDays[cycleDays.length - 1].dateStr;
                if (cycleEndStr >= limitStr) break;

                currentWeekStartObj.setDate(currentWeekStartObj.getDate() + 14);
            }

            if (newLocations.length > 0) {
                await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'unique_expert_date' });
            }
            if (newJourneys.length > 0) {
                await supabase.schema('espan').from('expert_journey_plans').upsert(newJourneys, { onConflict: 'expert_journey_plans_expert_id_date_key' });
            }
        }

        return { statusCode: 200, body: 'Schedule optimized successfully' };

    } catch (error) {
        console.error('CRON Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};

exports.handler = schedule("@daily", handler);