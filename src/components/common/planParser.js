import { processTextChunk } from '../../utils/regex/rulesEngine';

export const parsePlanText = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = []) => {
    const result = { phrases: [], signals: [], variables: {}, customTexts: {} };
    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // 1. TUHOTAAN URA-ROSKA (Esim. "Tämä suunnitelma laadittiin käyntiajalla...")
    const uraBoilerplateRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateRegex, '');

    // 2. POIMITAAN TYÖNHAUN ALOITUS
    const tyonhakuRegex = /Asiakkaan työnhaku on alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const tyonhakuMatch = remainingText.match(tyonhakuRegex);
    if (tyonhakuMatch) {
        result.variables['tyonhaku_alkanut'] = tyonhakuMatch[1];
    }
    
    // 3. URA-JÄRJESTELMÄN VAKIOTSIKOT (Tiukat ^ ja $ estävät lauseiden syömisen vahingossa)
    const URA_HEADERS = [
        { match: /^Suunnitelman perustiedot$/i, key: 'perustiedot' },
        { match: /^Työttömyysturva$/i, key: 'tyottomyysturva' },
        { match: /^Asiakkaan työtilanne$/i, key: 'tyotilanne' },
        { match: /^Koulutus ja yrittäjyys$/i, key: 'koulutus' },
        { match: /^Työkyky$/i, key: 'tyokyky' },
        { match: /^Palkkatuki$/i, key: 'palkkatuki' },
        { match: /^Suunnitelma$/i, key: 'suunnitelma' },
        { match: /^Työnhakuvelvollisuus$/i, key: 'tyonhakuvelvollisuus' },
        { match: /^Oikeudet ja velvollisuudet$/i, key: 'oikeudet_ja_velvollisuudet' },
        { match: /^Työnhakuvelvollisuuden toteuttaminen ja seuranta$/i, key: 'tyonhaku_seuranta' },
        { match: /^Työnhakuprofiili$/i, key: 'tyonhakuprofiili' }
    ];

    let currentSectionKey = 'tyotilanne'; 
    const chunks = { [currentSectionKey]: [] };
    const lines = remainingText.split('\n');

    // Pilkotaan teksti turvallisesti
    for (let line of lines) {
        const cleanLine = line.trim().replace(/\*/g, '');
        let foundHeader = false;
        for (const header of URA_HEADERS) {
            if (header.match.test(cleanLine) && cleanLine.length < 50) {
                currentSectionKey = header.key;
                if (!chunks[currentSectionKey]) chunks[currentSectionKey] = [];
                foundHeader = true;
                break;
            }
        }
        if (!foundHeader) chunks[currentSectionKey].push(line);
    }

    // 4. AJETAAN PALASET LÄPI SÄÄNTÖMOOTTORISTA
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        const chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        // Kutsutaan rulesEnginen aivoa
        const { text: cleanedText, foundPhrases } = processTextChunk(chunkText, dbPhrases, dbVariables);
        
        if (cleanedText) result.customTexts[sectionKey] = cleanedText;

        foundPhrases.forEach(newPhrase => {
            if (!result.phrases.some(p => p.id === newPhrase.id)) {
                
                // TÄMÄ ON SE RIVI, JOKA SAA ADAPTERIN RUKSIMAAN LAATIKOT PÄÄLLE!
                const sec = dbSections.find(s => s.id === newPhrase.section_id);
                newPhrase.sectionKey = sec ? sec.section_key : sectionKey;
                
                // Pakotetaan "laadittu"-päivämääräksi tämä päivä
                if (newPhrase.id === 'laadittu') {
                    const today = new Date().toLocaleDateString('fi-FI');
                    newPhrase.variables = newPhrase.variables || {};
                    newPhrase.variables['PÄIVÄMÄÄRÄ'] = today;
                }

                result.phrases.push(newPhrase);
            }
        });
    }

    // 5. POIMITAAN SIGNAALIT JA GLOBAALIT MUUTTUJAT
    const allCleanedText = Object.values(result.customTexts).join('\n');
    
    dbSignals.forEach(signal => {
        const searchLabel = (signal.label || '').toLowerCase();
        if (searchLabel && searchLabel.length > 4 && allCleanedText.toLowerCase().includes(searchLabel)) {
            if (!result.signals.some(s => s.id === signal.signal_key) && !result.phrases.some(p => p.id === signal.signal_key)) {
                result.signals.push({ id: signal.signal_key, label: signal.label });
            }
        }
    });

    const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const dateMatch = allCleanedText.match(dateRegex);
    if (dateMatch) {
        result.variables['palvelu_alku'] = dateMatch[1];
        result.variables['palvelu_loppu'] = dateMatch[2];
    }

    const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i;
    const escoMatch = allCleanedText.match(escoRegex);
    if (escoMatch && escoMatch[1]) {
        result.variables['tavoiteammatti_esco'] = escoMatch[1].trim();
    }

    for (const key in result.customTexts) {
        const finalClean = result.customTexts[key].replace(dateRegex, '').replace(escoRegex, '').trim();
        if (!finalClean) delete result.customTexts[key]; 
        else result.customTexts[key] = finalClean;
    }

    return result;
};