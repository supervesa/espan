import { processTextChunk } from '../../utils/regex/rulesEngine';
import { extractSignals } from '../../utils/regex/signalExtractor';
import { extractPatevyydet } from '../../utils/regex/patevyysExtractor';
import { extractTyokyky } from '../../utils/regex/tyokykyExtractor'; 
import { extractEdellytykset } from '../../utils/regex/edellytyksetExtractor';

import { extractGMServices } from '../../utils/regex/gmServiceExtractor'; 
import { extractKoulutus } from '../../utils/regex/extractKoulutus'; 

const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi;
const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/gi;

export const parsePlanText = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = [], dbServices = [], dbPatevyydet = []) => {
    
    const result = { 
        phrases: [], 
        signals: [], 
        sessionServices: [], 
        sessionEducations: [], 
        patevyydet: [], 
        variables: {}, 
        customTexts: {}, 
        tyokykyData: {}, 
        edellytyksetData: {} 
    };

    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // =========================================================================
    // 1. POIMITAAN LAADINTAPÄIVÄMÄÄRÄ & TUHOTAAN URA-ROSKA
    // =========================================================================
    
    const uraBoilerplateMatchRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?(\d{1,2}\.\d{1,2}\.\d{4})\.?\s*/i;
    const bpMatch = remainingText.match(uraBoilerplateMatchRegex);
    
    if (bpMatch && bpMatch[1]) {
        const laadittuPvm = bpMatch[1];
        result.variables['edellinen_tapaaminen_pvm'] = laadittuPvm;
        result.signals.push({ 
            id: 'edellinen_tapaaminen_pvm', 
            label: `Aiempi suunnitelma laadittu: ${laadittuPvm}` 
        });
    }

    const uraBoilerplateDestroyRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateDestroyRegex, '');

    // =========================================================================
    // 2. AJETAAN GOLDEN MASTER UUTTAJAT (Palvelut ja Koulutukset)
    // =========================================================================
    
    const gmResult = extractGMServices(remainingText);
    result.sessionServices = gmResult.foundServices;
    remainingText = gmResult.remainingText;

    const eduResult = extractKoulutus(remainingText);
    result.sessionEducations = eduResult.foundEducations;
    remainingText = eduResult.remainingText;

    // =========================================================================
    // 3. POIMITAAN GLOBAALIT MUUTTUJAT ENNEN KUIN MIKÄÄN SYÖ TEKSTIÄ
    // =========================================================================
    
    const tyonhakuRegex = /Asiakkaan työnhaku on alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const tyonhakuMatch = remainingText.match(tyonhakuRegex);
    if (tyonhakuMatch) {
        result.variables['tyonhaku_alkanut'] = tyonhakuMatch[1];
    }

    const aidinkieliRegex = /Asiakkaan äidinkieli on\s+([^,.\n]+)/i;
    const aidinkieliMatch = remainingText.match(aidinkieliRegex);
    if (aidinkieliMatch && aidinkieliMatch[1]) {
        result.variables['aidinkieli'] = aidinkieliMatch[1].trim();
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

    // --- UUSI: DIGITAIDOT JA ASIOINTI ---
    
    // Heikot digitaidot
    const heikotDigiRegex = /Asiakkaalla on puutteelliset digitaidot(?: tai niitä ei ole lainkaan)?/i;
    if (heikotDigiRegex.test(remainingText)) {
        result.signals.push({ id: 'puutteelliset_digitaidot', label: 'Puutteelliset digitaidot' });
        remainingText = remainingText.replace(heikotDigiRegex, '').trim();
    }
    
    // Hyvät digitaidot
    const hyvatDigiRegex = /Asiakkaalla on (?:hyvät valmiudet sähköiseen asiointiin[^.]*|hyvät digitaidot)/i;
    if (hyvatDigiRegex.test(remainingText)) {
        result.signals.push({ id: 'hyvat_digitaidot', label: 'Hyvät digitaidot' });
        remainingText = remainingText.replace(hyvatDigiRegex, '').trim();
    }

    // Ei pankkitunnuksia
    const eiPankkiaRegex = /(?:ja )?(?:hänellä |asiakkaalla )?ei ole käytössään vahvaa tunnistautumista/i;
    if (eiPankkiaRegex.test(remainingText)) {
        result.signals.push({ id: 'ei_pankkitunnuksia', label: 'Ei vahvaa tunnistautumista' });
        remainingText = remainingText.replace(eiPankkiaRegex, '').trim();
    }

    // On pankkitunnukset
    const onPankkiaRegex = /(?:ja )?(?:hänellä |asiakkaalla )?on käytössään vahva tunnistautuminen/i;
    if (onPankkiaRegex.test(remainingText)) {
        result.signals.push({ id: 'on_pankkitunnukset', label: 'Vahva tunnistautuminen' });
        remainingText = remainingText.replace(onPankkiaRegex, '').trim();
    }

    // =========================================================================
    // 4. JAA TEKSTI LOHKOIHIN OTSIKOIDEN PERUSTEELLA
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
        { match: /^Työkyky(?:\s|:|$)/i, key: 'tyokyky' },
        { match: /^Työllistymisen edellytysten arviointi(?:\s|:|$)/i, key: 'edellytykset' }
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
    // 5. KÄSITELLÄÄN JOKAINEN LOHKO ERIKSEEN
    // =========================================================================
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        let chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        const tyokykyResult = extractTyokyky(chunkText, dbPhrases);
        chunkText = tyokykyResult.remainingText;
        if (tyokykyResult.tyokykyData && Object.keys(tyokykyResult.tyokykyData).length > 0) {
            result.tyokykyData = { ...result.tyokykyData, ...tyokykyResult.tyokykyData };
        }

        if (sectionKey === 'edellytykset') {
            const edellytyksetResult = extractEdellytykset(chunkText, dbPhrases, dbSignals); 
            chunkText = edellytyksetResult.remainingText;
            if (edellytyksetResult.edellytyksetData && Object.keys(edellytyksetResult.edellytyksetData).length > 0) {
                result.edellytyksetData = { ...result.edellytyksetData, ...edellytyksetResult.edellytyksetData };
            }
        }

        const signalResult = extractSignals(chunkText, dbSignals);
        chunkText = signalResult.remainingText;
        signalResult.foundSignals.forEach(sig => {
            if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
        });

        const patevyysResult = extractPatevyydet(chunkText, dbPatevyydet);
        chunkText = patevyysResult.remainingText;
        patevyysResult.foundPatevyydet.forEach(p => {
            if (!result.patevyydet.some(existing => existing === p)) result.patevyydet.push(p);
        });

        const phraseResult = processTextChunk(chunkText, dbPhrases, dbVariables);
        chunkText = phraseResult.text; 
        phraseResult.foundPhrases.forEach(newPhrase => {
            if (!result.phrases.some(p => p.id === newPhrase.id)) {
                result.phrases.push(newPhrase);
            }
        });

        if (chunkText) result.customTexts[sectionKey] = chunkText;
    }

    // =========================================================================
    // 6. SIIVOUS
    // =========================================================================
    const residueRegexes = [ 
        /Asiakkaalla on voimassa olevat pätevyydet:?/gi, 
        /Asiakkaan äidinkieli on[^.]*\./gi,
        // Siivotaan irtonaiset "ja" sanat ja pisteet, jotka jäivät digitaidoista yli
        /^\s*ja\s*/gi,
        /^\s*\.\s*/gi
    ];
    for (const key in result.customTexts) {
        let finalClean = result.customTexts[key];
        
        finalClean = finalClean.replace(dateRegex, '').replace(escoRegex, '');
        residueRegexes.forEach(rx => { finalClean = finalClean.replace(rx, ''); });
        
        finalClean = finalClean.replace(/\s{2,}/g, ' ').trim();
        if (/^(?:pätevyydet|kortit|pätevyydet:|kortit:)$/i.test(finalClean)) {
            finalClean = '';
        }

        if (!finalClean) delete result.customTexts[key]; 
        else result.customTexts[key] = finalClean;
    }

    return result;
};