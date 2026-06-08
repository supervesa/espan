import { DATE_RANGE_PATTERN, parseFinnishDateToISO } from './core';

/**
 * VANHA Pika-pura (Jätetään tämä tänne, jotta mikään muu koodissa ei vahingossa mene rikki,
 * jos se vielä viittaa tähän vanhaan funktioon).
 */
export const extractWithRules = (text, dbPhrases = [], dbSignals = [], dynamicKeys = {}) => {
    const results = { foundPhrases: [], foundSignals: [], services: [] };
    if (!text) return results;
    
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lowerText = cleanText.toLowerCase();

    dbPhrases.forEach(phrase => {
        let isMatchFound = false;
        if (phrase.base_text) {
            const cleanBaseText = phrase.base_text.replace(/\s+/g, ' ').trim().toLowerCase();
            if (cleanBaseText.length > 0 && lowerText.includes(cleanBaseText)) isMatchFound = true;
        }
        if (!isMatchFound && phrase.extraction_pattern) {
            try {
                const regex = new RegExp(phrase.extraction_pattern, 'i');
                if (regex.test(cleanText)) isMatchFound = true;
            } catch (e) { }
        }
        if (isMatchFound && !results.foundPhrases.includes(phrase.phrase_key)) {
            results.foundPhrases.push(phrase.phrase_key);
        }
    });

    dbSignals.forEach(signal => {
        if (signal.label && lowerText.includes(signal.label.toLowerCase())) {
            results.foundSignals.push(signal.signal_key);
        }
    });

    const dateMatch = cleanText.match(DATE_RANGE_PATTERN);
    if (dateMatch) {
        const sentenceRegex = new RegExp(`([^.]*?${dateMatch[0].replace(/\./g, '\\.')}[^.]*)`, 'i');
        const sentenceMatch = cleanText.match(sentenceRegex);
        if (sentenceMatch) {
            const contextSentence = sentenceMatch[1].toLowerCase();
            let serviceType = null;
            let phraseKey = null;
            if (contextSentence.includes('kokeilu')) { serviceType = 'tyokokeilu'; phraseKey = dynamicKeys.tyokokeilu || 'tyokokeilu'; }
            else if (contextSentence.includes('palkkatuki')) { serviceType = 'palkkatuki'; phraseKey = dynamicKeys.palkkatuki || 'palkkatuki'; }
            else if (contextSentence.includes('koulutus')) { serviceType = 'tyovoimakoulutus'; phraseKey = dynamicKeys.tyovoimakoulutus || 'tyovoimakoulutus'; }

            if (serviceType) {
                results.services.push({ type: serviceType, phraseKey: phraseKey, start: parseFinnishDateToISO(dateMatch[1]), end: parseFinnishDateToISO(dateMatch[2]) });
                if (!results.foundPhrases.includes(phraseKey)) results.foundPhrases.push(phraseKey);
            }
        }
    }
    return results;
};


/**
 * YHTEINEN SUPER-MOOTTORI: Käytetään sekä URA-imurissa että yksittäisessä Pika-purassa!
 */
export const processTextChunk = (chunkText, dbPhrases = [], flatDbVariables = []) => {
    let text = chunkText;
    const foundPhrases = [];

    const validPhrases = [...dbPhrases]
        .filter(p => p.base_text && p.base_text.trim() !== '')
        .sort((a, b) => b.base_text.length - a.base_text.length);

    validPhrases.forEach(phrase => {
        let phraseVars = [];
        if (phrase.variables && Array.isArray(phrase.variables)) {
            phraseVars = phrase.variables.filter(v => v.import_behavior === 'extract');
        } else if (flatDbVariables && flatDbVariables.length > 0) {
            phraseVars = flatDbVariables.filter(v => v.phrase_id === phrase.id && v.import_behavior === 'extract');
        }
        
        let isMatched = false;
        let extractedVars = {};
        let textToWipe = null; // Tähän tallennetaan TARKALLEEN se teksti mikä pitää siivota pois

        const allVarsInText = [...phrase.base_text.matchAll(/\[([A-Z_ÄÖÅ0-9]+)\]/g)].map(m => m[1]);

        // VAIHE 1: Etsitään osumaa muuttujien kanssa (KORJATTU AHNEEMMAKSI)
        if (allVarsInText.length > 0) {
            let cleanBaseText = phrase.base_text.trim().replace(/\.$/, ''); // Poistetaan piste mallin lopusta
            
            // 1. Escapetaan teksti, mutta jätetään hakasulkeet rauhaan
            let regexStr = cleanBaseText.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
                if (match === '[' || match === ']') return match;
                return '\\' + match;
            });
            
            // 2. Tehdään välilyönneistä joustavia
            regexStr = regexStr.replace(/\\ /g, '\\s+');
            
            // 3. Vaihdetaan [MUUTTUJAT] laiskoiksi kaappareiksi
            allVarsInText.forEach(v => {
                regexStr = regexStr.replace(`[${v}]`, '(.+?)');
            });
            
            // 4. KRIITTINEN KORJAUS: Vahva ankkuri lauseen loppuun! 
            // Tämä pakottaa kaapparin ottamaan myös päivämäärän pisteet, kunnes se näkee TODELLISEN lauseen lopun.
            regexStr += '(?:\.\\s|\.\\n|\\s*\\n|$)';

            const regex = new RegExp(regexStr, 'i');
            const match = text.match(regex);
            
            if (match) {
                isMatched = true;
                textToWipe = match[0]; // Otetaan KOKO löydetty lauseke talteen siivousta varten!
                
                allVarsInText.forEach((v, idx) => {
                    const isExtractable = phraseVars.some(pv => pv.variable_key === v);
                    if (isExtractable && match[idx + 1]) {
                        // Varmistetaan ettei muuttujan perään tarttunut pistettä
                        extractedVars[v] = match[idx + 1].replace(/\.$/, '').trim();
                    }
                });
            }
        }

        // VAIHE 2: Tarkka perusosuma ilman muuttujia
        if (!isMatched && allVarsInText.length === 0) {
            let cleanBaseText = phrase.base_text.trim().replace(/\.$/, '');
            let exactRegexStr = cleanBaseText
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\\ /g, '\\s+');
                
            const exactRegex = new RegExp(`${exactRegexStr}(?:\\.\\s|\\.\\n|\\s*\\n|$)`, 'i');
            const match = text.match(exactRegex);
            if (match) {
                isMatched = true;
                textToWipe = match[0];
            }
        }

        // VAIHE 3: Sääntömoottorin extraction_pattern
        if (!isMatched && phrase.extraction_pattern) {
            try {
                const extRegex = new RegExp(phrase.extraction_pattern, 'i');
                const match = text.match(extRegex);
                if (match) {
                    isMatched = true;
                    textToWipe = match[0];
                }
            } catch (e) { }
        }

        // JOS OSUMA LÖYTYI -> Lisätään listalle ja siivotaan tekstistä!
        if (isMatched) {
            foundPhrases.push({
                id: phrase.phrase_key || phrase.avainsana,
                section_id: phrase.section_id,
                label: phrase.short_title || phrase.phrase_key,
                variables: extractedVars
            });
            
            // POMMINVARMA SIIVOUS: Pyyhitään vain ja ainoastaan se tarkka lause, joka antoi osuman.
            // Näin roskia ei voi jäädä yhtään!
            if (textToWipe) {
                text = text.replace(textToWipe, '\n');
            }
        }
    });

    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return { text, foundPhrases };
};