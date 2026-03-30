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
    // Alustetaan tila tyhjällä 'asiakas'-objektilla, jotta se on heti kaikkien käytettävissä
    const [state, setState] = useState({ asiakas: {} });

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleAddSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            
            if (!newState.signals[avainsana]) {
                newState.signals[avainsana] = { isMuted: false, isPrintable: true };
            }

            let section = null;
            let phrase = null;
            for (const sec of (dbPlanData.aihealueet || [])) {
                const found = sec.fraasit?.find(f => f.avainsana === avainsana);
                if (found) {
                    section = sec;
                    phrase = found;
                    break;
                }
            }

            if (section && phrase) {
                const sectionId = section.id;
                if (!newState[sectionId]) newState[sectionId] = {};
                const currentSelections = newState[sectionId];

                const initialVariables = {};
                if (phrase.muuttujat) {
                    Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                        if (config) {
                            let defaultVal = config.oletus !== undefined && config.oletus !== '' 
                                ? config.oletus 
                                : (config.vaihtoehdot && Array.isArray(config.vaihtoehdot) && config.vaihtoehdot.length > 0 ? config.vaihtoehdot[0] : '');
                            if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal || defaultVal === '')) {
                                defaultVal = new Date().toLocaleDateString('fi-FI');
                            }
                            initialVariables[key] = defaultVal;
                        } else {
                            initialVariables[key] = '';
                        }
                    });
                }

                if (section.monivalinta) {
                    currentSelections[avainsana] = { avainsana: avainsana, muuttujat: initialVariables };
                } else {
                    const oldAvainsana = currentSelections.avainsana;
                    if (oldAvainsana && oldAvainsana !== avainsana && newState.signals[oldAvainsana]) {
                        delete newState.signals[oldAvainsana];
                    }
                    currentSelections.avainsana = avainsana;
                    currentSelections.muuttujat = initialVariables;
                }
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleRemoveSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            
            if (newState.signals && newState.signals[avainsana]) {
                delete newState.signals[avainsana];
            }

            let section = null;
            for (const sec of (dbPlanData.aihealueet || [])) {
                if (sec.fraasit?.find(f => f.avainsana === avainsana)) {
                    section = sec;
                    break;
                }
            }

            if (section) {
                const sectionId = section.id;
                if (newState[sectionId]) {
                    if (section.monivalinta) {
                        if (newState[sectionId][avainsana]) {
                            delete newState[sectionId][avainsana];
                        }
                    } else {
                        if (newState[sectionId].avainsana === avainsana) {
                            delete newState[sectionId].avainsana;
                            delete newState[sectionId].muuttujat;
                        }
                    }
                }
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleToggleSignalSetting = useCallback((avainsana, setting) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) return currentState;
            if (newState.signals[avainsana]) {
                newState.signals[avainsana][setting] = !newState.signals[avainsana][setting];
            }
            return newState;
        });
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};

            if (updatedSelection) {
                newState[sectionId] = updatedSelection;
                return newState;
            }

            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId);
            if (!section) section = planData.aihealueet.find(s => s.id === sectionId);

            let phrase = null;
            if (section && section.fraasit) phrase = section.fraasit.find(f => f.avainsana === avainsana);
            
            if (!phrase) {
                for (const s of (dbPlanData.aihealueet || [])) {
                    const found = s.fraasit?.find(f => f.avainsana === avainsana);
                    if (found) { phrase = found; break; }
                }
            }

            if (!phrase) return currentState;

            if (!newState[sectionId]) newState[sectionId] = {};
            const currentSelections = newState[sectionId];
            const actualIsMultiSelect = section ? section.monivalinta : (isMultiSelect || false);

            if (actualIsMultiSelect) {
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                    if (newState.signals[avainsana]) delete newState.signals[avainsana];
                } else {
                    const initialVariables = {};
                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                let defaultVal = config.oletus !== undefined && config.oletus !== '' 
                                    ? config.oletus 
                                    : (config.vaihtoehdot && Array.isArray(config.vaihtoehdot) && config.vaihtoehdot.length > 0 ? config.vaihtoehdot[0] : '');
                                
                                if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal || defaultVal === '')) {
                                    defaultVal = new Date().toLocaleDateString('fi-FI');
                                }
                                initialVariables[key] = defaultVal;
                            } else {
                                initialVariables[key] = '';
                            }
                        });
                    }
                    currentSelections[avainsana] = { avainsana: avainsana, muuttujat: initialVariables };
                    if (!newState.signals[avainsana]) newState.signals[avainsana] = { isMuted: false, isPrintable: true };
                }
            } else { 
                if (currentSelections.avainsana === avainsana) {
                    delete currentSelections.avainsana;
                    delete currentSelections.muuttujat;
                    if (newState.signals[avainsana]) delete newState.signals[avainsana];
                } else {
                    const oldAvainsana = currentSelections.avainsana;
                    if (oldAvainsana && newState.signals[oldAvainsana]) {
                        delete newState.signals[oldAvainsana];
                    }

                    currentSelections.avainsana = phrase.avainsana;
                    currentSelections.muuttujat = {};

                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                let defaultVal = config.oletus !== undefined && config.oletus !== '' 
                                    ? config.oletus 
                                    : (config.vaihtoehdot && Array.isArray(config.vaihtoehdot) && config.vaihtoehdot.length > 0 ? config.vaihtoehdot[0] : '');
                                
                                if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal || defaultVal === '')) {
                                    defaultVal = new Date().toLocaleDateString('fi-FI');
                                }
                                currentSelections.muuttujat[key] = defaultVal;
                            } else {
                                currentSelections.muuttujat[key] = '';
                            }
                        });
                    }
                    
                    if (!newState.signals[phrase.avainsana]) newState.signals[phrase.avainsana] = { isMuted: false, isPrintable: true };
                }
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            
            // --- UUSI: Reititys suoraan asiakas-tilaan, jos sectionId on 'asiakas' ---
            if (sectionId === 'asiakas') {
                if (!newState.asiakas) newState.asiakas = {};
                // Varmistetaan, että emme tallenna vahingossa [object Object]
                newState.asiakas[avainsana] = value; 
                return newState;
            }
            // ----------------------------------------------------------------------
            
            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId);
            if (!section) section = planData.aihealueet.find(s => s.id === sectionId);
            
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

    // --- UUSI: Master-profiilin oma suora käsittelijä ---
    const handleUpdateAsiakas = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.asiakas) newState.asiakas = {};
            newState.asiakas[key] = value;
            return newState;
        });
    }, []);
    // ---------------------------------------------------

    const handleUpdateTyokyky = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.signals) newState.signals = {};
            const newTyokykyState = newState.tyokyky || {};
            
            if (key === 'togglePalveluohjaus') {
                const currentOhjaukset = newTyokykyState.palveluohjaukset || {};
                const avainsana = value.avainsana;
                
                if (currentOhjaukset[avainsana]) {
                    delete currentOhjaukset[avainsana];
                    if (newState.signals[avainsana]) delete newState.signals[avainsana];
                } else {
                    currentOhjaukset[avainsana] = value;
                    newState.signals[avainsana] = { isMuted: false, isPrintable: true };
                }
                newTyokykyState.palveluohjaukset = currentOhjaukset;

            } else if (key === 'updateKeskustelutieto') {
                 const currentTiedot = newTyokykyState.keskustelunTiedot || {};
                 currentTiedot[value.id] = value.value;
                 newTyokykyState.keskustelunTiedot = currentTiedot;
            } else {
                const oldValue = newTyokykyState[key];
                const oldSignalKey = typeof oldValue === 'string' ? oldValue : (oldValue?.avainsana || null);
                
                if (oldSignalKey && newState.signals[oldSignalKey]) {
                    delete newState.signals[oldSignalKey];
                }
                
                const newSignalKey = typeof value === 'string' ? value : (value?.avainsana || null);

                if (newSignalKey) {
                    let isKnownSignal = false;
                    for (const sec of (dbPlanData.aihealueet || [])) {
                        if (sec.fraasit?.some(f => f.avainsana === newSignalKey)) {
                            isKnownSignal = true; break;
                        }
                    }
                    if (isKnownSignal) {
                        newState.signals[newSignalKey] = { isMuted: false, isPrintable: true };
                    }
                }
                newTyokykyState[key] = value;
            }
            
            newState.tyokyky = newTyokykyState;
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdatePalkkatuki = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.signals) newState.signals = {};
            const newPtState = newState.palkkatuki || {};
            
            const oldValue = newPtState[key];
            const oldSignalKey = typeof oldValue === 'string' ? oldValue : (oldValue?.avainsana || null);
            
            if (oldSignalKey && newState.signals[oldSignalKey]) {
                delete newState.signals[oldSignalKey];
            }
            
            const newSignalKey = typeof value === 'string' ? value : (value?.avainsana || null);

            if (newSignalKey) {
                let isKnownSignal = false;
                for (const sec of (dbPlanData.aihealueet || [])) {
                    if (sec.fraasit?.some(f => f.avainsana === newSignalKey)) {
                        isKnownSignal = true; break;
                    }
                }
                if (isKnownSignal) {
                    newState.signals[newSignalKey] = { isMuted: false, isPrintable: true };
                }
            }
            
            newPtState[key] = value;
            newState.palkkatuki = newPtState;
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateTyottomyysturva = useCallback((key, value) => {
        setState(prevState => {
            const newTtState = { ...(prevState.tyottomyysturva || {}) };
            if (key === 'updateKysymys') {
                const currentAnswers = { ...(newTtState.answers || {}) };
                currentAnswers[value.id] = value.value;
                newTtState.answers = currentAnswers;
            } else if (key === 'updateSummaries') {
                newTtState.koonti = value.koonti;
                newTtState.yhteenvetoFraasi = value.yhteenvetoFraasi;
            } else if (key === 'updateYhteenveto') {
                newTtState.yhteenvetoFraasi = value;
            } else {
                newTtState[key] = value;
            }
            return { ...prevState, tyottomyysturva: newTtState };
        });
    }, []);

    const handleUpdateKielitaso = useCallback((key, value) => {
        setState(prevState => {
            const currentKielitaso = prevState.kielitaso || { aidinkieli: '', muutKielet: [{ kieli: 'Suomi', taso: '' }] };
            let updatedKielitaso = JSON.parse(JSON.stringify(currentKielitaso));
            if (key === 'updateAidinkieli') {
                updatedKielitaso.aidinkieli = value;
            } else if (key === 'updateMuuKieli') {
                const { index, field, value: langValue } = value;
                if (!updatedKielitaso.muutKielet) updatedKielitaso.muutKielet = [];
                while (updatedKielitaso.muutKielet.length <= index) {
                     updatedKielitaso.muutKielet.push({ kieli: index === 0 ? 'Suomi' : '', taso: ''});
                }
                updatedKielitaso.muutKielet[index] = { ...updatedKielitaso.muutKielet[index], [field]: langValue };
            }
            return { ...prevState, kielitaso: updatedKielitaso };
        });
    }, []);

    const handleUpdateSuunnitelma = useCallback((phraseId, isChecked) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.signals) newState.signals = {};
            const newSuunnitelmaState = newState.suunnitelma || {};
            
            if (isChecked) {
                newSuunnitelmaState[phraseId] = true;
                newState.signals[phraseId] = { isMuted: false, isPrintable: true };
            } else {
                delete newSuunnitelmaState[phraseId];
                if (newState.signals[phraseId]) delete newState.signals[phraseId];
            }
            
            newState.suunnitelma = newSuunnitelmaState;
            return newState;
        });
    }, []);

    // Päivitetty actions-objekti, joka jaetaan kaikille komponenteille
    const actions = {
        onSelect: handleSelectPhrase,
        onUpdateVariable: handleUpdateVariable,
        onUpdateCustomText: handleUpdateCustomText,
        onUpdateAsiakas: handleUpdateAsiakas, // UUSI!
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
        onUpdateKielitaso: handleUpdateKielitaso,
        onUpdateSuunnitelma: handleUpdateSuunnitelma, 
        handleScrape: handleScrape, 
        onAddSignal: handleAddSignal,
        onRemoveSignal: handleRemoveSignal,
        onToggleSignalSetting: handleToggleSignalSetting
    };

    return { state, setState, actions };
};