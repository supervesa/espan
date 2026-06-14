import { useContext } from 'react';
import { SignalContext } from './SignalContext';

export const useSignal = () => {
    const context = useContext(SignalContext);
    if (!context) {
        throw new Error('useSignal-hookia tulee käyttää SignalProviderin sisällä');
    }
    return context;
};