import { processTextChunk } from '../../utils/regex/rulesEngine';
import { extractSignals } from '../../utils/regex/signalExtractor';
import { extractPatevyydet } from '../../utils/regex/patevyysExtractor';
import { extractTyokyky } from '../../utils/regex/tyokykyExtractor'; 
import { extractEdellytykset } from '../../utils/regex/edellytyksetExtractor';
import { extractGMServices } from '../../utils/regex/gmServiceExtractor'; 
import { extractKoulutus } from '../../utils/regex/extractKoulutus'; 
import { extractTyottomyysturva } from '../../utils/regex/tyottomyysturvaExtractor';
import { extractSentinelData } from '../../utils/regex/sentinelExtractor'; // Identiteetin poimija

// Globaalit regex-vakiot
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
        edellytyksetData: {},
        tyottomyysturvaData: { answers: {} }
    };

    if (!rawText) return result;

    // Poistetaan näkymättömät ohjausmerkit mutta säilytetään teksti muuten ennallaan
    let remainingText = rawText.replace(/\u200B|\u200D|\u200C/g, '').trim();
    
    // =========================================================================
    // 1. VAIHE: SENTINEL & IDENTITEETTI (Luku raakatekstistä)
    // =========================================================================
    // Tämä on kriittisin vaihe: poimitaan tiedot ovimiestä varten ennen silppuamista.
    const sentinel = extractSentinelData(remainingText);
    
    // Siirretään löydetyt muuttujat (pvm, kunta, kieli, syntymävuosi, tapa)
    result.variables = { ...result.variables, ...sentinel.variables };
    
    // Siirretään löydetyt identiteetti-signaalit
    sentinel.signals.forEach(sig => {
        if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
    });

    // Poimitaan ESCO-ammatti (historiallinen tuki)
    const escoMatch = remainingText.match(escoRegex);
    if (escoMatch && escoMatch[0]) {
        const exactAmmatti = escoMatch[0].match(/tavoiteammatti(?:na on|:)?\s+([a-zäöåA-ZÄÖÅ\s-]+)(?:\.|$|\n)/i);
        if (exactAmmatti && exactAmmatti[1]) {
            result.variables['tavoiteammatti_esco'] = exactAmmatti[1].trim();
        }
    }

    // Poimitaan palvelujakson ajat (historiallinen tuki)
    const dateMatch = remainingText.match(dateRegex);
    if (dateMatch && dateMatch[0]) {
        const exactDates = dateMatch[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})/g);
        if (exactDates && exactDates.length >= 2) {
            result.variables['palvelu_alku'] = exactDates[0];
            result.variables['palvelu_loppu'] = exactDates[1];
        }
    }

    // =========================================================================
    // 2. VAIHE: TUHOAVAT UUTTAJAT (Teksti alkaa lyhentyä)
    // =========================================================================
    
    // A) Poistetaan URA-boilerplate (vasta nyt, kun sentinel on lukenut sen)
    const uraBoilerplateDestroyRegex = /(?:Tämä\s+suunnitelma\s+laadittiin)[^\n\r]*?\d{1,2}\.\d{1,2}\.\d{4}\.?\s*/gi;
    remainingText = remainingText.replace(uraBoilerplateDestroyRegex, '');

    // B) Työttömyysturva (erillinen uuttaja koko tekstille)
    const ttResult = extractTyottomyysturva(remainingText, dbPhrases);
    Object.assign(result.tyottomyysturvaData.answers, ttResult.answers);
    ttResult.foundPhrases.forEach(p => result.phrases.push(p));

    // C) Golden Master uuttajat (nämä poistavat tunnistetut lauseet tekstistä)
    const gmResult = extractGMServices(remainingText);
    result.sessionServices = gmResult.foundServices;
    remainingText = gmResult.remainingText;

    const eduResult = extractKoulutus(remainingText);
    result.sessionEducations = eduResult.foundEducations;
    remainingText = eduResult.remainingText;

    // =========================================================================
    // 3. VAIHE: LOHKOMINEN OTSIKOIDEN PERUSTEELLA
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

        // Työkyky
        const tyokykyRes = extractTyokyky(chunkText, dbPhrases);
        chunkText = tyokykyRes.remainingText;
        if (tyokykyRes.tyokykyData) {
            result.tyokykyData = { ...result.tyokykyData, ...tyokykyRes.tyokykyData };
        }

        // Työllistymisen edellytykset
        if (sectionKey === 'edellytykset') {
            const edRes = extractEdellytykset(chunkText, dbPhrases, dbSignals); 
            chunkText = edRes.remainingText;
            if (edRes.edellytyksetData) {
                result.edellytyksetData = { ...result.edellytyksetData, ...edRes.edellytyksetData };
            }
        }

        // Signaalit
        const sigRes = extractSignals(chunkText, dbSignals);
        chunkText = sigRes.remainingText;
        sigRes.foundSignals.forEach(sig => {
            if (!result.signals.some(s => s.id === sig.id)) result.signals.push(sig);
        });

        // Pätevyydet
        const patevyysRes = extractPatevyydet(chunkText, dbPatevyydet);
        chunkText = patevyysRes.remainingText;
        patevyysRes.foundPatevyydet.forEach(p => {
            if (!result.patevyydet.includes(p)) result.patevyydet.push(p);
        });

        // Vakiolauseet (Rules Engine)
        const phraseRes = processTextChunk(chunkText, dbPhrases, dbVariables);
        chunkText = phraseRes.text; 
        phraseRes.foundPhrases.forEach(p => {
            if (!result.phrases.some(exist => exist.id === p.id)) result.phrases.push(p);
        });

        if (chunkText) result.customTexts[sectionKey] = chunkText;
    }

  // =========================================================================
    // 5. VAIHE: LOPPUSIIVOUS (Residue-regexmit)
    // =========================================================================
    const residueRegexes = [ 
        /Asiakkaalla on voimassa olevat pätevyydet:?/gi, 
        /Asiakkaan äidinkieli on[^.]*\./gi,
        /Asiakkaan kotikunta on[^.]*\./gi,
        /Asiakkaan työnhaku on alkanut[^.]*\./gi,
        // Kielen tason korjaus, joka kestää B1.2 tyyppiset pisteet pätkimättä:
        /suomen kielen taito on tasolla\s*[a-c][1-2](?:\.[1-2])?\.?/gi, 
        /Asiakkaan oma arvio työkyvystään \(0-10\):?/gi,
        /Asiakkaalla on (?:hyvät|puutteelliset) digitaidot[^.]*\.?/gi,
        /Asiakkaalla on hyvät valmiudet sähköiseen asiointiin[^.]*\.?/gi,
        
        // --- UUDET LISÄYKSET TÄSSÄ ---
        // 1. Reikäjuustolause (kun sääntömoottori on purrut välistä sähköisen asioinnin)
        /Asiakkaalla on hyvät (?:ja )?itsenäiseen tiedonhakuun[^.]*\.?/gi,
        // 2. Tavoitteiden toisto
        /Asiakkaan ensisijaisena tavoitteena on työllistyä avoimille markkinoille\.?/gi,
        // 3. Työttömyyden kesto
        /Asiakkaan työttömyys on pitkittynyt\.?/gi,
        
        /Keskusteltiin yrittäjyydestä\.\s*Asiakas ei ole tässä vaiheessa kiinnostunut yritystoiminnan aloittamisesta\.?/gi,
        
        // --- ORPOJEN SANOJEN JA MERKKIEN SIIVOUS ---
        /(?:^|\s)Asiakas\s*\./gi,  // Poistaa orvon "Asiakas ."
        /^\s*[,.]\s*\d\.?/g,       // Nappaa sen ", 2." alun (joka jäi kielitasosta)
        /^\s*ja\s*/gi,
        /^[.,\s]+/g                // Poistaa alusta jääneet orvot pilkut ja pisteet
    ];

    for (const key in result.customTexts) {
        let finalClean = result.customTexts[key];
        
        // Poistetaan globaalit osumat (date, esco)
        finalClean = finalClean.replace(dateRegex, '').replace(escoRegex, '');
        
        // Poistetaan residue-listan pätkät
        residueRegexes.forEach(rx => { finalClean = finalClean.replace(rx, ''); });
        
        // Kieliopillinen siivous: Tuplavälit, tuplapisteet ja siistiminen
        finalClean = finalClean
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+\./g, '.')
            .replace(/\.\./g, '.')
            .trim();
        
        // Jos jäljelle jäi vain otsikko tai se on tyhjä, poistetaan koko lohko
        if (!finalClean || /^(?:pätevyydet|kortit|pätevyydet:|kortit:)$/i.test(finalClean)) {
            delete result.customTexts[key]; 
        } else {
            result.customTexts[key] = finalClean;
        }
    }

    return result;
};