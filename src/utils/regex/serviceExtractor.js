// --- src/utils/regex/serviceExtractor.js ---

export const extractServices = (text, dbServices = []) => {
    let remainingText = text || '';
    const foundServices = [];
    const autoSignals = [];

    if (!remainingText || !dbServices.length) return { remainingText, foundServices, autoSignals };

    // Estetään tuplien lukeminen
    const foundIds = new Set(); 

    // ============================================================================
    // VAIHE 1: TAULUKON PURKU
    // ============================================================================
    const tableRowRegex = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/gm;
    let match;
    let textToParse = remainingText; 

    while ((match = tableRowRegex.exec(textToParse)) !== null) {
        const rawTitle = match[1].trim();
        const tila = match[2].trim().toLowerCase();
        const lisatieto = match[4].trim();

        if (rawTitle.toLowerCase() === 'palvelu' || rawTitle.includes('---')) continue;

        const serviceMatch = dbServices.find(s => s.title.toLowerCase() === rawTitle.toLowerCase());

        if (serviceMatch) {
            foundServices.push({
                id: serviceMatch.id,
                title: serviceMatch.title,
                type: serviceMatch.service_type,
                tila: tila,
                lisatieto: lisatieto,
                definitionKey: 'asiantuntijapalvelu'
            });
            
            foundIds.add(serviceMatch.id);

            // Perityt signaalit
            if (serviceMatch.language_req && serviceMatch.language_req !== 'Ei määritelty') {
                const langKey = `language_fi_${serviceMatch.language_req.toLowerCase().replace(/\./g, '_')}`;
                autoSignals.push(langKey);
            }
            if (serviceMatch.triggers) {
                const triggers = serviceMatch.triggers.split(',').map(t => t.trim());
                autoSignals.push(...triggers);
            }

            // Incompatibility -signaali
            const negatiivisetTilat = ['ei soveltuva', 'peruuntunut', 'keskeytynyt'];
            if (negatiivisetTilat.includes(tila)) {
                autoSignals.push(`signal_incompatible_${serviceMatch.id}`);
            }

            remainingText = remainingText.replace(match[0], '');
        }
    }

    // ============================================================================
    // VAIHE 2: VAPAAN TEKSTIN HARAVOINTI
    // ============================================================================
    const validServices = [...dbServices].filter(s => s.plan_text && s.plan_text.trim().length > 10);
    validServices.sort((a, b) => b.plan_text.length - a.plan_text.length);

    validServices.forEach(service => {
        if (foundIds.has(service.id)) return;

        const regexString = service.plan_text
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') 
            .replace(/\s+/g, '\\s+');               

        try {
            const regex = new RegExp(regexString, 'i');
            const planMatch = remainingText.match(regex);

            if (planMatch) {
                foundServices.push({
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

    // Puhdistus
    remainingText = remainingText.replace(/^\|.*\|$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    const uniqueAutoSignals = [...new Set(autoSignals)];

    return { remainingText, foundServices, autoSignals: uniqueAutoSignals };
};