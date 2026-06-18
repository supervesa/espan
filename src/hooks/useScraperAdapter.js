// --- src/hooks/useScraperAdapter.js ---
import { useCallback } from 'react';

export const useScraperAdapter = (actions) => {
    
    const injectScrapedData = useCallback((parsedData) => {
        if (!parsedData) return;

        // Estetään tuplakäsittelyt pitämällä kirjaa, mitkä fraasit on jo valittu
        const processedPhrases = new Set();

        // 1. KÄSITELLÄÄN VAKIOLAUSEET
        if (parsedData.phrases && Array.isArray(parsedData.phrases)) {
            parsedData.phrases.forEach(phrase => {
                if (phrase.sectionKey) {
                    
                    if (actions.onSelect && !processedPhrases.has(phrase.id)) {
                        actions.onSelect(phrase.sectionKey, phrase.id, true);
                        processedPhrases.add(phrase.id);
                    }
                    
                    if (actions.onAddSignal) actions.onAddSignal(phrase.id);
                    
                    // Viedään muuttujat (esim. päivämäärät) sisään
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
                // Yrittäjyysvalinnat suoraan custom-teksteiksi
                else if (key === 'yrittajyys_kiinnostus' || key === 'yrittajyys_teksti') {
                    if (actions.onUpdateCustomText) {
                        actions.onUpdateCustomText(key, value);
                    }
                    // Sytytetään signaali, jos asiakas on kiinnostunut
                    if (key === 'yrittajyys_kiinnostus' && value === 'kylla' && actions.onAddSignal) {
                        actions.onAddSignal('yrittajyys_kiinnostus');
                    }
                } 
                // --- KORJATTU: TYÖNHAUN ALKAMISEN REITITYS LOMAKKEELLE ---
                else if (key === 'tyonhaku_alkanut') {
                    if (!processedPhrases.has('tyonhaku_alkanut')) {
                        // 1. Kytketään Perustiedot-lomakkeen ruksi päälle
                        if (actions.onSelect) {
                            actions.onSelect('suunnitelman_perustiedot', 'tyonhaku_alkanut', true);
                        }
                        // 2. Täytetään päivämäärä muuttujiin
                        if (actions.onUpdateVariable) {
                            // TÄMÄ ON SE KRIITTINEN KORJAUS (SQL-kannan mukainen avain):
                            actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'TH_ALKU_PVM', value);
                            
                            // Jätetään nämä varmuuden vuoksi (taaksepäin yhteensopivuus)
                            actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'PÄIVÄMÄÄRÄ', value);
                            actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', '[PÄIVÄMÄÄRÄ]', value);
                            actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'PVM', value);
                        }
                        processedPhrases.add('tyonhaku_alkanut');
                    }
                    // 3. Viedään silti varmuuden vuoksi myös asiakas-objektiin, jotta mikään vanha viittaus ei hajoa
                    if (actions.onUpdateAsiakas) {
                        actions.onUpdateAsiakas(key, value);
                    }
                }
                // --------------------------------------------------------------
                else if (actions.onUpdateAsiakas) {
                    actions.onUpdateAsiakas(key, value);
                }
            });
        }

        // 5. KÄSITELLÄÄN PALVELUT (Vanhat järjestelmäpalvelut)
        if (parsedData.services && Array.isArray(parsedData.services)) {
            parsedData.services.forEach(service => {
                if (typeof actions.onAddService === 'function') {
                    actions.onAddService(service.id);
                } else {
                    console.warn("Adapteri: onAddService funktiota ei löytynyt actions-objektista!", service);
                }
            });
        }

        // 6. KÄSITELLÄÄN PÄTEVYYDET (AMMATTIKORTIT)
        if (parsedData.patevyydet && Array.isArray(parsedData.patevyydet) && parsedData.patevyydet.length > 0) {
            if (actions.onUpdateCustomText) {
                actions.onUpdateCustomText('valitut_ammattikortit', JSON.stringify(parsedData.patevyydet));
            }
            
            if (actions.onAddSignal) {
                parsedData.patevyydet.forEach(kortti => {
                    const safeName = kortti.nimi.toLowerCase().replace(/[^a-z0-9äöå]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '');
                    actions.onAddSignal(`patevyys_${safeName}`);
                });
            }
        }

        // 7. KÄSITELLÄÄN TYÖKYKY
        if (parsedData.tyokykyData) {
            const { paavalinta, alentuma_kuvaus, oma_arvio, toimenpiteet } = parsedData.tyokykyData;

            if (paavalinta && actions.onUpdateCustomText) {
                actions.onUpdateCustomText('tyokyky_paavalinta', paavalinta);
                if (actions.onAddSignal) actions.onAddSignal(paavalinta);
            }
            
            if (oma_arvio && actions.onUpdateCustomText) {
                actions.onUpdateCustomText('tyokyky_oma_arvio', oma_arvio);
            }
            
            if (alentuma_kuvaus && actions.onUpdateCustomText) {
                actions.onUpdateCustomText('tyokyky_alentuma_kuvaus', alentuma_kuvaus);
            }
            
            if (toimenpiteet && Array.isArray(toimenpiteet)) {
                toimenpiteet.forEach(toim => {
                    if (actions.onSelect && !processedPhrases.has(toim.avainsana)) {
                        actions.onSelect('tyokyky', toim.avainsana, true);
                        processedPhrases.add(toim.avainsana);
                    }
                    if (actions.onAddSignal) actions.onAddSignal(toim.avainsana);
                    if (toim.muuttujat) {
                        Object.entries(toim.muuttujat).forEach(([vKey, vVal]) => {
                            actions.onUpdateVariable('tyokyky', toim.avainsana, vKey, vVal);
                        });
                    }
                });
            }
        }

        // 8. KÄSITELLÄÄN TYÖLLISTYMISEN EDELLYTYKSET (33 §)
        if (parsedData.edellytyksetData) {
            const { escoNimi, finescoAla, vaihtoehtoisetAlat, activeTags, selections } = parsedData.edellytyksetData;

            // Ensisijainen ammatti ja toimiala asiakastietoihin (kytkeytyy TavoiteAmmattiValitsimeen)
            if (escoNimi && actions.onUpdateAsiakas) {
                actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', escoNimi);
            }
            if (finescoAla && actions.onUpdateAsiakas) {
                actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finescoAla);
            }

            // Vaihtoehtoiset tavoitteet talteen stringifioituna
            if (vaihtoehtoisetAlat && Array.isArray(vaihtoehtoisetAlat) && vaihtoehtoisetAlat.length > 0) {
                if (actions.onUpdateCustomText) {
                    actions.onUpdateCustomText('vaihtoehtoiset_ammatit', JSON.stringify(vaihtoehtoisetAlat));
                }
            }

            // Aktivoidaan paneelien ruksitut tägit (Tavoitteet, Markkinaesteet, Elämäntilanne)
            if (activeTags) {
                Object.keys(activeTags).forEach(category => {
                    const tags = activeTags[category] || [];
                    tags.forEach(tag => {
                        if (actions.onSelect && !processedPhrases.has(tag.id)) {
                            actions.onSelect('edellytykset', tag.id, true);
                            processedPhrases.add(tag.id);
                        }
                        if (actions.onAddSignal) actions.onAddSignal(tag.id);
                        if (actions.setSignal) actions.setSignal(tag.id, true);
                    });
                });
            }

            // Aktivoidaan vireillä olevat ja hylätyt etuusvalinnat
            if (selections) {
                if (selections.vireilla && actions.onSelect && !processedPhrases.has(selections.vireilla.id)) {
                    actions.onSelect('edellytykset', selections.vireilla.id, true);
                    if (actions.onAddSignal) actions.onAddSignal(selections.vireilla.id);
                    processedPhrases.add(selections.vireilla.id);
                }
                if (selections.hylatty && actions.onSelect && !processedPhrases.has(selections.hylatty.id)) {
                    actions.onSelect('edellytykset', selections.hylatty.id, true);
                    if (actions.onAddSignal) actions.onAddSignal(selections.hylatty.id);
                    processedPhrases.add(selections.hylatty.id);
                }
            }
        }

        console.log("✅ URA-imurin adapteri: Ruksit, Signaalit, Muuttujat, Palvelut, Pätevyydet, Työkyky ja Edellytykset injektoitu onnistuneesti!");

    }, [actions]);

    return { injectScrapedData };
};