// --- src/hooks/usePlanState.js ---

import { useState, useCallback } from 'react';
import { planData } from '../data/planData'; 

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

export const usePlanState = (dbPlanData) => {
    // Alustetaan tila, jossa on mukana myös palvelut
    const [state, setState] = useState({ asiakas: {}, signals: {}, palvelut: {} });

    // --- CORE HANDLERS ---

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleSetSignal = useCallback((signalKey, isActive) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            
            if (isActive) {
                newState.signals[signalKey] = { isMuted: false, isPrintable: true };
            } else {
                delete newState.signals[signalKey];
            }
            return newState;
        });
    }, []);

    const handleUpdateSection = useCallback((sectionId, data) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            newState[sectionId] = data;
            return newState;
        });
    }, []);

    const handleAddService = useCallback((serviceId) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.palvelut) newState.palvelut = {};
            newState.palvelut[serviceId] = true;
            return newState;
        });
    }, []);

    const handleAddSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            if (!newState.signals[avainsana]) newState.signals[avainsana] = { isMuted: false, isPrintable: true };

            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            
            let section = null;
            let phrase = null;
            for (const sec of aihealueet) {
                const found = sec.fraasit?.find(f => f.avainsana === avainsana);
                if (found) { section = sec; phrase = found; break; }
            }

            if (section && phrase) {
                const sectionId = section.id;
                if (!newState[sectionId]) newState[sectionId] = {};
                const currentSelections = newState[sectionId];
                
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
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleRemoveSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (newState.signals) delete newState.signals[avainsana];
            
            const aihealueet = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;
            
            aihealueet.forEach(sec => {
                if (newState[sec.id]) {
                    if (sec.monivalinta) delete newState[sec.id][avainsana];
                    else if (newState[sec.id].avainsana === avainsana) {
                        delete newState[sec.id].avainsana;
                        delete newState[sec.id].muuttujat;
                    }
                }
            });
            return newState;
        });
    }, [dbPlanData]);

    const handleToggleSignalSetting = useCallback((avainsana, setting) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (newState.signals?.[avainsana]) newState.signals[avainsana][setting] = !newState.signals[avainsana][setting];
            return newState;
        });
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            if (updatedSelection) { newState[sectionId] = updatedSelection; return newState; }

            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId) || planData.aihealueet.find(s => s.id === sectionId);
            let phrase = section?.fraasit?.find(f => f.avainsana === avainsana);
            
            if (!phrase) return currentState;

            if (!newState[sectionId]) newState[sectionId] = {};
            const currentSelections = newState[sectionId];
            const actualIsMultiSelect = section ? section.monivalinta : (isMultiSelect || false);

            if (actualIsMultiSelect) {
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                    delete newState.signals[avainsana];
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
                    newState.signals[avainsana] = { isMuted: false, isPrintable: true };
                }
            } else {
                if (currentSelections.avainsana === avainsana) {
                    delete currentSelections.avainsana;
                    delete currentSelections.muuttujat;
                    delete newState.signals[avainsana];
                } else {
                    if (currentSelections.avainsana) delete newState.signals[currentSelections.avainsana];
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
                    newState.signals[avainsana] = { isMuted: false, isPrintable: true };
                }
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            
            if (sectionId === 'asiakas') {
                if (!newState.asiakas) newState.asiakas = {};
                newState.asiakas[avainsana] = value;
                return newState;
            }

            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId) || planData.aihealueet.find(s => s.id === sectionId);
            const isMulti = section ? section.monivalinta : false;
            let target = isMulti ? newState[sectionId]?.[avainsana] : newState[sectionId];

            if (!target) {
                if (isMulti) {
                    if (!newState[sectionId]) newState[sectionId] = {};
                    newState[sectionId][avainsana] = { avainsana: avainsana, muuttujat: {} };
                    target = newState[sectionId][avainsana];
                } else {
                    newState[sectionId] = { avainsana: avainsana, muuttujat: {} };
                    target = newState[sectionId];
                }
            }

            if (target) {
                if (!target.muuttujat) target.muuttujat = {};
                target.muuttujat[variableKey] = value;
            }
            return newState;
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
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const newPtState = { ...(newState.palkkatuki || {}) };
            newPtState[key] = value;
            return { ...newState, palkkatuki: newPtState };
        });
    }, []);

    const handleUpdateTyokyky = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const newTkState = { ...(newState.tyokyky || {}) };
            if (key === 'togglePalveluohjaus') {
                const current = newTkState.palveluohjaukset || {};
                if (current[value.avainsana]) delete current[value.avainsana];
                else current[value.avainsana] = value;
                newTkState.palveluohjaukset = current;
            } else {
                newTkState[key] = value;
            }
            return { ...newState, tyokyky: newTkState };
        });
    }, []);

    const handleUpdateTyottomyysturva = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const newTtState = { ...(newState.tyottomyysturva || {}) };
            if (key === 'updateKysymys') {
                const currentAnswers = { ...(newTtState.answers || {}) };
                currentAnswers[value.id] = value.value;
                newTtState.answers = currentAnswers;
            } else {
                newTtState[key] = value;
            }
            return { ...newState, tyottomyysturva: newTtState };
        });
    }, []);

    const handleUpdateKielitaso = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const current = newState.kielitaso || { aidinkieli: '', muutKielet: [] };
            if (key === 'updateAidinkieli') current.aidinkieli = value;
            return { ...newState, kielitaso: current };
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
        onAddService: handleAddService, // KORJATTU: Mukana toiminnassa!
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
        onUpdateKielitaso: handleUpdateKielitaso
    };

    return { state, setState, actions };
};