// --- src/utils/regex/edellytyksetExtractor.js ---

export const extractEdellytykset = (text, dbPhrases = [], dbSignals = []) => {
    let remainingText = text;
    
    const edellytyksetData = {
        escoNimi: null,
        finescoAla: null,
        vaihtoehtoisetAlat: [],
        activeTags: {
            tavoitteet: [], 
            markkina: [],   
            elamantila: []  
        },
        selections: {
            vireilla: null, 
            hylatty: null   
        }
    };

    if (!text) return { remainingText, edellytyksetData };

    // 1. TAVOITEAMMATTIEN JA ALOJEN POIMINTA
    const finescoEscoMatch = remainingText.match(/alalle:\s*([^.]+)\.\s*Tarkempana tavoiteammattina on\s*([^.]+)\./i);
    const justEscoMatch = remainingText.match(/tavoiteammattina on\s*([^.]+)\./i);
    const justFinescoMatch = remainingText.match(/alalle:\s*([^.]+)\./i);
    const vaihtoEhtoMatch = remainingText.match(/Vaihtoehtoisina tavoitteina on kartoitettu\s*([^.]+)\./i);

    if (finescoEscoMatch) {
        edellytyksetData.finescoAla = finescoEscoMatch[1].trim();
        edellytyksetData.escoNimi = finescoEscoMatch[2].trim();
        remainingText = remainingText.replace(finescoEscoMatch[0], '').trim();
    } else if (justEscoMatch) {
        edellytyksetData.escoNimi = justEscoMatch[1].trim();
        remainingText = remainingText.replace(justEscoMatch[0], '').trim();
    } else if (justFinescoMatch) {
        edellytyksetData.finescoAla = justFinescoMatch[1].trim();
        remainingText = remainingText.replace(justFinescoMatch[0], '').trim();
    }

    if (vaihtoEhtoMatch) {
        const alatStr = vaihtoEhtoMatch[1].replace(/ ja /g, ', ');
        const alatList = alatStr.split(',').map(s => s.trim()).filter(Boolean);
        edellytyksetData.vaihtoehtoisetAlat = alatList.map((nimi, idx) => ({ id: Date.now() + idx, nimi }));
        remainingText = remainingText.replace(vaihtoEhtoMatch[0], '').trim();
    }

    // 2. SIGNAALIPOHJAINEN TUNNISTUS (ÄLYKKÄÄMPI TAPA)
    // Mapataan signaalien kategoriat ja avaimet oikeisiin UI-laatikoihin
    const signalMappings = [
        // Vahvuudet (Tavoitteet)
        { key: 'TAIDOT_HYVA', label: 'Itsenäinen haku', type: 'tavoitteet', regex: /(?:hyvät ja )?itsenäiset työnhakutaidot/i },
        { key: 'HAKU_VERKOSTO', label: 'Verkostot', type: 'tavoitteet', regex: /hyödyntää verkostojaan/i },
        { key: 'HAKU_SAHKOINEN', label: 'Sähköinen haku', type: 'tavoitteet', regex: /osaa käyttää sähköisiä kanavia|valmiudet sähköiseen asiointiin/i },
        
        // Markkinaesteet
        { key: 'ESTE_LIIKKUVUUS', label: 'Alueellinen liikkuvuus', type: 'markkina', regex: /rajoittunut alueellinen liikkuvuus/i },
        { key: 'ESTE_MARKKINA', label: 'Haastava markkina', type: 'markkina', regex: /haastava markkinatilanne/i },
        
        // Elämäntilanne-esteet
        { key: 'ESTE_TALOUS', label: 'Taloushaasteet', type: 'elamantila', regex: /taloudellisia haasteita|taloudelliset haasteet/i },
        { key: 'ESTE_KUORMITUS', label: 'Kuormittavuus', type: 'elamantila', regex: /elämäntilanteen yleinen kuormittavuus/i },
        { key: 'ESTE_KIELI', label: 'Kielitaito (Este)', type: 'elamantila', regex: /puutteellinen kielitaito/i }
    ];

    signalMappings.forEach(mapping => {
        if (mapping.regex.test(remainingText)) {
            edellytyksetData.activeTags[mapping.type].push({
                id: mapping.key,
                label: mapping.label
            });
            remainingText = remainingText.replace(mapping.regex, '\n').trim();
        }
    });

    // 3. PUDOTUSVALIKOT (Etuudet vireillä / hylätty)
    // Etsitään tekstistä avainsanoja ja kytketään ne suoraan tietokannasta löytyviin etuuksiin
    ['etuus_vireilla', 'etuus_hylatty'].forEach(groupingKey => {
        const options = dbPhrases.filter(p => p.grouping_key === groupingKey);
        const targetField = groupingKey === 'etuus_vireilla' ? 'vireilla' : 'hylatty';

        for (const phrase of options) {
            if (phrase.base_text) {
                // Etuusteksteissä on usein "Asiakkaalla on..." alussa
                const cleanBase = phrase.base_text.replace(/Asiakkaalla (?:on )?/i, '').replace(/\./g, '').trim();
                const escapedBase = cleanBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedBase, 'i');
                
                const match = remainingText.match(regex);
                
                if (match) {
                    edellytyksetData.selections[targetField] = {
                        id: phrase.phrase_key,
                        label: phrase.short_title || phrase.base_text
                    };
                    // Syödään koko lause pois
                    const fullSentenceRegex = new RegExp(`(?:[^.]*?)${escapedBase}(?:[^.]*?\\.)`, 'i');
                    remainingText = remainingText.replace(fullSentenceRegex, '\n').trim();
                    break; 
                }
            }
        }
    });

    // 4. KIELIOPPI- JA JÄÄNNÖSSIIVOUS
    remainingText = remainingText
        .replace(/Asiakas\s+(ja|sekä|tai)\s+(työttömyysetuutta|työmarkkinatukea|peruspäivärahaa)\.?/gi, '') 
        .replace(/\b(ja|sekä|tai)\s+([.,])/gi, '$2')
        .replace(/,\s*(ja|sekä|tai)\b/gi, ' $1')
        .replace(/,\s*\./g, '.') 
        .replace(/\s{2,}/g, ' ') 
        .replace(/^[.,\s]+|[.,\s]+$/g, '') 
        .trim();

    remainingText = remainingText.replace(/\n{3,}/g, '\n\n').trim();

    return { remainingText, edellytyksetData };
};