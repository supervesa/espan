import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Compass, Sparkles, Link as LinkIcon, Save, Plus, Trash2, Info, AlertCircle, FileText, Globe, Type, Briefcase, Search, X, Check, CheckCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import AdminPanel from '../common/admin/AdminPanel';
import AdminAlert from '../common/admin/AdminAlert';
import SmartInput from '../common/admin/SmartInput';

const initialFormState = { 
    url: '', title: '', service_type: 'palvelu', category: 'Yleinen', description: '', plan_text: '', triggers: '',
    language_req: '', brochure_url: '', provider: '', ura_number: '', start_date: '', enrollment_deadline: '',
    esco_title: '', esco_uri: '', requires_referral: false, hard_service: false, meta: {}
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
    const [aiSuggestions, setAiSuggestions] = useState(null); // Tallentaa tekoälyn ehdottamat dynaamiset metasäännöt tarkistusta varten
    
    const [knownCategories, setKnownCategories] = useState([]);
    const [masterDictionary, setMasterDictionary] = useState([]);

    const [escoQuery, setEscoQuery] = useState('');
    const [escoResults, setEscoResults] = useState([]);
    const [isEscoSearching, setIsEscoSearching] = useState(false);
    const [showEscoDropdown, setShowEscoDropdown] = useState(false);
    const escoDropdownRef = useRef(null);

    const [newMetaKey, setNewMetaKey] = useState('');
    const [newMetaValue, setNewMetaValue] = useState('');
    const [newMetaType, setNewMetaType] = useState('boolean');

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { 
        fetchServices(); 
        const handleClickOutside = (event) => {
            if (escoDropdownRef.current && !escoDropdownRef.current.contains(event.target)) {
                setShowEscoDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchEsco = async () => {
            if (escoQuery.length < 3) {
                setEscoResults([]);
                return;
            }
            setIsEscoSearching(true);
            try {
                const res = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoQuery)}&language=fi&type=occupation`);
                const data = await res.json();
                if (data._embedded && data._embedded.results) {
                    setEscoResults(data._embedded.results.slice(0, 10));
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
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [escoQuery, formData.esco_uri]);

    const handleSelectEsco = (profession) => {
        setFormData(prev => ({ ...prev, esco_title: profession.title, esco_uri: profession.uri }));
        setEscoQuery('');
        setShowEscoDropdown(false);
    };

    const handleClearEsco = () => {
        setFormData(prev => ({ ...prev, esco_title: '', esco_uri: '' }));
        setEscoQuery('');
    };

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

            const { data: dictData, error: dictError } = await supabase.from('view_master_dictionary').select('keyword, label, category, description');
            if (!dictError && dictData) {
                setMasterDictionary(dictData);
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
            esco_title: service.esco_title || '', esco_uri: service.esco_uri || '',
            requires_referral: service.requires_referral || false,
            hard_service: service.hard_service || false,
            meta: service.meta || {}
        });
        setAiInput(service.url || '');
        setAiMode('url');
        setAiSuggestions(null);
        setEscoQuery('');
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleCreateNew = () => {
        setActiveService('new'); setFormData(initialFormState);
        setAiInput(''); setAiMode('url'); setEscoQuery(''); setAiSuggestions(null);
        setConfirmDelete(false); setSaveSuccess(false);
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Nimi on pakollinen!");
        setIsSaving(true); setSaveSuccess(false);
        try {
            const payload = { ...formData };
            if (!payload.enrollment_deadline) payload.enrollment_deadline = null;
            
            // TVM Saari-turvasääntö tallennuksessa
            if (payload.service_type === 'koulutus') {
                payload.hard_service = false;
                payload.requires_referral = false;
            }

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
        setIsGenerating(true); setAiSuggestions(null);
        try {
            const knownTriggers = masterDictionary.map(d => ({
                keyword: d.keyword,
                label: d.label || d.keyword,
                description: d.description || ''
            }));
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

            // Päivitetään standardikentät lomakkeeseen
            setFormData(prev => ({
                ...prev,
                url: aiMode === 'url' ? finalUrl : prev.url,
                title: aiData.title || prev.title, 
                service_type: aiData.service_type || prev.service_type, 
                category: aiData.category || prev.category,
                description: aiData.description || prev.description, 
                plan_text: aiData.plan_text || prev.plan_text, 
                triggers: safeTriggers,
                language_req: aiData.language_req || prev.language_req, 
                brochure_url: aiData.brochure_url || prev.brochure_url,
                provider: aiData.provider || prev.provider, 
                ura_number: aiData.ura_number || prev.ura_number, 
                start_date: aiData.start_date || prev.start_date, 
                enrollment_deadline: formattedDeadline || prev.enrollment_deadline,
                esco_title: aiData.esco_title || '', 
                esco_uri: aiData.esco_uri || '',
                // Jos ei ole TVM, otetaan liput vastaan valmiiksi muistiin tarkistusta varten
                requires_referral: aiData.service_type === 'koulutus' ? false : (aiData.requires_referral || false),
                hard_service: aiData.service_type === 'koulutus' ? false : (aiData.hard_service || false)
            }));

            // Jos tekoäly keksi dynaamisia metasääntöjä, asetetaan ne tarkistusjonoon
            if (aiData.meta && Object.keys(aiData.meta).length > 0 && aiData.service_type !== 'koulutus') {
                setAiSuggestions(aiData.meta);
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // --- DYNAAMINEN META EDITOR (JSONB Hallinta ilman kovakoodausta) ---
    const handleAddCustomMeta = () => {
        if (!newMetaKey.trim()) return alert("Avain ei voi olla tyhjä");
        const key = newMetaKey.trim().toLowerCase().replace(/ /g, '_');
        let value = newMetaType === 'boolean' ? (newMetaValue === 'true') : newMetaValue.trim();

        setFormData(prev => ({
            ...prev,
            meta: { ...prev.meta, [key]: value }
        }));
        setNewMetaKey(''); setNewMetaValue('');
    };

    const handleRemoveMetaKey = (key) => {
        const updatedMeta = { ...formData.meta };
        delete updatedMeta[key];
        setFormData(prev => ({ ...prev, meta: updatedMeta }));
    };

    const handleAcceptAiMeta = (key, value) => {
        setFormData(prev => ({
            ...prev,
            meta: { ...prev.meta, [key]: value }
        }));
        const updatedSuggestions = { ...aiSuggestions };
        delete updatedSuggestions[key];
        setAiSuggestions(Object.keys(updatedSuggestions).length > 0 ? updatedSuggestions : null);
    };

    const handleRejectAiMeta = (key) => {
        const updatedSuggestions = { ...aiSuggestions };
        delete updatedSuggestions[key];
        setAiSuggestions(Object.keys(updatedSuggestions).length > 0 ? updatedSuggestions : null);
    };
    // ------------------------------------------------------------------

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
    const isTvmIsland = formData.service_type === 'koulutus';

    const groupedDictionary = useMemo(() => {
        const groups = {};
        masterDictionary.forEach(item => {
            if (currentTriggersArray.includes(item.keyword)) return;
            const cat = item.category || 'Muu (Luokittelematon)';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [masterDictionary, currentTriggersArray]);

    if (isLoading) return <div className="section-container"><p>Ladataan hallintajärjestelmää...</p></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
            <div className="section-container" style={{ margin: 0, padding: '1.5rem 2rem' }}>
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '0.5rem' }}>
                    <Compass size={24} color="var(--color-primary)" /> Palveluhakemiston hallinta ja AI-tuonti
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0, maxWidth: '800px' }}>
                    Hallitse dynaamisesti palveluita, lainsäädännöllisiä lähetevaatimuksia, sekä suoraan tekoälyltä louhittuja tai manuaalisesti määriteltyjä metasääntöjä.
                </p>
            </div>

            <div className="admin-workspace-grid" style={{ margin: 0 }}>
                {/* VASEN SIVUPALKKI */}
                <div className="admin-sidebar">
                    <button className="btn" onClick={handleCreateNew} style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} disabled={isSaving}>
                        <Plus size={18} /> Uusi palvelu
                    </button>
                    <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', marginTop: 0 }}>Aktiiviset palvelut ({services.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {services.map(s => {
                            const isExpired = s.enrollment_deadline && new Date(s.enrollment_deadline) < new Date();
                            return (
                                <div key={s.id} className={`admin-menu-item ${activeService === s.id ? 'admin-menu-item--active' : ''}`} onClick={() => handleItemClick(s)} style={{ opacity: isExpired ? 0.6 : 1 }}>
                                    <div style={{ fontWeight: '600' }}>{s.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                        {s.service_type === 'koulutus' && <span style={{ color: '#b45309', fontWeight: 'bold' }}>[TVM]</span>}
                                        {s.category} {s.language_req && `• ${s.language_req}`}
                                        {s.hard_service && <span style={{ color: 'var(--color-danger)' }}>• Velvoittava</span>}
                                        {s.requires_referral && <span style={{ color: 'var(--color-success)' }}>• Lähete</span>}
                                        {isExpired && <span style={{ color: 'var(--color-danger)' }}>(Haku päättynyt)</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* OIKEA TYÖTILA */}
                <div className="admin-preview">
                    {!activeService ? (
                        <div className="admin-empty-state" style={{ minHeight: '500px' }}>
                            <Compass size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /> Valitse palvelu vasemmalta muokataksesi sitä tai aloita uusi luonnos.
                        </div>
                    ) : (
                        <div className="admin-preview-card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                            
                            {/* TEKOÄLYN TUONTILAATIKKO */}
                            <div className="smart-analysis-box" style={{ backgroundColor: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', padding: '1.5rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
                                        <Sparkles size={18} color="#8b5cf6" /> Tuo tiedot ja metasäännöt automaattisesti tekoälyllä
                                    </label>
                                    <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '0.2rem' }}>
                                        <button onClick={() => { setAiMode('url'); setAiInput(''); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: aiMode === 'url' ? '600' : 'normal', backgroundColor: aiMode === 'url' ? 'white' : 'transparent', color: aiMode === 'url' ? 'var(--color-primary)' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}>
                                            <Globe size={16} /> Palvelun linkki
                                        </button>
                                        <button onClick={() => { setAiMode('text'); setAiInput(''); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: aiMode === 'text' ? '600' : 'normal', backgroundColor: aiMode === 'text' ? '#fef3c7' : 'transparent', color: aiMode === 'text' ? '#b45309' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}>
                                            <Type size={16} /> Työmarkkinatorin teksti (TVM)
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    {aiMode === 'url' ? (
                                        <input type="text" className="form-input" placeholder="https://esimerkki.fi/palvelun-osoite" value={aiInput} onChange={(e) => setAiInput(e.target.value)} style={{ flex: 1, padding: '0.75rem' }} />
                                    ) : (
                                        <textarea className="form-input" rows="3" placeholder="Liitä koko Työmarkkinatorin teksti tähän. Järjestelmä eristää tämän automaattisesti omaksi TVM-koulutussaarekseen..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} style={{ flex: 1, padding: '0.75rem', resize: 'vertical' }} />
                                    )}
                                    <button className="btn-ai" onClick={handleAIProcess} disabled={isGenerating || !aiInput || isSaving} style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
                                        {isGenerating ? 'Louhitaan sääntöjä... ✨' : 'Hae ja analysoi'}
                                    </button>
                                </div>
                            </div>

                            {/* TEKOÄLYN EHDOTTAMAT METASÄÄNNÖT (TARKISTUSJONO) */}
                            {aiSuggestions && (
                                <div className="suggestions-container" style={{ margin: '0 0 2rem 0' }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-ai)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Sparkles size={16} /> Tekoälyn löytämät dynaamiset reuna-ehdot (Vahvista Meta-kenttään):
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>Seuraavat säännöt havaittiin analysoidussa tekstissä. Hyväksy ne osaksi palvelun dynaamista DNA:ta:</p>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {Object.entries(aiSuggestions).map(([key, value]) => (
                                            <li key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid var(--color-ai-border)', borderRadius: '6px', marginBottom: '0.5rem', backgroundColor: '#fafafa' }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                                    <strong>{key}</strong>: <span style={{ color: typeof value === 'boolean' ? 'var(--color-primary)' : 'inherit' }}>{String(value)}</span>
                                                </span>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', backgroundColor: 'var(--color-success)' }} onClick={() => handleAcceptAiMeta(key, value)}><Check size={14} /></button>
                                                    <button className="btn btn--secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleRejectAiMeta(key)}><X size={14} /></button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* STANDARDILOMAKE RAKENNE-KOMPONENTEILLA */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <SmartInput label="Palvelun tai koulutuksen virallinen nimi" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} disabled={isSaving} />
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <SmartInput label="Järjestelmätyyppi" type="select" value={formData.service_type} onChange={(e) => setFormData({...formData, service_type: e.target.value})} disabled={isSaving} options={[{ value: 'palvelu', label: 'Muu palvelu' }, { value: 'koulutus', label: 'Työvoimakoulutus (TVM)' }]} />
                                        <SmartInput label="Kategoria" type="select" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} disabled={isSaving} options={knownCategories.map(cat => ({ value: cat, label: cat }))} className={isCategoryNew ? 'panel-ai-edu' : ''} />
                                    </div>
                                </div>

                                {/* TYÖVOIMAKOULUTUS-SAARI (ERISTETTY REUNAEHTO ALUE) */}
                                {isTvmIsland ? (
                                    <div className="panel-gray" style={{ margin: 0, backgroundColor: 'rgba(255, 176, 32, 0.03)', borderColor: 'rgba(255, 176, 32, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 'bold', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                            <ShieldAlert size={18} /> Työvoimakoulutuksen (TVM) juridiset reuna-ehdot aktivoitu
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            <SmartInput label="Koulutuksen järjestäjä / Oppilaitos" value={formData.provider} onChange={(e) => setFormData({...formData, provider: e.target.value})} disabled={isSaving} placeholder="Esim. Stadin AO, Taitotalo" />
                                            <SmartInput label="Virallinen URA-numero" value={formData.ura_number} onChange={(e) => setFormData({...formData, ura_number: e.target.value})} disabled={isSaving} placeholder="6-numeroinen koodi" mono />
                                            <SmartInput label="Aloitusajankohta" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} disabled={isSaving} placeholder="Esim. 11.8.2026" />
                                            <SmartInput label="Viimeinen hakupäivä" type="date" value={formData.enrollment_deadline} onChange={(e) => setFormData({...formData, enrollment_deadline: e.target.value})} disabled={isSaving} />
                                        </div>
                                    </div>
                                ) : (
                                    /* TAVALLISEN PALVELUN LAKISÄÄTEISET KYTKIMET (PIILOTETTU TVM-SAARELTA) */
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <AdminPanel title="Lakisääteinen ohjausvelvoite" variant="bordered" style={{ borderColor: 'var(--color-danger)' }}>
                                            <label className="modern-checkbox-label" style={{ border: formData.hard_service ? '1px solid var(--color-danger)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: formData.hard_service ? 'rgba(227,74,74,0.02)' : 'transparent' }}>
                                                <input type="checkbox" className="modern-checkbox" checked={formData.hard_service} onChange={(e) => setFormData({...formData, hard_service: e.target.checked})} disabled={isSaving} />
                                                <div>
                                                    <strong>Aseta velvoittavaksi (hard_service)</strong>
                                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>Laukaisee työttömyysturvalain mukaiset seuraamustekstit asiakirjaan sekä mahdollisuuden alentaa THV-määrää nollaan.</p>
                                                </div>
                                            </label>
                                        </AdminPanel>

                                        <AdminPanel title="Ammattilaisen tilaus / Lähetevaatimus" variant="bordered" style={{ borderColor: 'var(--color-success)' }}>
                                            <label className="modern-checkbox-label" style={{ border: formData.requires_referral ? '1px solid var(--color-success)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: formData.requires_referral ? 'rgba(30,154,90,0.02)' : 'transparent' }}>
                                                <input type="checkbox" className="modern-checkbox" checked={formData.requires_referral} onChange={(e) => setFormData({...formData, requires_referral: e.target.checked})} disabled={isSaving} />
                                                <div>
                                                    <strong>Vaatii asiantuntijan lähetteen</strong>
                                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>Avaa työkaluun automaattisen monialaisen läheteikkunan, joka imee pohjaksi 33 §:n edellytysten arviointiraaka-tekstin.</p>
                                                </div>
                                            </label>
                                        </AdminPanel>
                                    </div>
                                )}

                                {/* ESCO AMMATTILUOKITUS */}
                                <AdminPanel title="Tavoiteammatti (ESCO-luokitus)" icon={<Briefcase size={18} />}>
                                    {formData.esco_title ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '0.75rem', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: '600', fontSize: '0.85rem' }}>
                                                <span>✓</span> Kytketty ammattikoodiin: {formData.esco_title}
                                            </div>
                                            <button onClick={handleClearEsco} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}><Search size={16} /></div>
                                            <input type="text" className="form-input" placeholder="Hae EU-ammattinimikettä kytkeäksesi palvelun ammattiryhmään (esim. laitoshuoltaja)..." value={escoQuery} onChange={(e) => setEscoQuery(e.target.value)} onFocus={() => escoResults.length > 0 && setShowEscoDropdown(true)} style={{ paddingLeft: '2.5rem' }} disabled={isSaving} />
                                            {isEscoSearching && <div style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>Etsitään...</div>}
                                            {showEscoDropdown && escoResults.length > 0 && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto', zIndex: 100 }}>
                                                    {escoResults.map((res, idx) => (
                                                        <div key={idx} onClick={() => handleSelectEsco(res)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>{res.title}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </AdminPanel>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <SmartInput label="Kielitaitovaatimus (CEFR)" type="select" value={formData.language_req} onChange={(e) => setFormData({...formData, language_req: e.target.value})} disabled={isSaving} options={CEFR_LEVELS.map(lvl => ({ value: lvl, label: lvl || 'Ei erillistä vaatimusta (Oletus: Natiivi)' }))} />
                                    <SmartInput label="Esitteen tai liitetiedoston suora URL" value={formData.brochure_url} onChange={(e) => setFormData({...formData, brochure_url: e.target.value})} disabled={isSaving} placeholder="https://palvelumanuaali.fi/esite.pdf" />
                                </div>

                                <SmartInput label="Virallinen manuaalilinkki lisätietoihin" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} disabled={isSaving} placeholder="https://tyollisyys.palvelumanuaali.fi/palvelu/..." />

                                <SmartInput label="Kuvaus asiantuntijalle (Sisäinen ohje)" type="textarea" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} disabled={isSaving} />

                                <SmartInput label="Asiakirjaan ja työllistymissuunnitelmaan tulostuva teksti (Juridinen päätös)" type="textarea" value={formData.plan_text} onChange={(e) => setFormData({...formData, plan_text: e.target.value})} disabled={isSaving} className="panel-ai-work" />

                                {/* --- TÄYSIN DYNAAMINEN META-KENTÄN EDITOR (JSONB) --- */}
                                {!isTvmIsland && (
                                    <AdminPanel title="Täydentävät dynaamiset reuna-ehdot ja metasäännöt (JSONB)" icon={<Info size={18} />}>
                                        <p style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>Määrittele vapaasti uusia reuna-ehtoja ilman tietokantamuutoksia. Nämä ohjaavat älykästä suosittelua taustalla.</p>
                                        
                                        {/* Nykyiset avaimet */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                            {Object.entries(formData.meta || {}).map(([key, value]) => (
                                                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                                        <strong style={{ color: 'var(--color-primary)' }}>{key}</strong>: {String(value)}
                                                    </span>
                                                    <button className="btn-clear" onClick={() => handleRemoveMetaKey(key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Poista sääntö</button>
                                                </div>
                                            ))}
                                            {Object.keys(formData.meta || {}).length === 0 && (
                                                <span style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Ei asetettuja erikoissääntöjä.</span>
                                            )}
                                        </div>

                                        {/* Uuden avaimen lisäys */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', gap: '1rem', alignItems: 'end', backgroundColor: '#fafafa', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Säännön avain (meta_key)</label>
                                                <input type="text" className="form-input" placeholder="esim. etäopetus" value={newMetaKey} onChange={(e) => setNewMetaKey(e.target.value)} style={{ marginTop: '0.25rem' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tietotyyppi</label>
                                                <select className="modern-select" value={newMetaType} onChange={(e) => { setNewMetaType(e.target.value); setNewMetaValue(e.target.value === 'boolean' ? 'true' : ''); }} style={{ marginTop: '0.25rem' }}>
                                                    <option value="boolean">Kyllä/Ei (Boolean)</option>
                                                    <option value="string">Teksti (String)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Arvo</label>
                                                {newMetaType === 'boolean' ? (
                                                    <select className="modern-select" value={newMetaValue} onChange={(e) => setNewMetaValue(e.target.value)} style={{ marginTop: '0.25rem' }}>
                                                        <option value="true">True (Kyllä)</option>
                                                        <option value="false">False (Ei)</option>
                                                    </select>
                                                ) : (
                                                    <input type="text" className="form-input" placeholder="Vapaa arvo" value={newMetaValue} onChange={(e) => setNewMetaValue(e.target.value)} style={{ marginTop: '0.25rem' }} />
                                                )}
                                            </div>
                                            <button className="btn" onClick={handleAddCustomMeta} style={{ padding: '0.5rem' }}>Lisää</button>
                                        </div>
                                    </AdminPanel>
                                )}

                                {/* SIGNAALIT / TAGIT HALLINTA */}
                                <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <Info size={18} color="var(--color-text-secondary)" /> Laukaisevat signaalit ja kytkennät
                                    </label>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem 0' }}>
                                        Yhdistä palvelu järjestelmän globaaleihin signaaleihin. Palvelu nousee älykkäästi suosituksi asiantuntijalle, kun nämä ehdot täyttyvät.
                                    </p>

                                    <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Aktiiviset kytkennät tässä palvelussa:</h5>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem', minHeight: '48px', padding: '0.75rem', backgroundColor: '#fff', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>
                                        {currentTriggersArray.length === 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Ei kytkettyjä signaaleja. Palvelu vaatii käsihakua.</span>}
                                        {currentTriggersArray.map((trigger, idx) => {
                                            const dictItem = masterDictionary.find(d => d.keyword === trigger);
                                            return (
                                                <span key={idx} title={dictItem?.description || trigger} className={`tag ${!dictItem ? 'tag--warning' : 'tag--success'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                                                    <span style={{ fontWeight: '600' }}>{dictItem?.label || trigger}</span>
                                                    <button onClick={() => handleRemoveTrigger(trigger)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: '0 0 0 0.4rem', marginLeft: '0.2rem', borderLeft: '1px solid currentColor', opacity: 0.7 }}><X size={14} /></button>
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {Object.keys(groupedDictionary).length > 0 && (
                                        <div style={{ padding: '1rem', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '600', display: 'block', marginBottom: '1rem' }}>Klikkaa signaali valituksi:</span>
                                            {Object.entries(groupedDictionary).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                                                <div key={category} style={{ marginBottom: '1.25rem' }}>
                                                    <h6 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem 0' }}>{category}</h6>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {items.map(item => (
                                                            <button key={item.keyword} onClick={() => handleAddTrigger(item.keyword)} title={item.description || item.keyword} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-text-primary)' }}>+ {item.label || item.keyword}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ marginTop: '1rem' }}>
                                        <input type="text" className="form-input" placeholder="Kirjoita uusi vapaa raaka-avain (esim. asunnottomuus_riski) ja paina Enter luodaksesi uuden kytkennän lennossa..." onKeyDown={handleCustomTriggerKeyDown} disabled={isSaving} style={{ fontSize: '0.85rem', padding: '0.75rem' }} />
                                    </div>
                                </div>
                            </div>

                            {/* ALALIDAN TALLENNUS/POISTO-PAINIKKEET */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', alignItems: 'center' }}>
                                <div>
                                    {activeService !== 'new' && (
                                        !confirmDelete ? (
                                            <button className="btn btn--secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => setConfirmDelete(true)} disabled={isSaving}>Poista palvelu hakemistosta</button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>Vahvistatko poiston?</span>
                                                <button className="btn" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleDeleteClick} disabled={isSaving}>Kyllä, poista</button>
                                                <button className="btn btn--secondary" onClick={() => setConfirmDelete(false)} disabled={isSaving}>Peruuta</button>
                                            </div>
                                        )
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {saveSuccess && <span style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '0.9rem' }}>✓ Muutokset tallennettu onnistuneesti kantaan</span>}
                                    <button className="btn" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}>
                                        <Save size={16} /> {isSaving ? 'Tallennetaan...' : 'Tallenna palvelutiedot'}
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