import { DATE_RANGE_PATTERN } from './core';

// 1. TÄMÄ PUUTTUI: Avainsanat, joilla heuristinen tunnistus toimii
const KEYWORD_MAP = {
    tyokokeilu: ['työkokeilu', 'työkokeilussa', 'työkokeiluun'],
    palkkatuki: ['palkkatuki', 'palkkatuella', 'palkkatukityö', 'palkkatukityössä', 'palkkatuetussa'],
    tyovoimakoulutus: ['työvoimakoulutus', 'työvoimakoulutuksessa', 'työvoimakoulutukseen'],
    kuntouttava_tyotoiminta: ['kuntouttava työtoiminta', 'kuntouttavassa työtoiminnassa', 'kuntouttavaan työtoimintaan'],
    opiskelu_omaehtoinen: ['omaehtoinen opiskelu', 'omaehtoisessa opiskelussa', 'omaehtoiseen opiskeluun', 'omaehtoisia opintoja'],
    opiskelu_lyhytkestoinen: ['lyhytkestoinen opiskelu', 'lyhytkestoisissa opinnoissa', 'lyhytkestoisiin opintoihin'],
    opiskelu_sivutoiminen: ['sivutoiminen opiskelu', 'sivutoimisessa opiskelussa', 'sivutoimisiin opintoihin'],
    opiskelu_kotoutuja: ['kotoutujan omaehtoinen', 'kotoutumista tukeva opiskelu', 'kotoutujan omaehtoisessa opiskelussa']
};

// 2. ITSE FUNKTIO
export const extractGMServices = (text) => {
    let remainingText = text;
    const rawFoundServices = [];

    if (!text) return { remainingText, foundServices: [] };

    // Haravoidaan kaikki osumat
    Object.entries(KEYWORD_MAP).forEach(([entityKey, keywords]) => {
        keywords.forEach(word => {
            const regex = new RegExp(word, 'i');
            let match = remainingText.match(regex);
            let safetyCounter = 0; // Estää ikiluupit
            
            while (match && safetyCounter < 10) {
                safetyCounter++;
                
                // Otetaan tekstin pätkä sanan JÄLKEEN, jotta voidaan etsiä päivät, tunnit ja sulut
                const endIdx = Math.min(remainingText.length, match.index + 150);
                const context = remainingText.substring(match.index, endIdx);

                // Etsitään päivämäärät lähistöltä
                const dateMatch = context.match(DATE_RANGE_PATTERN);
                
                // Etsitään SULUT aivan sanan vierestä
                const afterWord = remainingText.substring(match.index + match[0].length, match.index + match[0].length + 40);
                const nameMatch = afterWord.match(/^\s*\(([^)]+)\)/);
                const nimi = nameMatch ? nameMatch[1].trim() : '';

                // Etsitään päivät ja tunnit
                const paivatMatch = context.match(/(\d(?:[.,]\d)?)\s*(?:pv|päivää?)\b/i);
                const tunnitMatch = context.match(/(\d(?:[.,]\d)?)\s*(?:h|tuntia?)\b/i);

                const paivatViikossa = paivatMatch ? paivatMatch[1].replace(',', '.') : '';
                const tunnitPaivassa = tunnitMatch ? tunnitMatch[1].replace(',', '.') : '';

                // Tallennetaan raakalöytö taulukkoon
                rawFoundServices.push({
                    id: window.crypto.randomUUID(),
                    entity_key: entityKey,
                    category: entityKey.startsWith('opiskelu') ? 'opiskelu' : 'palvelu',
                    data: {
                        alku: dateMatch ? dateMatch[1] : '',
                        loppu: dateMatch ? dateMatch[2] : '',
                        nimi: nimi,
                        paivatViikossa: paivatViikossa,
                        tunnitPaivassa: tunnitPaivassa
                    },
                    meta: { source: 'scraper_heuristic' }
                });

                // Siivotaan teksti, ettei samaa sanaa löydetä uudestaan
                let stringToReplace = match[0];
                if (nameMatch) {
                    stringToReplace += nameMatch[0]; 
                }
                
                remainingText = remainingText.replace(stringToReplace, '\n');

                if (dateMatch) {
                    remainingText = remainingText.replace(dateMatch[0], ' ');
                }

                match = remainingText.match(regex);
            }
        });
    });

    // Deduplikointi (Puhdistetaan tuplat)
    const cleanedServices = [];
    
    const grouped = rawFoundServices.reduce((acc, curr) => {
        if (!acc[curr.entity_key]) acc[curr.entity_key] = [];
        acc[curr.entity_key].push(curr);
        return acc;
    }, {});

    Object.keys(grouped).forEach(key => {
        const items = grouped[key];
        
        if (items.length === 1) {
            cleanedServices.push(items[0]);
            return;
        }

        const withDates = items.filter(i => i.data.alku && i.data.loppu);
        const withoutDates = items.filter(i => !i.data.alku || !i.data.loppu);

        if (withDates.length > 0) {
            const uniqueWithDates = [];
            withDates.forEach(wd => {
                const isDuplicate = uniqueWithDates.some(u => u.data.alku === wd.data.alku && u.data.loppu === wd.data.loppu);
                if (!isDuplicate) uniqueWithDates.push(wd);
            });
            cleanedServices.push(...uniqueWithDates);
        } else {
            cleanedServices.push(withoutDates[0]);
        }
    });

    return { remainingText, foundServices: cleanedServices };
};