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

// Apufunktio viikkonumeron laskentaan
const getWeekNumber = (dateObj) => {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

const scanSlots = (typesToSearch, expertRules, bookedSlots, startDate, limitWeeks, settings, is46 = false, expertLocations = [], mockWeeklyLoad = {}) => {
    const slots = [];
    let current = parseSafeDate(startDate) || new Date();
    current.setHours(0, 0, 0, 0);

    const pyhatPaivat = settings?.pyhat_paivat || []; 
    const ahkysuoja_aktiivinen = settings?.ahkysuoja_aktiivinen ?? true;
    // Oletetaan että tavoite on esim. 12 asiakasta per viikko
    const TAVOITETAHTI_MAX = 12;

    for (let i = 0; i < (limitWeeks * 7); i++) {
        const checkDate = new Date(current);
        checkDate.setDate(current.getDate() + i);
        
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const weekNum = getWeekNumber(checkDate);
        const currentWeekLoad = mockWeeklyLoad[weekNum] || 0;

        // 🟢 1. ÄHKYSUOJA: Jos viikko on täynnä ja kyseessä ei ole 46§ hätätapaus, hypätään yli!
        if (ahkysuoja_aktiivinen && !is46 && currentWeekLoad >= TAVOITETAHTI_MAX) {
            continue; // Hylkää tämä päivä ja jatka etsimistä, asiantuntijan raja on täynnä!
        }

        // 🟢 2. POISSAOLOT (Lomat ja koulutukset)
        const locForDay = (expertLocations || []).find(l => l.date === dateStr);
        if (locForDay && (locForDay.location_type === 'loma' || locForDay.location_type === 'koulutus')) {
            continue; 
        }

        const jsDay = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
        const dayStr = String(jsDay);

        // 🟢 3. FOKUS-PÄIVÄT
        if (pyhatPaivat.includes(dayStr) && !is46) {
            continue; 
        }

        // Etsitään vapaat lokerot
        for (const tType of typesToSearch) {
            const matchingRules = (expertRules || []).filter(r => r.meeting_type === tType && r.is_active !== false);
            const rulesForDay = matchingRules.filter(r => r.day_of_week === jsDay);

            for (const rule of rulesForDay) {
                const [startH, startM] = rule.start_time.split(':').map(Number);
                const [endH, endM] = rule.end_time.split(':').map(Number);
                
                const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                const isSingleSlot = durationMinutes <= 75; 
                const defaultMode = rule.contact_method || 'puhelu';

                const isBorrowed = tType !== typesToSearch[0];
                let borrowLabel = null;
                if (isBorrowed) {
                    borrowLabel = tType === 'taydentava' ? 'Lainattu täydentävistä' : (tType === 'aktivointi' ? 'Lainattu aktivoinnista' : `Lainattu (${tType})`);
                }

                if (isSingleSlot) {
                    const slotTime = new Date(checkDate);
                    slotTime.setHours(startH, startM, 0, 0);
                    
                    const isBooked = (bookedSlots || []).some(bs => new Date(bs.start_time).getTime() === slotTime.getTime());
                    if (!isBooked) {
                        slots.push({ time: slotTime, mode: defaultMode, isBorrowed, label: borrowLabel, matchedType: tType });
                    }
                } else {
                    for (let h = startH; h < endH; h++) {
                        const slotTime = new Date(checkDate);
                        slotTime.setHours(h, startM, 0, 0);
                        
                        const isBooked = (bookedSlots || []).some(bs => new Date(bs.start_time).getTime() === slotTime.getTime());
                        if (!isBooked) {
                            slots.push({ time: slotTime, mode: defaultMode, isBorrowed, label: borrowLabel, matchedType: tType });
                        }
                    }
                }
            }
        }
    }
    return slots;
};

export const findAvailableSlots = (meetingType, expertRules, bookedSlots, targetDate, limitWeeks = 1, settings = null, is46 = false, expertLocations = [], mockWeeklyLoad = {}) => {
    
    const defaultLiedennys = settings?.liedennys_jarjestys || ['taydentava', 'aktivointi', 'normi'];
    const searchOrder = [meetingType, ...defaultLiedennys.filter(t => t !== meetingType)];

    let searchStart = new Date(targetDate);
    const automaatio = settings?.automaatio || {};
    const tasaus = automaatio.tasapainotus || {};

    // 🟢 4. KUOPPATUTKA & TASAPAINOTUS (Sliding Window)
    if (tasaus.liukuva_tasaus_aktiivinen && tasaus.hakeudu_kuoppiin && !is46) {
        const targetWeekNum = getWeekNumber(searchStart);
        const prevWeekNum = targetWeekNum - 1;
        
        const prevLoad = mockWeeklyLoad[prevWeekNum] || 0;
        const targetLoad = mockWeeklyLoad[targetWeekNum] || 0;

        if (prevLoad < 6 && targetLoad > 8) {
            // 1. Aikaistetaan hakua lennosta 7 päivällä
            searchStart.setDate(searchStart.getDate() - 7);
            
            // 2. KORJAUS: Siirretään aloituspäivä kuoppaviikon MAANANTAIHIN, 
            // jotta scanSlots ei hyppää kuoppaviikon alkuosan yli!
            const day = searchStart.getDay();
            const diffToMonday = searchStart.getDate() - day + (day === 0 ? -6 : 1);
            searchStart.setDate(diffToMonday);
        }
    }

    // VAIHE 1: Normaali haku (Lomat, ähky ja kuopat huomioiden)
    let slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, limitWeeks, settings, is46, expertLocations, mockWeeklyLoad);
    
    // VAIHE 2: Laajennettu haku (Vesiputous) jos aikaa ei löydy
    if (slots.length === 0) {
        slots = scanSlots(searchOrder, expertRules, bookedSlots, searchStart, limitWeeks * 2, settings, is46, expertLocations, mockWeeklyLoad);
    }

    // VAIHE 3: 46 § Ruuhkareaktioiden väkisin läpi puskeminen (Jos yhä nolla ja is46)
    if (slots.length === 0 && is46 && automaatio.ruuhkareaktiot?.uhraa_puskurit) {
        // Ohitetaan Ähkysuojat poistamalla "is46" tarkistuksissa rajoitteita
        slots = scanSlots(searchOrder, expertRules, bookedSlots, targetDate, limitWeeks * 2, settings, true, expertLocations, mockWeeklyLoad);
    }

    return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
};