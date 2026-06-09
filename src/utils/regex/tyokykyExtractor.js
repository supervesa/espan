// --- src/utils/regex/tyokykyExtractor.js ---

export const extractTyokyky = (text, dbPhrases = []) => {
    let remainingText = text;
    const tyokykyData = {
        paavalinta: null,
        alentuma_kuvaus: null,
        oma_arvio: null,
        toimenpiteet: []
    };

    // 1. Päävalinta (Sallii sen, että otsikko "Työkyky" on jo leikattu pois alusta)
    const normaaliRegex = /(?:Työkyky\s+)?on normaali\.?/i;
    if (normaaliRegex.test(remainingText)) {
        tyokykyData.paavalinta = 'tyokyky_normaali';
        remainingText = remainingText.replace(normaaliRegex, '').trim();
    } else {
        const selvitysRegex = /(?:Työkyky\s+)?vaatii lisäselvitystä\.?/i;
        if (selvitysRegex.test(remainingText)) {
            tyokykyData.paavalinta = 'tyokyky_selvityksessa';
            remainingText = remainingText.replace(selvitysRegex, '').trim();
        } else {
            const alentumaMatch = remainingText.match(/(?:(?:Asiakkaalla on\s+)?työkyvyn\s+)?alentuma:\s*([^\.]+)(?:\.|$)/i);
            if (alentumaMatch) {
                tyokykyData.paavalinta = 'tyokyky_alentunut';
                tyokykyData.alentuma_kuvaus = alentumaMatch[1].trim();
                remainingText = remainingText.replace(alentumaMatch[0], '').trim();
            }
        }
    }

    // 2. Oma arvio (Tunnistaa sekä uuden että vanhan URA-muotoilun)
    const arvioRegex = /(?:arvioi oman työkykynsä(?: pistemääräksi| numerolla)?|Asiakkaan oma arvio työkyvystään\s*\(0-10\):?)\s*(\d{1,2})\.?/i;
    const arvioMatch = remainingText.match(arvioRegex);
    if (arvioMatch) {
        tyokykyData.oma_arvio = arvioMatch[1];
        // Syödään lause pois tekstistä, jotta se ei jää vapaaseen tekstiin
        remainingText = remainingText.replace(arvioMatch[0], '').trim();
    }

    // 3. Toimenpiteet (käydään läpi dbPhrases-listan Työkyky-toimenpiteet)
    if (dbPhrases && Array.isArray(dbPhrases)) {
        const kyseisetToimenpiteet = dbPhrases.filter(p => p.grouping_key === 'tyokyky_toimenpide');
        kyseisetToimenpiteet.forEach(toim => {
            try {
                // Poistetaan lainausmerkit regex-patternista, jos niitä on
                const regex = new RegExp(toim.extraction_pattern.replace(/"/g, ''), 'i');
                const match = remainingText.match(regex);
                
                if (match) {
                    const uusiToim = {
                        avainsana: toim.avainsana,
                        label: toim.short_title || toim.base_text,
                        muuttujat: {}
                    };
                    
                    // Etsitään mahdolliset PVM-muuttujat toimenpiteen läheltä
                    const pvmMatch = remainingText.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*mennessä/i);
                    if (pvmMatch) uusiToim.muuttujat['PVM'] = pvmMatch[1];
                    
                    tyokykyData.toimenpiteet.push(uusiToim);
                    
                    // Syödään toimenpidelause pois tekstistä
                    remainingText = remainingText.replace(match[0], '').trim();
                }
            } catch (e) {
                console.warn("Virheellinen regex-pattern toimenpiteessä:", toim.avainsana);
            }
        });
    }

    return { remainingText, tyokykyData };
};