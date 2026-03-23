// src/utils/ruleEngineParser.jsx
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

// --- PÄIVITETTY SÄÄNTÖMOOTTORI (VAIN FAKTAT) ---
// Poimii VAIN 100% varmat, yksiselitteiset FAKTAT.
export const parseWithRuleEngine = (text) => {
    let state = {};
    const workText = `\n${text}\n`; 

    const rules = [
        // --- SUUNNITELMAN PERUSTIEDOT (FAKTAT) ---
        // Nämä on päivitetty vastaamaan esimerkkiäsi.
        { r: /Asiakkaan työnhaku on alkanut\s+([\d.]+)/i, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot','tyonhaku_alkanut',{PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /Tämä suunnitelma laadittiin puhelinajalla\s+([\d.]+)/i, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot','laadittu',{YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[1]})};}},
        
        // --- TYÖKYKY (FAKTA) ---
        // Pidetään tämä siltä varalta, että 'pistemääräkseen X' löytyy.
        { r: /pistemääräkseen\s+(\d+)/i, a: (m,s) => { s.tyokyky = {...s.tyokyky, omaArvio: m[1]};}},

        // --- POISTETUT SÄÄNNÖT ---
        // POISTETTU: 'lomautettu', 'työtön työnhakija' (Gemini hoitaa tulkinnan)
        // POISTETTU: 'koulutukseltaan' (Gemini hoitaa tulkinnan)
        // POISTETTU: 'Työnhakuvelvollisuus...' (Gemini hoitaa tulkinnan)
        // POISTETTU: 'peruskoulutus (YYYY)' (Liian epävarma, Gemini hoitaa)
    ];

    rules.forEach(rule => {
        const globalRegex = new RegExp(rule.r.source, 'gi');
        const matches = [...workText.matchAll(globalRegex)];
        if (matches.length > 0) {
             rule.a(matches[matches.length - 1], state);
        }
    });

    return state;
};