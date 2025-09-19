import { planData } from '../data/planData';

const createPhraseObject = (sectionId, avainsana, muuttujat = {}) => {
    const section = planData.aihealueet.find(s => s.id === sectionId);
    if (!section || !section.fraasit) return null;
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;
    const newPhrase = { avainsana, teksti: phraseTemplate.teksti, muuttujat: {} };
    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            newPhrase.muuttujat[key] = muuttujat[key] || config.oletus || '';
        });
    }
    return newPhrase;
};

export const parseTextToState = (text) => {
    let state = {};
    let workText = `\n${text}\n`;

    // Etsitään ensin edellinen THV-kirjaus
    const thvMatch = workText.match(/(TYÖNHAKUVELVOITE:|TYÖNHAKUVELVOLLISUUS)[\s\S]*/i);
    if (thvMatch) {
        // Etsitään seuraava pääotsikko tai tekstin loppu
        const subsequentText = thvMatch[0];
        const endMatch = subsequentText.substring(1).match(/\n[A-ZÖÄÅ -]{5,}:/);
        const thvBlock = endMatch ? subsequentText.substring(0, endMatch.index + 1) : subsequentText;
        state.previousThvText = thvBlock.replace(/(TYÖNHAKUVELVOITE:|TYÖNHAKUVELVOLLISUUS)/i, '').trim();
    }

    const rules = [
        { r: /Työnhakijaksi\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot','tyonhaku_alkanut',{PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /peruskoulutus\s+\((\d{4})\)/gi, a: (m,s) => { const year = parseInt(m[1], 10); s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, syntymavuosi: createPhraseObject('suunnitelman_perustiedot','syntymavuosi',{SYNTYMÄVUOSI: year - 16})};}},
        { r: /päivitetty\s+puhelimitse\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot','laadittu',{YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /lomautettu/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, lomautettu: createPhraseObject('tyotilanne','lomautettu')};}},
        { r: /työtön työhakija/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, tyoton: createPhraseObject('tyotilanne','tyoton')};}},
        { r: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, koulutus_tausta: createPhraseObject('koulutus_yrittajyys','koulutus_tausta',{KOULUTUS: m[1]})};}},
        { r: /pistemääräkseen\s+(\d+)/i, a: (m,s) => { s.tyokyky = {...s.tyokyky, omaArvio: m[1]};}},
        { r: /Työnhakuvelvollisuus on (\d+)\s+kpl\/kk/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: m[1], AIKAJAKSO: 'kuukaudessa'});}},
        { r: /hakea vähintään (neljää|4)\s+työmahdollisuutta (kuukaudessa)/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: 4, AIKAJAKSO: m[2]});}},
        { r: /Työnhakuvelvoitetta ei asetettu/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','ei_velvoitetta_tyokyky');}},
    ];

    rules.forEach(rule => {
        const matches = [...workText.matchAll(rule.r)];
        matches.forEach(match => {
            rule.a(match, state);
        });
    });

    return state;
};
