import { useCallback } from 'react';

export const useSelectionActions = (setState) => {

    const getInitialValue = (vKey, vConfig, currentState) => {
        const meta = vConfig?.metadata || {};
        const source = meta.source;

        if (source === 'today' || vKey.includes('PÄIVÄMÄÄRÄ') || vKey.includes('PVM')) {
            return new Date().toLocaleDateString('fi-FI');
        }
        if (source?.startsWith('scraper.')) {
            const scraperKey = source.split('.')[1];
            if (currentState.asiakas?.[scraperKey]) return currentState.asiakas[scraperKey];
        }
        if (vKey === 'SYNTYMÄVUOSI' && currentState.asiakas?.syntymavuosi) return currentState.asiakas.syntymavuosi;
        
        return vConfig?.oletus || (vConfig?.vaihtoehdot?.[0] || '');
    };

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, phraseConfig = null) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            if (!newState[sectionId]) newState[sectionId] = {};
            
            const currentSection = newState[sectionId];
            const isSelected = isMultiSelect ? !!currentSection[avainsana] : currentSection.avainsana === avainsana;

            if (!isSelected) {
                // PÄÄLLEKYTKENTÄ
                const initialVars = {};
                if (phraseConfig?.muuttujat) {
                    Object.entries(phraseConfig.muuttujat).forEach(([vKey, vConfig]) => {
                        initialVars[vKey] = getInitialValue(vKey, vConfig, currentState);
                    });
                }

                if (isMultiSelect) {
                    currentSection[avainsana] = { avainsana: avainsana, muuttujat: initialVars };
                } else {
                    const oldKey = currentSection.avainsana;
                    if (oldKey && newState.signals[oldKey]) delete newState.signals[oldKey];
                    currentSection.avainsana = avainsana;
                    currentSection.muuttujat = initialVars;
                }
                newState.signals[avainsana] = { isMuted: false, isPrintable: true };
            } else {
                // POISKYTKENTÄ
                if (isMultiSelect) {
                    delete currentSection[avainsana];
                } else {
                    currentSection.avainsana = null;
                    currentSection.muuttujat = {};
                }
                if (newState.signals[avainsana]) delete newState.signals[avainsana];
            }
            return newState;
        });
    }, [setState]);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            // Tehdään matala kopio jotta kirjoittaminen on nopeaa
            const newState = { ...currentState };
            
            if (sectionId === 'asiakas') {
                newState.asiakas = { ...newState.asiakas, [avainsana]: value };
                return newState;
            }

            if (!newState[sectionId]) return currentState;
            
            // Luodaan uusi viite vain muuttuneeseen osioon (Immutability)
            const updatedSection = { ...newState[sectionId] };

            // Etsitään kohde: onko se monivalinnan alla [avainsana] vai suoraan osiossa
            let target = (updatedSection[avainsana] && typeof updatedSection[avainsana] === 'object')
                ? { ...updatedSection[avainsana] }
                : { ...updatedSection };

            if (target) {
                target.muuttujat = { ...target.muuttujat, [variableKey]: value };
                
                // Päivitetään takaisin rakenteeseen
                if (updatedSection[avainsana] && typeof updatedSection[avainsana] === 'object') {
                    updatedSection[avainsana] = target;
                } else {
                    Object.assign(updatedSection, target);
                }
                
                newState[sectionId] = updatedSection;

                // Erikoissynkronointi perustiedoille
                if (sectionId === 'suunnitelman_perustiedot') {
                    if (avainsana === 'syntymavuosi' && variableKey === 'SYNTYMÄVUOSI') {
                        newState.asiakas = { ...newState.asiakas, syntymavuosi: value };
                    }
                    if (newState.signals && newState.signals[avainsana]) {
                        newState.signals[avainsana] = { ...newState.signals[avainsana], value: value };
                    }
                }
            }
            
            return newState;
        });
    }, [setState]);

    return { handleSelectPhrase, handleUpdateVariable };
};