import { planData } from '../data/planData';

// --- APUFUNKTIOT ---
/**
 * Luo uuden fraasi-objektin annettujen tietojen perusteella.
 * @param {object} section - Koko aihealue-objekti planDatasta.
 * @param {string} avainsana - Fraasin yksilöivä avainsana.
 * @param {object} [muuttujat={}] - Valinnaiset muuttujat fraasille.
 * @returns {object|null} Palauttaa uuden fraasi-objektin tai null, jos mallia ei löydy.
 */
const createPhraseObject = (section, avainsana, muuttujat = {}) => {
    // Varmistetaan, että section ja sen fraasit ovat olemassa
    if (!section || !section.fraasit) return null;
    
    // Etsitään oikea fraasimalli avainsanan perusteella
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;

    // Luodaan uusi fraasi-objekti löydetyn mallin pohjalta
    const newPhrase = {
        avainsana,
        teksti: phraseTemplate.teksti,
        lyhenne: phraseTemplate.lyhenne,
        muuttujat: {}
    };

    // Jos fraasimallissa on muuttujia, käsitellään ne
    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            // Käytetään annettua muuttujan arvoa tai mallin oletusarvoa
            newPhrase.muuttujat[key] = muuttujat[key] || config.oletus || '';
        });
    }
    return newPhrase;
};


// --- TÄYDELLINEN SORMENJÄLKI-PARSERI (KORJATTU) ---
/**
 * Jäsentää tekstimuotoisen suunnitelman rakenteelliseksi state-objektiksi.
 * @param {string} text - Lihavoiduilla otsikoilla jäsennelty tekstisisältö.
 * @returns {object} Jäsennelty state-objekti.
 */
export const parseWithBoldHeadings = (text) => {
    let state = {};
    // Jaa osiin lihavoidun otsikon perusteella ja poista sisältö ennen ensimmäistä otsikkoa.
    const sections = text.split(/^\*\*(.*?)\*\*$/m).slice(1);
    // Luo Map planDatan aihealueista nopeaa hakua varten otsikon perusteella.
    const sectionMap = new Map(planData.aihealueet.map(s => [s.otsikko, s]));

    // Käydään läpi parsitut osiot (otsikko ja sisältö pareittain)
    for (let i = 0; i < sections.length; i += 2) {
        const title = sections[i].trim();
        const content = sections[i + 1].trim();
        const section = sectionMap.get(title);

        if (!section) continue; // Jos otsikkoa ei löydy planDatasta, siirrytään seuraavaan

        let freeTextLines = [];
        const lines = content.split('\n');

        lines.forEach(line => {
            // POIKKEUS: Ohitetaan aina tämä spesifinen rivi.
            if (line.includes("Tämä suunnitelma laadittiin")) {
                return;
            }

            // KORJATTU REGEX: Tunnistaa avain-arvo-parit sallimalla avaimessa enemmän merkkejä.
            const kvMatch = line.match(/^([^:]+):\s+(.*)/);

            if (kvMatch) {
                const key = kvMatch[1].trim();
                const value = kvMatch[2].trim();

                let matchFound = false;

                // Etsitään fraasi, jonka lyhenne vastaa parsittua avainta
                const phraseTemplate = section.fraasit?.find(f => f.lyhenne === key);
                if (phraseTemplate) {
                    
                    // *** KRIITTINEN KORJAUS TÄSSÄ ***
                    // Aiemmin: createPhraseObject(section.id, ...) -> VIRHE
                    // Korjattu: createPhraseObject(section, ...) -> OIKEIN
                    // Annamme funktiolle koko section-olion, jotta se voi lukea section.fraasit.
                    const newPhrase = createPhraseObject(section, phraseTemplate.avainsana);

                    if (newPhrase) {
                        if (section.monivalinta) {
                            if (!state[section.id]) state[section.id] = {};
                            state[section.id][phraseTemplate.avainsana] = newPhrase;
                        } else {
                            state[section.id] = newPhrase;
                        }
                        matchFound = true;
                    }
                }

                // Erikoiskäsittelyt Työkyky-osastolle
                if (section.id === 'tyokyky') {
                    if (key === "Oma arvio") {
                        const arvio = value.match(/(\d+)\/10/);
                        if (arvio) {
                            if (!state.tyokyky) state.tyokyky = {};
                            state.tyokyky.omaArvio = arvio[1];
                            matchFound = true;
                        }
                    } else if (key === "Kuvaus alentumasta") {
                        if (!state.tyokyky) state.tyokyky = {};
                        state.tyokyky.alentumaKuvaus = value;
                        matchFound = true;
                    } else if (key === "Koonti keskustelusta") {
                        if (!state.tyokyky) state.tyokyky = {};
                        state.tyokyky.koonti = value;
                        matchFound = true;
                    }
                }
                
                if (!matchFound) {
                    freeTextLines.push(line);
                }

            } else if (line.trim()) {
                // Lisätään rivi vapaaksi tekstiksi, jos se ei ole tyhjä
                freeTextLines.push(line);
            }
        });
        
        // Lisätään kerätty vapaa teksti stateen, jos sitä on
        if (freeTextLines.length > 0) {
            const cleanFreeText = freeTextLines.join('\n').trim();
            if(cleanFreeText) {
                // Lisää olemassa olevan tekstin perään tai luo uuden kentän.
                // Estää ylimääräiset rivinvaihdot alussa.
                state[`custom-${section.id}`] = (state[`custom-${section.id}`] ? state[`custom-${section.id}`] + '\n' : '') + cleanFreeText;
            }
        }
    }

    // Annetaan virheilmoitus vain, jos tekstiä oli, mutta mitään ei saatu parsittua
    if (Object.keys(state).length === 0 && text.trim().length > 0) {
        alert("Virhe: Tekstistä ei löytynyt tunnistettavia lihavoituja otsikoita tai niiden sisältöä ei voitu jäsentää. Tarkista tekstin muotoilu.");
        return {};
    }

    return state;
};