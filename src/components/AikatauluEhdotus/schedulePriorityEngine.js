// Keskitetty määritys palveluille ja niiden kriittisyydelle (46 § tutkaa varten)
export const ENTITY_DEFINITIONS = {
    tyokokeilu: { label: "Työkokeilu", category: "palvelu", icon: "Briefcase", fields: { alku: "date", loppu: "date", jarjestaja: "text" }, isLawCritical: true },
    palkkatuki: { label: "Palkkatuki", category: "palvelu", icon: "Coins", fields: { alku: "date", loppu: "date", tyonantaja: "text" }, isLawCritical: true },
    tyovoimakoulutus: { label: "Työvoimakoulutus", category: "palvelu", icon: "GraduationCap", fields: { alku: "date", loppu: "date", koulutus: "text" }, isLawCritical: true },
    opiskelu_omaehtoinen: { label: "Omaehtoinen opiskelu", category: "opiskelu", icon: "BookOpen", fields: { alku: "date", loppu: "date", oppilaitos: "text", tutkinto: "text" }, isLawCritical: true },
    opiskelu_sivutoiminen: { label: "Sivutoiminen opiskelu", category: "opiskelu", icon: "Clock", fields: { alku: "date", loppu: "date", oppilaitos: "text" }, isLawCritical: false }
};

// Apufunktiot päivämäärien turvalliseen käsittelyyn
const parseSafeDate = (dateStr) => {
    if (!dateStr) return null;
    let str = typeof dateStr === 'object' ? (dateStr.value || dateStr.oletus || String(dateStr)) : dateStr;
    if (typeof str === 'string' && str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) {
            const parsed = new Date(parts[2], parts[1] - 1, parts[0]);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

const getMonthsDiff = (startDate) => {
    if (!startDate) return 0;
    const now = new Date();
    return Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 - startDate.getMonth() + now.getMonth());
};

const getDaysDiff = (endDate) => {
    if (!endDate) return Infinity;
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// PÄÄMOOTTORI: Analysoi kaiken ja palauttaa ehdotuksen + diagnoosidatan
export const analyzeSchedule = (rules = [], signals = {}, sessionServices = [], perustiedot = {}) => {
    
    const rawThAlku = perustiedot?.TH_ALKU_PVM || signals.tyonhaku_alkanut;
    const rawPlanDate = perustiedot?.PÄIVÄMÄÄRÄ || perustiedot?.PVM;
    const rawKaynti = signals.edellinen_kaynti_pvm;
    const rawTapaaminen = signals.edellinen_tapaaminen_pvm;
    const rawSyntymavuosi = perustiedot?.SYNTYMÄVUOSI || signals.syntymavuosi;

    const thAlkuDate = parseSafeDate(rawThAlku);
    const thKestoKk = thAlkuDate ? getMonthsDiff(thAlkuDate) : null;

    let ika = null;
    if (rawSyntymavuosi) {
        const nro = parseInt(String(rawSyntymavuosi).replace(/\D/g, ''), 10);
        if (!isNaN(nro) && nro > 1900) ika = new Date().getFullYear() - nro;
    }

    const planDate = parseSafeDate(rawPlanDate);
    const lastKayntiDate = parseSafeDate(rawKaynti) || planDate || thAlkuDate;
    const lastTapaaminenDate = parseSafeDate(rawTapaaminen) || planDate || thAlkuDate;

    const monthsFromKaynti = getMonthsDiff(lastKayntiDate);
    const monthsFromTapaaminen = getMonthsDiff(lastTapaaminenDate);

    const diagnostics = {
        rawThAlku, rawPlanDate, rawKaynti, rawTapaaminen, thKestoKk, ika,
        monthsFromKaynti, monthsFromTapaaminen, closestEndDays: Infinity
    };

    let suggestion = null;

    const findRule = (metadataType, fallbackTitlePart) => {
        return rules.find(r => 
            (r.metadata?.rule_type === metadataType) || 
            (r.title && r.title.toLowerCase().includes(fallbackTitlePart.toLowerCase()))
        );
    };

    if (rules.length === 0) return { suggestion, diagnostics };

    // PRIORITEETTI 1: Palvelun päättyminen (46 §)
    const servicesArray = Array.isArray(sessionServices) ? sessionServices : [];
    servicesArray.forEach(service => {
        const def = ENTITY_DEFINITIONS[service.entity_key];
        const loppuPvm = service.data?.loppu;
        if (def && def.isLawCritical && loppuPvm) {
            const endDate = parseSafeDate(loppuPvm);
            if (endDate) {
                const days = getDaysDiff(endDate);
                if (days >= 0 && days < diagnostics.closestEndDays) diagnostics.closestEndDays = days;
            }
        }
    });

    if (diagnostics.closestEndDays <= 30) {
        const rule = findRule('46_pykala', '46 §');
        if (rule) {
            suggestion = { 
                priority: 1, rule, 
                reason: `Kriittisen palvelun päättymiseen ${diagnostics.closestEndDays} pv`, 
                type: 'paattyminen', suggestedCount: 1, suggestedPeriod: 1, forcedMode: null 
            };
            return { suggestion, diagnostics };
        }
    }

    // PRIORITEETTI 2: Aktivointijakso (Aina 3 kpl, 3 kk, Käynti)
    if (signals.ETUUS_TOIMEENTULOTUKI || signals.tt_etuus_yleistuki) {
        const rule = rules.find(r => r.metadata?.triggers?.require_yleistuki === true);
        if (rule) {
            suggestion = { 
                priority: 2, rule, 
                reason: "Aktivointijakso (Etuus havaittu)", 
                type: 'aktivointi', suggestedCount: 3, suggestedPeriod: 3, forcedMode: 'kaynti' 
            };
            return { suggestion, diagnostics };
        }
    }

    // PRIORITEETTI 3: Lakisääteinen perusrytmi - ANKKURIMALLI (Aina eteenpäin)
    if (thAlkuDate) {
        const base = new Date(thAlkuDate);
        let targetMonths = 3;
        let nextMilestone = new Date(base);
        nextMilestone.setMonth(base.getMonth() + targetMonths);

        // Määritetään turvaraja: Emme hae aikaa menneisyydestä, emmekä liian läheltä nykyhetkeä
        const today = new Date();
        const bufferDate = new Date();
        bufferDate.setDate(bufferDate.getDate() + 14); // Haetaan 14 pv päähän aikaisintaan

        // Todellisuustarkistus: Jos tapaaminen oli esim. viikko sitten, vältetään tuplabuukkaus
        const tapaaminenBuffer = lastTapaaminenDate ? new Date(lastTapaaminenDate) : new Date(0);
        if (lastTapaaminenDate) tapaaminenBuffer.setDate(tapaaminenBuffer.getDate() + 45); // Ohitetaan jos alle 1.5 kk edellisestä

        // Kumpaa rajaa noudatetaan (kumpi on kauempana)
        const limitDate = bufferDate > tapaaminenBuffer ? bufferDate : tapaaminenBuffer;

        // Kelataan ruudukkoa eteenpäin kunnes löydetään puhdas tulevaisuuden etappi
        while (nextMilestone < limitDate && targetMonths <= 120) {
            targetMonths += 3;
            nextMilestone = new Date(base);
            nextMilestone.setMonth(base.getMonth() + targetMonths);
        }

        const isSixMonthStep = (targetMonths % 6 === 0);
const rule = findRule('saannollinen_tyonhakukeskustelu', 'säännöllise');
        
        if (rule) {
            suggestion = { 
                priority: 3, rule, 
                reason: `Lakisääteinen ${targetMonths} kk etappi (${nextMilestone.toLocaleDateString('fi-FI')})`, 
                type: 'normi', suggestedCount: 1, suggestedPeriod: 1, 
                forcedMode: isSixMonthStep ? 'kaynti' : null,
                targetDate: nextMilestone // <-- Tämä välitetään nyt kalenterille!
            };
            return { suggestion, diagnostics };
        }
    }

    return { suggestion, diagnostics };
};