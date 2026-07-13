import { findAvailableSlots } from './schedulingUtils';
import { interpretDraftBasket } from './locationInterpreter';

export const generateSmartDraft = (rule, expertRules, bookedSlots, count, periodMonths, targetDate = null, expertLocations = []) => {
    if (!rule || count <= 0) return [];
    
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

    // --- UUSI LOGIIKKA: Aloitetaan oikeasta tavoiteajasta ---
    if (targetDate) {
        currentDate = new Date(targetDate);
        
        // Estetään vain haun meneminen menneisyyteen.
        const today = new Date();
        if (currentDate < today) {
            currentDate = today;
        }
    }

    // ==========================================
    // AKTIVOINNIN ALOITUSHYPPY
    // Koska aktivointi alkaa tästä päivästä, ensimmäinen varattava
    // tulevaisuuden aika on tasan 4 viikon (28 päivän) päässä.
    // ==========================================
    if (meetingType === 'aktivointi') {
        currentDate.setDate(currentDate.getDate() + 28);
    }
    // --------------------------------------------------------

    // 3. Draftataan ajat periksiantamattomasti
    let attempts = 0; // Varmistus, ettei jäädä ikiluuppiin jos kalenteri on aivan täynnä
    
    while (draft.length < count && attempts < 50) {
        // 1. Haetaan VAIN yhden viikon raaka-ajat kerrallaan, jotta automaatti ei karkaa liian kauas!
        const rawAvailable = findAvailableSlots(meetingType, expertRules, tempBooked, currentDate, 1);
        
        // 2. Ajetaan ajat TULKIN läpi täällä moottorissa! Näin varmistetaan, ettei koriin oteta loma-aikoja tai ankkureita.
        const validForThisWeek = interpretDraftBasket(rawAvailable, expertRules, tempBooked, expertLocations);
        
        if (validForThisWeek.length > 0) {
            // Pyöräytetään indeksiä, jotta ei oteta aina viikon ensimmäistä aikaa
            const selectedIndex = draft.length % validForThisWeek.length;
            const selected = validForThisWeek[selectedIndex]; 
            
            draft.push({ time: selected.time, mode: selected.mode });
            tempBooked.push({ start_time: selected.time.toISOString() });

            // ONNISTUMINEN: Hypätään eteenpäin tavoiterytmin verran (esim. 4 vko) seuraavaa aikaa varten
            currentDate = new Date(selected.time);
            currentDate.setDate(currentDate.getDate() + (intervalWeeks * 7));
        } else {
            // HYLSY: Tällä viikolla ei ollut TULKIN hyväksymiä aikoja. 
            // Siirrytään VAIN 1 viikko eteenpäin ja yritetään heti uudestaan!
            currentDate.setDate(currentDate.getDate() + 7);
        }
        attempts++;
    }
    
    return draft;
};