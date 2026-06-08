import { useCallback } from 'react';

export const useScraperAdapterV2 = (actions) => {
    
    const injectScrapedData = useCallback((parsedData) => {
        if (!parsedData) return;

        // 1. INJEKTOIDAAN FRAASIT (Vakiolauseet)
        if (parsedData.phrases && Array.isArray(parsedData.phrases)) {
            parsedData.phrases.forEach(phrase => {
                if (phrase.sectionKey) {
                    // Pakotetaan ruksi päälle
                    actions.onUpdateVariable(phrase.sectionKey, phrase.id, true);
                    
                    // Laitetaan Signaalipaneeliin
                    if (actions.onAddSignal) actions.onAddSignal(phrase.id);
                    
                    // Syötetään mahdolliset muuttujat (esim. Päivämäärä)
                    if (phrase.variables) {
                        Object.entries(phrase.variables).forEach(([vKey, vVal]) => {
                            actions.onUpdateVariable(phrase.sectionKey, phrase.id, vKey, vVal);
                        });
                    }
                } else {
                    if (actions.onAddSignal) actions.onAddSignal(phrase.id);
                }
            });
        }

        // 2. INJEKTOIDAAN PALVELUT (Services)
        // Palvelut menevät yleensä "suunnitelma" tai vastaavalle välilehdelle ja niillä on UUID
        if (parsedData.services && Array.isArray(parsedData.services)) {
            parsedData.services.forEach(service => {
                // Ruksitaan palvelu aktiiviseksi suunnitelmaan (tai mihin ikinä onSelect sen laittaakaan)
                actions.onSelect('suunnitelma', service.id, true);
                if (actions.onAddSignal) actions.onAddSignal(service.id);
            });
        }

        // 3. INJEKTOIDAAN SIGNAALIT
        if (parsedData.signals && Array.isArray(parsedData.signals)) {
            parsedData.signals.forEach(signal => {
                if (actions.onAddSignal) actions.onAddSignal(signal.id);
            });
        }

        // 4. INJEKTOIDAAN VAPAAT TEKSTIT (Vain ne, joita asiantuntija ei hylännyt!)
        if (parsedData.customTexts) {
            Object.entries(parsedData.customTexts).forEach(([sectionKey, text]) => {
                if (text && text.trim() && actions.onUpdateCustomText) {
                    actions.onUpdateCustomText(sectionKey, text.trim());
                }
            });
        }

        // 5. INJEKTOIDAAN GLOBAALIT MUUTTUJAT
        if (parsedData.variables) {
            Object.entries(parsedData.variables).forEach(([key, value]) => {
                if (actions.onUpdateAsiakas) {
                    actions.onUpdateAsiakas(key, value);
                }
            });
        }

        console.log("🚀 URA-imuri V2: Tiedot injektoitu onnistuneesti!");

    }, [actions]);

    return { injectScrapedData };
};