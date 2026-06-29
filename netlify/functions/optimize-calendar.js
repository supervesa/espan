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

        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 105); // 3,5 kk horisontti
        const startDateStr = today.toISOString().split('T')[0];

        // 1. DATAHAKU PORTINVARTIJANA
        const [setRes, availRes, locRes, holRes, ledgerRes] = await Promise.all([
            supabase.schema('espan').from('expert_location_settings').select('*').eq('expert_id', expertId).single(),
            supabase.schema('espan').from('availability').select('start_time, is_blocked, meeting_type, contact_method').eq('expert_id', expertId).gte('start_time', `${startDateStr} 00:00:00`),
            supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', expertId).gte('date', startDateStr),
            supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', startDateStr),
            supabase.schema('espan').from('expert_remote_bank_ledger').select('transaction_type').eq('expert_id', expertId).gt('expiration_date', startDateStr)
        ]);

        const settings = setRes.data;
        if (!settings) return { statusCode: 404, body: 'Asetuksia ei löydy' };

        const availability = availRes.data || [];
        const existingLocations = locRes.data || [];
        const holidays = holRes.data || [];
        const ledger = ledgerRes.data || [];

        // Etäpäiväpankin premium-saldo ja syklirullaava vajaussaldo (Deficit)
        let currentBalance = ledger.reduce((sum, row) => sum + row.transaction_type, 0);
        let carriedDeficit = 0; 
        let newLocations = [];

        // Etsitään kuluvan viikon maanantai
        let currentWeekStart = new Date(today);
        const dayOffset = currentWeekStart.getDay() === 0 ? -6 : 1 - currentWeekStart.getDay();
        currentWeekStart.setDate(currentWeekStart.getDate() + dayOffset); 

        // PYÖRITETÄÄN KALENTERIA KIINTEISSÄ 2 VIIKON (14 PV) SYKLEISSÄ
        while (currentWeekStart < endDate) {
            let cycleDays = [];

            // Luodaan kahden viikon (10 työpäivän) aikajakso
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

                    const isHoliday = holidays.some(h => h.date === dateStr);
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

                    // JOS PÄIVÄ ON VAPAATA RIISTAA, KÄYTETÄÄN PEHMEÄÄ RUNKOTEMPLATEA
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
                        // Perjantai on alustavasti toimistolla vain 1. tai 3. viikolla
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
                        day.type = 'eta'; // Perjantai pakotetaan etäksi saarekesuojan vuoksi!
                    } else if (day.dayOfWeek === 2 || day.dayOfWeek === 3) {
                        day.type = 'lahityo';
                        day.name = settings.primary_office_name;
                    }
                }
            });

            // LASKETAAN SYKLIN AKTIIVISET TYÖPÄIVÄT JA TAVOITE (50%)
            const activeWorkingDays = cycleDays.filter(d => d.type !== 'pyha' && d.type !== 'loma').length;
            let targetOfficeDays = Math.ceil(activeWorkingDays * 0.5) + carriedDeficit;
            let currentOfficeDays = cycleDays.filter(d => d.type === 'lahityo').length;

            // ================= ILMAINEN TASAPAINOTUS (TRIMMAUS) =================
            if (currentOfficeDays > targetOfficeDays) {
                // Liikaa toimistopäiviä. Kevennetään reunapäiviä luomatta saarekkeita (Vain Matkaviikon perjantai tai tiistai)
                cycleDays.forEach(day => {
                    if (currentOfficeDays <= targetOfficeDays) return;
                    if (day.isUserLocked || day.isAnchor) return;

                    // Trimmauskohde 1: Matkaviikon perjantai (Muutetaan yhtenäinen 4 pv putki 3 päiväksi)
                    if (day.dayOfWeek === 5 && day.type === 'lahityo') {
                        day.type = 'eta_kevennys';
                        day.name = '⚖️ Etätyö (Tasapainotus)';
                        currentOfficeDays--;
                    }
                });

                cycleDays.forEach(day => {
                    if (currentOfficeDays <= targetOfficeDays) return;
                    if (day.isUserLocked || day.isAnchor) return;

                    // Trimmauskohde 2: Matkaviikon tiistai (Jättää Ke-To matkablokin täysin ehjäksi)
                    if (day.dayOfWeek === 2 && day.type === 'lahityo') {
                        day.type = 'eta_kevennys';
                        day.name = '⚖️ Etätyö (Tasapainotus)';
                        currentOfficeDays--;
                    }
                });
            }

            // ================= VAJEEN TÄYTTÖ TAI RULLAUS ETENPÄIN =================
            if (currentOfficeDays < targetOfficeDays) {
                // Kalenterissa on liikaa etäpäiviä. Yritetään täyttää vaje laajentamalla olemassa olevia matkablokkeja saarekkeettomasti
                cycleDays.forEach(day => {
                    if (currentOfficeDays >= targetOfficeDays) return;
                    if (day.isUserLocked || day.isAnchor) return;

                    // Putken laajennus: Jos matkaviikon perjantai oli etänä, muutetaan se lähityöksi (saarekkeeton 4 pv putki)
                    if (day.dayOfWeek === 5 && day.shouldBeOfficeThu && day.type !== 'lahityo') {
                        day.type = 'lahityo';
                        day.name = settings.primary_office_name;
                        currentOfficeDays++;
                    }
                });

                // Tarkistetaan jäikö sykli silti vajaaksi saarekesuojan takia (esim. kaksi paikallisviikkoa putkeen)
                if (currentOfficeDays < targetOfficeDays) {
                    carriedDeficit = targetOfficeDays - currentOfficeDays; // Rullataan vaje seuraavaan 2 viikon sykliin
                } else {
                    carriedDeficit = 0;
                }
            } else {
                carriedDeficit = 0; // Sykli täydellisessä tasapainossa
            }

            // ================= PREMIUM-ETÄPÄIVÄPANKKI (SILTAPÄIVÄT) =================
            if (currentBalance > 0) {
                cycleDays.forEach((day, idx) => {
                    if (currentBalance <= 0) return;
                    if (day.isUserLocked || day.isAnchor) return;

                    // Siltapäivä-äly Tiistai-pyhille -> Maanantai etäksi pankista
                    if (day.dayOfWeek === 2 && day.type === 'pyha' && idx > 0) {
                        const prev = cycleDays[idx - 1];
                        if (prev.type === 'lahityo' && !prev.isUserLocked && !prev.isAnchor) {
                            prev.type = 'eta_pankki';
                            prev.name = 'Ehdotus: Pankki-etä (Silta)';
                            currentBalance--;
                        }
                    }
                    // Siltapäivä-äly Torstai-pyhille -> Perjantai etäksi pankista
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

            // PUSHATAAN SYKLIN VALMIIT AUTOMAATTIEHDOTUKSET TALLENNUSLISTALLE
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

            // Siirretään pääluuppia eteenpäin tasan 2 kalenteriviikkoa
            currentWeekStart.setDate(currentWeekStart.getDate() + 14);
        }

        // TALLENNETAAN LOPULTA KAIKKI EHDOTUKSET YHDELLÄ UPSERTILLA TIETOKANTAAN
        if (newLocations.length > 0) {
            await supabase.schema('espan').from('expert_daily_locations').upsert(newLocations, { onConflict: 'expert_id, date' });
        }

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Kalenteri optimoitu Master 2.0 rullaavalla syklilogiikalla saarekkeettomasti.' }) };

    } catch (error) {
        console.error('Optimointi Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};