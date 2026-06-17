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

    // Yritetään kaivaa teksti esiin, jos lomake antaakin objektin
    let str = typeof dateStr === 'object' ? (dateStr.value || dateStr.oletus || String(dateStr)) : dateStr;
    
    if (typeof str === 'string' && str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) {
            // new Date(Vuosi, Kuukausi (0-11), Päivä)
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
    // ---------------------------------------------------------
    // 1. RAAKADATAN KERUU & MATEMATIIKKA (Diagnoosia varten)
    // ---------------------------------------------------------
    
    // KORJATTU LUKEMISJÄRJESTYS: Lomakkeen pvm ensin, sitten vasta signaalit
    const rawThAlku = perustiedot?.TH_ALKU_PVM || signals.tyonhaku_alkanut;
    
    const rawPlanDate = perustiedot?.PÄIVÄMÄÄRÄ || perustiedot?.PVM;
    const rawKaynti = signals.edellinen_kaynti_pvm;
    const rawTapaaminen = signals.edellinen_tapaaminen_pvm;
    const rawSyntymavuosi = perustiedot?.SYNTYMÄVUOSI || signals.syntymavuosi;

    // Puhdas TH-kesto (Vain ja ainoastaan oikeasta signaalista)
    const thAlkuDate = parseSafeDate(rawThAlku);
    const thKestoKk = thAlkuDate ? getMonthsDiff(thAlkuDate) : null;

    // Puhdas iän laskenta
    let ika = null;
    if (rawSyntymavuosi) {
        const nro = parseInt(String(rawSyntymavuosi).replace(/\D/g, ''), 10);
        if (!isNaN(nro) && nro > 1900) ika = new Date().getFullYear() - nro;
    }

    // Vesiputouspäivämäärät Prioriteetti 3:a varten
    const planDate = parseSafeDate(rawPlanDate);
    const lastKayntiDate = parseSafeDate(rawKaynti) || planDate || thAlkuDate;
    const lastTapaaminenDate = parseSafeDate(rawTapaaminen) || planDate || thAlkuDate;

    const monthsFromKaynti = getMonthsDiff(lastKayntiDate);
    const monthsFromTapaaminen = getMonthsDiff(lastTapaaminenDate);

    // Kokoamme diagnoosiobjektin käyttöliittymän debug-ikkunaa varten
    const diagnostics = {
        rawThAlku,
        rawPlanDate,
        rawKaynti,
        rawTapaaminen,
        thKestoKk,
        ika,
        monthsFromKaynti,
        monthsFromTapaaminen,
        closestEndDays: Infinity
    };

    let suggestion = null;

    // Apufunktio sääntöjen turvalliseen hakuun
    const findRule = (metadataType, fallbackTitlePart) => {
        return rules.find(r => 
            (r.metadata?.rule_type === metadataType) || 
            (r.title && r.title.toLowerCase().includes(fallbackTitlePart.toLowerCase()))
        );
    };

    if (rules.length === 0) return { suggestion, diagnostics };

    // ---------------------------------------------------------
    // 2. SÄÄNTÖJEN PRIORITEETTIMOOTTORI
    // ---------------------------------------------------------

    // PRIORITEETTI 1: Palvelun päättyminen (46 §)
    // KORJATTU: Luetaan sessionServices taulukkona ja entity_key/data.loppu -rakenteella
    const servicesArray = Array.isArray(sessionServices) ? sessionServices : [];
    
    servicesArray.forEach(service => {
        const def = ENTITY_DEFINITIONS[service.entity_key];
        // Tarkistetaan loppupäivä dynaamisesta data-objektista
        const loppuPvm = service.data?.loppu;
        
        if (def && def.isLawCritical && loppuPvm) {
            const endDate = parseSafeDate(loppuPvm);
            if (endDate) {
                const days = getDaysDiff(endDate);
                // Huomioidaan vain tulevat tai juuri päättyneet (0-30 pv sisällä)
                if (days >= 0 && days < diagnostics.closestEndDays) {
                    diagnostics.closestEndDays = days;
                }
            }
        }
    });

    if (diagnostics.closestEndDays <= 30) {
        const rule = findRule('46_pykala', '46 §');
        if (rule) {
            suggestion = { 
                priority: 1, 
                rule, 
                reason: `Kriittisen palvelun päättymiseen ${diagnostics.closestEndDays} pv`, 
                type: 'paattyminen',
                suggestedCount: 1,
                suggestedPeriod: 1,
                forcedMode: null // Joustava
            };
            return { suggestion, diagnostics }; // Palautetaan heti
        }
    }

    // PRIORITEETTI 2: Aktivointijakso
    if (signals.ETUUS_TOIMEENTULOTUKI || signals.tt_etuus_yleistuki) {
        const rule = rules.find(r => r.metadata?.triggers?.require_yleistuki === true);
        if (rule) {
            suggestion = { 
                priority: 2, 
                rule, 
                reason: "Aktivointijakso (Etuus havaittu)", 
                type: 'aktivointi',
                suggestedCount: 3,
                suggestedPeriod: 3,
                forcedMode: 'kaynti' // Pakotetaan käynniksi
            };
            return { suggestion, diagnostics };
        }
    }

    // PRIORITEETTI 3: Lakisääteinen perusrytmi (Työnhakukeskustelu)
    // A-Haara: 6kk etappi
    if (monthsFromKaynti >= 6) {
        const rule = findRule('tyonhakukeskustelu', 'työnhakukeskustelu'); 
        if (rule) {
            suggestion = { 
                priority: 3, 
                rule, 
                reason: `Edellisestä KÄYNNISTÄ yli 6 kk`, 
                type: 'normi',
                suggestedCount: 1,
                suggestedPeriod: 1,
                forcedMode: 'kaynti' // Pakotetaan käynniksi
            };
            return { suggestion, diagnostics };
        }
    }
    
    // B-Haara: 3kk välietappi
    if (monthsFromTapaaminen >= 3) {
        const rule = findRule('tyonhakukeskustelu', 'työnhakukeskustelu');
        if (rule) {
            suggestion = { 
                priority: 3, 
                rule, 
                reason: `Edellisestä TAPAAMISESTA yli 3 kk`, 
                type: 'normi',
                suggestedCount: 1,
                suggestedPeriod: 1,
                forcedMode: null // Joustava
            };
            return { suggestion, diagnostics };
        }
    }

    // Jos ei ehtoja, suggestion on null (Täydentävä jää manuaaliseksi)
    return { suggestion, diagnostics };
};