// --- src/utils/regex/planParser.js ---

import { processTextChunk } from '../../utils/regex/rulesEngine';
import { extractServices } from '../../utils/regex/serviceExtractor';
import { extractSignals } from '../../utils/regex/signalExtractor';
import { extractPatevyydet } from '../../utils/regex/patevyysExtractor';

// Nostetaan globaalit regex-määrittelyt tänne, jotta ne näkyvät kaikkialla tiedostossa
const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi;
const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/gi;

export const parsePlanText = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = [], dbServices = [], dbPatevyydet = []) => {
    const result = { phrases: [], signals: [], services: [], patevyydet: [], variables: {}, customTexts: {} };
    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // 1. TUHOTAAN URA-ROSKA
    const uraBoilerplateRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateRegex, '');

    // =========================================================================
    // 2. POIMITAAN GLOBAALIT MUUTTUJAT ENNEN KUIN MIKÄÄN FUNKTIO SYÖ TEKSTIÄ
    // =========================================================================
    
    const tyonhakuRegex = /Asiakkaan työnhaku on alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const tyonhakuMatch = remainingText.match(tyonhakuRegex);
    if (tyonhakuMatch) {
        result.variables['tyonhaku_alkanut'] = tyonhakuMatch[1];
    }

    // Käytetään ylempänä määriteltyä dateRegxia
    const dateMatch = remainingText.match(dateRegex);
    if (dateMatch && dateMatch[0]) {
        // Poimitaan tarkat päivämäärät ensimmäisestä osumasta
        const exactDates = dateMatch[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/g);
        if (exactDates && exactDates.length >= 2) {
            result.variables['palvelu_alku'] = exactDates[0];
            result.variables['palvelu_loppu'] = exactDates[1];
        }
    }

    // Äidinkieli
    const aidinkieliRegex = /Asiakkaan äidinkieli on\s+([^,.\n]+)/i;
    const aidinkieliMatch = remainingText.match(aidinkieliRegex);
    if (aidinkieliMatch && aidinkieliMatch[1]) {
        result.variables['aidinkieli'] = aidinkieliMatch[1].trim();
    }

    // Tavoiteammatti (Käytetään ylempänä määriteltyä escoRegxia)
    const escoMatch = remainingText.match(escoRegex);
    if (escoMatch && escoMatch[0]) {
        const exactAmmatti = escoMatch[0].match(/tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i);
        if (exactAmmatti && exactAmmatti[1]) {
            result.variables['tavoiteammatti_esco'] = exactAmmatti[1].trim();
        }
    }

    // Yrittäjyys - Ei kiinnostunut
    const eiYrittajyysRegex = /(?:Keskusteltiin yrittäjyydestä\.\s*)?Asiakas ei(?: ole)? (?:tässä vaiheessa )?kiinnostunut yritystoiminnan(?: aloittamisesta)?\.?/i;
    if (eiYrittajyysRegex.test(remainingText)) {
        result.variables['yrittajyys_kiinnostus'] = 'ei';
        result.variables['yrittajyys_teksti'] = 'Keskusteltiin yrittäjyydestä. Asiakas ei ole tässä vaiheessa kiinnostunut yritystoiminnan aloittamisesta.';
        remainingText = remainingText.replace(eiYrittajyysRegex, '').trim();
    }

    // Yrittäjyys - On kiinnostunut
    const kyllaYrittajyysRegex = /Asiakas on kiinnostunut yrittäjyydestä\.?/i;
    if (kyllaYrittajyysRegex.test(remainingText)) {
        result.variables['yrittajyys_kiinnostus'] = 'kylla';
        remainingText = remainingText.replace(kyllaYrittajyysRegex, '').trim();
    }

    // =========================================================================
    // 3. ERIKOISIRROTTIMET (Nämä poistavat osumat tekstistä)
    // =========================================================================

    // AJETAAN PALVELUT
    const serviceResult = extractServices(remainingText, dbServices);
    remainingText = serviceResult.remainingText; 
    result.services = serviceResult.foundServices; 
    
    serviceResult.autoSignals.forEach(sigKey => {
        if (!result.signals.some(s => s.id === sigKey)) {
            const dbSig = dbSignals.find(s => s.signal_key === sigKey);
            result.signals.push({ id: sigKey, label: dbSig ? dbSig.label : sigKey });
        }
    });

    // AJETAAN SIGNAALIT
    const signalResult = extractSignals(remainingText, dbSignals);
    remainingText = signalResult.remainingText; 
    
    signalResult.foundSignals.forEach(sig => {
        if (!result.signals.some(s => s.id === sig.id)) {
            result.signals.push(sig);
        }
    });

    // AJETAAN PÄTEVYYDET
    const patevyysResult = extractPatevyydet(remainingText, dbPatevyydet);
    remainingText = patevyysResult.remainingText;
    result.patevyydet = patevyysResult.foundPatevyydet;


    // =========================================================================
    // 4. URA-JÄRJESTELMÄN VAKIOTSIKOT
    // =========================================================================
    const URA_HEADERS = [
        { match: /^Työnhakuvelvollisuuden toteuttaminen ja seuranta(?:\s|$)/i, key: 'tyonhaku_seuranta' },
        { match: /^Oikeudet ja velvollisuudet(?:\s|$)/i, key: 'oikeudet_ja_velvollisuudet' },
        { match: /^Suunnitelman perustiedot(?:\s|$)/i, key: 'perustiedot' },
        { match: /^Koulutus ja yrittäjyys(?:\s|$)/i, key: 'koulutus' },
        { match: /^Asiakkaan työtilanne(?:\s|$)/i, key: 'tyotilanne' },
        { match: /^Työnhakuvelvollisuus(?:\s|$)/i, key: 'tyonhakuvelvollisuus' },
        { match: /^Työnhakuprofiili(?:\s|$)/i, key: 'tyonhakuprofiili' },
        { match: /^Työttömyysturva(?:\s|$)/i, key: 'tyottomyysturva' },
        { match: /^Palkkatuki(?:\s|$)/i, key: 'palkkatuki' },
        { match: /^Suunnitelma(?:\s|$)/i, key: 'suunnitelma' },
        { match: /^Työkyky(?:\s|$)/i, key: 'tyokyky' }
    ];

    let currentSectionKey = 'tyotilanne'; 
    const chunks = { [currentSectionKey]: [] };
    const lines = remainingText.split('\n');

    for (let line of lines) {
        const cleanLine = line.trim().replace(/\*/g, '');
        if (!cleanLine) continue; 

        let foundHeader = false;
        for (const header of URA_HEADERS) {
            const match = cleanLine.match(header.match);
            if (match) {
                currentSectionKey = header.key;
                if (!chunks[currentSectionKey]) chunks[currentSectionKey] = [];
                foundHeader = true;
                const contentAfterHeader = cleanLine.substring(match[0].length).trim();
                if (contentAfterHeader) chunks[currentSectionKey].push(contentAfterHeader);
                break; 
            }
        }
        if (!foundHeader) chunks[currentSectionKey].push(cleanLine);
    }

    // 5. AJETAAN PALASET LÄPI SÄÄNTÖMOOTTORISTA
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        const chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        const { text: cleanedText, foundPhrases } = processTextChunk(chunkText, dbPhrases, dbVariables);
        
        if (cleanedText) result.customTexts[sectionKey] = cleanedText;

        foundPhrases.forEach(newPhrase => {
            if (!result.phrases.some(p => p.id === newPhrase.id)) {
                
                const sec = dbSections.find(s => s.id === newPhrase.section_id);
                newPhrase.sectionKey = sec ? sec.section_key : sectionKey;
                
                if (newPhrase.id === 'laadittu') {
                    const today = new Date().toLocaleDateString('fi-FI');
                    newPhrase.variables = newPhrase.variables || {};
                    newPhrase.variables['PÄIVÄMÄÄRÄ'] = today;
                }

                result.phrases.push(newPhrase);
            }
        });
    }

    // 6. YLIJÄÄMÄN LOPPUSIIVOUS
    const residueRegexes = [
        /Asiakkaalla on voimassa\s*(?:mm\.?)?[\s,]*/gi,
        /Asiakkaalla on voimassa olevat pätevyydet:?/gi,
        /Asiakkaan äidinkieli on[^.]*\./gi,
        /suomen kielen taito on tasolla[^.]*\.?/gi,
        /(?:^|\s)Asiakas\s*$/gim, 
        /Asiakas\s+$/gim 
    ];

    for (const key in result.customTexts) {
        let finalClean = result.customTexts[key];
        
        // Vanhat poistot (Nyt dateRegex ja escoRegex näkyvät täällä asti!)
        finalClean = finalClean.replace(dateRegex, '').replace(escoRegex, '');
        
        // Siivotaan tunnetut jäänteet
        residueRegexes.forEach(rx => {
            finalClean = finalClean.replace(rx, '');
        });
        
        // Kieliopillinen siivous 
        finalClean = finalClean
            .replace(/\s{2,}/g, ' ')       
            .replace(/,\s*\./g, '.')       
            .replace(/\s+\./g, '.')        
            .replace(/^[.,\s]+/, '')       
            .trim();

        // Tyhjennetään turhat pätkät
        if (/^(?:pätevyydet|kortit|pätevyydet:|kortit:)$/i.test(finalClean)) {
            finalClean = '';
        }

        if (!finalClean) delete result.customTexts[key]; 
        else result.customTexts[key] = finalClean;
    }

    return result;
};