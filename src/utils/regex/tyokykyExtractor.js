// --- src/utils/regex/tyokykyExtractor.js ---

export const extractTyokyky = (text, dbPhrases = []) => {
    let remainingText = text;
    const tyokykyData = {
        paavalinta: null,
        alentuma_kuvaus: null,
        oma_arvio: null,
        toimenpiteet: []
    };

    if (!text) return { remainingText, tyokykyData };

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
            const alentumaMatch = remainingText.match(/(?:(?:Asiakkaalla on\s+)?työkyvyn\s+)?alentuma:\s*([^.]+)(?:\.|$)/i);
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
        remainingText = remainingText.replace(arvioMatch[0], '').trim();
    }

    // 3. Toimenpiteet (KORJATTU: Kestää vialliset tai virheelliset säännölliset lausekkeet)
    if (dbPhrases && Array.isArray(dbPhrases)) {
        const kyseisetToimenpiteet = dbPhrases.filter(p => p.grouping_key === 'tyokyky_toimenpide');
        
        // Sisäinen apufunktio pomminvarmalle tekstille (Välttää koodin monistamisen)
        const tryBaseTextMatch = (baseText) => {
            if (!baseText) return null;
            const cleanBase = baseText.trim().replace(/\.$/, '');
            const escapedBase = cleanBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fallbackRegex = new RegExp(`${escapedBase}(?:\\.\\s|\\.\\n|\\s*\\n|$)`, 'i');
            return remainingText.match(fallbackRegex);
        };

        kyseisetToimenpiteet.forEach(toim => {
            let isMatch = false;
            let textToWipe = null;

            if (toim.extraction_pattern) {
                try {
                    const regex = new RegExp(toim.extraction_pattern.replace(/"/g, ''), 'i');
                    const match = remainingText.match(regex);
                    if (match) {
                        isMatch = true;
                        textToWipe = match[0];
                    }
                } catch (e) {
                    // Säännöllinen lauseke oli viallinen kannassa (kuten konsolivaroitukset näyttivät).
                    // Hiljennetään varoitus ja käytetään välitöntä tekstihakua fallbackina!
                    const fallbackMatch = tryBaseTextMatch(toim.base_text);
                    if (fallbackMatch) {
                        isMatch = true;
                        textToWipe = fallbackMatch[0];
                    }
                }
            } else {
                // Jos lauseketta ei ole määritelty ollenkaan, ajetaan suora haku tekstistä
                const fallbackMatch = tryBaseTextMatch(toim.base_text);
                if (fallbackMatch) {
                    isMatch = true;
                    textToWipe = fallbackMatch[0];
                }
            }

            // Jos osuma saatiin säännöllisellä lausekkeella TAI tekstihaku-fallbackilla
            if (isMatch) {
                const uusiToim = {
                    avainsana: toim.avainsana || toim.phrase_key,
                    label: toim.short_title || toim.base_text,
                    muuttujat: {}
                };
                
                // Etsitään mahdolliset PVM-muuttujat toimenpiteen läheltä
                const pvmMatch = remainingText.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*mennessä/i);
                if (pvmMatch) uusiToim.muuttujat['PVM'] = pvmMatch[1];
                
                tyokykyData.toimenpiteet.push(uusiToim);
                
                // Siivotaan lause pois tekstistä
                if (textToWipe) {
                    remainingText = remainingText.replace(textToWipe, '\n').trim();
                }
            }
        });
    }

    remainingText = remainingText.replace(/\n{3,}/g, '\n\n').trim();
    return { remainingText, tyokykyData };
};