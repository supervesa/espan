// --- src/components/admin/ServicesAdmin.jsx ---

import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Link as LinkIcon, Save, Plus, Trash2, Info, AlertCircle, FileText, Globe } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const initialFormState = { 
    url: '', title: '', category: 'Yleinen', description: '', plan_text: '', triggers: '',
    language_req: '', brochure_url: '' 
};

const DEFAULT_CATEGORIES = ['Yleinen', 'Koulutus', 'Työnhaku', 'Terveys ja työkyky', 'Arjen tuki', 'Digituki'];
const CEFR_LEVELS = ['', 'A1.1', 'A1.2', 'A1.3', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1', 'C2'];

const ServicesAdmin = () => {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeService, setActiveService] = useState(null);
    const [formData, setFormData] = useState(initialFormState);
    
    const [knownCategories, setKnownCategories] = useState([]);
    const [knownTriggers, setKnownTriggers] = useState([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { fetchServices(); }, []);

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('services').select('*').order('title', { ascending: true });
            if (error) throw error;
            if (data) {
                setServices(data);
                const fetchedCats = data.map(s => s.category).filter(Boolean);
                setKnownCategories([...new Set([...DEFAULT_CATEGORIES, ...fetchedCats])]);
                setKnownTriggers([...new Set(data.flatMap(s => (s.triggers || '').split(',').map(t => t.trim()).filter(Boolean)))].sort());
            }
        } catch (error) {
            console.error("Latausvirhe:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleItemClick = (service) => {
        setActiveService(service.id);
        setFormData({
            url: service.url || '', title: service.title || '', category: service.category || 'Yleinen',
            description: service.description || '', plan_text: service.plan_text || '', triggers: service.triggers || '',
            language_req: service.language_req || '', brochure_url: service.brochure_url || '' 
        });
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleCreateNew = () => {
        setActiveService('new'); setFormData(initialFormState);
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Nimi on pakollinen!");
        setIsSaving(true); setSaveSuccess(false);
        try {
            if (activeService === 'new') {
                const { data, error } = await supabase.from('services').insert([formData]).select().single();
                if (error) throw error;
                setServices(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)));
                setActiveService(data.id);
            } else {
                const { data, error } = await supabase.from('services').update(formData).eq('id', activeService).select().single();
                if (error) throw error;
                setServices(prev => prev.map(s => s.id === activeService ? data : s));
            }
            fetchServices();
            setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            alert("Tallennus epäonnistui!");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('services').delete().eq('id', activeService);
            if (error) throw error;
            setServices(prev => prev.filter(s => s.id !== activeService));
            setActiveService(null); setConfirmDelete(false); setFormData(initialFormState); fetchServices();
        } catch (error) {
            alert("Poisto epäonnistui!"); setConfirmDelete(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAIProcess = async () => {
        if (!formData.url) return alert("Syötä URL!");
        setIsGenerating(true);
        try {
            const response = await fetch('/.netlify/functions/extract_service', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: formData.url, knownCategories, knownTriggers })
            });
            if (!response.ok) throw new Error('Virhe AI-haussa');
            const aiData = await response.json();
            
            // Turvataan triggers siltä varalta, että AI palauttaa taulukon
            const safeTriggers = Array.isArray(aiData.triggers) ? aiData.triggers.join(', ') : (aiData.triggers || '');

            setFormData(prev => ({
                ...prev,
                title: aiData.title || '', category: aiData.category || 'Yleinen',
                description: aiData.description || '', plan_text: aiData.plan_text || '', triggers: safeTriggers,
                language_req: aiData.language_req || '', brochure_url: aiData.brochure_url || '' 
            }));
        } catch (error) {
            alert("Haku epäonnistui: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // TAG MANAGER -LOGIIKKA
    const safeCurrentTriggers = Array.isArray(formData.triggers) ? formData.triggers.join(', ') : (formData.triggers || '');
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
            const val = e.target.value.trim().toLowerCase().replace(/ /g, '_'); // Automuotoilu esim. "oma koti" -> "oma_koti"
            if (val) {
                handleAddTrigger(val);
                e.target.value = '';
            }
        }
    };

    const isCategoryNew = formData.category && !knownCategories.includes(formData.category);

    if (isLoading) return <div className="section-container"><p>Ladataan...</p></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
            <div className="section-container" style={{ margin: 0, padding: '1.5rem 2rem' }}>
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '0.5rem' }}>
                    <Compass size={24} color="var(--color-primary)" /> Palveluhakemiston hallinta ja AI-tuonti
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0, maxWidth: '800px' }}>
                    Tekoäly pyrkii hyödyntämään olemassa olevia kategorioita ja signaaleja. Voit helposti klikkailla signaaleja päälle tai pois estääksesi päällekkäisyyksien syntymisen tietokantaan.
                </p>
            </div>

            <div className="admin-workspace-grid" style={{ margin: 0 }}>
                <div className="admin-sidebar">
                    <button className="btn" onClick={handleCreateNew} style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} disabled={isSaving}>
                        <Plus size={18} /> Uusi palvelu
                    </button>
                    <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', marginTop: 0 }}>Aktiiviset palvelut ({services.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {services.map(s => (
                            <div key={s.id} className={`admin-menu-item ${activeService === s.id ? 'admin-menu-item--active' : ''}`} onClick={() => handleItemClick(s)} style={{ padding: '0.75rem 1rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                                <div style={{ fontWeight: '600' }}>{s.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>{s.category} {s.language_req && `• ${s.language_req}`}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-preview">
                    {!activeService ? (
                        <div className="admin-empty-state" style={{ minHeight: '500px' }}>
                            <Compass size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /> Valitse palvelu vasemmalta tai luo uusi.
                        </div>
                    ) : (
                        <div className="admin-preview-card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                            <div className="smart-analysis-box" style={{ backgroundColor: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', padding: '1.5rem', marginBottom: '2rem' }}>
                                <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-text-primary)' }}>
                                    <Globe size={18} /> Palvelun verkkosivu (URL)
                                </label>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <input type="text" className="form-input" placeholder="https://esimerkki.fi/palvelu" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} style={{ flex: 1, padding: '0.75rem' }} />
                                    <button className="btn" onClick={handleAIProcess} disabled={isGenerating || !formData.url || isSaving} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                                        <Sparkles size={16} /> {isGenerating ? 'Louhitaan...' : 'Hae tiedot (AI)'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Palvelun nimi</label>
                                        <input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} disabled={isSaving} />
                                    </div>
                                    <div>
                                        <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            Kategoria {isCategoryNew && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>(Uusi tekoälyn ehdotus)</span>}
                                        </label>
                                        <select className="modern-select" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} disabled={isSaving} style={isCategoryNew ? { borderColor: 'var(--color-primary)', backgroundColor: 'rgba(255,107,0,0.05)' } : {}}>
                                            {isCategoryNew && <option value={formData.category}>{formData.category}</option>}
                                            {knownCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <div>
                                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Kielitaitovaatimus (CEFR)</label>
                                        <select className="modern-select" value={formData.language_req} onChange={(e) => setFormData({...formData, language_req: e.target.value})} disabled={isSaving}>
                                            <option value="">Ei vaatimusta / Ei tiedossa</option>
                                            {formData.language_req && !CEFR_LEVELS.includes(formData.language_req) && <option value={formData.language_req}>{formData.language_req}</option>}
                                            {CEFR_LEVELS.filter(Boolean).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                            <FileText size={16} /> Esitteen tai liitteen URL
                                        </label>
                                        <input type="text" className="form-input" placeholder="https://.../esite.pdf" value={formData.brochure_url} onChange={(e) => setFormData({...formData, brochure_url: e.target.value})} disabled={isSaving} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Kuvaus asiantuntijalle</label>
                                    <textarea className="form-input" rows="3" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} disabled={isSaving} />
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Asiakirjaan tulostuva teksti (Juridinen)</label>
                                    <textarea className="form-input" rows="4" style={{ borderLeft: '3px solid var(--color-primary)', backgroundColor: '#fffaf5' }} value={formData.plan_text} onChange={(e) => setFormData({...formData, plan_text: e.target.value})} disabled={isSaving} />
                                </div>

                                {/* UUSI TAG MANAGER SIGNAALEILLE */}
                                <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                        <Info size={16} color="var(--color-text-secondary)" /> Laukaisevat signaalit (Tagit)
                                    </label>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}>
                                        Poista huonot ehdotukset ruksilla ja klikkaa tilalle oikea olemassa oleva signaali.
                                    </p>

                                    {/* Valitut signaalit */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '38px', padding: '0.5rem', backgroundColor: '#fff', border: '1px dashed var(--color-border)', borderRadius: '4px' }}>
                                        {currentTriggersArray.length === 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.2rem' }}>Ei valittuja signaaleja...</span>}
                                        {currentTriggersArray.map((trigger, idx) => {
                                            const isTriggerNew = !knownTriggers.includes(trigger);
                                            return (
                                                <span key={idx} className={`tag ${isTriggerNew ? 'tag--warning' : 'tag--success'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                                                    {isTriggerNew && <AlertCircle size={14} />}
                                                    {trigger} {isTriggerNew && '(Uusi)'}
                                                    <button onClick={() => handleRemoveTrigger(trigger)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '0.2rem' }}>✕</button>
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {/* Olemassa olevien signaalien valintalista */}
                                    {knownTriggers.length > 0 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                                                Lisää olemassa oleva signaali klikkaamalla:
                                            </span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {knownTriggers.filter(t => !currentTriggersArray.includes(t)).map(t => (
                                                    <button 
                                                        key={t} onClick={() => handleAddTrigger(t)} 
                                                        style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.2s' }}
                                                        onMouseOver={e => {e.target.style.borderColor='var(--color-primary)'; e.target.style.color='var(--color-primary)';}} 
                                                        onMouseOut={e => {e.target.style.borderColor='var(--color-border)'; e.target.style.color='var(--color-text-secondary)';}}
                                                    >
                                                        + {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Uuden signaalin manuaalinen lisäys */}
                                    <div>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="Kirjoita uusi signaali ja paina Enter (esim. mt_ongelmat)..." 
                                            onKeyDown={handleCustomTriggerKeyDown} 
                                            disabled={isSaving} 
                                            style={{ fontSize: '0.85rem', padding: '0.5rem' }} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', alignItems: 'center' }}>
                                <div>
                                    {activeService !== 'new' && (
                                        !confirmDelete ? (
                                            <button className="btn btn--secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => setConfirmDelete(true)} disabled={isSaving}>Poista palvelu</button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>Oletko varma?</span>
                                                <button className="btn" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleDeleteClick} disabled={isSaving}>Kyllä, poista</button>
                                                <button className="btn btn--secondary" onClick={() => setConfirmDelete(false)} disabled={isSaving}>Peruuta</button>
                                            </div>
                                        )
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {saveSuccess && <span style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '0.9rem', animation: 'fadeIn 0.3s ease-out' }}>✓ Tallennus onnistui</span>}
                                    <button className="btn" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}>
                                        <Save size={16} /> {isSaving ? 'Tallennetaan...' : 'Tallenna palvelu'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServicesAdmin;