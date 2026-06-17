// Etsitään koko lause pisteeseen (tai rivinvaihtoon) asti
const EDU_SENTENCE_PATTERNS = [
    /(?:asiakas on )?(?:perus)?koulutukseltaan\s+(.+?)(?:\.|$|\n)/i,
    /(?:valmistunut|valmistui)\s+(.+?)(?:\.|$|\n)/i,
    /(?:koulutus|tutkinto|koulutustausta):\s*(.+?)(?:\.|$|\n)/i
];

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

    return { remainingText, foundEducations };
};