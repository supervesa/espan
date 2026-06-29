// netlify/functions/location-cron.js
const { schedule } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');

const handler = async (event, context) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log("CRON: Aloitetaan asiantuntijoiden Master 2.0 -kalenterien optimointi...");

        // 1. Haetaan kaikkien asiantuntijoiden asetukset
        const { data: expertsSettings, error: settingsError } = await supabase.schema('espan').from('expert_location_settings').select('*');
        
        if (settingsError) throw settingsError;
        if (!expertsSettings || expertsSettings.length === 0) {
            console.log("CRON: Ei asiantuntijoita, joille ajaa optimointi.");
            return { statusCode: 200, body: 'No experts found' };
        }

        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 105); // 3,5 kk horisontti
        
        const startDateStr = today.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // 2. PORTINVARTIJA-DATA: Haetaan kansalliset pyhäpäivät kerralla yhteisesti kaikille asiantuntijoille
        const { data: holidays } = await supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', startDateStr).lte('date', endDateStr);
        const holidayList = holidays || [];

        // Käsitellään jokainen asiantuntija erikseen omassa 2 viikon syklitoteutuksessaan
        for (const settings of expertsSettings) {
            const expertId = settings.expert_id;
            console.log(`CRON: Käsitellään asiantuntija: ${expertId}`);

            // Haetaan asiantuntijan omat varaukset, lukitukset ja etäpäiväpankin tilanne
            const [availRes, locRes, ledgerRes] = await Promise.all([
                supabase.schema('espan').from('availability').select('start_time, is_blocked, meeting_type, contact_method').eq('expert_id', expertId).gte('start_time', `${startDateStr} 00:00:00`).lte('start_time', `${endDateStr} 23:59:59`),
                supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', expertId).gte('date', startDateStr).lte('date', endDateStr),
                supabase.schema('espan').from('expert_remote_bank_ledger').select('transaction_type').eq('expert_id', expertId).gt('expiration_date', startDateStr)
            ]);

            const availability = availRes.data || [];
            const existingLocations = locRes.data || [];
            const ledger = ledgerRes.data || [];

            // Etäpäiväpankin premium-saldo ja syklirullaava vajaussaldo (Deficit)
            let currentBalance = ledger.reduce((sum, row) => sum + row.transaction_type, 0);
            let carriedDeficit = 0; 
            let newLocations = [];

            // Etsitään kuluvan viikon maanantai viikko- ja syklitason analyysiä varten
            let currentWeekStart = new Date(today);
            const dayOffset = currentWeekStart.getDay() === 0 ? -6 : 1 - currentWeekStart.getDay();
            currentWeekStart.setDate(currentWeekStart.getDate() + dayOffset); 

            // PYÖRITETÄÄN AS_ASIANTUNTIJAN KALENTERIA KIINTEISSÄ 2 VIIKON (14 PV) SYKLEISSÄ
            while (currentWeekStart < endDate) {
                let cycleDays = [];

                // Luodaan kahden viikon (10 työpäivän) jaksolohko
                for (let w = 0; w < 2; w++) {
                    const weekStart = new Date(currentWeekStart);
                    weekStart.setDate(weekStart.getDate() + (w * 7));
                    
                    // Arvotaan kyseisen viikon torstain ihannetila runkosäännön mukaan
                    const shouldBeOfficeThu = (Math.random() * 100) < settings.thursday_office_rate;

                    for (let i = 0; i < 5; i++) {
                        let d = new Date(weekStart);
                        d.setDate(d.getDate() + i);
                        const dateStr = d.toISOString().split('T')[0];
                        const dayNum = d.getDate();
                        const dayOfWeek = i + 1; // 1=Ma, 2=Ti, 3=Ke, 4=To, 5=Pe

                        let dayObj = { 
                            dateStr, dayOfWeek, weekIndex: w, dayNum,
                            type: 'eta', name: 'Etätyö', 
                            isUserLocked: false, isAnchor: false 
                        };

                        // KOSKEMATTOMAT SUOJAT (Käsin lukitut, pyhät ja lomat)
                        const lockedLoc = existingLocations.find(l => l.date === dateStr && !l.is_auto_generated);
                        if (lockedLoc) {
                            dayObj.isUserLocked = true;
                            dayObj.type = lockedLoc.location_type;
                            dayObj.name = lockedLoc.location_name;
                            cycleDays.push(dayObj);
                            continue;
                        }

                        const isHoliday = holidayList.some(h => h.date === dateStr);
                        if (isHoliday) {
                            dayObj.type = 'pyha';
                            dayObj.name = 'Pyhäpäivä';
                            dayObj.isUserLocked = true;
                            cycleDays.push(dayObj);
                            continue;
                        }

                        const dayAppts = availability.filter(a => a.start_time.startsWith(dateStr));
                        const isPersonalBlocked = dayAppts.some(a => a.is_blocked && a.meeting_type === 'estetty');
                        if (isPersonalBlocked) {
                            dayObj.type = 'loma';
                            dayObj.name = 'Loma/Este';
                            dayObj.isUserLocked = true;
                            cycleDays.push(dayObj);
                            continue;
                        }

                        // KASVOKKAINEN ASIAKASANKKURI PASSIIVISESSA SUOJASSA
                        const hasInPersonMeeting = dayAppts.some(a => a.contact_method === 'kaynti');
                        if (hasInPersonMeeting) {
                            dayObj.type = 'lahityo';
                            dayObj.name = (dayOfWeek === 4) ? settings.thursday_office_name : settings.primary_office_name;
                            dayObj.isAnchor = true;
                            cycleDays.push(dayObj);
                            continue;
                        }

                        // VAPAAT PÄIVÄT MERKITÄÄN PEHMEÄKSI RUNKOTEMPLATEKSI
                        dayObj.shouldBeOfficeThu = shouldBeOfficeThu;
                        cycleDays.push(dayObj);
                    }
                }

                // LEIVOTAAN PEHMEILLE PÄIVILLE ALUSTAVAT SIJAINNIT VIIKKOTYYPIN MUKAAN
                cycleDays.forEach(day => {
                    if (day.isUserLocked || day.isAnchor || day.type === 'pyha' || day.type === 'loma') return;

                    if (day.shouldBeOfficeThu) {
                        // SKENAARIO 1: Matkaviikko (Torstai toimistolla -> Ke-To lukitaan käsikädessä)
                        if (day.dayOfWeek === 1) {
                            day.type = 'eta';
                        } else if (day.dayOfWeek === 2 || day.dayOfWeek === 3) {
                            day.type = 'lahityo';
                            day.name = settings.primary_office_name;
                        } else if (day.dayOfWeek === 4) {
                            day.type = 'lahityo';
                            day.name = settings.thursday_office_name;
                            day.isAnchor = true; // Suojataan Viipurinkatu-torstai trimmaukselta
                        } else if (day.dayOfWeek === 5) {
                            const isAllowedFriday = (day.dayNum <= 7) || (day.dayNum >= 15 && day.dayNum <= 21);
                            if (isAllowedFriday) {
                                day.type = 'lahityo';
                                day.name = settings.primary_office_name;
                            } else {
                                day.type = 'eta';
                            }
                        }
                    } else {
                        // SKENAARIO 2: Paikallisviikko (Torstai kotona -> Ti-Ke muodostaa yhtenäisen blokin)
                        if (day.dayOfWeek === 1 || day.dayOfWeek === 4 || day.dayOfWeek === 5) {
                            day.type = 'eta'; // Perjantai etäksi saarekesuojan vuoksi
                        } else if (day.dayOfWeek === 2 || day.dayOfWeek === 3) {
                            day.type = 'lahityo';
                            day.name = settings.primary_office_name;
                        }
                    }
                });

                // LASKETAAN SYKLIN AKTIIVISET TYÖPÄIVÄT JA LÄHITYÖTAVOITE (50%)
                const activeWorkingDays = cycleDays.filter(d => d.type !== 'pyha' && d.type !== 'loma').length;
                let targetOfficeDays = Math.ceil(activeWorkingDays * 0.5) + carriedDeficit;
                let currentOfficeDays = cycleDays.filter(d => d.type === 'lahityo').length;

                // ================= ILMAINEN TASAPAINOTUS (TRIMMAUS) =================
                if (currentOfficeDays > targetOfficeDays) {
                    // Liikaa toimistopäiviä. Kevennetään reunapäiviä luomatta saarekkeita (Vain matkaviikkojen perjantai tai tiistai)
                    cycleDays.forEach(day => {
                        if (currentOfficeDays <= targetOfficeDays) return;
                        if (day.isUserLocked || day.isAnchor) return;

                        if (day.dayOfWeek === 5 && day.type === 'lahityo') {
                            day.type = 'eta_kevennys';
                            day.name = '⚖️ Etätyö (Tasapainotus)';
                            currentOfficeDays--;
                        }
                    });

                    cycleDays.forEach(day => {
                        if (currentOfficeDays <= targetOfficeDays) return;
                        if (day.isUserLocked || day.isAnchor) return;

                        if (day.dayOfWeek === 2 && day.type === 'lahityo') {
                            day.type = 'eta_kevennys';
                            day.name = '⚖️ Etätyö (Tasapainotus)';
                            currentOfficeDays--;
                        }
                    });
                }

                // ================= VAJEEN TÄYTTÖ TAI RULLAUS ETEENPÄIN =================
                if (currentOfficeDays < targetOfficeDays) {
                    // Kalenterissa liikaa etää. Täytetään laajentamalla olemassa olevia matkablokkeja saarekkeettomasti
                    cycleDays.forEach(day => {
                        if (currentOfficeDays >= targetOfficeDays) return;
                        if (day.isUserLocked || day.isAnchor) return;

                        if (day.dayOfWeek === 5 && day.shouldBeOfficeThu && day.type !== 'lahityo') {
                            day.type = 'lahityo';
                            day.name = settings.primary_office_name;
                            currentOfficeDays++;
                        }
                    });

                    // Tarkistetaan jäikö sykli silti vajaaksi saarekesuojan takia (esim. kaksi paikallisviikkoa putkeen)
                    if (currentOfficeDays < targetOfficeDays) {
                        carriedDeficit = targetOfficeDays - currentOfficeDays; // Rullataan vaje seuraavaan sykliin
                    } else {
                        carriedDeficit = 0;
                    }
                } else {
                    carriedDeficit = 0;
                }

                // ================= PREMIUM-ETÄPÄIVÄPANKKI (SILTAPÄIVÄT) =================
                if (currentBalance > 0) {
                    cycleDays.forEach((day, idx) => {
                        if (currentBalance <= 0) return;
                        if (day.isUserLocked || day.isAnchor) return;

                        // Tiistai-pyhä -> Maanantai etäksi pankista
                        if (day.dayOfWeek === 2 && day.type === 'pyha' && idx > 0) {
                            const prev = cycleDays[idx - 1];
                            if (prev.type === 'lahityo' && !prev.isUserLocked && !prev.isAnchor) {
                                prev.type = 'eta_pankki';
                                prev.name = 'Ehdotus: Pankki-etä (Silta)';
                                currentBalance--;
                            }
                        }
                        // Torstai-pyhä -> Perjantai etäksi pankista
                        if (day.dayOfWeek === 4 && day.type === 'pyha' && idx < cycleDays.length - 1) {
                            const next = cycleDays[idx + 1];
                            if (next.type === 'lahityo' && !next.isUserLocked && !next.isAnchor) {
                                next.type = 'eta_pankki';
                                next.name = 'Ehdotus: Pankki-etä (Silta)';
                                currentBalance--;
                            }
                        }
                    });
                }

                // KERÄTÄÄN SYKLIN VALMIIT AUTOMAATTIEHDOTUKSET TALLENNUSLISTALLE
                cycleDays.forEach(day => {
                    if (!day.isUserLocked) {
                        newLocations.push({ 
                            expert_id: expertId, 
                            date: day.dateStr, 
                            location_type: day.type, 
                            location_name: day.name, 
                            is_auto_generated: true 
                        });
                    }
                });

                // Siirretään pääluuppia eteenpäin tasan 14 päivää
                currentWeekStart.setDate(currentWeekStart.getDate() + 14);
            }

            // 4. Tallennetaan generoitu data kantaan UPSERT-komennolla (Yksilöllisesti kullekin asiantuntijalle)
            if (newLocations.length > 0) {
                const { error: upsertError } = await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'expert_id, date' });
                
                if (upsertError) {
                    console.error(`CRON: Virhe tallennettaessa asiantuntijalle ${expertId}:`, upsertError);
                } else {
                    console.log(`CRON: Asiantuntijan ${expertId} kalenteri tallennettu.`);
                }
            }
        }

        console.log("CRON: Kaikki asiantuntijat optimoitu onnistuneesti Master 2.0 -logiikalla!");
        return { statusCode: 200, body: 'Schedule optimized successfully with Master 2.0' };

    } catch (error) {
        console.error('CRON Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};

// Netlify Cron-määritys: Ajetaan kerran päivässä (keskiyöllä UTC)
exports.handler = schedule("@daily", handler);