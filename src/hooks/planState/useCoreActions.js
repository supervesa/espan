import { useCallback } from 'react';

const deepMerge = (target, source) => {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target) || target[key] === null) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

export const useCoreActions = (setState) => {
    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => {
            // 1. Perus-merge (asiakas-tila päivittyy)
            const newState = deepMerge(currentState, scrapedState);
            
            // 2. SYNKRONOINTI: Jos imuri toi uutta dataa, päivitetään se aktiivisiin perustietoihin
            const perustiedot = newState.suunnitelman_perustiedot;
            if (perustiedot) {
                // Käydään läpi kaikki valitut fraasit tässä osiossa
                Object.keys(perustiedot).forEach(key => {
                    const phrase = perustiedot[key];
                    if (phrase && phrase.muuttujat) {
                        // Esimerkki: Syntymävuosi
                        if (key === 'syntymavuosi' && !phrase.muuttujat.SYNTYMÄVUOSI) {
                            phrase.muuttujat.SYNTYMÄVUOSI = newState.asiakas?.syntymavuosi || '';
                        }
                        // Esimerkki: Nimi
                        if (phrase.muuttujat.NIMI === '') {
                            phrase.muuttujat.NIMI = newState.asiakas?.nimi || '';
                        }
                    }
                });
            }
            
            return newState;
        });
    }, [setState]);

    // ... (muut funktiot ennallaan) ...
    const handleSetSignal = useCallback((signalKey, isActive) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            if (isActive) newState.signals[signalKey] = { isMuted: false, isPrintable: true };
            else delete newState.signals[signalKey];
            return newState;
        });
    }, [setState]);

    const handleUpdateSection = useCallback((sectionId, data) => {
        setState(currentState => ({ ...currentState, [sectionId]: data }));
    }, [setState]);

    const handleUpdateCustomText = useCallback((sectionId, value) => {
        const customKey = sectionId === 'kielitaso' ? `custom-kielitaso` : `custom-${sectionId}`;
        setState(currentState => ({ ...currentState, [customKey]: value }));
    }, [setState]);

    const handleUpdateAsiakas = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.asiakas) newState.asiakas = {};
            newState.asiakas[key] = value;
            return newState;
        });
    }, [setState]);

    return { handleScrape, handleSetSignal, handleUpdateSection, handleUpdateCustomText, handleUpdateAsiakas };
};