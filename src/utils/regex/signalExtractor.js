// --- src/utils/regex/signalExtractor.js ---

export const extractSignals = (text, dbSignals = []) => {
    let remainingText = text;
    const foundSignals = [];

    if (!text || !dbSignals.length) return { remainingText, foundSignals };

    // Järjestetään pisimmästä selitteestä lyhimpään, jotta tarkimmat syödään ensin
    const validSignals = [...dbSignals].sort((a, b) => {
        const lenA = a.description ? a.description.length : 0;
        const lenB = b.description ? b.description.length : 0;
        return lenB - lenA;
    });

    validSignals.forEach(signal => {
        // Tutkitaan ensin tarkka description, sitten label
        const targetTexts = [signal.description, signal.label].filter(t => t && t.trim().length > 10);

        for (const targetText of targetTexts) {
            const regexString = targetText
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');

            try {
                const regex = new RegExp(regexString, 'i');
                const match = remainingText.match(regex);

                if (match) {
                    // 1. Kirjataan signaali talteen
                    if (!foundSignals.some(s => s.id === signal.signal_key)) {
                        foundSignals.push({
                            id: signal.signal_key,
                            label: signal.label
                        });
                    }
                    
                    // 2. Syödään teksti pois ja siirrytään seuraavaan signaaliin
                    remainingText = remainingText.replace(match[0], '');
                    break; 
                }
            } catch (e) {
                console.error(`Regex error in signal: ${signal.signal_key}`, e);
            }
        }
    });

    return { remainingText, foundSignals };
};