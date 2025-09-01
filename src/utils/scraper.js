import { planData } from '../data/planData';

// --- APUFUNKTIOT ---

// Yhdistää kaksi objektia syvästi. Lähteen arvot ylikirjoittavat kohteen arvot.
const deepMerge = (target, source) => {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !source[key].teksti) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

const createPhraseObject = (sectionId, avainsana, muuttujat = {}) => {
    const section = planData.aihealueet.find(s => s.id === sectionId);
    if (!section) return null;
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;

    const newPhrase = {
        avainsana: phraseTemplate.avainsana,
        teksti: phraseTemplate.teksti,
        muuttujat: {}
    };

    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            newPhrase.muuttujat[key] = config.oletus !== undefined ? config.oletus : '';
        });
    }
    Object.assign(newPhrase.muuttujat, muuttujat);
    return newPhrase;
};

// --- STRATEGIA A: YLEINEN AVAINSANAHAKU (VANHA TAPA) ---
const parseWithStrategyA = (text) => {
    let state = {};
    
    // Perustiedot
    const startDateMatch = text.match(/Työnhakijaksi\s+(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (startDateMatch) {
        state.suunnitelman_perustiedot = {
            ...state.suunnitelman_perustiedot,
            tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot', 'tyonhaku_alkanut', { PÄIVÄMÄÄRÄ: startDateMatch[1] })
        };
    }
    const yearMatch = text.match(/koulutukseltaan\s+.*?v\.\s*(\d{4})/i);
    if(yearMatch) {
         state.suunnitelman_perustiedot = {
            ...state.suunnitelman_perustiedot,
            syntymavuosi: createPhraseObject('suunnitelman_perustiedot', 'syntymavuosi', { SYNTYMÄVUOSI: parseInt(yearMatch[1], 10) })
        };
    }

    // Koulutus
    const koulutusMatch = text.match(/koulutukseltaan\s+([^,.\n(]+)/i);
    if(koulutusMatch) {
        state.koulutus_yrittajyys = {
            ...state.koulutus_yrittajyys,
            koulutus_tausta: createPhraseObject('koulutus_yrittajyys', 'koulutus_tausta', { KOULUTUS: koulutusMatch[1].trim() })
        };
    }

    return state;
};

// --- STRATEGIA B: OTSIKKOPOHJAINEN ANALYYSI (UUSI TAPA) ---
const parseWithStrategyB = (text) => {
    let state = {};
    const sectionHeaders = {
        "NYKYTILANNE": "tyotilanne",
        "OSAAMINEN": "koulutus_yrittajyys",
        "TAVOITTEET JA SUUNNITELMA": "suunnitelma",
        "TYÖKYKYARVIO": "tyokyky",
        "TYÖNHAKUVELVOITE": "tyonhakuvelvollisuus"
    };

    // Paloittelutekniikka vaatii monimutkaisempaa logiikkaa,
    // joten käytetään yksinkertaisempia sääntöjä, jotka etsivät otsikon ja sen jälkeisen tekstin.
    
    // NYKYTILANNE
    let match = text.match(/NYKYTILANNE:([\s\S]*?)(?=\n[A-ZÖÄÅ -]+:|$)/i);
    if (match) {
        const content = match[1];
        state.tyotilanne = {};
        if (/työtön työhakija/i.test(content)) state.tyotilanne.tyoton = createPhraseObject('tyotilanne', 'tyoton');
        if (/ei ole ammatillista koulutusta/i.test(content)) {
            state.koulutus_yrittajyys = { ...state.koulutus_yrittajyys, ei_tutkintoa: createPhraseObject('koulutus_yrittajyys', 'ei_tutkintoa') };
        }
        state['custom-tyotilanne'] = content.trim(); // Koko kappale lisätietoihin
    }

    // OSAAMINEN
    match = text.match(/OSAAMINEN:([\s\S]*?)(?=\n[A-ZÖÄÅ -]+:|$)/i);
    if(match) {
        state['custom-koulutus_yrittajyys'] = match[1].trim();
    }

    // TYÖKYKYARVIO
    match = text.match(/TYÖKYKYARVIO:([\s\S]*?)(?=\n[A-ZÖÄÅ -]+:|$)/i);
    if(match) {
        state.tyokyky = {};
        const arvioMatch = match[1].match(/pistemääräkseen\s+(\d+)/i);
        if (arvioMatch) {
            state.tyokyky.omaArvio = arvioMatch[1];
        }
    }

    // TYÖNHAKUVELVOITE
    match = text.match(/TYÖNHAKUVELVOITE:([\s\S]*?)(?=\n[A-ZÖÄÅ -]+:|$)/i);
    if(match) {
        if(/ei asetettu/i.test(match[1])) {
             state.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus', 'ei_velvoitetta_tyokyky');
        }
        state['custom-tyonhakuvelvollisuus'] = match[1].trim();
    }

    return state;
};


// --- PÄÄFUNKTIO ---
export const parseTextToState = (text) => {
    // Aja molemmat strategiat
    const stateA = parseWithStrategyA(text);
    const stateB = parseWithStrategyB(text);

    // Yhdistä tulokset. Strategia B (tarkempi) ylikirjoittaa
    // Strategia A:n (yleisempi) tulokset tarvittaessa.
    const finalState = deepMerge(stateA, stateB);
    
    return finalState;
};
