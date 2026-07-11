import { useCallback } from 'react';

export const useScraperAdapter = (actions) => {
    
    const injectScrapedData = useCallback((parsedData) => {
        if (!parsedData) return;

        const processedPhrases = new Set();

        // 1. KÄSITELLÄÄN VAKIOLAUSEET
        if (parsedData.phrases && Array.isArray(parsedData.phrases)) {
            parsedData.phrases.forEach(phrase => {
                const pKey = phrase.phrase_key || phrase.id;
                const sec = phrase.sectionKey || phrase.section_id;

                if (['tt_ehdottomat', 'tt_yleiset', 'muut_tuet'].includes(phrase.grouping_key)) {
                    let meta = phrase.metadata || {};
                    if (typeof meta === 'string') {
                        try { meta = JSON.parse(meta); } catch (e) {}
                    }
                    if (meta.signal_key && actions.onAddSignal) {
                        actions.onAddSignal(meta.signal_key);
                    }
                    return; 
                }

                if (sec) { 
                    if (actions.onSelect && !processedPhrases.has(pKey)) {
                        actions.onSelect(sec, pKey, true);
                        processedPhrases.add(pKey);
                    }
                    
                    if (actions.onAddSignal) actions.onAddSignal(pKey);
                    
                    if (phrase.variables) {
                        Object.entries(phrase.variables).forEach(([vKey, vVal]) => {
                            actions.onUpdateVariable(sec, pKey, vKey, vVal);
                        });
                    }
                } else {
                    if (actions.onAddSignal) actions.onAddSignal(pKey);
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

        // 4. KÄSITELLÄÄN GLOBAALIT MUUTTUJAT
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
                else if (key === 'yrittajyys_kiinnostus' || key === 'yrittajyys_teksti') {
                    if (actions.onUpdateCustomText) {
                        actions.onUpdateCustomText(key, value);
                    }
                    if (key === 'yrittajyys_kiinnostus' && value === 'kylla' && actions.onAddSignal) {
                        actions.onAddSignal('yrittajyys_kiinnostus');
                    }
                } 
                // --- TÄMÄ ON SE KORJATTU KOHTA ---
                else if (key === 'tyonhaku_alkanut') {
                    // IF-ehto on tuhottu! Sentinel-päivämäärä jyrää aina kaiken muun yli!
                    if (actions.onSelect) {
                        actions.onSelect('suunnitelman_perustiedot', 'tyonhaku_alkanut', true);
                    }
                    if (actions.onUpdateVariable) {
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'TH_ALKU_PVM', value);
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'PÄIVÄMÄÄRÄ', value);
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', '[PÄIVÄMÄÄRÄ]', value);
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'tyonhaku_alkanut', 'PVM', value);
                    }
                    if (actions.onUpdateAsiakas) {
                        actions.onUpdateAsiakas(key, value);
                    }
                }
                // Syntymävuosi ja Kunta Ovimiestä varten
                else if (key === 'syntymavuosi') {
                    if (actions.onUpdateVariable) {
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'syntymavuosi', 'SYNTYMÄVUOSI', value);
                    }
                }
                else if (key === 'kotikunta') {
                    if (actions.onUpdateVariable) {
                        actions.onUpdateVariable('suunnitelman_perustiedot', 'kotikunta', 'KUNTA', value);
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
                }
            });
        }

        // 6. KÄSITELLÄÄN PÄTEVYYDET
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

        // 8. KÄSITELLÄÄN EDELLYTYKSET
        if (parsedData.edellytyksetData) {
            const { escoNimi, finescoAla, vaihtoehtoisetAlat, activeTags, selections } = parsedData.edellytyksetData;

            if (escoNimi && actions.onUpdateAsiakas) actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', escoNimi);
            if (finescoAla && actions.onUpdateAsiakas) actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finescoAla);

            if (vaihtoehtoisetAlat && Array.isArray(vaihtoehtoisetAlat) && vaihtoehtoisetAlat.length > 0) {
                if (actions.onUpdateCustomText) actions.onUpdateCustomText('vaihtoehtoiset_ammatit', JSON.stringify(vaihtoehtoisetAlat));
            }

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

        // 9. KÄSITELLÄÄN TYÖTTÖMYYSTURVA
        if (parsedData.tyottomyysturvaData && parsedData.tyottomyysturvaData.answers) {
            Object.entries(parsedData.tyottomyysturvaData.answers).forEach(([qId, value]) => {
                if (actions.onUpdateTyottomyysturva) {
                    actions.onUpdateTyottomyysturva('updateKysymys', { id: qId, value });
                }
            });
        }

    }, [actions]);

    return { injectScrapedData };
};