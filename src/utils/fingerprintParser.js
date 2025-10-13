import { planData } from '../data/planData';

// --- APUFUNKTIO ---
/**
 * Luo uuden fraasi-objektin annettujen tietojen perusteella.
 * @param {object} section - Koko aihealue-objekti planDatasta.
 * @param {string} avainsana - Fraasin yksilöivä avainsana.
 * @param {object} [muuttujat={}] - Valinnaiset muuttujat fraasille.
 * @returns {object|null} Palauttaa uuden fraasi-objektin tai null, jos mallia ei löydy.
 */
const createPhraseObject = (section, avainsana, muuttujat = {}) => {
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


// --- TEKOÄLYN JSON-VASTAUKSEN JÄSENTÄJÄ ---
/**
 * Jäsentää tekoälyn tuottaman JSON-objektin sovelluksen sisäiseksi state-objektiksi.
 * @param {object} data - Tekoälyn tuottama JSON-data.
 * @returns {object} Jäsennelty state-objekti.
 */
const parseAiJson = (data) => {
    const state = {};
    const sectionMap = new Map(planData.aihealueet.map(s => [s.id, s]));

    for (const sectionId in data) {
        if (!data.hasOwnProperty(sectionId)) continue;

        const aiSectionData = data[sectionId];
        const sectionConfig = sectionMap.get(sectionId);
        if (!sectionConfig) continue;

        // Käsittele lisätiedot (vapaa teksti) kaikille osioille samalla tavalla
        if (aiSectionData.lisatiedot) {
            state[`custom-${sectionId}`] = aiSectionData.lisatiedot;
        }

        switch (sectionId) {
            case 'tyotilanne':
                if (aiSectionData.valinnat && Array.isArray(aiSectionData.valinnat)) {
                    state[sectionId] = {}; // Alustetaan objekti monivalinnoille
                    aiSectionData.valinnat.forEach(avainsana => {
                        const phrase = createPhraseObject(sectionConfig, avainsana);
                        if (phrase) {
                            // Lisätään jokainen valinta omalla avaimellaan
                            state[sectionId][avainsana] = phrase;
                        }
                    });
                }
                break;

            case 'koulutus_yrittajyys':
                if (aiSectionData.valinnat && typeof aiSectionData.valinnat === 'object') {
                    // Otetaan ensimmäinen avain objektista (pitäisi olla 'koulutus_tausta')
                    const avainsana = Object.keys(aiSectionData.valinnat)[0];
                    if (avainsana) {
                        const muuttujat = aiSectionData.valinnat[avainsana];
                        const phrase = createPhraseObject(sectionConfig, avainsana, muuttujat);
                        if (phrase) {
                            state[sectionId] = phrase; // Asetetaan suoraan, koska ei ole monivalinta
                        }
                    }
                }
                break;

            case 'tyokyky':
                state[sectionId] = {}; // Alustetaan aina tyhjä objekti
                if (aiSectionData.paavalinta) {
                    // Rakennetaan Työkyky-komponentin odottama state-rakenne manuaalisesti
                    state[sectionId].paavalinta = { avainsana: aiSectionData.paavalinta };
                }
                if (aiSectionData.alentumaKuvaus) {
                    state[sectionId].alentumaKuvaus = aiSectionData.alentumaKuvaus;
                }
                if (aiSectionData.koonti) {
                    state[sectionId].koonti = aiSectionData.koonti;
                }
                break;
            
            // Lisää muut osiot tarvittaessa
            default:
                break;
        }
    }
    return state;
};


// --- PERINTEISEN TEKSTIN JÄSENTÄJÄ ---
/**
 * Jäsentää tekstimuotoisen suunnitelman rakenteelliseksi state-objektiksi.
 * @param {string} text - Lihavoiduilla otsikoilla jäsennelty tekstisisältö.
 * @returns {object} Jäsennelty state-objekti.
 */
const parseWithBoldHeadings = (text) => {
    let state = {};
    const sections = text.split(/^\*\*(.*?)\*\*$/m).slice(1);
    const sectionMap = new Map(planData.aihealueet.map(s => [s.otsikko, s]));

    for (let i = 0; i < sections.length; i += 2) {
        const title = sections[i].trim();
        const content = sections[i + 1].trim();
        const section = sectionMap.get(title);

        if (!section) continue;

        let freeTextLines = [];
        const lines = content.split('\n');

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.includes("Tämä suunnitelma laadittiin")) return;
            
            let matchFound = false;

            // Yritetään löytää fraasi, joka täsmää koko riviin
            const fullLinePhrase = section.fraasit?.find(f => f.teksti.replace(/\[.*?\]\s*/g, '').trim() === trimmedLine);

            if (fullLinePhrase) {
                const newPhrase = createPhraseObject(section, fullLinePhrase.avainsana);
                if (section.monivalinta) {
                    if (!state[section.id]) state[section.id] = {};
                    state[section.id][fullLinePhrase.avainsana] = newPhrase;
                } else {
                    state[section.id] = newPhrase;
                }
                matchFound = true;
            }

            if (!matchFound) {
                 freeTextLines.push(line);
            }
        });
        
        if (freeTextLines.length > 0) {
            const cleanFreeText = freeTextLines.join('\n').trim();
            if (cleanFreeText) {
                state[`custom-${section.id}`] = (state[`custom-${section.id}`] ? state[`custom-${section.id}`] + '\n' : '') + cleanFreeText;
            }
        }
    }

    if (Object.keys(state).length === 0 && text.trim().length > 0) {
        throw new Error("Virhe: Tekstistä ei löytynyt tunnistettavia lihavoituja otsikoita tai niiden sisältöä ei voitu jäsentää. Tarkista tekstin muotoilu.");
    }

    return state;
};


// --- PÄÄFUNKTIO (PÄIVITETTY VIRHEENKÄSITTELY) ---
/**
 * Jäsentää annetun syötteen, joka voi olla joko tekstimuotoinen suunnitelma
 * tai tekoälyn tuottama JSON-objekti/merkkijono.
 * @param {string|object} input - Jäsennettävä data.
 * @returns {object} Jäsennelty state-objekti.
 */
export const parsePlanInput = (input) => {
    // 1. Jos syöte on jo objekti, oletetaan sen olevan AI JSON.
    if (typeof input === 'object' && input !== null) {
        return parseAiJson(input);
    }

    // 2. Jos syöte ei ole merkkijono, palautetaan tyhjä objekti.
    if (typeof input !== 'string') {
        console.error("Virheellinen syötetyyppi. Syötteen tulee olla merkkijono tai objekti.");
        return {};
    }
    
    const trimmedInput = input.trim();

    // 3. Jos syöte näyttää JSON-datalta, yritetään jäsentää se.
    if (trimmedInput.startsWith('{') && trimmedInput.endsWith('}')) {
        try {
            const jsonData = JSON.parse(trimmedInput);
            // Onnistui, käytetään AI JSON -parseria.
            return parseAiJson(jsonData);
        } catch (jsonError) {
            // **PÄIVITYS**: Jos jäsennys epäonnistuu, annetaan selkeä virheilmoitus.
            console.error("Alkuperäinen JSON-jäsennysvirhe:", jsonError);
            throw new Error(`Virhe: Tekoälyn vastaus näyttää JSON-datalta, mutta sen muoto on virheellinen. Kopioi vastaus uudelleen tai tarkista sen syntaksi.`);
        }
    }

    // 4. Jos syöte ei näytä JSON-datalta, käytetään perinteistä tekstiparseria.
    return parseWithBoldHeadings(input);
};