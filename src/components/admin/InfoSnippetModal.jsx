// --- src/components/admin/InfoSnippetModal.jsx ---

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Sparkles, Globe, AlertCircle, Info, CalendarCheck, Link as LinkIcon } from 'lucide-react';

const initialFormData = {
    label: '', snippet_key: '', content: '', url: '', triggers: '', ai_description: '', last_checked_at: null
};

const InfoSnippetModal = ({ snippet, triggerDictionary, onClose, onSaveComplete }) => {
    const isNew = snippet === 'new';
    const [formData, setFormData] = useState(initialFormData);
    const [urlInput, setUrlInput] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (!isNew && snippet) {
            setFormData({
                label: snippet.label || '',
                snippet_key: snippet.snippet_key || '',
                content: snippet.content || '',
                url: snippet.url || '', // Uusi URL-kenttä
                triggers: snippet.triggers || '',
                ai_description: snippet.ai_description || '',
                last_checked_at: snippet.last_checked_at || null
            });
            setUrlInput(snippet.url || ''); // Asetetaan myös AI-hakukenttään
        }
    }, [snippet, isNew]);

    // TEKOÄLYN PUTKITUS KYTKETTY
    const handleAIProcess = async () => {
        if (!urlInput) return alert("Syötä URL ensin!");
        setIsGenerating(true);
        
        try {
            const response = await fetch('/.netlify/functions/extract_snippet', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput, triggerDictionary })
            });
            
            if (!response.ok) {
                if (response.status === 500 || response.status === 503) {
                    throw new Error("Aivoissa on juuri nyt ruuhkaa! Liikaa pörriäisiä kimpussani, yritä hetken kuluttua uudestaan. 🐝");
                }
                throw new Error("Haku epäonnistui (Virhekoodi: " + response.status + "). Tarkista linkki.");
            }
            
            const aiData = await response.json();
            const safeTriggers = Array.isArray(aiData.triggers) ? aiData.triggers.join(', ') : (aiData.triggers || '');

            setFormData(prev => ({
                ...prev,
                url: urlInput, // Tallennetaan haettu URL automaattisesti
                label: aiData.label || prev.label,
                content: aiData.content || prev.content,
                ai_description: aiData.ai_description || prev.ai_description,
                triggers: safeTriggers,
                last_checked_at: new Date().toISOString() // Kuitataan tuoreeksi!
            }));
            
        } catch (error) {
            alert(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // TALLENNUS
    const handleSave = async (updateTimestamp = false) => {
        setIsSaving(true);
        try {
            const dataToSave = { ...formData };
            if (updateTimestamp) {
                dataToSave.last_checked_at = new Date().toISOString();
            }

            if (isNew) {
                if (!dataToSave.snippet_key) {
                    dataToSave.snippet_key = dataToSave.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                }
                const { error } = await supabase.from('info_snippets').insert([dataToSave]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('info_snippets').update(dataToSave).eq('id', snippet.id);
                if (error) throw error;
            }
            
            setSaveSuccess(true);
            setTimeout(() => onSaveComplete(), 1000);
        } catch (error) {
            console.error(error);
            alert("Tallennus epäonnistui!");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isNew) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('info_snippets').delete().eq('id', snippet.id);
            if (error) throw error;
            onSaveComplete();
        } catch (error) {
            alert("Poisto epäonnistui!");
        } finally {
            setIsSaving(false);
        }
    };

    // TAG MANAGER LOGIIKKA
    const safeCurrentTriggers = formData.triggers || '';
    const currentTriggersArray = safeCurrentTriggers.split(',').map(t => t.trim()).filter(Boolean);

    const handleAddTrigger = (t) => {
        if (!currentTriggersArray.includes(t)) {
            setFormData({ ...formData, triggers: [...currentTriggersArray, t].join(', ') });
        }
    };
    const handleRemoveTrigger = (t) => {
        setFormData({ ...formData, triggers: currentTriggersArray.filter(item => item !== t).join(', ') });
    };
    const handleCustomTriggerKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = e.target.value.trim().toLowerCase().replace(/ /g, '_');
            if (val) {
                handleAddTrigger(val);
                e.target.value = '';
            }
        }
    };

    const formattedDate = formData.last_checked_at 
        ? new Date(formData.last_checked_at).toLocaleDateString('fi-FI') 
        : 'Ei koskaan';

    return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content" style={{ maxWidth: '900px' }}>
                
                <div className="admin-modal-header">
                    <div>
                        <h2 style={{ margin: '0 0 0.25rem 0' }}>{isNew ? 'Luo uusi sähköpostilinkki' : 'Muokkaa linkkiä'}</h2>
                        {!isNew && <span className="tag tag--warning">Tarkistettu: {formattedDate}</span>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* TEKOÄLYPUTKI */}
                    <div className="smart-analysis-box" style={{ backgroundColor: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', padding: '1rem' }}>
                        <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Globe size={18} /> URL-osoite tekoälylle (Automatisoi täyttö)
                        </label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <input type="text" className="form-input" placeholder="https://..." value={urlInput} onChange={e => setUrlInput(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn" onClick={handleAIProcess} disabled={isGenerating || isSaving || !urlInput} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', display: 'flex', gap: '0.5rem' }}>
                                <Sparkles size={16} /> {isGenerating ? 'Kerätään mettä... 🌼' : 'Hae tiedot (AI) 🐝'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        
                        {/* VASEN SARAKE: Asiakasdata */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: 0, borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>1. Asiakkaalle näkyvä osuus</h4>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Otsikko (esim. Työkokeilu):</label>
                                <input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Tunniste (esim. tyokokeilu):</label>
                                <input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} disabled={!isNew} value={formData.snippet_key} onChange={e => setFormData({...formData, snippet_key: e.target.value})} />
                                {!isNew && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>Tunnistetta ei voi muuttaa luonnin jälkeen.</p>}
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Saateteksti sähköpostiin:</label>
                                <textarea className="input-field" style={{ width: '100%', padding: '0.5rem', minHeight: '80px' }} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Lyhyt kuvaus asiakkaalle..." />
                            </div>

                            {/* EROTETTU URL-KENTTÄ */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                                    <LinkIcon size={16} /> Virallinen Linkki (URL)
                                </label>
                                <input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem', color: 'var(--color-primary)' }} value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://..." />
                            </div>
                        </div>

                        {/* OIKEA SARAKE: AI ja Tagit */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: 0, borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>2. Tekoäly ja Älykkyys</h4>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--color-primary)' }}>Tekoälyn ohjeistus (ai_description):</label>
                                <textarea className="input-field" style={{ width: '100%', padding: '0.5rem', minHeight: '80px', backgroundColor: '#fffaf5', borderLeft: '3px solid var(--color-primary)' }} value={formData.ai_description} onChange={e => setFormData({...formData, ai_description: e.target.value})} placeholder="Esim: Ehdota tätä jos..." />
                            </div>

                            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                    <Info size={16} color="var(--color-text-secondary)" /> Signaalit (Sanakirjasta)
                                </label>
                                
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '38px', padding: '0.5rem', backgroundColor: '#fff', border: '1px dashed var(--color-border)', borderRadius: '4px' }}>
                                    {currentTriggersArray.length === 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.2rem' }}>Ei signaaleja...</span>}
                                    {currentTriggersArray.map((trigger, idx) => {
                                        const isTriggerNew = !triggerDictionary.includes(trigger);
                                        return (
                                            <span key={idx} className={`tag ${isTriggerNew ? 'tag--warning' : 'tag--success'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                                                {isTriggerNew && <AlertCircle size={14} />} {trigger}
                                                <button onClick={() => handleRemoveTrigger(trigger)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '0.2rem' }}>✕</button>
                                            </span>
                                        );
                                    })}
                                </div>

                                {triggerDictionary.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
                                        {triggerDictionary.filter(t => !currentTriggersArray.includes(t)).map(t => (
                                            <button key={t} onClick={() => handleAddTrigger(t)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                                + {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input type="text" className="form-input" placeholder="Kirjoita uusi..." onKeyDown={handleCustomTriggerKeyDown} style={{ fontSize: '0.85rem', padding: '0.4rem', marginTop: '0.5rem', width: '100%' }} />
                            </div>
                        </div>

                    </div>
                </div>

                <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {!isNew && (
                            !confirmDelete ? (
                                <button className="btn btn--secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => setConfirmDelete(true)} disabled={isSaving}>Poista linkki</button>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleDelete} disabled={isSaving}>Vahvista poisto</button>
                                    <button className="btn btn--secondary" onClick={() => setConfirmDelete(false)} disabled={isSaving}>Peruuta</button>
                                </div>
                            )
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {saveSuccess && <span style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '0.9rem' }}>✓ Tallennettu</span>}
                        
                        {!isNew && (
                            <button className="btn btn--secondary" onClick={() => handleSave(true)} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                                <CalendarCheck size={16} /> Tallenna ja kuittaa tarkistetuksi
                            </button>
                        )}
                        <button className="btn" onClick={() => handleSave(false)} disabled={isSaving}>
                            {isSaving ? 'Tallennetaan...' : 'Tallenna'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default InfoSnippetModal;