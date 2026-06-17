import { DATE_RANGE_PATTERN } from './core';

// Avainsanat, joilla heuristinen tunnistus toimii
const KEYWORD_MAP = {
    tyokokeilu: ['työkokeilu', 'työkokeilussa', 'työkokeiluun'],
    palkkatuki: ['palkkatuki', 'palkkatuella', 'palkkatukityö', 'palkkatukityössä', 'palkkatuetussa'],
    tyovoimakoulutus: ['työvoimakoulutus', 'työvoimakoulutuksessa', 'työvoimakoulutukseen'],
    opiskelu_omaehtoinen: ['omaehtoinen opiskelu', 'omaehtoisessa opiskelussa', 'omaehtoiseen opiskeluun', 'omaehtoisia opintoja'],
    opiskelu_lyhytkestoinen: ['lyhytkestoinen opiskelu', 'lyhytkestoisissa opinnoissa', 'lyhytkestoisiin opintoihin'],
    opiskelu_sivutoiminen: ['sivutoiminen opiskelu', 'sivutoimisessa opiskelussa', 'sivutoimisiin opintoihin'],
    opiskelu_kotoutuja: ['kotoutujan omaehtoinen', 'kotoutumista tukeva opiskelu', 'kotoutujan omaehtoisessa opiskelussa']
};

export const extractGMServices = (text) => {
    let remainingText = text;
    const rawFoundServices = [];

    if (!text) return { remainingText, foundServices: [] };

    // 1. HARAVOIDAAN KAIKKI OSUMAT
    Object.entries(KEYWORD_MAP).forEach(([entityKey, keywords]) => {
        keywords.forEach(word => {
            const regex = new RegExp(word, 'i');
            let match = remainingText.match(regex);
            let safetyCounter = 0; // Estää ikiluupit
            
            while (match && safetyCounter < 10) {
                safetyCounter++;
                
                // Otetaan tekstin pätkä sanan JÄLKEEN, jotta voidaan etsiä päivät/sulut
                const endIdx = Math.min(remainingText.length, match.index + 150);
                const context = remainingText.substring(match.index, endIdx);

                // Etsitään päivämäärät lähistöltä
                const dateMatch = context.match(DATE_RANGE_PATTERN);
                
                // Etsitään SULUT aivan sanan vierestä (esim. "omaehtoisessa opiskelussa (luulaja)")
                const afterWord = remainingText.substring(match.index + match[0].length, match.index + match[0].length + 40);
                const nameMatch = afterWord.match(/^\s*\(([^)]+)\)/);
                const nimi = nameMatch ? nameMatch[1].trim() : '';

                // Tallennetaan raakalöytö taulukkoon
                rawFoundServices.push({
                    id: window.crypto.randomUUID(),
                    entity_key: entityKey,
                    category: entityKey.startsWith('opiskelu') ? 'opiskelu' : 'palvelu',
                    data: {
                        alku: dateMatch ? dateMatch[1] : '',
                        loppu: dateMatch ? dateMatch[2] : '',
                        nimi: nimi
                    },
                    meta: { source: 'scraper_heuristic' }
                });

                // Siivotaan teksti, ettei samaa sanaa löydetä uudestaan
                let stringToReplace = match[0];
                if (nameMatch) {
                    stringToReplace += nameMatch[0]; // Poistetaan myös sulut tekstistä
                }
                
                // Pyyhitään löydetty sana puhtaasti (turvallisempi kuin regex-replace tässä kohtaa)
                remainingText = remainingText.replace(stringToReplace, '\n');

                // Jos päivämäärä löytyi, siivotaan sekin pois häiritsemästä
                if (dateMatch) {
                    remainingText = remainingText.replace(dateMatch[0], ' ');
                }

                // Haetaan seuraava osuma, jos samassa tekstissä on sama sana uudelleen
                match = remainingText.match(regex);
            }
        });
    });

    // ----------------------------------------------------
    // 2. DEDUPLIKOINTI (Puhdistetaan tuplat)
    // ----------------------------------------------------
    const cleanedServices = [];
    
    // Ryhmitellään löydöt entity_keyn mukaan (esim. kaikki palkkatuet nippuun)
    const grouped = rawFoundServices.reduce((acc, curr) => {
        if (!acc[curr.entity_key]) acc[curr.entity_key] = [];
        acc[curr.entity_key].push(curr);
        return acc;
    }, {});

    // Analysoidaan ryhmät
    Object.keys(grouped).forEach(key => {
        const items = grouped[key];
        
        // Jos löydettiin vain yksi kappale tätä tyyppiä, pidetään se suoraan
        if (items.length === 1) {
            cleanedServices.push(items[0]);
            return;
        }

        // Jos löydettiin useita, lajitellaan ne: joissa on päivät vs joissa ei ole
        const withDates = items.filter(i => i.data.alku && i.data.loppu);
        const withoutDates = items.filter(i => !i.data.alku || !i.data.loppu);

        if (withDates.length > 0) {
            // Jos löytyi päivämäärällisiä, hylätään tyhjät osumat kokonaan!
            // Estetään myös täsmälleen samojen päivämäärien monistuminen:
            const uniqueWithDates = [];
            withDates.forEach(wd => {
                const isDuplicate = uniqueWithDates.some(u => u.data.alku === wd.data.alku && u.data.loppu === wd.data.loppu);
                if (!isDuplicate) uniqueWithDates.push(wd);
            });
            cleanedServices.push(...uniqueWithDates);
        } else {
            // Jos mikään löydös ei sisältänyt päiviä, lisätään vain yksi tyhjä laatikko
            cleanedServices.push(withoutDates[0]);
        }
    });

    return { remainingText, foundServices: cleanedServices };
};