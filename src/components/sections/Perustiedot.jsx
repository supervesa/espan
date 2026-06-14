import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import { planData } from '../../data/planData';
import { aggregateSignalText } from '../../utils/textAggregator';
import { FileText, Sparkles } from 'lucide-react';

const Perustiedot = ({ state, actions }) => {
    const DB_PERUSTIEDOT = '33c681b0-4d06-4236-a63c-6f5675780fbb';
    const UI_KEY = 'suunnitelman_perustiedot';

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    const transformVariables = (varsArray) => {
        if (!varsArray || varsArray.length === 0) return null;
        return varsArray.reduce((acc, curr) => {
            let opts = [];
            try { if (curr.options) opts = JSON.parse(curr.options); } catch (e) {}
            acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: curr.default_value, vaihtoehdot: opts };
            return acc;
        }, {});
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_PERUSTIEDOT).order('created_at'),
                    supabase.from('variables').select('*')
                ]);
                const enriched = (phrasesRes.data || []).map(p => ({
                    ...p,
                    variables: (varsRes.data || []).filter(v => v.phrase_id === p.id)
                }));

                const section = planData.aihealueet.find(s => s.id === UI_KEY);
                if (section) {
                    enriched.forEach(dbP => {
                        if (dbP.grouping_key === 'ghost' || dbP.grouping_key === 'automaatti_tpl') return;
                        if (!section.fraasit.find(f => f.avainsana === dbP.phrase_key)) {
                            section.fraasit.push({
                                avainsana: dbP.phrase_key,
                                teksti: dbP.base_text,
                                lyhenne: dbP.short_title,
                                muuttujat: transformVariables(dbP.variables)
                            });
                        }
                    });
                }
                setPhrases(enriched);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const generatedSignalText = useMemo(() => aggregateSignalText(phrases, state.signals), [phrases, state.signals]);

    if (loading) return <div className="section-container">Ladataan...</div>;

    return (
        <section className="section-container">
            <h2 className="section-title icon-heading">
                <FileText size={22} color="var(--color-primary)" /> Suunnitelman perustiedot
            </h2>

            <div className="options-container">
                {phrases
                    .filter(p => p.grouping_key !== 'ghost' && p.grouping_key !== 'automaatti_tpl')
                    .map(phrase => (
                    <PhraseOption 
                        key={phrase.id} 
                        phrase={{
                            ...phrase,
                            avainsana: phrase.phrase_key,
                            teksti: phrase.base_text,
                            lyhenne: phrase.short_title,
                            muuttujat: transformVariables(phrase.variables)
                        }} 
                        section={{ id: UI_KEY, monivalinta: true }} 
                        isSelected={state[UI_KEY]?.[phrase.phrase_key]} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                    />
                ))}
            </div>

            {generatedSignalText && (
                <div className="smart-analysis-box" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(139, 92, 246, 0.04)', borderColor: 'var(--color-ai)', borderStyle: 'dashed' }}>
                    <div className="smart-analysis-header" style={{ color: 'var(--color-ai)', marginBottom: '8px' }}>
                        <Sparkles size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Automaattinen koonti signaaleista</span>
                    </div>
                    <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.9rem', color: '#4c1d95' }}>{generatedSignalText}</p>
                </div>
            )}

            <div className="custom-text-container" style={{ marginTop: '1.5rem' }}>
                <textarea 
                    className="form-input"
                    rows="3" 
                    value={state[`custom-${UI_KEY}`] || ''} 
                    onChange={(e) => onUpdateCustomText(UI_KEY, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Perustiedot;