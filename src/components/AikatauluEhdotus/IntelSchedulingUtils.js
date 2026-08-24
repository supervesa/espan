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

/**
 * Sisäinen apufunktio, joka skannaa kalenterin säännöillä ja huomioi lomat/poissaolot.
 */
const scanSlots = (typesToSearch, expertRules, bookedSlots, startDate, limitWeeks, settings, ignoreFokus = false, expertLocations = []) => {
    const slots = [];
    let current = parseSafeDate(startDate) || new Date();
    current.setHours(0, 0, 0, 0);

    const pyhatPaivat = settings?.pyhat_paivat || []; 

    for (let i = 0; i < (limitWeeks * 7); i++) {
        const checkDate = new Date(current);
        checkDate.setDate(current.getDate() + i);
        
        // Muunnetaan YYYY-MM-DD muotoon lokaatiotarkistusta varten
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        // 🟢 TARKISTUS: Onko tälle päivälle merkitty loma tai poissaolo/koulutus?
        const locForDay = (expertLocations || []).find(l => l.date === dateStr);
        if (locForDay && (locForDay.location_type === 'loma' || locForDay.location_type === 'koulutus')) {
            continue; // Ohitetaan tämä päivä kokonaan, koska asiantuntija on poissa!
        }

        const jsDay = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
        const dayStr = String(jsDay);

        if (pyhatPaivat.includes(dayStr) && !ignoreFokus) {
            continue; 
        }

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
                        slots.push({ 
                            time: slotTime, 
                            mode: defaultMode, 
                            isBorrowed, 
                            label: borrowLabel,
                            matchedType: tType
                        });
                    }
                } else {
                    for (let h = startH; h < endH; h++) {
                        const slotTime = new Date(checkDate);
                        slotTime.setHours(h, startM, 0, 0);
                        
                        const isBooked = (bookedSlots || []).some(bs => new Date(bs.start_time).getTime() === slotTime.getTime());
                        if (!isBooked) {
                            slots.push({ 
                                time: slotTime, 
                                mode: defaultMode, 
                                isBorrowed, 
                                label: borrowLabel,
                                matchedType: tType
                            });
                        }
                    }
                }
            }
        }
    }
    return slots;
};

export const findAvailableSlots = (meetingType, expertRules, bookedSlots, startDate, limitWeeks = 1, settings = null, is46 = false, expertLocations = []) => {
    const defaultLiedennys = settings?.liedennys_jarjestys || ['taydentava', 'aktivointi', 'normi'];
    const searchOrder = [meetingType, ...defaultLiedennys.filter(t => t !== meetingType)];

    // VAIHE 1: Normaali haku (lomat ja poissaolot huomioiden)
    let slots = scanSlots(searchOrder, expertRules, bookedSlots, startDate, limitWeeks, settings, false, expertLocations);
    if (slots.length > 0) {
        return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    // VAIHE 2: Laajennettu haku
    slots = scanSlots(searchOrder, expertRules, bookedSlots, startDate, limitWeeks * 2, settings, false, expertLocations);
    if (slots.length > 0) {
        return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    // VAIHE 3: Viimeinen hätävara (46 § purkaa Fokus-päivät)
    if (is46) {
        slots = scanSlots(searchOrder, expertRules, bookedSlots, startDate, limitWeeks * 2, settings, true, expertLocations);
    }

    return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
};