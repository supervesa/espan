// --- src/utils/regex/tyokykyExtractor.js ---

export const extractTyokyky = (text, dbPhrases) => {
    let remainingText = text;
    const tyokykyData = {
        paavalinta: null,
        alentuma_kuvaus: null,
        oma_arvio: null,
        toimenpiteet: []
    };

    // 1. Päävalinta
    if (/Työkyky on normaali/i.test(remainingText)) tyokykyData.paavalinta = 'tyokyky_normaali';
    else if (/Työkyky vaatii lisäselvitystä/i.test(remainingText)) tyokykyData.paavalinta = 'tyokyky_selvityksessa';
    else {
        const alentumaMatch = remainingText.match(/(?:Asiakkaalla on )?työkyvyn alentuma:\s*([^\.]+)(?:\.|$)/i);
        if (alentumaMatch) {
            tyokykyData.paavalinta = 'tyokyky_alentunut';
            tyokykyData.alentuma_kuvaus = alentumaMatch[1].trim();
        }
    }

    // 2. Oma arvio
    const arvioMatch = remainingText.match(/(?:arvioi oman työkykynsä(?: pistemääräksi| numerolla)?)\s*(\d{1,2})/i);
    if (arvioMatch) tyokykyData.oma_arvio = arvioMatch[1];

    // 3. Toimenpiteet (käydään läpi dbPhrases-listan Työkyky-toimenpiteet)
    const kyseisetToimenpiteet = dbPhrases.filter(p => p.grouping_key === 'tyokyky_toimenpide');
    kyseisetToimenpiteet.forEach(toim => {
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
            remainingText = remainingText.replace(match[0], '').trim();
        }
    });

    return { remainingText, tyokykyData };
};