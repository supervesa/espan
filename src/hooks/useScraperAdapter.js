// --- src/hooks/useScraperAdapter.js ---
import { useCallback } from 'react';

export const useScraperAdapter = (actions) => {
    
    const injectScrapedData = useCallback((parsedData) => {
        if (!parsedData) return;

        // 1. KÄSITELLÄÄN VAKIOLAUSEET
        if (parsedData.phrases && Array.isArray(parsedData.phrases)) {
            parsedData.phrases.forEach(phrase => {
                if (phrase.sectionKey) {
                    actions.onUpdateVariable(phrase.sectionKey, phrase.id, true);
                    if (actions.onAddSignal) actions.onAddSignal(phrase.id);
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

        // 2. KÄSITELLÄÄN SIGNAALIT
        if (parsedData.signals && Array.isArray(parsedData.signals)) {
            parsedData.signals.forEach(signal => {
                if (actions.onAddSignal) actions.onAddSignal(signal.id);
            });
        }

        // 3. KÄSITELLÄÄN VAPAAT TEKSTIT
        if (parsedData.customTexts) {
            Object.entries(parsedData.customTexts).forEach(([sectionKey, text]) => {
                if (text && text.trim() && actions.onUpdateCustomText) {
                    actions.onUpdateCustomText(sectionKey, text.trim());
                }
            });
        }

     // 4. KÄSITELLÄÄN GLOBAALIT MUUTTUJAT, ÄIDINKIELI JA YRITTÄJYYS
        if (parsedData.variables) {
            Object.entries(parsedData.variables).forEach(([key, value]) => {
                if (key === 'aidinkieli') {
                    const kieli = value.trim();
                    if (actions.onUpdateCustomText) {
                        actions.onUpdateCustomText('kielitaso_aidinkieli', kieli);
                    }
                    if (kieli && actions.onAddSignal) {
                        actions.onAddSignal(kieli.toLowerCase().replace(/\s+/g, '_'));
                    }
                } 
                // UUSI LISÄYS: Ohjataan yrittäjyysvalinnat suoraan custom-teksteiksi
                else if (key === 'yrittajyys_kiinnostus' || key === 'yrittajyys_teksti') {
                    if (actions.onUpdateCustomText) {
                        actions.onUpdateCustomText(key, value);
                    }
                    // Sytytetään signaali, jos asiakas on kiinnostunut
                    if (key === 'yrittajyys_kiinnostus' && value === 'kylla' && actions.onAddSignal) {
                        actions.onAddSignal('yrittajyys_kiinnostus');
                    }
                } 
                else if (actions.onUpdateAsiakas) {
                    actions.onUpdateAsiakas(key, value);
                }
            });
        }

        // 5. KÄSITELLÄÄN PALVELUT
        if (parsedData.services && Array.isArray(parsedData.services)) {
            parsedData.services.forEach(service => {
                if (typeof actions.onAddService === 'function') {
                    actions.onAddService(service.id);
                } else {
                    console.warn("Adapteri: onAddService funktiota ei löytynyt actions-objektista!", service);
                }
            });
        }

        // 6. UUSI: KÄSITELLÄÄN PÄTEVYYDET (AMMATTIKORTIT)
        if (parsedData.patevyydet && Array.isArray(parsedData.patevyydet) && parsedData.patevyydet.length > 0) {
            if (actions.onUpdateCustomText) {
                // Tilaan pitää laittaa stringifioitu taulukko
                actions.onUpdateCustomText('valitut_ammattikortit', JSON.stringify(parsedData.patevyydet));
            }
            
            // Laitetaan myös signaalit päälle nimen perusteella samalla logiikalla kuin PatevyydetOsio tekee
            if (actions.onAddSignal) {
                parsedData.patevyydet.forEach(kortti => {
                    const safeName = kortti.nimi.toLowerCase().replace(/[^a-z0-9äöå]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '');
                    actions.onAddSignal(`patevyys_${safeName}`);
                });
            }
        }

        console.log("✅ URA-imurin adapteri: Ruksit, Signaalit, Muuttujat, Palvelut ja Pätevyydet injektoitu onnistuneesti!");

    }, [actions]);

    return { injectScrapedData };
};