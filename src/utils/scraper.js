import { planData } from '../data/planData';

const FINGERPRINT = '\u200B\u200D\u200C'; // Näkymätön sormenjälki

// --- APUFUNKTIOT ---
const createPhraseObject = (sectionId, avainsana, muuttujat = {}) => {
    const section = planData.aihealueet.find(s => s.id === sectionId);
    if (!section || !section.fraasit) return null;
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;

    const newPhrase = { 
        avainsana, 
        teksti: phraseTemplate.teksti, 
        lyhenne: phraseTemplate.lyhenne,
        muuttujat: {} 
    };
    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            newPhrase.muuttujat[key] = muuttujat[key] || config.oletus || '';
        });
    }
    return newPhrase;
};

// --- PRIORITEETTI 1: SORMENJÄLJEN TUNNISTUS ---
const parseWithFingerprint = (text) => {
    let state = {};
    const cleanText = text.replace(FINGERPRINT, '');
    const sections = cleanText.split('\n\n');
    const sectionMap = new Map(planData.aihealueet.map(s => [s.otsikko, s]));

    sections.forEach(sectionBlock => {
        const lines = sectionBlock.split('\n');
        const title = lines.shift();
        const section = sectionMap.get(title);

        if (!section) return;

        let freeText = [];

        lines.forEach(line => {
            const valintaMatch = line.match(/^Valinta(?: \((.*?)\))?:\s+(.*)/);
            const lisatiedotMatch = line.match(/^Lisätiedot:\s+(.*)/);
            const omaArvioMatch = line.match(/^Oma arvio:\s+(\d+)\/10/);
            const kuvausAlentumastaMatch = line.match(/^Kuvaus alentumasta:\s+(.*)/);

            if (valintaMatch) {
                const avainsana = valintaMatch[1];
                const teksti = valintaMatch[2];
                // Etsitään oikea fraasi joko avainsanan tai tekstin alun perusteella
                const phraseTemplate = section.fraasit?.find(f => f.avainsana === avainsana || f.teksti.startsWith(teksti.substring(0, 20)));

                if (phraseTemplate) {
                    if (section.monivalinta) {
                        if (!state[section.id]) state[section.id] = {};
                        state[section.id][phraseTemplate.avainsana] = { ...phraseTemplate };
                    } else {
                        state[section.id] = { ...phraseTemplate };
                    }
                }
            } else if (omaArvioMatch) {
                if (!state.tyokyky) state.tyokyky = {};
                state.tyokyky.omaArvio = omaArvioMatch[1];
            } else if (kuvausAlentumastaMatch) {
                if (!state.tyokyky) state.tyokyky = {};
                state.tyokyky.alentumaKuvaus = kuvausAlentumastaMatch[1];
            } else if (lisatiedotMatch) {
                freeText.push(lisatiedotMatch[1]);
            } else {
                freeText.push(line);
            }
        });

        if (freeText.length > 0) {
            state[`custom-${section.id}`] = freeText.join('\n');
        }
    });

    return state;
};

// --- PRIORITEETTI 2: JOUSTAVA SÄÄNTÖMOOTTORI (VARA-ANALYSI) ---
const parseWithRuleEngine = (text) => {
    let state = {};
    let workText = `\n${text}\n`;

    const rules = [
        // Perustiedot
        { r: /Työnhakijaksi\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot','tyonhaku_alkanut',{PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /peruskoulutus\s+\((\d{4})\)/gi, a: (m,s) => { const year = parseInt(m[1], 10); s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, syntymavuosi: createPhraseObject('suunnitelman_perustiedot','syntymavuosi',{SYNTYMÄVUOSI: year - 16})};}},
        { r: /päivitetty\s+puhelimitse\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot','laadittu',{YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[2]})};}},
        
        // Työtilanne
        { r: /lomautettu/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, lomautettu: createPhraseObject('tyotilanne','lomautettu')};}},
        { r: /työtön työhakija/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, tyoton: createPhraseObject('tyotilanne','tyoton')};}},

        // Koulutus
        { r: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, koulutus_tausta: createPhraseObject('koulutus_yrittajyys','koulutus_tausta',{KOULUTUS: m[1]})};}},
        { r: /peruskoulutus/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, ei_tutintoa: createPhraseObject('koulutus_yrittajyys','ei_tutintoa')};}},
        { r: /Ei yritystä tai yrittäjyysajatuksia/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, ei_yrittajyysajatuksia: createPhraseObject('koulutus_yrittajyys','ei_yrittajyysajatuksia')};}},

        // Työkyky
        { r: /pistemäärän\s+(\d+)\s+asteikolla/gi, a: (m,s) => { s.tyokyky = {...s.tyokyky, omaArvio: m[1]};}},
        { r: /vaikeuttavat työllistymistäni/gi, a: (m,s) => { s.tyokyky = {...s.tyokyky, paavalinta: {avainsana: 'tyokyky_normaali', teksti: 'Työkyky on normaali.'}}}},
        
        // THV
        { r: /Työnhakuvelvollisuus on (\d+)\s+kpl\/kk/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: m[1], AIKAJAKSO: 'kuukaudessa'});}},
        { r: /hakea vähintään (neljää|4)\s+työmahdollisuutta (kuukaudessa)/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: 4, AIKAJAKSO: 'kuukaudessa'});}},
        { r: /Työnhakuvelvoitetta ei asetettu/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','ei_velvoitetta_tyokyky');}},
    ];

    rules.forEach(rule => {
        const matches = [...workText.matchAll(rule.r)];
        matches.forEach(match => {
            rule.a(match, state);
            workText = workText.replace(match[0], '');
        });
    });

    // Jäljelle jääneen vapaan tekstin lajittelu
    const contextRules = {
        'custom-koulutus_yrittajyys': /OSAAMINEN:|Kielitaito:|Digitaidot/i,
        'custom-tyokyky': /TYÖKYKYARVIO:|RAJOITTEET|Haasteina työuraa/i,
        'custom-suunnitelma': /TAVOITTEET JA SUUNNITELMA:|Työnhaun tavoite:/i,
    };
    
    const chunks = workText.split(/(?=\n(?:NYKYTILANNE:|OSAAMINEN:|TAVOITTEET JA SUUNNITELMA:|TYÖKYKYARVIO:|RAJOITTEET:|TYÖNHAKUVELVOITE:))/i);
    
    chunks.forEach(chunk => {
        let assigned = false;
        for (const [key, regex] of Object.entries(contextRules)) {
            if (regex.test(chunk)) {
                const cleanChunk = chunk.replace(regex, '').trim();
                if (cleanChunk) state[key] = (state[key] || '') + cleanChunk + '\n';
                assigned = true;
                break;
            }
        }
        if (!assigned && chunk.trim().length > 10) {
            state['custom-suunnitelma'] = (state['custom-suunnitelma'] || '') + chunk.trim() + '\n';
        }
    });

    return state;
};


// --- PÄÄFUNKTIO ---
export const parseTextToState = (text) => {
    if (text.startsWith(FINGERPRINT)) {
        return parseWithFingerprint(text);
    } else {
        return parseWithRuleEngine(text);
    }
};