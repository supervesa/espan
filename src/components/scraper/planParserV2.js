import { processTextChunk } from '../../utils/regex/rulesEngine';

export const parsePlanTextV2 = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = [], dbServices = []) => {
    const result = { 
        phrases: [], 
        services: [], // Erillinen V2 UI:ta varten
        signals: [], 
        variables: {}, 
        customTexts: {} 
    };
    
    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // 1. TUHOTAAN URA-ROSKA (V1:stä tuttu ja turvallinen)
    const uraBoilerplateRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateRegex, '');

    // 2. POIMITAAN TYÖNHAUN ALOITUS
    const tyonhakuRegex = /Asiakkaan työnhaku on alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const tyonhakuMatch = remainingText.match(tyonhakuRegex);
    if (tyonhakuMatch) {
        result.variables['tyonhaku_alkanut'] = tyonhakuMatch[1];
    }
    
    // 3. URA-JÄRJESTELMÄN VAKIOTSIKOT (Pomminvarma V1-tunnistus!)
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

    // 4. AJETAAN PALASET LÄPI SUPER-MOOTTORISTA
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        const chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        // Kutsutaan rulesEnginen aivoa
        const { text: cleanedText, foundPhrases } = processTextChunk(chunkText, dbPhrases, dbVariables);
        
        if (cleanedText) result.customTexts[sectionKey] = cleanedText;

        foundPhrases.forEach(newPhrase => {
            if (!result.phrases.some(p => p.id === newPhrase.id)) {
                
                // Haetaan oikea välilehti, jotta adapteri osaa ruksia sen
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

    // 5. ETSITÄÄN PALVELUT (Ja erotetaan ne V2 UI:ta varten)
    dbServices.forEach(service => {
        let isMatched = false;

        // Etsitään palvelun juridinen teksti (plan_text) vapaiden tekstien seasta
        if (service.plan_text && service.plan_text.trim().length > 10) {
            let cleanPlanText = service.plan_text.trim().replace(/\.$/, '');
            const exactRegexStr = cleanPlanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
            const exactRegex = new RegExp(`${exactRegexStr}(?:\\s*\\.?\\s*(?:\\n|$))`, 'gi');

            for (const key in result.customTexts) {
                if (exactRegex.test(result.customTexts[key])) {
                    isMatched = true;
                    // Tuhotaan lause vapaasta tekstistä, koska se tunnistettiin!
                    result.customTexts[key] = result.customTexts[key].replace(exactRegex, '\n').trim();
                }
            }
        }

        // Jos ei löytynyt plan_textillä, tutkitaan löytyykö pelkkä otsikko
        if (!isMatched && service.title && service.title.trim().length > 5) {
            const titleRegex = new RegExp(service.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            for (const key in result.customTexts) {
                if (titleRegex.test(result.customTexts[key])) {
                    isMatched = true;
                }
            }
        }

        if (isMatched) {
            result.services.push({
                id: service.id,
                title: service.title,
                type: service.service_type || 'palvelu'
            });
        }
    });

    // 6. POIMITAAN SIGNAALIT JA GLOBAALIT MUUTTUJAT
    const allCleanedText = Object.values(result.customTexts).join('\n');
    
    dbSignals.forEach(signal => {
        const searchLabel = (signal.label || '').toLowerCase();
        if (searchLabel && searchLabel.length > 4) {
            let isMatched = allCleanedText.toLowerCase().includes(searchLabel);
            
            // Joustava haku
            if (!isMatched && searchLabel.includes(' - ')) {
                const shortLabel = searchLabel.split(' - ')[0].trim();
                if (shortLabel.length > 4 && allCleanedText.toLowerCase().includes(shortLabel)) {
                    isMatched = true;
                }
            }

            if (isMatched && !result.signals.some(s => s.id === signal.signal_key)) {
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