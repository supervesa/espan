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

// --- UUSI, YKSINKERTAINEN JA VAKAA SCRAPER ---
export const parseTextToState = (text) => {
    let state = {};
    let workText = text;

    // Säännöt, jotka etsivät tarkkoja ja luotettavia tietoja
    const rules = [
        { // Työkyvyn oma arvio
            regex: /pistemäärän\s+(\d+)\s+asteikolla/i,
            action: (match, s) => {
                s.tyokyky = { ...s.tyokyky, omaArvio: match[1] };
            }
        },
        { // THV (numeroitu)
            regex: /työnhakuvelvollisuus on (\d+)\s+kpl\/kk/i,
            action: (match, s) => {
                s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus', 'paasaanto', { LKM: match[1], AIKAJAKSO: 'kuukaudessa' });
            }
        },
        { // THV (sanallinen)
            regex: /hakea vähintään (neljää)\s+työmahdollisuutta (kuukaudessa)/i,
            action: (match, s) => {
                 s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus', 'paasaanto', { LKM: 4, AIKAJAKSO: 'kuukaudessa' });
            }
        },
         { // Suunnitelman päivitystapa ja -aika
            regex: /päivitetty\s+(puhelimitse)\s+([\d.]+)/i,
            action: (match, s) => {
                 s.suunnitelman_perustiedot = { ...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot', 'laadittu', { YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: match[2] }) };
            }
        },
    ];

    // 1. Aja tarkat säännöt ja poista osumat tekstistä
    rules.forEach(rule => {
        const match = workText.match(rule.regex);
        if (match) {
            rule.action(match, state);
            workText = workText.replace(match[0], '');
        }
    });

    // 2. Jaa jäljelle jäänyt teksti osiin otsikoiden perusteella
    const sectionTriggers = {
        'custom-tyotilanne': /NYKYTILANNE:|Asiakas on/i,
        'custom-koulutus_yrittajyys': /OSAAMINEN:|koulutukseltaan/i,
        'custom-suunnitelma': /TAVOITTEET JA SUUNNITELMA:|Työnhaun tavoite:/i,
        'custom-tyokyky': /TYÖKYKYARVIO:|Asiakkaan työkyky|RAJOITTEET/i,
        'custom-tyonhakuvelvollisuus': /TYÖNHAKUVELVOITE:|oikeudet ja velvollisuudet/i
    };

    const foundTriggers = Object.entries(sectionTriggers)
        .map(([key, regex]) => ({ key, match: workText.match(regex) }))
        .filter(item => item.match)
        .sort((a, b) => a.match.index - b.match.index);

    if (foundTriggers.length > 0) {
        let lastIndex = 0;
        foundTriggers.forEach((trigger, i) => {
            const nextTrigger = foundTriggers[i + 1];
            const endIndex = nextTrigger ? nextTrigger.match.index : workText.length;
            const chunk = workText.substring(trigger.match.index, endIndex);
            
            // Poimitaan vielä avainsana, jos se on jäljellä
            if(trigger.key === 'custom-tyotilanne') {
                 if (/lomautettu/i.test(chunk)) {
                    state.tyotilanne = { ...state.tyotilanne, lomautettu: createPhraseObject('tyotilanne', 'lomautettu') };
                 }
            }
             if(trigger.key === 'custom-tyokyky') {
                 if (/ei ole.*vaikeuttavat työllistymistäni/i.test(chunk)) {
                    state.tyokyky = { ...state.tyokyky, paavalinta: { teksti: "Työkyky on normaali.", avainsana: "tyokyky_normaali"} };
                 }
             }
            
            const cleanChunk = chunk.replace(trigger.match[0], '').trim();
            if (cleanChunk) {
                state[trigger.key] = (state[trigger.key] || '') + cleanChunk + '\n';
            }
        });
    }

    return state;
};
