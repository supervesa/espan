// Etsitään koko lause pisteeseen (tai rivinvaihtoon) asti
const EDU_SENTENCE_PATTERNS = [
    /(?:asiakas on )?(?:perus)?koulutukseltaan\s+(.+?)(?:\.|$|\n)/i,
    /(?:valmistunut|valmistui)\s+(.+?)(?:\.|$|\n)/i,
    /(?:koulutus|tutkinto|koulutustausta):\s*(.+?)(?:\.|$|\n)/i
];

// UUSI: Kakkoskerroksen anomaliatutka
// Etsii 1-3 sanaa, joiden perässä on vuosiluku suluissa (esim. "Medionomi (v.2001)" tai "leipuri-kondiittori (2007)")
const ANOMALY_PATTERN = /\b([A-Za-zÅÄÖåäö-]{4,}(?:\s+[A-Za-zÅÄÖåäö-]{3,}){0,2})\s*\(\s*(?:v\.?\s*|vuonna\s+)?(\d{4})\s*\)/gi;

// Apufunktio, joka erottaa yhdestä pätkästä (esim. "media (v. 2008)") tutkinnon ja vuoden
const parseDegreeAndYear = (str) => {
    // Etsitään vuosiluku ja siihen liittyvät turhat sanat/sulut (esim. "(v. 2008)", "vuonna 2015", "(2020)")
    const yearRegex = /(?:\(\s*)?(?:vuonna\s+|v\.?\s*)?(\d{4})(?:\s*\))?/i;
    const yearMatch = str.match(yearRegex);
    
    let vuosi = '';
    let tutkinto = str;

    if (yearMatch) {
        vuosi = yearMatch[1]; // Pelkät 4 numeroa
        // Poistetaan koko vuosi-ilmaisu tutkinnon nimestä ja siistitään
        tutkinto = tutkinto.replace(yearMatch[0], '').trim();
    }

    // Siivotaan mahdolliset lauseen jäänteet ja turhat merkit
    tutkinto = tutkinto.replace(/^[:,]/, '').replace(/ja$/, '').replace(/sekä$/, '').trim();

    return { tutkinto, vuosi };
};

export const extractKoulutus = (text) => {
    let remainingText = text;
    const foundEducations = [];

    if (!text) return { remainingText, foundEducations };

    // --- 1. KIERROS (Ykköskerros / Peruslogiikka) ---
    EDU_SENTENCE_PATTERNS.forEach(pattern => {
        let match = remainingText.match(pattern);
        let safetyCounter = 0; // Estää ikiluupin

        while (match && safetyCounter < 10) {
            safetyCounter++;

            const fullSentence = match[0]; // Koko alkuperäinen lause, esim. "Asiakas on koulutukseltaan media (v. 2008) ja lukio (2001)."
            const listString = match[1];   // Pelkkä listaus-osa, esim. "media (v. 2008) ja lukio (2001)"

            // Pilkotaan listaus-osa erottimilla (ja, sekä, pilkku)
            const parts = listString.split(/\s+ja\s+|\s+sekä\s+|,/).map(s => s.trim()).filter(Boolean);

            parts.forEach(part => {
                const { tutkinto, vuosi } = parseDegreeAndYear(part);
                
                // Estetään aivan liian lyhyet/virheelliset osumat
                if (tutkinto && tutkinto.length > 2) {
                    foundEducations.push({
                        id: window.crypto.randomUUID(),
                        data: {
                            tutkinto: tutkinto,
                            vuosi: vuosi
                        },
                        meta: { source: 'scraper_heuristic' }
                    });
                }
            });

            // Pyyhitään alkuperäisestä tekstistä vain se koko löydetty lauseke
            remainingText = remainingText.replace(fullSentence, '\n').replace(/\s{2,}/g, ' ').trim();
            
            // Haetaan seuraava mahdollinen koulutuslause, jos niitä on useita
            match = remainingText.match(pattern);
        }
    });

    // --- 2. KIERROS (Anomaliatutka / Varoverkko) ---
    // Ajetaan vain, jos ensimmäinen, perinteisempi logiikka ei löytänyt yhtään mitään
    if (foundEducations.length === 0) {
        // matchAll käy läpi kaikki mahdolliset regex-osumat tekstistä g-flagin avulla
        const anomalies = Array.from(remainingText.matchAll(ANOMALY_PATTERN));
        
        anomalies.forEach(anomaly => {
            const fullMatch = anomaly[0];       // esim. "Medionomi (v.2001)"
            const tutkintoRaa = anomaly[1];     // esim. "Medionomi"
            const vuosi = anomaly[2];           // esim. "2001"
            
            // Suodatetaan satunnaisia selkeitä huti-osumia (esim. "Syntynyt (1980)" ei ole ammatti)
            const isInvalid = /syntynyt|muuttanut|puhelin/i.test(tutkintoRaa);
            
            if (tutkintoRaa && tutkintoRaa.trim().length > 2 && !isInvalid) {
                foundEducations.push({
                    id: window.crypto.randomUUID(),
                    data: {
                        tutkinto: tutkintoRaa.trim(),
                        vuosi: vuosi
                    },
                    meta: { source: 'anomaly_radar' } // Kirjataan ylös, että tieto pelastettiin 2-kierrokselta
                });
                
                // Siivotaan tutkan poimima osa alkuperäisestä tekstistä sotkemasta.
                // Laitetaan tilalle vain huomaamaton väli.
                remainingText = remainingText.replace(fullMatch, ' ').replace(/\s{2,}/g, ' ').trim();
            }
        });
    }

    return { remainingText, foundEducations };
};