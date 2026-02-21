import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { updatePhrase } from './adminSupabaseService';
import PhraseEditModal from './PhraseEditModal';

const DataBrowser = () => {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPhrase, setEditingPhrase] = useState(null); // Tila modaalille

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sections')
            .select('*, phrases (*, variables (*))')
            .order('order_index', { ascending: true });

        if (!error && data) setSections(data);
        setLoading(false);
    };

    const handleSavePhrase = async (id, updates) => {
        const { success } = await updatePhrase(id, updates);
        if (success) {
            setEditingPhrase(null);
            fetchData(); // Päivitetään lista nähdäksemme muutokset
        } else {
            alert("Virhe tallennuksessa!");
        }
    };

    if (loading) return <div className="section-container"><p>Ladataan tietokantaa...</p></div>;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title">Lomakerakenne (Supabase)</h2>
                <button onClick={fetchData} className="btn btn--secondary">Päivitä näkymä</button>
            </div>

            <div className="options-container" style={{ marginTop: '1.5rem' }}>
                {sections.map(section => (
                    <details key={section.id} className="discussion-accordion">
                        <summary>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {section.title}
                                <span className="tag tag--pending">{section.section_key}</span>
                            </span>
                        </summary>
                        <div className="discussion-content">
                            {section.phrases && section.phrases.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                                    {section.phrases.map(phrase => (
                                        <li key={phrase.id} style={{ 
                                            marginBottom: '1rem', paddingBottom: '1rem', 
                                            borderBottom: '1px solid var(--color-border)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
                                                    {phrase.short_title} <span className="tag" style={{ marginLeft: '0.5rem' }}>{phrase.phrase_key}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                                                    {phrase.base_text}
                                                </div>
                                                {phrase.variables && phrase.variables.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                                        {phrase.variables.map(v => (
                                                            <span key={v.id} className="chip chip--warning" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                                                                [{v.variable_key}] : {v.input_type}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Muokkausnappi */}
                                            <button 
                                                className="btn btn--secondary" 
                                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                                onClick={() => setEditingPhrase(phrase)}
                                            >
                                                Muokkaa
                                            </button>

                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontStyle: 'italic' }}>Ei fraaseja tässä osiossa.</p>
                            )}
                        </div>
                    </details>
                ))}
            </div>

            {/* Renderöidään modaali vain, jos jokin fraasi on valittuna */}
            {editingPhrase && (
                <PhraseEditModal 
                    phrase={editingPhrase} 
                    onClose={() => setEditingPhrase(null)} 
                    onSave={handleSavePhrase} 
                />
            )}
        </section>
    );
};

export default DataBrowser;