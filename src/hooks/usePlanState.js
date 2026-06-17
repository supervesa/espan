// --- src/hooks/usePlanState.js ---

import { useState, useCallback } from 'react';
import { planData } from '../data/planData'; 

const deepMerge = (target, source) => {
    // Jos kyseessä on taulukko, palautetaan lähde suoraan (Golden Master -yhteensopivuus)
    if (Array.isArray(source)) {
        return source;
    }

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

export const usePlanState = (dbPlanData) => {
    // Alustetaan tila, jossa on mukana myös palvelut (sessionServices)
    const [state, setState] = useState({ 
        asiakas: {}, 
        signals: {}, 
        palvelut: {},
        sessionServices: [], // UUSI: Golden Master -taulukko palveluille
        sessionEducations: [] // UUSI: Golden Master -taulukko koulutuksille
    });

    // --- CORE HANDLERS ---

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleSetSignal = useCallback((signalKey, isActive) => {
        setState(currentState => {
            const newSignals = { ...currentState.signals };
            if (isActive) {
                newSignals[signalKey] = { isMuted: false, isPrintable: true };
            } else {
                delete newSignals[signalKey];
            }
            return { ...currentState, signals: newSignals };
        });
    }, []);

    const handleUpdateSection = useCallback((sectionId, data) => {
        setState(currentState => ({
            ...currentState,
            [sectionId]: data
        }));
    }, []);

    const handleAddService = useCallback((serviceId) => {
        setState(currentState => {
            const newPalvelut = { ...currentState.palvelut, [serviceId]: true };
            return { ...currentState, palvelut: newPalvelut };
        });
    }, []);

    const handleAddSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newSignals = { ...currentState.signals };
            if (!newSignals[avainsana]) newSignals[avainsana] = { isMuted: false, isPrintable: true };

            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            
            let section = null;
            let phrase = null;
            for (const sec of aihealueet) {
                const found = sec.fraasit?.find(f => f.avainsana === avainsana);
                if (found) { section = sec; phrase = found; break; }
            }

            const newState = { ...currentState, signals: newSignals };

            if (section && phrase) {
                const sectionId = section.id;
                const currentSelections = { ...(newState[sectionId] || {}) };
                
                const initialVariables = {};
                if (phrase.muuttujat) {
                    Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                        let defaultVal = config.oletus || (config.vaihtoehdot?.[0] || '');
                        if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal)) {
                            defaultVal = new Date().toLocaleDateString('fi-FI');
                        }
                        initialVariables[key] = defaultVal;
                    });
                }
                
                if (section.monivalinta) currentSelections[avainsana] = { avainsana, muuttujat: initialVariables };
                else { currentSelections.avainsana = avainsana; currentSelections.muuttujat = initialVariables; }
                
                newState[sectionId] = currentSelections;
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleRemoveSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newSignals = { ...currentState.signals };
            delete newSignals[avainsana];
            
            const newState = { ...currentState, signals: newSignals };
            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            
            aihealueet.forEach(sec => {
                if (newState[sec.id]) {
                    const sectionCopy = { ...newState[sec.id] };
                    if (sec.monivalinta) {
                        delete sectionCopy[avainsana];
                        newState[sec.id] = sectionCopy;
                    } else if (sectionCopy.avainsana === avainsana) {
                        delete sectionCopy.avainsana;
                        delete sectionCopy.muuttujat;
                        newState[sec.id] = sectionCopy;
                    }
                }
            });
            return newState;
        });
    }, [dbPlanData]);

    const handleToggleSignalSetting = useCallback((avainsana, setting) => {
        setState(currentState => {
            if (!currentState.signals?.[avainsana]) return currentState;
            const newSignals = { ...currentState.signals };
            newSignals[avainsana] = { 
                ...newSignals[avainsana], 
                [setting]: !newSignals[avainsana][setting] 
            };
            return { ...currentState, signals: newSignals };
        });
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = { ...currentState };
            if (!newState.signals) newState.signals = {};
            const newSignals = { ...newState.signals };

            if (updatedSelection) { 
                return { ...newState, [sectionId]: updatedSelection };
            }

            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            let section = aihealueet.find(s => s.id === sectionId);
            let phrase = section?.fraasit?.find(f => f.avainsana === avainsana);
            
            // JOS fraasia ei löydy muistista, sallitaan se silti (DB-fraasit)
            // Luodaan minimiobjekti jotta valinta ei blokkaannu
            if (!phrase) {
                phrase = { avainsana: avainsana, muuttujat: {} };
            }

            const currentSelections = { ...(newState[sectionId] || {}) };
            const actualIsMultiSelect = section ? section.monivalinta : (isMultiSelect || false);

            if (actualIsMultiSelect) {
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                    delete newSignals[avainsana];
                } else {
                    const initialVariables = {};
                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            let def = config.oletus || (config.vaihtoehdot?.[0] || '');
                            if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && !def) def = new Date().toLocaleDateString('fi-FI');
                            initialVariables[key] = def;
                        });
                    }
                    currentSelections[avainsana] = { avainsana: avainsana, muuttujat: initialVariables };
                    newSignals[avainsana] = { isMuted: false, isPrintable: true };
                }
            } else {
                if (currentSelections.avainsana === avainsana) {
                    delete currentSelections.avainsana;
                    delete currentSelections.muuttujat;
                    delete newSignals[avainsana];
                } else {
                    if (currentSelections.avainsana) delete newSignals[currentSelections.avainsana];
                    const initialVariables = {};
                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            let def = config.oletus || (config.vaihtoehdot?.[0] || '');
                            if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && !def) def = new Date().toLocaleDateString('fi-FI');
                            initialVariables[key] = def;
                        });
                    }
                    currentSelections.avainsana = avainsana;
                    currentSelections.muuttujat = initialVariables;
                    newSignals[avainsana] = { isMuted: false, isPrintable: true };
                }
            }
            
            newState[sectionId] = currentSelections;
            newState.signals = newSignals;
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            // TÄRKEÄ: Golden Master -tuki sessionServices- ja sessionEducations-taulukoille.
            if (sectionId === 'global' && (avainsana === 'sessionServices' || avainsana === 'sessionEducations')) {
                const actualValue = value !== undefined ? value : variableKey;
                return { ...currentState, [avainsana]: actualValue };
            }

            if (sectionId === 'asiakas') {
                const actualValue = value !== undefined ? value : variableKey;
                return { 
                    ...currentState, 
                    asiakas: { ...currentState.asiakas, [avainsana]: actualValue } 
                };
            }

            const newState = { ...currentState };
            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            let section = aihealueet.find(s => s.id === sectionId);
            const isMulti = section ? section.monivalinta : false;

            const sectionData = { ...(newState[sectionId] || {}) };
            
            if (isMulti) {
                if (!sectionData[avainsana]) sectionData[avainsana] = { avainsana, muuttujat: {} };
                sectionData[avainsana] = {
                    ...sectionData[avainsana],
                    muuttujat: { ...sectionData[avainsana].muuttujat, [variableKey]: value }
                };
            } else {
                sectionData.muuttujat = { ...(sectionData.muuttujat || {}), [variableKey]: value };
            }

            return { ...newState, [sectionId]: sectionData };
        });
    }, [dbPlanData]);

    const handleUpdateCustomText = useCallback((sectionId, value) => {
        const customKey = sectionId === 'kielitaso' ? `custom-kielitaso` : `custom-${sectionId}`;
        setState(currentState => ({ ...currentState, [customKey]: value }));
    }, []);

    const handleUpdateAsiakas = useCallback((key, value) => {
        setState(prevState => ({ ...prevState, asiakas: { ...prevState.asiakas, [key]: value } }));
    }, []);

    // --- DOMAIN SPECIFIC HANDLERS ---

    const handleUpdatePalkkatuki = useCallback((key, value) => {
        setState(prevState => ({
            ...prevState,
            palkkatuki: { ...(prevState.palkkatuki || {}), [key]: value }
        }));
    }, []);

    const handleUpdateTyokyky = useCallback((key, value) => {
        setState(prevState => {
            const newTkState = { ...(prevState.tyokyky || {}) };
            if (key === 'togglePalveluohjaus') {
                const current = { ...(newTkState.palveluohjaukset || {}) };
                if (current[value.avainsana]) delete current[value.avainsana];
                else current[value.avainsana] = value;
                newTkState.palveluohjaukset = current;
            } else {
                newTkState[key] = value;
            }
            return { ...prevState, tyokyky: newTkState };
        });
    }, []);

    const handleUpdateTyottomyysturva = useCallback((key, value) => {
        setState(prevState => {
            const newTtState = { ...(prevState.tyottomyysturva || {}) };
            if (key === 'updateKysymys') {
                newTtState.answers = { ...(newTtState.answers || {}), [value.id]: value.value };
            } else {
                newTtState[key] = value;
            }
            return { ...prevState, tyottomyysturva: newTtState };
        });
    }, []);

    const handleUpdateKielitaso = useCallback((key, value) => {
        setState(prevState => {
            const current = { ...(prevState.kielitaso || { aidinkieli: '', muutKielet: [] }) };
            if (key === 'updateAidinkieli') current.aidinkieli = value;
            return { ...prevState, kielitaso: current };
        });
    }, []);

    const actions = {
        onSelect: handleSelectPhrase,
        onUpdateVariable: handleUpdateVariable,
        onUpdateCustomText: handleUpdateCustomText,
        onUpdateAsiakas: handleUpdateAsiakas,
        onAddSignal: handleAddSignal,
        onRemoveSignal: handleRemoveSignal,
        onToggleSignalSetting: handleToggleSignalSetting,
        handleScrape,
        setSignal: handleSetSignal,
        updateSection: handleUpdateSection,
        onAddService: handleAddService,
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
        onUpdateKielitaso: handleUpdateKielitaso
    };

    return { state, setState, actions };
};