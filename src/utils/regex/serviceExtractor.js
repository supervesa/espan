// --- src/utils/regex/serviceExtractor.js ---

export const extractServices = (text, dbServices = []) => {
    let remainingText = text;
    const foundServices = [];
    const autoSignals = [];

    if (!text || !dbServices.length) return { remainingText, foundServices, autoSignals };

    // Järjestetään pisimmästä plan_textistä lyhimpään
    const validServices = [...dbServices].filter(s => s.plan_text && s.plan_text.trim().length > 10);
    validServices.sort((a, b) => b.plan_text.length - a.plan_text.length);

    validServices.forEach(service => {
        // Sallitaan joustava välilyöntien/rivinvaihtojen määrä
        const regexString = service.plan_text
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapetetaan erikoismerkit
            .replace(/\s+/g, '\\s+');               // Normalisoidaan välilyönnit

        try {
            const regex = new RegExp(regexString, 'i');
            const match = remainingText.match(regex);

            if (match) {
                // 1. Kirjataan palvelu talteen
                foundServices.push({
                    id: service.id,
                    title: service.title,
                    type: service.service_type
                });

                // 2. Poimitaan palvelun mukana periytyvät automaatiosignaalit
                if (service.language_req) {
                    // Muutetaan esim 'A1.1' muotoon 'language_fi_a1_1' 
                    // (tai miten tietokantasi signal_key onkaan rakennettu)
                    const langKey = `language_fi_${service.language_req.toLowerCase().replace('.', '_')}`;
                    autoSignals.push(langKey);
                }
                
                if (service.triggers) {
                    // Pilkotaan pilkulla erotetut triggerit (esim. 'kielitaidon_puute, tyoton')
                    const triggers = service.triggers.split(',').map(t => t.trim());
                    autoSignals.push(...triggers);
                }

                // 3. Syödään teksti pois!
                remainingText = remainingText.replace(match[0], '');
            }
        } catch (e) {
            console.error(`Regex error in service: ${service.title}`, e);
        }
    });

    // Poistetaan mahdolliset duplikaatti-signaalit
    const uniqueAutoSignals = [...new Set(autoSignals)];

    return { remainingText, foundServices, autoSignals: uniqueAutoSignals };
};