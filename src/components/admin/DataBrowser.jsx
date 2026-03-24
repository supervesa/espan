// --- src/components/admin/DataBrowser.jsx ---

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { updatePhrase } from './adminSupabaseService';
import PhraseEditModal from './PhraseEditModal';
import InfoSnippetModal from './InfoSnippetModal'; // UUSI TUONTI

const DataBrowser = () => {
    const [sections, setSections] = useState([]);
    const [snippets, setSnippets] = useState([]); // UUSI: Linkit
    const [triggerDictionary, setTriggerDictionary] = useState([]); // UUSI: Sanakirja
    
    const [loading, setLoading] = useState(true);
    
    const [editingPhrase, setEditingPhrase] = useState(null); 
    const [editingSnippet, setEditingSnippet] = useState(null); // UUSI: Snippet modaali

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Haetaan osiot ja fraasit
            const { data: secData, error: secError } = await supabase
                .from('sections')
                .select('*, phrases (*, variables (*))')
                .order('order_index', { ascending: true });

            // Haetaan sähköpostilinkit
            const { data: snipData, error: snipError } = await supabase
                .from('info_snippets')
                .select('*')
                .order('label', { ascending: true });

            // Haetaan sanakirja triggereistä
            const { data: trigData, error: trigError } = await supabase
                .from('phrase_triggers')
                .select('signal_key');

            if (!secError && secData) setSections(secData);
            if (!snipError && snipData) setSnippets(snipData);
            
            // Rakennetaan uniikki sanakirja
            if (!trigError && trigData) {
                const uniqueTriggers = [...new Set(trigData.map(t => t.signal_key).filter(Boolean))].sort();
                setTriggerDictionary(uniqueTriggers);
            }
        } catch (error) {
            console.error("Virhe datan latauksessa:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePhrase = async (id, updates) => {
        const { success } = await updatePhrase(id, updates);
        if (success) {
            setEditingPhrase(null);
            fetchData(); 
        } else {
            alert("Virhe tallennuksessa!");
        }
    };

    // Apu: Onko linkki yli 6 kk vanha?
    const isLinkOld = (dateString) => {
        if (!dateString) return true;
        const checkDate = new Date(dateString);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return checkDate < sixMonthsAgo;
    };

    if (loading) return <div className="section-container"><p>Ladataan tietokantaa...</p></div>;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title">Lomakerakenne ja Linkit (Supabase)</h2>
                <button onClick={fetchData} className="btn btn--secondary">Päivitä näkymä</button>
            </div>

            <div className="options-container" style={{ marginTop: '1.5rem' }}>
                
                {/* 1. FRAASIT */}
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>1. Fraasit ja Toimenpiteet</h3>
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
                                            </div>
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

                {/* 2. SÄHKÖPOSTIN LINKIT (INFO SNIPPETS) */}
                <h3 style={{ marginBottom: '1rem', marginTop: '2.5rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    2. Sähköpostin tietoiskut ja linkit
                    <button className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => setEditingSnippet('new')}>
                        + Uusi linkki
                    </button>
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {snippets.map(snippet => {
                        const old = isLinkOld(snippet.last_checked_at);
                        return (
                            <div key={snippet.id} style={{ 
                                padding: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-border)', 
                                borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {snippet.label}
                                        <span className="tag">{snippet.snippet_key}</span>
                                        {old && <span className="tag tag--danger" title="Tarkistettu yli 6 kk sitten!">Vanhahko linkki</span>}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--color-text-secondary)' }}>
                                        <strong>Signaalit:</strong> {snippet.triggers || <i style={{opacity: 0.5}}>Ei signaaleja</i>}
                                    </div>
                                </div>
                                <button 
                                    className="btn btn--secondary" 
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                    onClick={() => setEditingSnippet(snippet)}
                                >
                                    Muokkaa
                                </button>
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* MODAALIT */}
            {editingPhrase && (
                <PhraseEditModal 
                    phrase={editingPhrase} 
                    onClose={() => setEditingPhrase(null)} 
                    onSave={handleSavePhrase} 
                />
            )}

            {editingSnippet && (
                <InfoSnippetModal 
                    snippet={editingSnippet} 
                    triggerDictionary={triggerDictionary}
                    onClose={() => setEditingSnippet(null)} 
                    onSaveComplete={() => { setEditingSnippet(null); fetchData(); }} 
                />
            )}
        </section>
    );
};

export default DataBrowser;