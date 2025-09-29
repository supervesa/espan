import { planData } from '../data/planData';

// --- APUFUNKTIOT ---
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

// --- SÄÄNTÖMOOTTORI V7: KONTEKSTITIETOINEN ---
export const parseTextToState = (text) => {
    let state = {};
    
    // Määritellään, mitkä otsikot tai avainlauseet kuuluvat mihinkin osioon
    const sectionTriggers = {
        suunnitelman_perustiedot: /Suunnitelma (on päivitetty|laadittu)/i,
        tyotilanne: /NYKYTILANNE:|Asiakas on (rakennusmies|työtön)/i,
        koulutus_yrittajyys: /OSAAMINEN:|Asiakas on koulutukseltaan|Asiakkaalla peruskoulutus|Kielitaito:/i,
        suunnitelma: /TAVOITTEET JA SUUNNITELMA:|Työnhaun tavoite:/i,
        tyokyky: /TYÖKYKYARVIO:|Asiakkaan työkyky|RAJOITTEET|Haasteina työuraa/i,
        tyonhakuvelvollisuus: /TYÖNHAKUVELVOITE:|oikeudet ja velvollisuudet|Työnhakuvelvollisuus on|Palvelumallin mukaisesti/i
    };

    // Säännöt, joita sovelletaan kunkin osion sisällä
    const rules = {
        suunnitelman_perustiedot: [
            { r: /päivitetty\s+(puhelimitse)\s+([\d.]+)/i, a: (m, s) => { s.laadittu = createPhraseObject('suunnitelman_perustiedot', 'laadittu', { YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[2] }); return m[0]; } },
            { r: /Työnhakijaksi\s+([\d.]+)/i, a: (m, s) => { s.tyonhaku_alkanut = createPhraseObject('suunnitelman_perustiedot', 'tyonhaku_alkanut', { PÄIVÄMÄÄRÄ: m[1] }); return m[0]; } },
            { r: /\((\d{4})\)/, a: (m, s) => { s.syntymavuosi = createPhraseObject('suunnitelman_perustiedot', 'syntymavuosi', { SYNTYMÄVUOSI: parseInt(m[1], 10) - 16 }); return m[0]; } },
        ],
        tyotilanne: [
            { r: /työtön työhakija/i, a: (m, s) => { s.tyoton = createPhraseObject('tyotilanne', 'tyoton'); return m[0]; } },
            { r: /lomautettu/i, a: (m, s) => { s.lomautettu = createPhraseObject('tyotilanne', 'lomautettu'); return m[0]; } }
        ],
        koulutus_yrittajyys: [
            { r: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/i, a: (m, s) => { s.koulutus_tausta = createPhraseObject('koulutus_yrittajyys', 'koulutus_tausta', { KOULUTUS: m[1] }); return m[0]; } },
            { r: /peruskoulutus|ei ole ammatillista koulutusta/i, a: (m, s) => { s.ei_tutkintoa = createPhraseObject('koulutus_yrittajyys', 'ei_tutkintoa'); return m[0]; } }
        ],
        tyokyky: [
             { r: /pistemääräkseen\s+(\d+)/i, a: (m, s) => { s.omaArvio = m[1]; return m[0]; } },
             { r: /B-todistuksen, missä määritellään:\s+"([^"]+)"/i, a: (m, s) => { s.alentumaKuvaus = (s.alentumaKuvaus || '') + `B-todistus: "${m[1]}"\n`; return m[0]; }},
        ],
        tyonhakuvelvollisuus: [
            { r: /alennetaan työnhakuvelvoite olemaan (\w+)\s+(\d+)\s+työhakemusta (kuukauden jaksoissa)/i, a: (m, s) => { state.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus', 'manuaalinen', { LKM: 2, AIKAJAKSO: 'kuukaudessa' }); return m[0]; } },
            { r: /(\d+)\s+kpl\/kk/i, a: (m, s) => { state.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus', 'paasaanto', { LKM: m[1], AIKAJAKSO: 'kuukaudessa' }); return m[0]; } }
        ]
    };
    
    // Etsitään triggerien sijainnit tekstistä
    const foundTriggers = Object.entries(sectionTriggers)
        .map(([id, regex]) => ({ id, match: text.match(regex) }))
        .filter(item => item.match)
        .sort((a, b) => a.match.index - b.match.index);

    if (foundTriggers.length === 0) {
        // Jos mitään otsikoita ei löydy, laitetaan kaikki suunnitelman lisätietoihin
        state['custom-suunnitelma'] = text;
        return state;
    }

    // Pilkotaan teksti osiin triggerien perusteella
    let lastIndex = 0;
    foundTriggers.forEach((trigger, i) => {
        const nextTrigger = foundTriggers[i + 1];
        const endIndex = nextTrigger ? nextTrigger.match.index : text.length;
        
        let chunkText = text.substring(lastIndex, endIndex);
        
        // Määritetään, mihin osioon tämä kappale kuuluu
        const currentSectionId = trigger.id;
        
        let sectionState = state[currentSectionId] || {};
        
        // Sovelletaan sääntöjä vain tähän kappaleeseen
        if (rules[currentSectionId]) {
            rules[currentSectionId].forEach(rule => {
                const globalRegex = new RegExp(rule.r.source, 'gi');
                chunkText = chunkText.replace(globalRegex, (match, ...args) => {
                    rule.a([match, ...args], sectionState);
                    return ''; // Poista käsitelty osa
                });
            });
        }

        // Siivotaan jäljelle jäänyt teksti ja lisätään se lisätietoihin
        const cleanRemainingText = chunkText.replace(trigger.match[0], '').replace(/:\s*\n/, '').trim();
        if (cleanRemainingText.length > 5) {
            state[`custom-${currentSectionId}`] = (state[`custom-${currentSectionId}`] || '') + cleanRemainingText + '\n';
        }

        // Yhdistetään osion tila pää-stateen
        if (Object.keys(sectionState).length > 0) {
            state[currentSectionId] = { ...(state[currentSectionId] || {}), ...sectionState };
        }

        lastIndex = endIndex;
    });

    return state;
};

