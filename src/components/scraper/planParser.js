import { processTextChunk } from '../../utils/regex/rulesEngine';
import { extractSignals } from '../../utils/regex/signalExtractor';
import { extractPatevyydet } from '../../utils/regex/patevyysExtractor';
import { extractTyokyky } from '../../utils/regex/tyokykyExtractor'; 
import { extractEdellytykset } from '../../utils/regex/edellytyksetExtractor';
import { extractGMServices } from '../../utils/regex/gmServiceExtractor'; 
import { extractKoulutus } from '../../utils/regex/extractKoulutus'; 
import { extractTyottomyysturva } from '../../utils/regex/tyottomyysturvaExtractor';
import { extractSentinelData } from '../../utils/regex/sentinelExtractor'; 
import { extractServicesTable, extractServiceOverrides } from '../../utils/regex/serviceExtractor'; 

// Globaalit regex-vakiot
const dateRegex = /ajalla\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi;
const escoRegex = /tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/gi;

export const parsePlanText = (rawText, dbSections = [], dbPhrases = [], dbSignals = [], dbVariables = [], dbServices = [], dbPatevyydet = []) => {
    
    const result = { 
        phrases: [], 
        signals: [], 
        services: [], 
        sessionServices: [], 
        sessionEducations: [], 
        patevyydet: [], 
        variables: {}, 
        customTexts: {}, 
        tyokykyData: {}, 
        edellytyksetData: {},
        tyottomyysturvaData: { answers: {} }
    };

    if (!rawText) return result;

    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // =========================================================================
    // 1. VAIHE: SENTINEL & IDENTITEETTI
    // =========================================================================
    const sentinel = extractSentinelData(remainingText);
    
    result.variables = { ...result.variables, ...sentinel.variables };
    
    sentinel.signals.forEach(sig => {
        if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
    });

    const escoMatch = remainingText.match(escoRegex);
    if (escoMatch && escoMatch[0]) {
        const exactAmmatti = escoMatch[0].match(/tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i);
        if (exactAmmatti && exactAmmatti[1]) {
            result.variables['tavoiteammatti_esco'] = exactAmmatti[1].trim();
        }
    }

    const dateMatch = remainingText.match(dateRegex);
    if (dateMatch && dateMatch[0]) {
        const exactDates = dateMatch[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/g);
        if (exactDates && exactDates.length >= 2) {
            result.variables['palvelu_alku'] = exactDates[0];
            result.variables['palvelu_loppu'] = exactDates[1];
        }
    }

    // =========================================================================
    // 2. VAIHE: TURVALLISET UUTTAJAT (Ei syödä sanoja liian aikaisin!)
    // =========================================================================
    
    const uraBoilerplateDestroyRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateDestroyRegex, '');

    const ttResult = extractTyottomyysturva(remainingText, dbPhrases);
    Object.assign(result.tyottomyysturvaData.answers, ttResult.answers);
    ttResult.foundPhrases.forEach(p => result.phrases.push(p));

    // Luodaan vain Välimuistipankki, mutta ei leikata vapaata tekstiä rikki!
    const servicesTableRes = extractServicesTable(remainingText, dbServices);
    let palveluMemoryBank = servicesTableRes.memoryBank; 
    remainingText = servicesTableRes.remainingText;
    
    servicesTableRes.autoSignals.forEach(sigKey => {
        if (!result.signals.some(s => s.id === sigKey || s.signal_key === sigKey)) {
            const dbSig = dbSignals.find(s => s.signal_key === sigKey);
            result.signals.push({
                id: sigKey,
                signal_key: sigKey,
                label: dbSig ? dbSig.label : sigKey
            });
        }
    });
    
    // HUOM: Golden Master (extractGMServices) ja Koulutus siirretty VAIHEESEEN 4!

    // =========================================================================
    // 3. VAIHE: LOHKOMINEN OTSIKOIDEN PERUSTEELLA
    // =========================================================================
    const URA_HEADERS = [
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
            const hMatch = cleanLine.match(header.match);
            if (hMatch) {
                currentSectionKey = header.key;
                if (!chunks[currentSectionKey]) chunks[currentSectionKey] = [];
                foundHeader = true;
                const afterHeader = cleanLine.substring(hMatch[0].length).trim();
                if (afterHeader) chunks[currentSectionKey].push(afterHeader);
                break; 
            }
        }
        if (!foundHeader) chunks[currentSectionKey].push(cleanLine);
    }

    // =========================================================================
    // 4. VAIHE: OSIOKOHTAINEN ANALYYSI
    // =========================================================================
    for (const [sectionKey, linesArr] of Object.entries(chunks)) {
        let chunkText = linesArr.join('\n').trim();
        if (!chunkText) continue; 

        // KORJAUS: Ajetaan vain Työkyky-osiossa, jotta myöhemmät tyhjät osiot eivät ylikirjoita dataa nulleilla
        if (sectionKey === 'tyokyky') {
            const tyokykyRes = extractTyokyky(chunkText, dbPhrases);
            chunkText = tyokykyRes.remainingText;
            if (tyokykyRes.tyokykyData) {
                result.tyokykyData = { ...result.tyokykyData, ...tyokykyRes.tyokykyData };
            }
        }

        // Työllistymisen edellytykset - Nyt teksti saapuu tänne koskemattomana!
        if (sectionKey === 'edellytykset') {
            
            // Asiantuntijatekstin nuuskinta ja ylikirjoitus
            const overrideRes = extractServiceOverrides(chunkText, dbServices, palveluMemoryBank);
            chunkText = overrideRes.remainingText; 
            
            overrideRes.autoSignals.forEach(sigKey => {
                if (!result.signals.some(s => s.id === sigKey || s.signal_key === sigKey)) {
                    const dbSig = dbSignals.find(s => s.signal_key === sigKey);
                    result.signals.push({
                        id: sigKey,
                        signal_key: sigKey,
                        label: dbSig ? dbSig.label : sigKey
                    });
                }
            });

            const edRes = extractEdellytykset(chunkText, dbPhrases, dbSignals); 
            chunkText = edRes.remainingText;
            if (edRes.edellytyksetData) {
                result.edellytyksetData = { ...result.edellytyksetData, ...edRes.edellytyksetData };
            }
        }

        const sigRes = extractSignals(chunkText, dbSignals);
        chunkText = sigRes.remainingText;
        sigRes.foundSignals.forEach(sig => {
            if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
        });

        const patevyysRes = extractPatevyydet(chunkText, dbPatevyydet);
        chunkText = patevyysRes.remainingText;
        patevyysRes.foundPatevyydet.forEach(p => {
            if (!result.patevyydet.includes(p)) result.patevyydet.push(p);
        });

        const phraseRes = processTextChunk(chunkText, dbPhrases, dbVariables);
        chunkText = phraseRes.text; 
        phraseRes.foundPhrases.forEach(p => {
            if (!result.phrases.some(exist => exist.id === p.id)) result.phrases.push(p);
        });

        // --- UUSI SIJAINTI TUHOAVILLE UUTTAJILLE ---
        // Vasta kun kaikki muu logiikka on ajettu, leikataan Golden Master ja Koulutus pois.
        const gmResult = extractGMServices(chunkText);
        chunkText = gmResult.remainingText;
        if (gmResult.foundServices) {
            gmResult.foundServices.forEach(s => {
                if (!result.sessionServices.some(es => es.id === s.id)) {
                    result.sessionServices.push(s);
                }
            });
        }

        const eduResult = extractKoulutus(chunkText);
        chunkText = eduResult.remainingText;
        if (eduResult.foundEducations) {
            eduResult.foundEducations.forEach(e => {
                if (!result.sessionEducations.some(ee => ee.id === e.id)) {
                    result.sessionEducations.push(e);
                }
            });
        }
        // -------------------------------------------

        if (chunkText) result.customTexts[sectionKey] = chunkText;
    }

  // =========================================================================
    // 5. VAIHE: LOPPUSIIVOUS
    // =========================================================================
    const residueRegexes = [ 
        /Asiakkaalla on voimassa olevat pätevyydet:?/gi, 
        /Asiakkaan äidinkieli on[^.]*\./gi,
        /Asiakkaan kotikunta on[^.]*\./gi,
        /Asiakkaan työnhaku on alkanut[^.]*\./gi,
        /suomen kielen taito on tasolla\s*[a-c][1-2](?:\.[1-2])?\.?/gi, 
        /Asiakkaan oma arvio työkyvystään \(0-10\):?/gi,
        /Asiakkaalla on (?:hyvät|puutteelliset) digitaidot[^.]*\.?/gi,
        /Asiakkaalla on hyvät valmiudet sähköiseen asiointiin[^.]*\.?/gi,
        /Asiakkaalla on hyvät (?:ja )?itsenäiseen tiedonhakuun[^.]*\.?/gi,
        /Asiakkaan ensisijaisena tavoitteena on työllistyä avoimille markkinoille\.?/gi,
        /Asiakkaan työttömyys on pitkittynyt\.?/gi,
        /Keskusteltiin yrittäjyydestä\.\s*Asiakas ei ole tässä vaiheessa kiinnostunut yritystoiminnan aloittamisesta\.?/gi,
        /(?:^|\s)Asiakas\s*\./gi,  
        /^\s*[,.]\s*\d\.?/g,       
        /^\s*ja\s*/gi,
        /^[.,\s]+/g                
    ];

    for (const key in result.customTexts) {
        let finalClean = result.customTexts[key];
        
        finalClean = finalClean.replace(dateRegex, '').replace(escoRegex, '');
        residueRegexes.forEach(rx => { finalClean = finalClean.replace(rx, ''); });
        
        finalClean = finalClean
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+\./g, '.')
            .replace(/\.\./g, '.')
            .trim();
        
        if (!finalClean || /^(?:pätevyydet|kortit|pätevyydet:|kortit:)$/i.test(finalClean)) {
            delete result.customTexts[key]; 
        } else {
            result.customTexts[key] = finalClean;
        }
    }

    // Muutetaan Map takaisin arrayksi jota UI osaa lukea
    result.services = Array.from(palveluMemoryBank.values());

    return result;
};