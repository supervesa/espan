import { useCallback } from 'react';

export const useSignalActions = (setState) => {
    const handleAddSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) newState.signals = {};
            if (!newState.signals[avainsana]) {
                newState.signals[avainsana] = { isMuted: false, isPrintable: true };
            }
            return newState;
        });
    }, [setState]);

    const handleRemoveSignal = useCallback((avainsana) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (newState.signals && newState.signals[avainsana]) {
                delete newState.signals[avainsana];
            }
            return newState;
        });
    }, [setState]);

    const handleToggleSignalSetting = useCallback((avainsana, setting) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            if (!newState.signals) return currentState;
            if (newState.signals[avainsana]) {
                newState.signals[avainsana][setting] = !newState.signals[avainsana][setting];
            }
            return newState;
        });
    }, [setState]);

    return { handleAddSignal, handleRemoveSignal, handleToggleSignalSetting };
};