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

export const findAvailableSlots = (meetingType, expertRules, bookedSlots, startDate, limitWeeks = 1) => {
    const slots = [];
    let current = parseSafeDate(startDate) || new Date();
    current.setHours(0, 0, 0, 0);

    const matchingRules = (expertRules || []).filter(r => r.meeting_type === meetingType && r.is_active !== false);
    if (matchingRules.length === 0) return [];

    for (let i = 0; i < (limitWeeks * 7); i++) {
        const checkDate = new Date(current);
        checkDate.setDate(current.getDate() + i);
        const jsDay = checkDate.getDay() === 0 ? 7 : checkDate.getDay();

        const rulesForDay = matchingRules.filter(r => r.day_of_week === jsDay);

        for (const rule of rulesForDay) {
            const [startH, startM] = rule.start_time.split(':').map(Number);
            const [endH, endM] = rule.end_time.split(':').map(Number);
            
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            const isSingleSlot = durationMinutes <= 75; 
            
            // KORJAUS: Oletustapa on nyt puhelu
            const defaultMode = rule.contact_method || 'puhelu';

            if (isSingleSlot) {
                const slotTime = new Date(checkDate);
                slotTime.setHours(startH, startM, 0, 0);
                
                const isBooked = (bookedSlots || []).some(bs => new Date(bs.start_time).getTime() === slotTime.getTime());
                if (!isBooked) {
                    slots.push({ time: slotTime, mode: defaultMode });
                }
            } else {
                for (let h = startH; h < endH; h++) {
                    const slotTime = new Date(checkDate);
                    slotTime.setHours(h, startM, 0, 0);
                    
                    const isBooked = (bookedSlots || []).some(bs => new Date(bs.start_time).getTime() === slotTime.getTime());
                    if (!isBooked) {
                        slots.push({ time: slotTime, mode: defaultMode });
                    }
                }
            }
        }
    }

    return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
};