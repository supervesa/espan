// --- src/components/admin/ServicesAdmin.jsx ---

import React, { useState, useEffect, useRef } from 'react';
import { Compass, Sparkles, Link as LinkIcon, Save, Plus, Trash2, Info, AlertCircle, FileText, Globe, Type, Briefcase, Search, X } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const initialFormState = { 
    url: '', title: '', service_type: 'palvelu', category: 'Yleinen', description: '', plan_text: '', triggers: '',
    language_req: '', brochure_url: '', provider: '', ura_number: '', start_date: '', enrollment_deadline: '',
    esco_title: '', esco_uri: '' // UUDET ESCO-KENTÄT
};

const DEFAULT_CATEGORIES = ['Yleinen', 'Koulutus', 'Työnhaku', 'Terveys ja työkyky', 'Arjen tuki', 'Digituki'];
const CEFR_LEVELS = ['', 'A1.1', 'A1.2', 'A1.3', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1', 'C2'];

const ServicesAdmin = () => {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeService, setActiveService] = useState(null);
    const [formData, setFormData] = useState(initialFormState);
    
    const [aiMode, setAiMode] = useState('url'); 
    const [aiInput, setAiInput] = useState(''); 
    
    const [knownCategories, setKnownCategories] = useState([]);
    const [knownTriggers, setKnownTriggers] = useState([]);

    // --- ESCO-HAUN TILAMUUTTUJAT ---
    const [escoQuery, setEscoQuery] = useState('');
    const [escoResults, setEscoResults] = useState([]);
    const [isEscoSearching, setIsEscoSearching] = useState(false);
    const [showEscoDropdown, setShowEscoDropdown] = useState(false);
    const escoDropdownRef = useRef(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { 
        fetchServices(); 
        
        // Sulje ESCO-valikko jos klikataan muualle
        const handleClickOutside = (event) => {
            if (escoDropdownRef.current && !escoDropdownRef.current.contains(event.target)) {
                setShowEscoDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- ESCO API HAKU (Viiveellä, ettei EU:n palvelin tukkiudu) ---
    useEffect(() => {
        const fetchEsco = async () => {
            if (escoQuery.length < 3) {
                setEscoResults([]);
                return;
            }
            setIsEscoSearching(true);
            try {
                // Virallinen ESCO API -haku (suomeksi, vain ammatit)
                const res = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoQuery)}&language=fi&type=occupation`);
                const data = await res.json();
                if (data._embedded && data._embedded.results) {
                    setEscoResults(data._embedded.results.slice(0, 10)); // Otetaan 10 parasta tulosta
                    setShowEscoDropdown(true);
                }
            } catch (e) {
                console.error("ESCO API virhe:", e);
            } finally {
                setIsEscoSearching(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (escoQuery && !formData.esco_uri) fetchEsco();
        }, 400); // 400ms viive kirjoituksen jälkeen

        return () => clearTimeout(timeoutId);
    }, [escoQuery]);

    const handleSelectEsco = (profession) => {
        setFormData(prev => ({ ...prev, esco_title: profession.title, esco_uri: profession.uri }));
        setEscoQuery('');
        setShowEscoDropdown(false);
    };

    const handleClearEsco = () => {
        setFormData(prev => ({ ...prev, esco_title: '', esco_uri: '' }));
        setEscoQuery('');
    };
    // ----------------------------------------------------------------

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('services').select('*').order('title', { ascending: true });
            if (error) throw error;
            if (data) {
                setServices(data);
                const fetchedCats = data.map(s => s.category).filter(Boolean);
                setKnownCategories([...new Set([...DEFAULT_CATEGORIES, ...fetchedCats])]);
            }

            const { data: dictData, error: dictError } = await supabase.from('view_master_dictionary').select('*');
            if (!dictError && dictData) {
                setKnownTriggers(dictData.map(d => d.keyword));
            } else if (data) {
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
            url: service.url || '', title: service.title || '', service_type: service.service_type || 'palvelu', category: service.category || 'Yleinen',
            description: service.description || '', plan_text: service.plan_text || '', triggers: service.triggers || '',
            language_req: service.language_req || '', brochure_url: service.brochure_url || '',
            provider: service.provider || '', ura_number: service.ura_number || '', start_date: service.start_date || '', enrollment_deadline: service.enrollment_deadline || '',
            esco_title: service.esco_title || '', esco_uri: service.esco_uri || ''
        });
        setAiInput(service.url || '');
        setAiMode('url');
        setEscoQuery('');
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleCreateNew = () => {
        setActiveService('new'); setFormData(initialFormState);
        setAiInput(''); setAiMode('url'); setEscoQuery('');
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Nimi on pakollinen!");
        setIsSaving(true); setSaveSuccess(false);
        try {
            const payload = { ...formData };
            if (!payload.enrollment_deadline) payload.enrollment_deadline = null;

            if (activeService === 'new') {
                const { data, error } = await supabase.from('services').insert([payload]).select().single();
                if (error) throw error;
                setServices(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)));
                setActiveService(data.id);
            } else {
                const { data, error } = await supabase.from('services').update(payload).eq('id', activeService).select().single();
                if (error) throw error;
                setServices(prev => prev.map(s => s.id === activeService ? data : s));
            }
            fetchServices();
            setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            alert("Tallennus epäonnistui! " + error.message);
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
        if (!aiInput) return alert("Syötä kenttään sisältöä ensin!");
        setIsGenerating(true);
        try {
            const payload = { knownCategories, knownTriggers, mode: aiMode, aiInput: aiInput.trim() };

            const response = await fetch('/.netlify/functions/extract_service', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("Haku epäonnistui (Virhekoodi: " + response.status + ").");
            
            const aiData = await response.json();

            const safeTriggers = Array.isArray(aiData.triggers) ? aiData.triggers.join(', ') : (aiData.triggers || '');
            let formattedDeadline = '';
            if (aiData.enrollment_deadline) formattedDeadline = String(aiData.enrollment_deadline).substring(0, 10);

            const isUrl = aiInput.trim().startsWith('http://') || aiInput.trim().startsWith('https://');
            const finalUrl = isUrl ? aiInput.trim() : '';

            setFormData(prev => ({
                ...prev,
            url: aiMode === 'url' ? finalUrl : prev.url,
                title: aiData.title || prev.title, service_type: aiData.service_type || prev.service_type, category: aiData.category || prev.category,
                description: aiData.description || prev.description, plan_text: aiData.plan_text || prev.plan_text, triggers: safeTriggers,
                language_req: aiData.language_req || prev.language_req, brochure_url: aiData.brochure_url || prev.brochure_url,
                provider: aiData.provider || prev.provider, ura_number: aiData.ura_number || prev.ura_number, 
                start_date: aiData.start_date || prev.start_date, enrollment_deadline: formattedDeadline || prev.enrollment_deadline,
                
                // NÄMÄ KAKSI RIVIÄ PUUTTUIVAT:
                esco_title: aiData.esco_title || '',
                esco_uri: aiData.esco_uri || ''
            }));
        } catch (error) {
            alert(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const safeCurrentTriggers = Array.isArray(formData.triggers) ? formData.triggers.join(', ') : (formData.triggers || '');
    const currentTriggersArray = safeCurrentTriggers.split(',').map(t => t.trim()).filter(Boolean);

    const handleAddTrigger = (t) => {
        if (!currentTriggersArray.includes(t)) setFormData({ ...formData, triggers: [...currentTriggersArray, t].join(', ') });
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
                        {services.map(s => {
                            const isExpired = s.enrollment_deadline && new Date(s.enrollment_deadline) < new Date();
                            return (
                                <div key={s.id} className={`admin-menu-item ${activeService === s.id ? 'admin-menu-item--active' : ''}`} onClick={() => handleItemClick(s)} style={{ padding: '0.75rem 1rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', opacity: isExpired ? 0.6 : 1 }}>
                                    <div style={{ fontWeight: '600' }}>{s.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                        {s.service_type === 'koulutus' && <span style={{ color: '#b45309', fontWeight: 'bold' }}>[TVM]</span>}
                                        {s.category} {s.language_req && `• ${s.language_req}`}
                                        {isExpired && <span style={{ color: 'var(--color-danger)' }}>(Haku päättynyt)</span>}
                                    </div>
                                </div>
                            );
                        })}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
                                        <Sparkles size={18} color="#8b5cf6" /> Tuo tiedot tekoälyllä
                                    </label>
                                    <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '0.2rem' }}>
                                        <button 
                                            onClick={() => { setAiMode('url'); setAiInput(''); }} 
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: aiMode === 'url' ? '600' : 'normal', backgroundColor: aiMode === 'url' ? 'white' : 'transparent', color: aiMode === 'url' ? 'var(--color-primary)' : 'var(--color-text-secondary)', transition: 'all 0.2s', boxShadow: aiMode === 'url' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                        >
                                            <Globe size={16} /> Palvelun linkki
                                        </button>
                                        <button 
                                            onClick={() => { setAiMode('text'); setAiInput(''); }} 
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: aiMode === 'text' ? '600' : 'normal', backgroundColor: aiMode === 'text' ? '#fef3c7' : 'transparent', color: aiMode === 'text' ? '#b45309' : 'var(--color-text-secondary)', transition: 'all 0.2s', boxShadow: aiMode === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                        >
                                            <Type size={16} /> Työmarkkinatori (Teksti)
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    {aiMode === 'url' ? (
                                        <input type="text" className="form-input" placeholder="https://esimerkki.fi/palvelu" value={aiInput} onChange={(e) => setAiInput(e.target.value)} style={{ flex: 1, padding: '0.75rem' }} />
                                    ) : (
                                        <textarea className="form-input" rows="3" placeholder="Liitä koko Työmarkkinatorin ilmoituksen teksti tähän (Ctrl+A, Ctrl+C, Ctrl+V)..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} style={{ flex: 1, padding: '0.75rem', resize: 'vertical' }} />
                                    )}
                                    <button className="btn" onClick={handleAIProcess} disabled={isGenerating || !aiInput || isSaving} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
                                        {isGenerating ? 'Louhitaan... 🌼' : 'Hae tiedot 🐝'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Palvelun nimi</label>
                                        <input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} disabled={isSaving} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Tyyppi</label>
                                            <select className="modern-select" value={formData.service_type} onChange={(e) => setFormData({...formData, service_type: e.target.value})} disabled={isSaving}>
                                                <option value="palvelu">Palvelu</option>
                                                <option value="koulutus">Koulutus (TVM)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                Kategoria {isCategoryNew && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>(Uusi)</span>}
                                            </label>
                                            <select className="modern-select" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} disabled={isSaving} style={isCategoryNew ? { borderColor: 'var(--color-primary)', backgroundColor: 'rgba(255,107,0,0.05)' } : {}}>
                                                {isCategoryNew && <option value={formData.category}>{formData.category}</option>}
                                                {knownCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* UUSI ESCO AMMATTIHAKU */}
                                <div style={{ position: 'relative', zIndex: 50 }} ref={escoDropdownRef}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: formData.esco_uri ? 'var(--color-success)' : 'inherit' }}>
                                        <Briefcase size={18} /> Tavoiteammatti (ESCO)
                                    </label>
                                    
                                    {formData.esco_title ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '0.75rem', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: '600' }}>
                                                <span>✓</span> {formData.esco_title}
                                            </div>
                                            <button onClick={handleClearEsco} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', display: 'flex', alignItems: 'center' }}>
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}>
                                                <Search size={16} />
                                            </div>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="Kirjoita ammatin nimi (esim. Ohjelmistokehittäjä)..." 
                                                value={escoQuery} 
                                                onChange={(e) => setEscoQuery(e.target.value)} 
                                                onFocus={() => escoResults.length > 0 && setShowEscoDropdown(true)}
                                                style={{ paddingLeft: '2.5rem' }}
                                                disabled={isSaving}
                                            />
                                            {isEscoSearching && (
                                                <div style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                    Etsitään...
                                                </div>
                                            )}
                                            
                                            {/* ESCO Pudotusvalikko */}
                                            {showEscoDropdown && escoResults.length > 0 && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto' }}>
                                                    {escoResults.map((res, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            onClick={() => handleSelectEsco(res)}
                                                            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: idx !== escoResults.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                                                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            {res.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem', margin: '0.4rem 0 0 0' }}>
                                        Virallinen EU:n ammattiluokitus. Tekoäly pyrkii löytämään tämän automaattisesti tekstistä.
                                    </p>
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                        <LinkIcon size={16} /> Virallinen linkki palveluun (esim. www.taitotalo.fi)
                                    </label>
                                    <input type="text" className="form-input" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} disabled={isSaving} />
                                </div>

                                {formData.service_type === 'koulutus' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: '#fffbe3', padding: '1rem', borderRadius: '6px', border: '1px solid #facc15' }}>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Järjestäjä</label>
                                            <input type="text" className="form-input" value={formData.provider} onChange={(e) => setFormData({...formData, provider: e.target.value})} disabled={isSaving} placeholder="Esim. Taitotalo" />
                                        </div>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>URA-numero</label>
                                            <input type="text" className="form-input" value={formData.ura_number} onChange={(e) => setFormData({...formData, ura_number: e.target.value})} disabled={isSaving} placeholder="Esim. 712345" />
                                        </div>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Aloitusajankohta</label>
                                            <input type="text" className="form-input" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} disabled={isSaving} placeholder="Esim. Syksy 2026" />
                                        </div>
                                        <div>
                                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Hakuaika päättyy</label>
                                            <input type="date" className="form-input" value={formData.enrollment_deadline} onChange={(e) => setFormData({...formData, enrollment_deadline: e.target.value})} disabled={isSaving} />
                                        </div>
                                    </div>
                                )}

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
                                    <textarea className="form-input" rows="6" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} disabled={isSaving} />
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Asiakirjaan tulostuva teksti (Juridinen)</label>
                                    <textarea className="form-input" rows="4" style={{ borderLeft: '3px solid var(--color-primary)', backgroundColor: '#fffaf5' }} value={formData.plan_text} onChange={(e) => setFormData({...formData, plan_text: e.target.value})} disabled={isSaving} />
                                </div>

                                <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                        <Info size={16} color="var(--color-text-secondary)" /> Laukaisevat signaalit (Tagit)
                                    </label>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}>
                                        Poista huonot ehdotukset ruksilla ja klikkaa tilalle oikea olemassa oleva signaali.
                                    </p>

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

                                    {knownTriggers.length > 0 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                                                Lisää olemassa oleva signaali klikkaamalla:
                                            </span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                                                {knownTriggers.filter(t => !currentTriggersArray.includes(t)).map(t => (
                                                    <button 
                                                        key={t} onClick={() => handleAddTrigger(t)} 
                                                        style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.2s' }}
                                                    >
                                                        + {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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