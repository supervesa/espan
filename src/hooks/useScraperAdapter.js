// --- src/hooks/useScraperAdapter.js ---

import { useCallback } from 'react';

export const useScraperAdapter = (actions, dbPlanData) => {
    
    const injectScrapedData = useCallback((parsedData) => {
        if (!parsedData) return;

        // Otetaan talteen kaikki välilehdet, jotta tiedämme mihin kukin ruksi kuuluu
        const allSections = dbPlanData?.aihealueet || [];

        // 1. KÄSITELLÄÄN VAKIOLAUSEET (Phrases) & NIIDEN MUUTTUJAT
        if (parsedData.phrases && Array.isArray(parsedData.phrases)) {
            parsedData.phrases.forEach(phrase => {
                let sectionId = null;
                let isMulti = false;

                // Etsitään mistä välilehdeltä tämä fraasi löytyy
                for (const sec of allSections) {
                    if (sec.fraasit && sec.fraasit.some(f => f.avainsana === phrase.id)) {
                        sectionId = sec.id;
                        isMulti = sec.monivalinta;
                        break;
                    }
                }

                if (sectionId) {
                    // Laitetaan rasti ruutuun!
                    actions.onSelect(sectionId, phrase.id, isMulti);
                    
                    // Jos parseri poimi tekstin seasta muuttujia, syötetään ne heti perään
                    if (phrase.variables) {
                        Object.entries(phrase.variables).forEach(([vKey, vVal]) => {
                            actions.onUpdateVariable(sectionId, phrase.id, vKey, vVal);
                        });
                    }
                } else {
                    // Jos id:tä ei löydy miltään välilehdeltä, se on luultavasti signaali
                    actions.onAddSignal(phrase.id);
                }
            });
        }

        // 2. KÄSITELLÄÄN SIGNAALIT (Tagit)
        if (parsedData.signals && Array.isArray(parsedData.signals)) {
            parsedData.signals.forEach(signal => {
                actions.onAddSignal(signal.id);
            });
        }

        // 3. KÄSITELLÄÄN VAPAAT TEKSTIT (Tuntemattomaksi jääneet lauseet)
        if (parsedData.customTexts) {
            Object.entries(parsedData.customTexts).forEach(([sectionId, text]) => {
                if (text && text.trim()) {
                    actions.onUpdateCustomText(sectionId, text.trim());
                }
            });
        }

        // 4. KÄSITELLÄÄN GLOBAALIT MUUTTUJAT (ESCO, Palvelun pvm, jne)
        if (parsedData.variables) {
            Object.entries(parsedData.variables).forEach(([key, value]) => {
                // Lähetetään nämä uuteen asiakas-stateen, jonka loit usePlanStateen
                actions.onUpdateAsiakas(key, value);
            });
        }

        console.log("✅ URA-imurin adapteri: Tiedot käännetty ja injektoitu onnistuneesti tilakoneeseen!");

    }, [actions, dbPlanData]);

    return { injectScrapedData };
};