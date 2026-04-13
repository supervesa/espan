// --- src/components/scraper/planParser.js ---

export const parsePlanText = (rawText, dbPhrases = [], dbSignals = []) => {
    const result = {
        phrases: [],
        signals: [],
        variables: {},
        customTexts: {}
    };

    if (!rawText) return result;

    // Siivotaan piilomerkit (zero-width spaces)
    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();

    // =========================================================================
    // 1. FRAASIT (Etsitään tietokannan base_text -kenttien perusteella)
    // =========================================================================
    const validPhrases = dbPhrases.filter(p => p.base_text && p.base_text.trim().length > 0);
    // Järjestetään pisimmästä lyhimpään, jotta tarkimmat lauseet löytyvät ensin
    validPhrases.sort((a, b) => b.base_text.length - a.base_text.length);

    validPhrases.forEach(entry => {
        // Muutetaan [MUUTTUJA] sellaiseksi RegExiksi, joka syö kaiken tiedon sisältä (.+?)
        let regexString = entry.base_text
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapetetaan erikoismerkit
            .replace(/\\\[([A-Z_ÄÖÅ0-9]+)\\\]/g, '(\\d{1,2}\\.\\d{1,2}\\.\\d{4}|.+?)')
            .replace(/\s+/g, '\\s+'); 
        
        // Salli pisteen puuttuminen tai rivinvaihto perään
        regexString = regexString.replace(/\\\.$/, '(?:\\.|\\s|\\n|$)');

        try {
            const regex = new RegExp(regexString, 'i'); 
            const match = remainingText.match(regex);

            if (match) {
                const extractedVars = {};
                // Poimitaan alkuperäisen base_textin muuttujien nimet (esim. [PÄIVÄMÄÄRÄ])
                const varMatches = [...entry.base_text.matchAll(/\[([A-Z_ÄÖÅ0-9]+)\]/g)];
                varMatches.forEach((m, index) => {
                    const varName = m[1];
                    const varValue = match[index + 1]; 
                    if (varValue) extractedVars[varName] = varValue.trim();
                });

                result.phrases.push({ 
                    id: entry.phrase_key, 
                    label: entry.short_title || entry.phrase_key,
                    variables: extractedVars // TÄRKEÄ: Nämä menevät adapterille asti!
                });

                // Syödään löydetty lauseke ylijäämätekstistä pois
                remainingText = remainingText.replace(match[0], '');
            }
        } catch (e) {
            console.error("Regex error:", e);
        }
    });

    // =========================================================================
    // 2. SIGNAALIT
    // =========================================================================
    if (dbSignals && dbSignals.length > 0) {
        dbSignals.forEach(entry => {
            const searchLabel = (entry.label || '').toLowerCase();
            // Tunnistetaan vain yli 4 merkin pituiset tagit vahinkojen välttämiseksi
            if (searchLabel && searchLabel.length > 4 && remainingText.toLowerCase().includes(searchLabel)) {
                if (!result.signals.some(s => s.id === entry.signal_key) && !result.phrases.some(p => p.id === entry.signal_key)) {
                    result.signals.push({ id: entry.signal_key, label: entry.label });
                    // Syödään signaalin teksti ylijäämästä
                    remainingText = remainingText.replace(new RegExp(entry.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
                }
            }
        });
    }

    // =========================================================================
    // 3. ERIKOISMUUTTUJAT
    // =========================================================================
    // Etsitään "ajalla pp.kk.vvvv - pp.kk.vvvv"
    const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const dateMatch = remainingText.match(dateRegex);
    if (dateMatch) {
        result.variables['palvelu_alku'] = dateMatch[1];
        result.variables['palvelu_loppu'] = dateMatch[2];
        remainingText = remainingText.replace(dateMatch[0], '');
    }

    // Etsitään "Tavoiteammattina on X"
    const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i;
    const escoMatch = remainingText.match(escoRegex);
    if (escoMatch && escoMatch[1]) {
        result.variables['tavoiteammatti_esco'] = escoMatch[1].trim();
        remainingText = remainingText.replace(escoMatch[0], '');
    }

    // =========================================================================
    // 4. LOHKONTA (Jakaa ylijäämätekstin oikeille välilehdille)
    // =========================================================================
    const sectionHeaders = [
        { match: /Suunnitelman perustiedot/i, id: 'perustiedot' },
        { match: /Työttömyysturva/i, id: 'tyottomyysturva' },
        { match: /Asiakkaan työtilanne/i, id: 'tyotilanne' },
        { match: /Koulutus ja yrittäjyys/i, id: 'koulutus' },
        { match: /Työkyky/i, id: 'tyokyky' },
        { match: /Palkkatuki/i, id: 'palkkatuki' },
        { match: /^Suunnitelma\s*$/im, id: 'suunnitelma' },
        { match: /Työnhakuvelvollisuus/i, id: 'tyonhakuvelvollisuus' },
        { match: /Oikeudet ja velvollisuudet/i, id: 'oikeudet_ja_velvollisuudet' }
    ];

    const paragraphs = remainingText.split(/\n{2,}/);
    let currentSection = 'tyotilanne'; // Oletuksena, jos otsikoita ei löydy, laitetaan työtilanteeseen

    paragraphs.forEach(para => {
        const trimmedPara = para.trim();
        if (!trimmedPara) return; 

        const lines = trimmedPara.split('\n');
        const firstLineClean = lines[0].replace(/\*/g, '').trim(); 
        let foundHeader = false;

        for (const sec of sectionHeaders) {
            if (sec.match.test(firstLineClean) && firstLineClean.length < 50) {
                currentSection = sec.id; // Vaihdetaan aktiivista laatikkoa
                foundHeader = true;
                if (lines.length > 1) {
                    const content = lines.slice(1).join('\n').trim();
                    if (content) {
                        result.customTexts[currentSection] = result.customTexts[currentSection] 
                            ? result.customTexts[currentSection] + '\n\n' + content
                            : content;
                    }
                }
                break;
            }
        }

        if (!foundHeader) {
            result.customTexts[currentSection] = result.customTexts[currentSection] 
                ? result.customTexts[currentSection] + '\n\n' + trimmedPara
                : trimmedPara;
        }
    });

    return result;
};