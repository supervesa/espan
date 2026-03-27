// --- src/components/sections/UraAnalyzerModal.jsx ---

import React, { useState, useEffect } from 'react';
import { X, Wand2, FileText, Briefcase, Tag, Check, AlertCircle, Loader2, Info, GraduationCap } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const UraAnalyzerModal = ({ isOpen, onClose, actions }) => {
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // AI:n palauttamat erilliset laatikot
    const [workDraft, setWorkDraft] = useState('');
    const [eduDraft, setEduDraft] = useState('');
    const [escoProfession, setEscoProfession] = useState('');
    const [activeTriggers, setActiveTriggers] = useState([]);
    
    const [knownTriggers, setKnownTriggers] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchDictionary();
            setStep(1); setRawData(''); setWorkDraft(''); setEduDraft(''); setEscoProfession(''); setActiveTriggers([]); setError(null);
        }
    }, [isOpen]);

    const fetchDictionary = async () => {
        try {
            const { data, error } = await supabase.from('view_master_dictionary').select('keyword');
            if (data && !error) setKnownTriggers(data.map(d => d.keyword));
        } catch (err) {
            console.error("Sanakirjan lataus epäonnistui:", err);
        }
    };

    const anonymizeData = (text) => {
        let clean = text;
        clean = clean.replace(/\b\d{6}[A-Y+-]\d{3}[A-Z0-9]\b/gi, '[HETU]');
        clean = clean.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (match, d, m, y) => `${m.padStart(2, '0')}/${y}`);
        return clean;
    };

    const handleAnalyze = async () => {
        if (!rawData.trim()) return setError("Syötä URA-historia ensin.");
        setError(null);
        setIsAnalyzing(true);

        const safeData = anonymizeData(rawData);

        try {
            const response = await fetch('/.netlify/functions/analyze_ura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: safeData, knownTriggers })
            });

            if (!response.ok) throw new Error("Aivoissa ruuhkaa. Yritä hetken kuluttua uudelleen.");

            const aiData = await response.json();
            
            // Jaetaan data kahteen erilliseen laatikkoon
            setWorkDraft(aiData.tyohistoria || '');
            setEduDraft(aiData.koulutushistoria || '');
            
            setEscoProfession(aiData.esco_ammatti || '');
            setActiveTriggers(aiData.loydetyt_triggerit || []);
            setStep(2); 
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAccept = async () => {
        setIsSaving(true);
        try {
            // 1. Ammutaan työtilanne suoraan nykyiselle välilehdelle
            if (workDraft) {
                actions.onUpdateCustomText('tyotilanne', workDraft);
            }

            // 2. Ammutaan koulutus valmiiksi omalle välilehdelleen odottamaan (AI-koulutushistoria-avaimella)
            if (eduDraft) {
                actions.onUpdateCustomText('ai_koulutushistoria', eduDraft);
            }

            // 3. Täpätään triggerit
            activeTriggers.forEach(trigger => {
                actions.onUpdateVariable('tyotilanne', trigger, true);
            });

            // 4. ESCO-virallistaminen
            if (escoProfession) {
                const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoProfession)}&language=fi&type=occupation`);
                const escoJson = await escoRes.json();
                if (escoJson._embedded && escoJson._embedded.results && escoJson._embedded.results.length > 0) {
                    const uri = escoJson._embedded.results[0].uri;
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_uri', uri);
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_nimi', escoJson._embedded.results[0].title);
                }
            }

            onClose(); 
        } catch (err) {
            setError("Tietojen siirrossa tapahtui virhe.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease-out' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                        <Wand2 size={20} /> Työ- ja palveluhistorian AI-analyysi
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {error && (
                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div>
                            <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                <FileText size={16} /> Liitä URA-historia tähän
                            </label>
                            <textarea 
                                className="form-input" 
                                rows="12" 
                                placeholder="Kopioi asiakkaan palvelu-, koulutus- tai työhistoria suoraan URA-järjestelmästä ja liitä tähän (Ctrl+V)..."
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                disabled={isAnalyzing}
                                style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Info size={14} /> Järjestelmä anonymisoi HETUt ja tarkat päivämäärät selaimessa ennen tekoälylle lähettämistä.
                            </p>
                        </div>
                    )}

                    {step === 2 && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Työhistoria -laatikko */}
                                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                                        <Briefcase size={16} /> Työ- ja palveluhistoria
                                    </label>
                                    <textarea 
                                        className="form-input" 
                                        rows="8" 
                                        value={workDraft}
                                        onChange={(e) => setWorkDraft(e.target.value)}
                                        style={{ borderLeft: '3px solid var(--color-primary)' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>Tämä siirretään Työtilanne-välilehdelle.</p>
                                </div>

                                {/* Koulutushistoria -laatikko */}
                                <div style={{ backgroundColor: '#fffbe3', padding: '1rem', borderRadius: '6px', border: '1px solid #facc15' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: '#b45309' }}>
                                        <GraduationCap size={16} /> Suoritetut tutkinnot ja kortit
                                    </label>
                                    <textarea 
                                        className="form-input" 
                                        rows="8" 
                                        value={eduDraft}
                                        onChange={(e) => setEduDraft(e.target.value)}
                                        style={{ borderLeft: '3px solid #f59e0b' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.4rem' }}>Tämä siirretään suoraan Koulutus-välilehdelle!</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1rem' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                                        <Briefcase size={16} color="#059669" /> Tunnistettu tavoiteammatti (ESCO)
                                    </label>
                                    {escoProfession ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.4rem 0.8rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '500', border: '1px solid #a7f3d0' }}>
                                            {escoProfession}
                                            <button onClick={() => setEscoProfession('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Ei tunnistettu selkeää ammattia.</span>
                                    )}
                                </div>

                                <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1rem' }}>
                                    <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                                        <Tag size={16} color="#2563eb" /> Automaattisesti täpättävät signaalit
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {activeTriggers.length > 0 ? activeTriggers.map((trigger, idx) => (
                                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #bfdbfe' }}>
                                                {trigger}
                                                <button onClick={() => setActiveTriggers(prev => prev.filter(t => t !== trigger))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={12} /></button>
                                            </span>
                                        )) : (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Ei tunnistettuja signaaleja.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f8fafc', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <button className="btn btn--secondary" onClick={onClose} disabled={isAnalyzing || isSaving}>
                        Peruuta
                    </button>
                    
                    {step === 1 ? (
                        <button className="btn" onClick={handleAnalyze} disabled={isAnalyzing || !rawData.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-primary)' }}>
                            {isAnalyzing ? <><Loader2 size={16} className="animate-spin" /> Analysoidaan...</> : <><Wand2 size={16} /> Pura ja jäsennä historia</>}
                        </button>
                    ) : (
                        <button className="btn" onClick={handleAccept} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#059669', borderColor: '#059669' }}>
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Siirretään...</> : <><Check size={16} /> Hyväksy ja siirrä suunnitelmaan</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UraAnalyzerModal;