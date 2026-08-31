// src/components/AikatauluEhdotus/IntelSchedulingUtils.js

export const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const s = String(val).trim();
    if (!s.includes('.') && !s.includes('-')) return null;
    let d = null;
    if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
        d = new Date(s);
    }
    return (d && !isNaN(d.getTime())) ? d : null;
};

const getWeekNumber = (dateObj) => {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

const minsToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const mergeBlocks = (rules) => {
    if (!rules || rules.length === 0) return [];
    
    const timeToMins = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    
    const blocks = rules.map(r => ({
        start: timeToMins(r.start_time),
        end: timeToMins(r.end_time),
        mode: r.contact_method || 'puhelu',
        type: r.meeting_type
    })).sort((a, b) => a.start - b.start);

    const merged = [blocks[0]];
    for (let i = 1; i < blocks.length; i++) {
        const current = blocks[i];
        const last = merged[merged.length - 1];
        
        if (current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push(current);
        }
    }
    return merged;
};

// 🟢 UUSI: Älykäs kuormandatan parsija (Tukee sekä Legacy-numeroita että uusia Obj-tavoitteita)
const getLoadData = (weeklyLoadObj, weekNum) => {
    const data = weeklyLoadObj[weekNum];
    // Oletusarvona 12 (jos dataa ei löydy)
    if (!data) return { load: 0, limit: 12 };
    
    // Uusi muoto: { varattu: 15, maksimi_tavoite: 12.30 }
    if (typeof data === 'object') {
        return {
            load: data.varattu || 0,
            limit: data.maksimi_tavoite || 12
        };
    }
    // Vanha muoto: pelkkä varattujen määrä numeroina
    return {
        load: Number(data) || 0,
        limit: 12
    };
};

// ==========================================
// PÄÄMOOTTORI: AUKKOJEN SKANNAUS 
// ==========================================
const scanSlots = (
    typesToSearch, expertRules, bookedSlots, startDate, targetDuration, 
    limitWeeks, settings, is46 = false, expertLocations = [], mockWeeklyLoad = {}, 
    targetMode = 'puhelu', targetLocation = null
) => {
    const slots = [];
    let current = parseSafeDate(startDate) || new Date();
    current.setHours(0, 0, 0, 0);

    const pyhatPaivat = settings?.pyhat_paivat || []; 
    const ahkysuoja_aktiivinen = settings?.ahkysuoja_aktiivinen ?? true;

    const validRules = (expertRules || []).filter(r => r.is_active !== false);

    for (let i = 0; i < (limitWeeks * 7); i++) {
        const checkDate = new Date(current);
        checkDate.setDate(current.getDate() + i);
        
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;
        const jsDay = checkDate.getDay() === 0 ? 7 : checkDate.getDay();

        // 🟢 1. ÄHKYSUOJA DYNAAMISELLA KATTOARVOLLA
        const weekNum = getWeekNumber(checkDate);
        const loadData = getLoadData(mockWeeklyLoad, weekNum);
        
        // Vertaillaan dynaamisen limiitin suhteen (esim 15 >= 12.30 -> Estetään päivä!)
        if (ahkysuoja_aktiivinen && !is46 && loadData.load >= loadData.limit) {
            continue;
        }

        const locForDay = (expertLocations || []).find(l => l.date === dateStr);
        
        // 2. Poissaolot ja sisätyöpäivät hylätään armotta asiakastyöstä
        const blockedLocationTypes = ['loma', 'koulutus', 'sisatyot_lahityo', 'sisatyot_eta'];
        if (locForDay && blockedLocationTypes.includes(locForDay.location_type)) {
            continue; 
        }
        
        // 3. LOKAATIOMATCHING (Käynneissä)
        if (targetMode === 'kaynti') {
            const locType = locForDay?.location_type || 'lahityo'; 
            const locName = locForDay?.location_name || 'Malminkatu';

            if (locType === 'eta') continue;

            if (targetLocation && locName !== targetLocation) {
                continue;
            }
        }

        const dayStr = String(jsDay);
        if (pyhatPaivat.includes(dayStr) && !is46) continue; 

        const bookedToday = (bookedSlots || []).filter(bs => {
            const bsDate = new Date(bs.start_time);
            return bsDate.getFullYear() === year && bsDate.getMonth() === checkDate.getMonth() && bsDate.getDate() === checkDate.getDate();
        }).map(bs => {
            const d = new Date(bs.start_time);
            const startMins = d.getHours() * 60 + d.getMinutes();
            const dur = bs.duration_minutes || 60; 
            return { start: startMins, end: startMins + dur };
        });

        const rulesForDay = validRules.filter(r => r.day_of_week === jsDay);
        if (rulesForDay.length === 0) continue;

        const mergedBlocks = mergeBlocks(rulesForDay);
        const stepMins = settings?.askellus_minuutit || 15;

        for (const block of mergedBlocks) {
            const blockDuration = block.end - block.start;
            if (blockDuration < targetDuration) continue;

            for (let startMins = block.start; startMins + targetDuration <= block.end; startMins += stepMins) {
                const endMins = startMins + targetDuration;
                const hasCollision = bookedToday.some(b => (startMins < b.end) && (endMins > b.start));

                if (!hasCollision) {
                    const slotTime = new Date(checkDate);
                    slotTime.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
                    
                    const exists = slots.some(s => s.time.getTime() === slotTime.getTime());
                    if (!exists) {
                        const isBorrowed = block.type !== typesToSearch[0];
                        let borrowLabel = null;
                        if (isBorrowed) {
                            borrowLabel = block.type === 'taydentava' ? 'Lainattu täydentävistä' : (block.type === 'aktivointi' ? 'Lainattu aktivoinnista' : `Lainattu (${block.type})`);
                        }

                        let resolvedLocation = locForDay?.location_name || 'Malminkatu';

                        slots.push({ 
                            time: slotTime, 
                            mode: targetMode === 'kaynti' ? 'kaynti' : block.mode,
                            locationName: resolvedLocation, 
                            isBorrowed, 
                            label: borrowLabel, 
                            matchedType: block.type, 
                            duration: targetDuration 
                        });
                    }
                }
            }
        }
    }
    return slots;
};

// ==========================================
// RAJAPINTA UI:LLE (HAKU-STRATEGIA)
// ==========================================
export const findAvailableSlots = (
    meetingType, expertRules, bookedSlots, targetDate, targetDuration = 45, 
    limitWeeks = 1, settings = null, is46 = false, expertLocations = [], 
    mockWeeklyLoad = {}, requestedMode = 'puhelu', clientIdealLocation = null
) => {
    let defaultLiedennys = settings?.liedennys_jarjestys;
    if (!Array.isArray(defaultLiedennys) || defaultLiedennys.length === 0) {
        defaultLiedennys = ['alkuhaastattelu', 'taydentava', 'aktivointi', 'normi'];
    }
    
    const searchOrder = [meetingType, ...defaultLiedennys.filter(t => t !== meetingType)];

    let searchStart = new Date(targetDate);
    const automaatio = settings?.automaatio || {};
    const tasaus = automaatio.tasapainotus || {};

    // 🟢 UUSI: ÄLYKÄS LIUKUVA IKKUNA (Kaikututka)
    if (tasaus.liukuva_tasaus_aktiivinen && tasaus.hakeudu_kuoppiin && !is46) {
        const targetWeekNum = getWeekNumber(searchStart);
        const targetData = getLoadData(mockWeeklyLoad, targetWeekNum);
        
        // Aloitetaan kuopan etsintä VASTA jos tavoiteviikolla on selkeää ruuhkaa (esim > 80% kapasiteetista)
        if ((targetData.load / targetData.limit) > 0.8) {
            
            const windowLimit = tasaus.tasaus_ikkuna_vko || 2; // Oletuksena +-2 viikkoa
            let bestWeekOffset = 0;
            let lowestRatio = targetData.load / targetData.limit;

            const today = new Date();
            today.setHours(0,0,0,0);
            const currentWeekNum = getWeekNumber(today);

            // Skannataan viikot asetetun ikkunan sisältä (esim. -3 ... +3)
            for (let offset = -windowLimit; offset <= windowLimit; offset++) {
                if (offset === 0) continue;

                const checkD = new Date(searchStart);
                checkD.setDate(checkD.getDate() + (offset * 7));
                
                // Aikakone-esto: Ei voida varata aikaa menneisyyteen!
                if (checkD < today && getWeekNumber(checkD) < currentWeekNum) continue;

                const checkWkNum = getWeekNumber(checkD);
                const wData = getLoadData(mockWeeklyLoad, checkWkNum);
                const ratio = wData.load / wData.limit;

                // Jos tältä viikolta löytyy merkittävä "kuoppa" (esim. kuorma on yli 30% pienempi kuin alkuperäisessä)
                if (ratio < lowestRatio - 0.3) {
                    lowestRatio = ratio;
                    bestWeekOffset = offset;
                }
            }

            // Jos parempi kuoppa löytyi, siirretään aloitusviikko sinne!
            if (bestWeekOffset !== 0) {
                searchStart.setDate(searchStart.getDate() + (bestWeekOffset * 7));
                // Palautetaan osoitin viikon maanantaille puhtaan haun varmistamiseksi
                const day = searchStart.getDay();
                const diffToMonday = searchStart.getDate() - day + (day === 0 ? -6 : 1);
                searchStart.setDate(diffToMonday);
            }
        }
    }

    let slots = [];

    if (requestedMode === 'kaynti' && clientIdealLocation) {
        slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, clientIdealLocation);
        
        if (slots.length === 0) {
            slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, null);
            if (slots.length === 0) {
                slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks * 2, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, clientIdealLocation);
                if (slots.length === 0) {
                    slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks * 2, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, null);
                }
            }
        }
    } else {
        slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, null);
        if (slots.length === 0) {
            slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, targetDuration, limitWeeks * 2, settings, is46, expertLocations, mockWeeklyLoad, requestedMode, null);
        }
    }

    if (slots.length === 0 && is46 && automaatio.ruuhkareaktiot?.uhraa_puskurit) {
        slots = scanSlots(searchOrder, expertRules, bookedSlots, targetDate, targetDuration, limitWeeks * 2, settings, true, expertLocations, mockWeeklyLoad, requestedMode, null);
    }

    return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
};