// --- src/utils/regex/serviceExtractor.js ---

// VAIHE 1: URA-tekstien alkuperäinen luku
export const extractServicesTable = (text, dbServices = []) => {
    let remainingText = text || '';
    const memoryBank = new Map(); 
    const autoSignals = [];

    if (!remainingText || !dbServices.length) return { remainingText, memoryBank, autoSignals };

    const validServices = [...dbServices].filter(s => s.plan_text && s.plan_text.trim().length > 10);
    validServices.sort((a, b) => b.plan_text.length - a.plan_text.length);

    validServices.forEach(service => {
        const regexString = service.plan_text
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') 
            .replace(/\s+/g, '\\s+');               

        try {
            const regex = new RegExp(regexString, 'i');
            const planMatch = remainingText.match(regex);

            if (planMatch) {
                memoryBank.set(service.id, {
                    id: service.id,
                    title: service.title,
                    type: service.service_type,
                    tila: 'ohjattu',
                    lisatieto: '',
                    definitionKey: 'asiantuntijapalvelu'
                });

                if (service.language_req && service.language_req !== 'Ei määritelty') {
                    const langKey = `language_fi_${service.language_req.toLowerCase().replace(/\./g, '_')}`;
                    autoSignals.push(langKey);
                }
                
                if (service.triggers) {
                    const triggers = service.triggers.split(',').map(t => t.trim());
                    autoSignals.push(...triggers);
                }

                remainingText = remainingText.replace(planMatch[0], '');
            }
        } catch (e) {
            console.error(`Regex error in service: ${service.title}`, e);
        }
    });

    remainingText = remainingText.replace(/\n{3,}/g, '\n\n').trim();
    const uniqueAutoSignals = [...new Set(autoSignals)];

    return { remainingText, memoryBank, autoSignals: uniqueAutoSignals };
};


// VAIHE 2: Asiantuntijan nuuskinta (Ylikirjoittaa tilat 'edellytykset' laatikosta)
export const extractServiceOverrides = (text, dbServices = [], memoryBank = new Map()) => {
    let remainingText = text || '';
    const autoSignals = [];

    if (!remainingText || !dbServices.length) return { remainingText, autoSignals };

    const validServices = [...dbServices].filter(s => s.title && s.title.trim().length > 3);
    validServices.sort((a, b) => b.title.length - a.title.length);

    const sentences = remainingText.match(/[^.!?\n]+[.!?\n]+/g) || [remainingText];
    let textToKeep = [];

    const normalize = (str) => str.toLowerCase().replace(/[-_,.()]/g, ' ').replace(/\s+/g, ' ').trim();

    for (let i = 0; i < sentences.length; i++) {
        let sentence = sentences[i];
        let sentenceConsumed = false;
        const lowerSentence = sentence.toLowerCase();
        const normSentence = normalize(sentence);

        for (const service of validServices) {
            const normTitle = normalize(service.title);
            let isMatch = false;

            if (normSentence.includes(normTitle)) {
                isMatch = true;
            } else {
                const titleWords = normTitle.split(' ').filter(w => w.length > 4); 
                if (titleWords.length > 0) {
                    const allWordsMatch = titleWords.every(tw => {
                        const stem = tw.substring(0, Math.min(tw.length, 5)); 
                        return normSentence.includes(stem);
                    });
                    if (allWordsMatch) isMatch = true;
                }
            }

            if (isMatch) {
                let tila = 'ohjattu';
                let isNegative = false;

                // Tilan haistelu: KORJATTU SUOMEN KIELEN ASTEVAIHTELUT (suoritti vs suoritettu)
                if (/(keskeyt|lopett(?:i|anut)|lopetettu|jättänyt kesken)/.test(lowerSentence)) {
                    tila = 'keskeytynyt'; isNegative = true;
                } else if (/(ei soveltu(?:nut|va)|ei ajankohtai(?:nen|sta)|haasteellista)/.test(lowerSentence)) {
                    tila = 'ei soveltuva'; isNegative = true;
                } else if (/(peru(?:untui|ttiin|ttu|untunut)|ei järjestetä)/.test(lowerSentence)) {
                    tila = 'peruuntunut'; isNegative = true;
                } else if (/(suoritt(?:i|anut)|suoritettu|käynyt loppuun)/.test(lowerSentence)) {
                    tila = 'suoritettu';
                } else if (/(aloitt(?:i|anut)|aloitettu|alkanut|osallistuu)/.test(lowerSentence)) {
                    tila = 'alkanut';
                }

                let lisatieto = "";
                
                const syyMatch = lowerSentence.match(/(?:syy[:\s-]|koska|vuoksi|perustelu[:\s-])\s*(.+)/);
                const sulkuMatch = sentence.match(/\(([^)]+)\)/); 

                if (syyMatch) {
                    lisatieto = syyMatch[1].replace(/[.!?]+$/, '').trim(); 
                } else if (sulkuMatch) {
                    lisatieto = sulkuMatch[1].trim(); 
                } else if (isNegative && i + 1 < sentences.length) {
                    const nextSentence = sentences[i + 1];
                    if (/^(?:syy|perustelu)[:\s-]/i.test(nextSentence.trim())) {
                        lisatieto = nextSentence.replace(/^(?:syy|perustelu)[:\s-]/i, '').replace(/[.!?]+$/, '').trim();
                        i++; 
                    }
                }

                const existing = memoryBank.get(service.id) || {};
                
                memoryBank.set(service.id, {
                    id: service.id,
                    title: service.title,
                    type: service.service_type,
                    definitionKey: 'asiantuntijapalvelu',
                    tila: tila,
                    lisatieto: lisatieto || existing.lisatieto || ''
                });

                if (isNegative) autoSignals.push(`signal_incompatible_${service.id}`);
                if (service.language_req && service.language_req !== 'Ei määritelty') {
                    autoSignals.push(`language_fi_${service.language_req.toLowerCase().replace(/\./g, '_')}`);
                }

                sentenceConsumed = true; 
                break; 
            }
        }

        if (!sentenceConsumed) textToKeep.push(sentence);
    }

    return { 
        remainingText: textToKeep.join('').trim(), 
        autoSignals: [...new Set(autoSignals)] 
    };
};