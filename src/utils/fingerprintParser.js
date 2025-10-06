import { planData } from '../data/planData';

// Tunnistaa lihavoidun otsikon, esim. **Otsikko**
const HEADING_REGEX = /^\*\*(.*?)\*\*/;

export const parseWithBoldHeadings = (text) => {
    let state = {};
    // Jaa osiin kahden tai useamman rivinvaihdon perusteella
    const sections = text.split(/\n\s*\n/);
    const sectionMap = new Map(planData.aihealueet.map(s => [s.otsikko, s]));

    sections.forEach(sectionBlock => {
        const lines = sectionBlock.split('\n');
        const titleLine = lines.shift() || '';
        const titleMatch = titleLine.match(HEADING_REGEX);

        // Jos rivi ei ole lihavoitu otsikko, ohitetaan se
        if (!titleMatch) return;

        const title = titleMatch[1].trim();
        const section = sectionMap.get(title);

        if (!section) return;

        let freeTextLines = [];
        let sectionState = {};

        lines.forEach(line => {
            // POIKKEUS: Ohitetaan aina suunnitelman laatimispäivä
            if (line.includes("Tämä suunnitelma laadittiin")) {
                return;
            }

            const kvMatch = line.match(/^([A-Za-zåäöÅÄÖ\s\(\)]+):\s+(.*)/);
            if (kvMatch) {
                const key = kvMatch[1].trim();
                const value = kvMatch[2].trim();

                // Yritetään yhdistää avain-arvo -pari johonkin fraasiin
                const phraseTemplate = section.fraasit?.find(f => f.lyhenne === key || f.teksti.startsWith(key));

                if (phraseTemplate) {
                     const newPhrase = { ...phraseTemplate, muuttujat: {} };
                     // Yritetään parsia muuttujat, jos niitä on
                     if (phraseTemplate.muuttujat) {
                         const varMatch = value.match(/\[(.*?)\]/);
                         if (varMatch) {
                             newPhrase.muuttujat[Object.keys(phraseTemplate.muuttujat)[0]] = varMatch[1];
                         }
                     }
                    if (section.monivalinta) {
                        if (!state[section.id]) state[section.id] = {};
                        state[section.id][phraseTemplate.avainsana] = newPhrase;
                    } else {
                        state[section.id] = newPhrase;
                    }
                } else if (key === "Oma arvio") {
                    const arvio = value.match(/(\d+)\/10/);
                    if (arvio) {
                        if(!state.tyokyky) state.tyokyky = {};
                        state.tyokyky.omaArvio = arvio[1];
                    }
                }
                else {
                    freeTextLines.push(line); // Ei tunnistettu, lisätään vapaaseen tekstiin
                }
            } else {
                freeTextLines.push(line);
            }
        });

        if (Object.keys(sectionState).length > 0) {
            state = { ...state, ...sectionState };
        }
        if (freeTextLines.length > 0) {
            const cleanFreeText = freeTextLines.join('\n').trim();
            if(cleanFreeText) {
                state[`custom-${section.id}`] = (state[`custom-${section.id}`] || '') + cleanFreeText + '\n';
            }
        }
    });

    if (Object.keys(state).length === 0 && !text.includes('**')) {
        alert("Virhe: Tekstistä ei löytynyt tunnistettavia lihavoituja otsikoita. Käytä 'Yritä tulkita muu teksti' -nappia.");
        return {};
    }

    return state;
};