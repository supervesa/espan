// --- src/components/AikatauluEhdotus/locationInterpreter.js ---
import { findAvailableSlots } from './schedulingUtils';

/**
 * PÄÄTULKKI: Käsittelee viikkonäkymän asiantuntijan manuaalista valintaa varten.
 * Toteuttaa GM 2.5 vesiputouksen, ankkurin ja lennossa laimentamisen.
 */
export const getInterpretedWeekSlots = (targetRuleType, expertRules, bookedSlots, searchStart, expertLocations) => {
    // 1. Hae raakakapasiteetti kaikista luokista katseltavalle viikolle
    const rawNormi = findAvailableSlots('normi', expertRules, bookedSlots, searchStart, 1);
    const rawTaydentava = findAvailableSlots('taydentava', expertRules, bookedSlots, searchStart, 1);
    const rawAktivointi = findAvailableSlots('aktivointi', expertRules, bookedSlots, searchStart, 1);

    // Apufunktio: Kerros 1 (Estot) ja Kerros 2 (Laimennus)
    const filterAndDowngrade = (slots) => {
        return slots.filter(slot => {
            const dateStr = slot.time.toISOString().split('T')[0];
            const dayLoc = expertLocations.find(l => l.date === dateStr);
            
            // SÄÄNTÖ 0: ESTETÄÄN LOMAT, PYHÄT JA SISÄTYÖT KOKONAAN
            if (dayLoc && (dayLoc.location_type === 'loma' || dayLoc.location_type === 'pyha' || dayLoc.location_type.startsWith('sisatyot_'))) {
                return false;
            }
            
            // SÄÄNTÖ 1: Etäpuheluita EI saa varata päiville, joita ei ole vielä lukittu (automaatin haamuehdotukset).
            if (dayLoc && dayLoc.is_auto_generated && slot.mode === 'puhelu') {
                return false; 
            }
            return true;
        }).map(slot => {
            const dateStr = slot.time.toISOString().split('T')[0];
            const dayLoc = expertLocations.find(l => l.date === dateStr);
            
            // LENNOSSA LAIMENTAMINEN (Downgrade)
            if (dayLoc && !dayLoc.is_auto_generated) {
                if (dayLoc.location_type === 'eta') return { ...slot, mode: 'puhelu', isTranslated: true };
                if (dayLoc.location_type === 'lahityo') return { ...slot, mode: 'kaynti', isTranslated: true };
            }
            return slot;
        });
    };

    const processedNormi = filterAndDowngrade(rawNormi);
    const processedTaydentava = filterAndDowngrade(rawTaydentava);
    const processedAktivointi = filterAndDowngrade(rawAktivointi);

    // 2. VAKIOANKKURI (⭐ Vain alkuhaastattelu)
    let anchorSlot = null;
    const sortedNormi = [...processedNormi].sort((a, b) => a.time - b.time);
    if (sortedNormi.length > 0) {
        anchorSlot = { ...sortedNormi[0], isAnchor: true, icon: '⭐', label: 'Vain alkuhaastattelu' };
    }

    // Suodatetaan ankkuri pois tavallisten normiaikojen pinosta
    const normiPool = processedNormi.filter(s => anchorSlot && s.time.getTime() !== anchorSlot.time.getTime());

    // 3. MAANANTAIN TUNNISTUS
    const isMonday = (slot) => slot.time.getDay() === 1;

    const normiTiPe = normiPool.filter(s => !isMonday(s));
    const normiMa = normiPool.filter(s => isMonday(s));
    const taydentavaTiPe = processedTaydentava.filter(s => !isMonday(s));
    const taydentavaMa = processedTaydentava.filter(s => isMonday(s));

    let finalSlots = [];

    // 4. VESIPUTOUSMALLI JOS HAETAAN TAVALLISTA AIKAA
    if (targetRuleType === 'normi') {
        // Taso 1: Vihreä vyöhyke
        finalSlots = [...normiTiPe];

        // Taso 2: Kapasiteettivaroitus (Enää <= 2 normiaikaa jäljellä)
        if (normiTiPe.length <= 2) {
            const borrowed = taydentavaTiPe.map(s => ({...s, isBorrowed: true, icon: '⚠️', label: 'Lainattu täydentävistä'}));
            finalSlots = [...finalSlots, ...borrowed];
        }

        // Taso 3: Maanantain uhraus
        if (normiTiPe.length === 0 && taydentavaTiPe.length === 0) {
            finalSlots = [...finalSlots, ...normiMa];
            const borrowedMa = taydentavaMa.map(s => ({...s, isBorrowed: true, icon: '⚠️', label: 'Lainattu täydentävistä'}));
            finalSlots = [...finalSlots, ...borrowedMa];
        }

        // Taso 4: Viimeinen linnake
        if (finalSlots.length === 0) {
            const borrowedAkti = processedAktivointi.map(s => ({...s, isBorrowed: true, icon: '🚨', label: 'Lainattu aktivoinnista'}));
            finalSlots = [...borrowedAkti];
        }
    } else if (targetRuleType === 'taydentava') {
        finalSlots = [...processedTaydentava];
    } else if (targetRuleType === 'aktivointi') {
        finalSlots = [...processedAktivointi];
    }

    // Näytetään ankkuri aina ruudulla
    if (anchorSlot) {
        finalSlots.push(anchorSlot);
    }

    return finalSlots.sort((a, b) => a.time - b.time);
};

/**
 * KORITULKKI: Käsittelee automaattisen ehdotusmoottorin (draftingEngine) tekemät korit.
 * Tekee estot/laimennukset ja piilottaa ankkurin, jotta automaatti ei varaa alkuhaastatteluaikoja.
 */
export const interpretDraftBasket = (slots, expertRules, bookedSlots, expertLocations) => {
    if (!slots) return [];
    
    // Perus laimennus ja estot
    let filtered = slots.filter(slot => {
        const dateStr = slot.time.toISOString().split('T')[0];
        const dayLoc = expertLocations.find(l => l.date === dateStr);
        if (dayLoc && (dayLoc.location_type === 'loma' || dayLoc.location_type === 'pyha' || dayLoc.location_type.startsWith('sisatyot_'))) return false;
        if (dayLoc && dayLoc.is_auto_generated && slot.mode === 'puhelu') return false;
        return true;
    }).map(slot => {
        const dateStr = slot.time.toISOString().split('T')[0];
        const dayLoc = expertLocations.find(l => l.date === dateStr);
        if (dayLoc && !dayLoc.is_auto_generated) {
            if (dayLoc.location_type === 'eta') return { ...slot, mode: 'puhelu', isTranslated: true };
            if (dayLoc.location_type === 'lahityo') return { ...slot, mode: 'kaynti', isTranslated: true };
        }
        return slot;
    });

    // Piilotetaan ankkurit automaattiselta korilta
    return filtered.filter(slot => {
        const slotDate = new Date(slot.time);
        const dayOfWeek = slotDate.getDay();
        const diffToMonday = slotDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startOfWeek = new Date(slotDate);
        startOfWeek.setDate(diffToMonday);
        startOfWeek.setHours(0,0,0,0);

        const rawNormi = findAvailableSlots('normi', expertRules, bookedSlots, startOfWeek, 1);
        const processedNormi = rawNormi.filter(s => {
            const ds = s.time.toISOString().split('T')[0];
            const dl = expertLocations.find(l => l.date === ds);
            if (dl && (dl.location_type === 'loma' || dl.location_type === 'pyha' || dl.location_type.startsWith('sisatyot_'))) return false;
            return true;
        }).sort((a, b) => a.time - b.time);

        const anchor = processedNormi.length > 0 ? processedNormi[0] : null;

        if (anchor && slot.time.getTime() === anchor.time.getTime()) {
            return false; // Heitetään slotti pois, automaatti yritti varata ankkurin!
        }
        return true;
    });
};