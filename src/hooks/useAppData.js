// --- src/hooks/useAppData.js ---

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export const useAppData = () => {
    const [dbPlanData, setDbPlanData] = useState({ aihealueet: [] });
    const [dbMessages, setDbMessages] = useState([]);
    const [dbKnowledge, setDbKnowledge] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoadingData(true);
            try {
                const [secRes, msgRes, knowRes] = await Promise.all([
                  supabase.from('sections').select('*, phrases (*, variables (*), phrase_triggers (*))').order('order_index'),
                    supabase.from('message_templates').select('*').order('title'),
                    supabase.from('knowledge_base').select('*').order('title')
                ]);

                if (secRes.data) {
                    const mappedAihealueet = secRes.data.map(sec => {
                        const alwaysMultiSelect = ['suunnitelman_perustiedot', 'tyotilanne', 'ammattikortit', 'palveluunohjaus', 'suunnitelma'];
                        const isMulti = alwaysMultiSelect.includes(sec.section_key) ? true : sec.is_multiselect;

                        return {
                            otsikko: sec.title,
                            id: sec.section_key,
                            monivalinta: isMulti,
                            tyyppi: sec.component_type,
                            fraasit: (sec.phrases || []).sort((a, b) => a.order_index - b.order_index).map(phr => {
                                const muuttujat = {};
                                if (phr.variables && phr.variables.length > 0) {
                                    phr.variables.forEach(v => {
                                        let optionsArray = undefined;
                                        if (v.options && v.options !== 'null' && v.options !== '[]' && v.options !== '') {
                                            try { 
                                                const parsed = typeof v.options === 'string' ? JSON.parse(v.options) : v.options; 
                                                optionsArray = Array.isArray(parsed) ? parsed : [parsed];
                                            } catch(e) {
                                                optionsArray = v.options.replace(/[\[\]"']/g, '').split(',').map(s => s.trim());
                                            }
                                        }
                                        
                                        let inputTyyppi = 'teksti';
                                        if (v.input_type === 'select' || v.input_type === 'valinta' || (optionsArray && optionsArray.length > 0)) {
                                            inputTyyppi = 'valinta';
                                        } else if (v.input_type === 'number' || v.input_type === 'numero') {
                                            inputTyyppi = 'numero';
                                        }

                                        let defVal = v.default_value !== null && v.default_value !== undefined ? v.default_value : '';
                                        if ((v.variable_key.includes('PÄIVÄMÄÄRÄ') || v.variable_key.includes('PVM')) && (!defVal || defVal.trim() === '')) {
                                            defVal = new Date().toLocaleDateString('fi-FI');
                                        }
                                        
                                        if (inputTyyppi === 'valinta' && (!defVal || defVal === '') && optionsArray && optionsArray.length > 0) {
                                            defVal = optionsArray[0];
                                        }

                                        muuttujat[v.variable_key] = { tyyppi: inputTyyppi, vaihtoehdot: optionsArray, oletus: defVal };
                                    });
                                }
                                
                                // TÄSSÄ ON SE KORJATTU KOHTA (id: phr.id on nyt mukana)
                              return {
    id: phr.id,
    lyhenne: phr.short_title,
    teksti: phr.base_text,
    avainsana: phr.phrase_key,
    ryhma: phr.grouping_key,
    priority: phr.priority_score,
    muuttujat: Object.keys(muuttujat).length > 0 ? muuttujat : undefined,
    triggerit: phr.phrase_triggers || [] // <--- TÄMÄ ON UUSI RIVI
};
                            })
                        };
                    });
                    setDbPlanData({ aihealueet: mappedAihealueet });
                }

                if (msgRes.data) {
                    const parsedMessages = msgRes.data.map(msg => {
                        let parsedFields = [];
                        let parsedAddons = [];
                        try { parsedFields = typeof msg.fields === 'string' ? JSON.parse(msg.fields) : msg.fields; } catch(e){}
                        try { parsedAddons = typeof msg.addons === 'string' ? JSON.parse(msg.addons) : msg.addons; } catch(e){}
                        return { ...msg, template: msg.template_body, fields: parsedFields || [], addons: parsedAddons || [] };
                    });
                    setDbMessages(parsedMessages);
                }

                if (knowRes.data) setDbKnowledge(knowRes.data);

            } catch (error) {
                console.error("Virhe datan latauksessa:", error);
            }
            setIsLoadingData(false);
        };

        fetchAllData();
    }, []);

    return { dbPlanData, dbMessages, dbKnowledge, isLoadingData };
};