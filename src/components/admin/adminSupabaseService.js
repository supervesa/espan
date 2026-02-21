import { supabase } from '../../utils/supabaseClient';

// --- TUONTIFUNKTIOT (IMPORT) ---

export const importPlanData = async (jsonData, onLog) => {
    try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        if (!data.aihealueet || !Array.isArray(data.aihealueet)) {
            throw new Error("Virheellinen JSON: Odotettiin 'aihealueet' taulukkoa.");
        }

        onLog(`Aloitetaan tuonti. Löydettiin ${data.aihealueet.length} osiota.`);

        for (let i = 0; i < data.aihealueet.length; i++) {
            const section = data.aihealueet[i];
            onLog(`Käsitellään osiota: ${section.otsikko}...`);

            const { data: sectionData, error: sectionError } = await supabase
                .from('sections')
                .insert([{
                    section_key: section.id,
                    title: section.otsikko,
                    is_multiselect: section.monivalinta || false,
                    component_type: section.tyyppi || 'perus',
                    order_index: i
                }])
                .select();

            if (sectionError) {
                onLog(`Virhe osion ${section.otsikko} luonnissa: ${sectionError.message}`);
                continue;
            }

            const newSectionId = sectionData[0].id;
            onLog(`Osio luotu. ID: ${newSectionId}`);

            if (section.fraasit && Array.isArray(section.fraasit)) {
                for (let j = 0; j < section.fraasit.length; j++) {
                    const phrase = section.fraasit[j];
                    const { data: phraseData, error: phraseError } = await supabase
                        .from('phrases')
                        .insert([{
                            section_id: newSectionId,
                            phrase_key: phrase.avainsana,
                            short_title: phrase.lyhenne || phrase.teksti.substring(0, 20) + '...',
                            base_text: phrase.teksti,
                            grouping_key: phrase.ryhma || null,
                            priority_score: phrase.priority || 0,
                            order_index: j
                        }])
                        .select();

                    if (phraseError) {
                        onLog(`  - Virhe fraasin ${phrase.avainsana} luonnissa: ${phraseError.message}`);
                        continue;
                    }

                    if (phrase.muuttujat) {
                        const newPhraseId = phraseData[0].id;
                        for (const [varKey, varConfig] of Object.entries(phrase.muuttujat)) {
                            let inputType = varConfig.tyyppi === 'numero' ? 'number' : 
                                          varConfig.tyyppi === 'valinta' ? 'select' : 'text';

                            const { error: varError } = await supabase
                                .from('variables')
                                .insert([{
                                    phrase_id: newPhraseId,
                                    variable_key: varKey,
                                    input_type: inputType,
                                    options: varConfig.vaihtoehdot ? JSON.stringify(varConfig.vaihtoehdot) : null,
                                    default_value: varConfig.oletus !== undefined ? String(varConfig.oletus) : null
                                }]);

                            if (varError) {
                                onLog(`    -- Virhe muuttujan ${varKey} luonnissa: ${varError.message}`);
                            }
                        }
                    }
                }
                onLog(`  - Fraasit ja muuttujat lisätty osioon ${section.otsikko}.`);
            }
        }
        onLog('Tuonti suoritettu onnistuneesti!');
        return true;
    } catch (err) {
        onLog(`KRIITTINEN VIRHE: ${err.message}`);
        return false;
    }
};

export const importMessageTemplates = async (jsonData, onLog) => {
    try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (!Array.isArray(data)) {
            throw new Error("Virheellinen JSON: Odotettiin taulukkoa (Array).");
        }

        onLog(`Aloitetaan tuonti. Löydettiin ${data.length} viestipohjaa.`);

        for (const template of data) {
            onLog(`Tuodaan pohja: ${template.title}...`);
            const { error } = await supabase
                .from('message_templates')
                .insert([{
                    category: template.category,
                    title: template.title,
                    subject: template.subject || '',
                    template_body: template.template,
                    fields: template.fields ? JSON.stringify(template.fields) : '[]',
                    addons: template.addons ? JSON.stringify(template.addons) : '[]'
                }]);

            if (error) {
                onLog(`  - Virhe pohjan luonnissa: ${error.message}`);
            } else {
                onLog(`  - Pohja '${template.title}' lisätty.`);
            }
        }
        onLog('Viestipohjien tuonti suoritettu onnistuneesti!');
        return true;
    } catch (err) {
        onLog(`KRIITTINEN VIRHE: ${err.message}`);
        return false;
    }
};

export const importKnowledgeBase = async (jsonData, onLog) => {
    try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (!Array.isArray(data)) {
            throw new Error("Virheellinen JSON: Odotettiin taulukkoa (Array).");
        }

        onLog(`Aloitetaan tuonti. Löydettiin ${data.length} ohjetta/tietoiskua.`);

        for (const item of data) {
            onLog(`Tuodaan ohje: ${item.title}...`);
            const { error } = await supabase
                .from('knowledge_base')
                .insert([{
                    category: item.category,
                    title: item.title,
                    content_text: item.content_text,
                    metadata: item.metadata || {}
                }]);

            if (error) {
                onLog(`  - Virhe ohjeen luonnissa: ${error.message}`);
            }
        }
        onLog('Tietopankin tuonti suoritettu onnistuneesti!');
        return true;
    } catch (err) {
        onLog(`KRIITTINEN VIRHE: ${err.message}`);
        return false;
    }
};

// --- SÄÄNTÖMOOTTORIN FUNKTIOT ---

export const fetchPhraseRules = async (phraseId) => {
    const { data, error } = await supabase
        .from('business_rules')
        .select('*')
        .eq('target_id', phraseId)
        .eq('target_type', 'phrase');
        
    if (error) {
        console.error("Virhe sääntöjen haussa:", error);
        return [];
    }
    return data;
};

export const addPhraseRule = async (ruleData) => {
    const { data, error } = await supabase
        .from('business_rules')
        .insert([ruleData])
        .select();
        
    if (error) {
        console.error("Virhe säännön lisäyksessä:", error);
        return null;
    }
    return data[0];
};

export const deletePhraseRule = async (ruleId) => {
    const { error } = await supabase
        .from('business_rules')
        .delete()
        .eq('id', ruleId);
        
    if (error) {
        console.error("Virhe säännön poistossa:", error);
        return false;
    }
    return true;
};

// --- YLEINEN LUONTIFUNKTIO ---

export const createNewItem = async (tableName, defaultData) => {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .insert([defaultData])
            .select();

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error(`Virhe luotaessa uutta kohdetta tauluun ${tableName}:`, error);
        return null;
    }
};

// --- YLEINEN POISTOFUNKTIO ---

export const deleteAdminItem = async (tableName, itemId) => {
    try {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', itemId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Virhe poistettaessa taulusta ${tableName}:`, error);
        return false;
    }
};