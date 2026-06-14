import { findAvailableSlots } from './schedulingUtils';

export const generateSmartDraft = (rule, expertRules, bookedSlots, count, periodMonths) => {
    if (!rule) return [];
    
    const draft = [];
    const tempBooked = [...bookedSlots]; 
    
    // 1. Päätellään tapaamisen luonne
    let meetingType = 'normi';
    if (rule.metadata?.triggers?.require_yleistuki) {
        meetingType = 'aktivointi';
    } else if (rule.title.toLowerCase().includes('täydentävä')) {
        meetingType = 'taydentava';
    }

    // 2. Määritetään joustavan hypyn pituus viikkoina
    let intervalWeeks = 0;
    if (meetingType === 'aktivointi') {
        intervalWeeks = 4; // n. 1kk välein
    } else if (meetingType === 'normi') {
        intervalWeeks = rule.metadata?.triggers?.recurring_months ? rule.metadata.triggers.recurring_months * 4 : 12; // Tietokannan 3kk sääntö
    } else {
        // Täydentävät: Jaetaan valittu kuukausimäärä tasaisesti valitulle määrälle
        intervalWeeks = Math.max(1, Math.floor((periodMonths * 4) / count));
    }

    let currentDate = new Date();

    // 3. Draftataan ajat
    for (let i = 0; i < count; i++) {
        const available = findAvailableSlots(meetingType, expertRules, tempBooked, currentDate, 8);
        
        if (available.length > 0) {
            // FIKSU POIMINTA (Round-Robin): Ei oteta aina ensimmäistä!
            // Tämä jakaa ajat nätisti eri kellonajoille ja tapaamistavoille (puhelu/käynti).
            const selectedIndex = i % available.length;
            const selected = available[selectedIndex]; 
            
            draft.push({ time: selected.time, mode: selected.mode });
            tempBooked.push({ start_time: selected.time.toISOString() });

            // Asetetaan seuraavan haun tavoitepäivä
            currentDate = new Date(selected.time);
            currentDate.setDate(currentDate.getDate() + (intervalWeeks * 7));
        } else {
            currentDate.setDate(currentDate.getDate() + (intervalWeeks * 7));
        }
    }
    
    return draft;
};