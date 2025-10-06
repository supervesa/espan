import { planData } from '../data/planData';

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

export const parseWithRuleEngine = (text) => {
    let state = {};
    let workText = `\n${text}\n`;

    const rules = [
        { r: /Työnhakijaksi\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot','tyonhaku_alkanut',{PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /peruskoulutus\s+\((\d{4})\)/gi, a: (m,s) => { const year = parseInt(m[1], 10); s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, syntymavuosi: createPhraseObject('suunnitelman_perustiedot','syntymavuosi',{SYNTYMÄVUOSI: year - 16})};}},
        { r: /päivitetty\s+puhelimitse\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot','laadittu',{YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[2]})};}},
        { r: /lomautettu/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, lomautettu: createPhraseObject('tyotilanne','lomautettu')};}},
        { r: /työtön työnhakija/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, tyoton: createPhraseObject('tyotilanne','tyoton')};}},
        { r: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, koulutus_tausta: createPhraseObject('koulutus_yrittajyys','koulutus_tausta',{KOULUTUS: m[1]})};}},
        // KORJATTU: Lisätty 'g'-lippu
        { r: /pistemääräkseen\s+(\d+)/gi, a: (m,s) => { s.tyokyky = {...s.tyokyky, omaArvio: m[1]};}},
        { r: /Työnhakuvelvollisuus on (\d+)\s+kpl\/kk/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: m[1], AIKAJAKSO: 'kuukaudessa'});}},
        { r: /hakea vähintään (neljää|4)\s+työmahdollisuutta (kuukaudessa)/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: 4, AIKAJAKSO: 'kuukaudessa'});}},
        { r: /Työnhakuvelvoitetta ei asetettu/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','ei_velvoitetta_tyokyky');}},
    ];

    rules.forEach(rule => {
        // Varmistetaan, että regex on aina globaali
        const globalRegex = new RegExp(rule.r.source, 'gi');
        const matches = [...workText.matchAll(globalRegex)];
        matches.forEach(match => {
            rule.a(match, state);
            workText = workText.replace(match[0], '');
        });
    });

    const contextRules = {
        'custom-koulutus_yrittajyys': /OSAAMINEN:|Kielitaito:|Digitaidot/i,
        'custom-tyokyky': /TYÖKYKYARVIO:|RAJOITTEET|Haasteina työuraa/i,
        'custom-suunnitelma': /TAVOITTEET JA SUUNNITELMA:|Työnhaun tavoite:/i,
    };
    
    Object.entries(contextRules).forEach(([key, regex]) => {
        const match = workText.match(regex);
        if (match) {
            const subsequentText = workText.substring(match.index);
            const paragraphMatch = subsequentText.match(/([\s\S]*?)(?=\n\n[A-ZÖÄÅ -]+:|$)/);
            if (paragraphMatch) {
                let cleanText = paragraphMatch[1].replace(regex, '').trim();
                if (cleanText) state[key] = (state[key] || '') + cleanText + '\n';
            }
        }
    });

    return state;
};