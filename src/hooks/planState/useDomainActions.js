import { useCallback } from 'react';

export const useDomainActions = (setState, dbPlanData) => {
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
                if (oldSignalKey && newState.signals[oldSignalKey]) delete newState.signals[oldSignalKey];
                
                const newSignalKey = typeof value === 'string' ? value : (value?.avainsana || null);
                if (newSignalKey) newState.signals[newSignalKey] = { isMuted: false, isPrintable: true };
                newTyokykyState[key] = value;
            }
            
            newState.tyokyky = newTyokykyState;
            return newState;
        });
    }, [setState]);

    const handleUpdatePalkkatuki = useCallback((key, value) => {
        setState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            if (!newState.signals) newState.signals = {};
            const newPtState = newState.palkkatuki || {};
            
            const oldValue = newPtState[key];
            const oldSignalKey = typeof oldValue === 'string' ? oldValue : (oldValue?.avainsana || null);
            if (oldSignalKey && newState.signals[oldSignalKey]) delete newState.signals[oldSignalKey];
            
            const newSignalKey = typeof value === 'string' ? value : (value?.avainsana || null);
            if (newSignalKey) newState.signals[newSignalKey] = { isMuted: false, isPrintable: true };
            
            newPtState[key] = value;
            newState.palkkatuki = newPtState;
            return newState;
        });
    }, [setState]);

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
    }, [setState]);

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
    }, [setState]);

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
    }, [setState]);

    return { handleUpdateTyokyky, handleUpdatePalkkatuki, handleUpdateTyottomyysturva, handleUpdateKielitaso, handleUpdateSuunnitelma };
};