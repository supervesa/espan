// src/utils/regex/extractKoulutus.js

// Erilaisia tyypillisiä tapoja ilmaista koulutus vapaassa tekstissä
const EDU_PATTERNS = [
    // "Asiakas on koulutukseltaan media (v. 2008)" tai "koulutukseltaan yo."
    /(?:asiakas on )?(?:perus)?koulutukseltaan\s+([^(.,]+)(?:\s*\(\s*v?\.?\s*(\d{4})\s*\))?/i,
    
    // "Valmistunut kokiksi vuonna 2015" tai "valmistunut merkonomi 2020"
    /(?:valmistunut|valmistui)\s+([^0-9.,]+)(?:\s+(?:vuonna\s+)?v?\.?\s*(\d{4}))?/i,
    
    // "Koulutus: Datanomi (2010)" tai "Tutkinto: ylioppilas"
    /(?:koulutus|tutkinto|koulutustausta):\s*([^(.,]+)(?:\s*\(\s*v?\.?\s*(\d{4})\s*\))?/i
];

export const extractKoulutus = (text) => {
    let remainingText = text;
    const foundEducations = [];

    if (!text) return { remainingText, foundEducations };

    EDU_PATTERNS.forEach(pattern => {
        // Etsitään kaikki osumat (while-luuppi siltä varalta, että listassa on useita tutkintoja)
        let match = remainingText.match(pattern);
        let safetyCounter = 0;

        while (match && safetyCounter < 5) {
            safetyCounter++;

            // Poimitaan Regex-ryhmistä tutkinto ja vuosi
            const degreeRaw = match[1] ? match[1].trim() : '';
            const yearRaw = match[2] ? match[2].trim() : '';

            if (degreeRaw && degreeRaw.length > 2) {
                foundEducations.push({
                    id: window.crypto.randomUUID(),
                    data: {
                        tutkinto: degreeRaw,
                        vuosi: yearRaw
                    },
                    meta: { source: 'scraper_heuristic' }
                });
            }

            // Etsitään koko virke (pisteeseen asti), jossa osuma on, jotta siivous on siisti
            // Jos lauseke päättyy jo pisteeseen, otetaan se. Muuten etsitään seuraava piste.
            const matchIndex = match.index;
            const textAfterMatch = remainingText.substring(matchIndex);
            const nextDot = textAfterMatch.indexOf('.');
            
            let stringToWipe = match[0];
            if (nextDot !== -1 && nextDot < 50) { // Jos piste on lähellä, pyyhitään siihen asti
                stringToWipe = textAfterMatch.substring(0, nextDot + 1);
            }

            remainingText = remainingText.replace(stringToWipe, ' ').replace(/\s{2,}/g, ' ').trim();
            match = remainingText.match(pattern);
        }
    });

    return { remainingText, foundEducations };
};