// src/components/AikatauluEhdotus/draftingEngine.js

// 🟢 UUSI: Tuodaan älykäs moottori vanhan tyhmän sijaan
import { findAvailableSlots } from './IntelSchedulingUtils';

export const generateSmartDraft = (
    rule, expertRules, bookedSlots, count, periodMonths, targetDate = null, 
    expertLocations = [], settings = null, forcedMode = 'puhelu', 
    idealLocation = null, targetDuration = 45
) => {
    if (!rule || count <= 0) return [];
    
    const draft = [];
    const tempBooked = [...bookedSlots]; 
    
    // 1. Päätellään tapaamisen luonne
    let meetingType = 'normi';
    if (rule.metadata?.triggers?.require_yleistuki) {
        meetingType = 'aktivointi';
    } else if (rule.title?.toLowerCase().includes('täydentävä')) {
        meetingType = 'taydentava';
    }

    // 2. Määritetään joustavan hypyn pituus viikkoina
    let intervalWeeks = 0;
    if (meetingType === 'aktivointi') {
        intervalWeeks = 4; // n. 1kk välein
    } else if (meetingType === 'normi') {
        intervalWeeks = rule.metadata?.triggers?.recurring_months ? rule.metadata.triggers.recurring_months * 4 : 12;
    } else {
        intervalWeeks = Math.max(1, Math.floor((periodMonths * 4) / count));
    }

    let currentDate = new Date();

    if (targetDate) {
        currentDate = new Date(targetDate);
        const today = new Date();
        if (currentDate < today) {
            currentDate = today;
        }
    }

    // Aktivoinnin ensimmäinen varattava aika on 4 viikon päässä
    if (meetingType === 'aktivointi') {
        currentDate.setDate(currentDate.getDate() + 28);
    }

    // 3. Draftataan ajat periksiantamattomasti uudella moottorilla
    let attempts = 0; 
    
    while (draft.length < count && attempts < 50) {
        // 🟢 Moottoriin syötetään KAIKKI uudet parametrit: kesto, moodi ja lokaatio!
        const rawAvailable = findAvailableSlots(
            meetingType, expertRules, tempBooked, currentDate, targetDuration, 
            1, settings, false, expertLocations, {}, forcedMode, idealLocation
        );
        
        if (rawAvailable.length > 0) {
            const selectedIndex = draft.length % rawAvailable.length;
            const selected = rawAvailable[selectedIndex]; 
            
            // 🟢 TÄSSÄ OLI VIKA: Nyt pakataan kesto ja huonetiedot mukaan koriin!
            draft.push({ 
                time: selected.time, 
                mode: selected.mode,
                locationName: selected.locationName,
                isBorrowed: selected.isBorrowed,
                label: selected.label,
                duration_minutes: selected.duration || targetDuration,
                hasRoom: selected.hasRoom,
                roomName: selected.roomName
            });
            
            // Varataan aika tilapäisesti seuraavaa luuppia varten
            tempBooked.push({ 
                start_time: selected.time.toISOString(),
                duration_minutes: targetDuration
            });

            // Hypätään eteenpäin tavoiterytmin verran (esim. 4 vko)
            currentDate = new Date(selected.time);
            currentDate.setDate(currentDate.getDate() + (intervalWeeks * 7));
        } else {
            // HYLSY: Tällä viikolla ei ollut aikaa. Siirrytään 1 viikko eteenpäin.
            currentDate.setDate(currentDate.getDate() + 7);
        }
        attempts++;
    }
    
    return draft;
};