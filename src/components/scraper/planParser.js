// --- src/utils/regex/planParser.js ---

import { processTextChunk } from '../../utils/regex/rulesEngine';
import { extractServices } from '../../utils/regex/serviceExtractor';
import { extractSignals } from '../../utils/regex/signalExtractor';
import { extractPatevyydet } from '../../utils/regex/patevyysExtractor';
// LISÄTTY: Tuodaan uusi työkyky-uuttaja
import { extractTyokyky } from '../../utils/regex/tyokykyExtractor'; 

const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi;
const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/gi;

export const parsePlanText = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = [], dbServices = [], dbPatevyydet = []) => {
    // LISÄTTY: Alustetaan tyokykyData tyhjäksi objektiksi tulokseen
    const result = { phrases: [], signals: [], services: [], patevyydet: [], variables: {}, customTexts: {}, tyokykyData: {} };
    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // 1. TUHOTAAN URA-ROSKA
    const uraBoilerplateRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateRegex, '');

    // =========================================================================
    // 2. POIMITAAN GLOBAALIT MUUTTUJAT ENNEN KUIN MIKÄÄN SYÖ TEKSTIÄ
    // =========================================================================
    
    const tyonhakuRegex = /Asiakkaan työnhaku on alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const tyonhakuMatch = remainingText.match(tyonhakuRegex);
    if (tyonhakuMatch) {
        result.variables['tyonhaku_alkanut'] = tyonhakuMatch[1];
    }

    const dateMatch = remainingText.match(dateRegex);
    if (dateMatch && dateMatch[0]) {
        const exactDates = dateMatch[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/g);
        if (exactDates && exactDates.length >= 2) {
            result.variables['palvelu_alku'] = exactDates[0];
            result.variables['palvelu_loppu'] = exactDates[1];
        }
    }

    const aidinkieliRegex = /Asiakkaan äidinkieli on\s+([^,.\n]+)/i;
    const aidinkieliMatch = remainingText.match(aidinkieliRegex);
    if (aidinkieliMatch && aidinkieliMatch[1]) {
        result.variables['aidinkieli'] = aidinkieliMatch[1].trim();
    }

    const escoMatch = remainingText.match(escoRegex);
    if (escoMatch && escoMatch[0]) {
        const exactAmmatti = escoMatch[0].match(/tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i);
        if (exactAmmatti && exactAmmatti[1]) {
            result.variables['tavoiteammatti_esco'] = exactAmmatti[1].trim();
        }
    }

    const eiYrittajyysRegex = /(?:Keskusteltiin yrittäjyydestä\.\s*)?Asiakas ei(?: ole)? (?:tässä vaiheessa )?kiinnostunut yritystoiminnan(?: aloittamisesta)?\.?/i;
    if (eiYrittajyysRegex.test(remainingText)) {
        result.variables['yrittajyys_kiinnostus'] = 'ei';
        result.variables['yrittajyys_teksti'] = 'Keskusteltiin yrittäjyydestä. Asiakas ei ole tässä vaiheessa kiinnostunut yritystoiminnan aloittamisesta.';
        remainingText = remainingText.replace(eiYrittajyysRegex, '').trim();
    }

    const kyllaYrittajyysRegex = /Asiakas on kiinnostunut yrittäjyydestä\.?/i;
    if (kyllaYrittajyysRegex.test(remainingText)) {
        result.variables['yrittajyys_kiinnostus'] = 'kylla';
        remainingText = remainingText.replace(kyllaYrittajyysRegex, '').trim();
    }

    // =========================================================================
    // 3. JAA TEKSTI LOHKOIHIN OTSIKOIDEN PERUSTEELLA
    // =========================================================================
    const URA_HEADERS = [
        { match: /^Työnhakuvelvollisuuden toteuttaminen ja seuranta(?:\s|:|$)/i, key: 'tyonhaku_seuranta' },
        { match: /^Oikeudet ja velvollisuudet(?:\s|:|$)/i, key: 'oikeudet_ja_velvollisuudet' },
        { match: /^Suunnitelman perustiedot(?:\s|:|$)/i, key: 'perustiedot' },
        { match: /^Koulutus ja yrittäjyys(?:\s|:|$)/i, key: 'koulutus' },
        { match: /^Asiakkaan työtilanne(?:\s|:|$)/i, key: 'tyotilanne' },
        { match: /^Työnhakuvelvollisuus(?:\s|:|$)/i, key: 'tyonhakuvelvollisuus' },
        { match: /^Työnhakuprofiili(?:\s|:|$)/i, key: 'tyonhakuprofiili' },
        { match: /^Työttömyysturva(?:\s|:|$)/i, key: 'tyottomyysturva' },
        { match: /^Palkkatuki(?:\s|:|$)/i, key: 'palkkatuki' },
        { match: /^Suunnitelma(?:\s|:|$)/i, key: 'suunnitelma' },
        { match: /^Työkyky(?:\s|:|$)/i, key: 'tyokyky' }
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

    // =========================================================================
    // 4. KÄSITELLÄÄN JOKAINEN LOHKO ERIKSEEN (Täällä irrottimet saavat syödä)
    // =========================================================================
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        let chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        // 4A. Työkyky (LISÄTTY TÄHÄN!)
        // Vaikka ajamme tämän jokaiselle lohkolle, se tekee tuhojaan vain jos sieltä löytyy
        // Työkyvyn lauseita (kuten "Työkyky on normaali").
        const tyokykyResult = extractTyokyky(chunkText, dbPhrases);
        chunkText = tyokykyResult.remainingText;
        
        // Yhdistetään löydökset tulokseen, jos jotain löytyi
        if (tyokykyResult.tyokykyData && (tyokykyResult.tyokykyData.paavalinta || tyokykyResult.tyokykyData.oma_arvio || tyokykyResult.tyokykyData.toimenpiteet.length > 0)) {
            // Yhdistetään fiksusti, jos tekstiä olikin useammassa lohkossa
            result.tyokykyData = {
                paavalinta: tyokykyResult.tyokykyData.paavalinta || result.tyokykyData.paavalinta,
                alentuma_kuvaus: tyokykyResult.tyokykyData.alentuma_kuvaus || result.tyokykyData.alentuma_kuvaus,
                oma_arvio: tyokykyResult.tyokykyData.oma_arvio || result.tyokykyData.oma_arvio,
                toimenpiteet: [...(result.tyokykyData.toimenpiteet || []), ...tyokykyResult.tyokykyData.toimenpiteet]
            };
        }

        // 4B. Palvelut
        const serviceResult = extractServices(chunkText, dbServices);
        chunkText = serviceResult.remainingText;
        
        serviceResult.foundServices.forEach(s => {
            if (!result.services.some(existing => existing.id === s.id)) result.services.push(s);
        });
        
        serviceResult.autoSignals.forEach(sigKey => {
            if (!result.signals.some(s => s.id === sigKey)) {
                const dbSig = dbSignals.find(s => s.signal_key === sigKey);
                result.signals.push({ id: sigKey, label: dbSig ? dbSig.label : sigKey });
            }
        });

        // 4C. Signaalit
        const signalResult = extractSignals(chunkText, dbSignals);
        chunkText = signalResult.remainingText;
        signalResult.foundSignals.forEach(sig => {
            if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
        });

        // 4D. Pätevyydet
        const patevyysResult = extractPatevyydet(chunkText, dbPatevyydet);
        chunkText = patevyysResult.remainingText;
        patevyysResult.foundPatevyydet.forEach(p => {
            if (!result.patevyydet.some(existing => existing === p)) result.patevyydet.push(p);
        });

        // 4E. Vakiolauseet (Sääntömoottori)
        const phraseResult = processTextChunk(chunkText, dbPhrases, dbVariables);
        chunkText = phraseResult.text; 
        
        phraseResult.foundPhrases.forEach(newPhrase => {
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

        // Laitetaan tästä kyseisestä välilehdestä jäljelle jäänyt teksti talteen
        if (chunkText) result.customTexts[sectionKey] = chunkText;
    }

    // =========================================================================
    // 5. YLIJÄÄMÄN LOPPUSIIVOUS
    // =========================================================================
    const residueRegexes = [
        /Asiakkaalla on voimassa\s*(?:mm\.?)?[\s,]*/gi,
        /Asiakkaalla on voimassa olevat pätevyydet:?/gi,
        /Asiakkaan äidinkieli on[^.]*\./gi,
        /suomen kielen taito on tasolla[^.]*\.?/gi,
        /Asiakkaan oma arvio työkyvystään \(0-10\):?/gi, // Siivoaa oman arvion jäänteet!
        /(?:^|\s)Asiakas\s*$/gim, 
        /Asiakas\s+$/gim 
    ];

    for (const key in result.customTexts) {
        let finalClean = result.customTexts[key];
        
        // Vanhat poistot
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