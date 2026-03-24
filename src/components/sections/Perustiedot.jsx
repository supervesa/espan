// --- src/components/sections/Perustiedot.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import { planData } from '../../data/planData'; // LISÄTTY: Tuodaan planData injektiota varten

const Perustiedot = ({ state, actions }) => {
    const DB_PERUSTIEDOT = '33c681b0-4d06-4236-a63c-6f5675780fbb';
    const UI_KEY = 'suunnitelman_perustiedot';

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    const transformVariables = (varsArray) => {
        if (!varsArray || !Array.isArray(varsArray) || varsArray.length === 0) return null;
        const transformed = varsArray.reduce((acc, curr) => {
            let parsedOptions = [];
            try {
                if (curr.options) {
                    parsedOptions = JSON.parse(curr.options);
                    if (typeof parsedOptions === 'string') parsedOptions = JSON.parse(parsedOptions);
                }
            } catch (e) {
                console.warn("Virhe options-kentän parsinnassa:", curr.options);
            }
            acc[curr.variable_key] = {
                tyyppi: curr.input_type,
                oletus: curr.default_value,
                vaihtoehdot: parsedOptions
            };
            return acc;
        }, {});
        return Object.keys(transformed).length > 0 ? transformed : null;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_PERUSTIEDOT).order('created_at'),
                    supabase.from('variables').select('*')
                ]);

                if (phrasesRes.error) throw phrasesRes.error;

                const enrichedPhrases = (phrasesRes.data || []).map(phrase => ({
                    ...phrase,
                    variables: (varsRes.data || []).filter(v => v.phrase_id === phrase.id)
                }));

                // --- TAIKATEMPPU: INJEKTOIDAAN UUDET FRAASIT PLANDATAAN ---
                const sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
                if (sectionInPlanData) {
                    enrichedPhrases.forEach(dbPhrase => {
                        const exists = sectionInPlanData.fraasit.find(f => f.avainsana === dbPhrase.phrase_key);
                        if (!exists) {
                            sectionInPlanData.fraasit.push({
                                avainsana: dbPhrase.phrase_key,
                                teksti: dbPhrase.base_text,
                                lyhenne: dbPhrase.short_title,
                                muuttujat: transformVariables(dbPhrase.variables)
                            });
                        }
                    });
                }
                // --------------------------------------------------------

                setPhrases(enrichedPhrases);
            } catch (err) {
                console.error("Virhe Perustiedot-haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="section-container">Ladataan perustietoja...</div>;

    const sectionDef = { id: UI_KEY, monivalinta: true };

    return (
        <section className="section-container">
            <h2 className="section-title">Suunnitelman perustiedot</h2>
            <div className="options-container">
                {phrases.map(phrase => (
                    <PhraseOption 
                        key={phrase.id} 
                        phrase={{
                            ...phrase,
                            avainsana: phrase.phrase_key,
                            teksti: phrase.base_text,
                            lyhenne: phrase.short_title,
                            muuttujat: transformVariables(phrase.variables)
                        }} 
                        section={sectionDef} 
                        isSelected={state[UI_KEY]?.[phrase.phrase_key]} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                    />
                ))}
            </div>
             <div className="custom-text-container">
                <label htmlFor={`custom-text-${UI_KEY}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-${UI_KEY}`} 
                    className="form-input"
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-${UI_KEY}`] || ''} 
                    onChange={(e) => onUpdateCustomText(UI_KEY, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Perustiedot;