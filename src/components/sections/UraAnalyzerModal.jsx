// --- src/components/sections/UraAnalyzerModal.jsx ---
import React, { useState, useEffect } from 'react';
import { X, Wand2, FileText, Briefcase, Tag, Check, AlertCircle, Loader2, Info, GraduationCap, CalendarClock } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const UraAnalyzerModal = ({ isOpen, onClose, actions, state }) => {
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // AI-tilat
    const [workDraft, setWorkDraft] = useState('');
    const [eduDraft, setEduDraft] = useState('');
    const [tkDraft, setTkDraft] = useState(''); 
    
    // UUDET: ESCO ja Koulutusideat
    const [escoProfession, setEscoProfession] = useState('');
    const [altProfessions, setAltProfessions] = useState([]);
    const [selectedAltProfessions, setSelectedAltProfessions] = useState([]);
    const [educationIdeas, setEducationIdeas] = useState([]);
    
    const [activeTriggers, setActiveTriggers] = useState([]);
    const [knownTriggers, setKnownTriggers] = useState([]);
    
    const [isStudent, setIsStudent] = useState(false);
    const [isEntrepreneur, setIsEntrepreneur] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDictionary();
            setStep(1); setRawData(''); setWorkDraft(''); setEduDraft(''); setTkDraft(''); 
            setEscoProfession(''); setAltProfessions([]); setSelectedAltProfessions([]); setEducationIdeas([]);
            setActiveTriggers([]); setError(null);
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
        setError(null); setIsAnalyzing(true);

        const safeData = anonymizeData(rawData);

        try {
            const response = await fetch('/.netlify/functions/analyze_ura', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: safeData, knownTriggers })
            });

            if (!response.ok) throw new Error("Aivoissa ruuhkaa. Yritä hetken kuluttua uudelleen.");

            const aiData = await response.json();
            setWorkDraft(aiData.tyohistoria || '');
            setEduDraft(aiData.koulutushistoria || '');
            setTkDraft(aiData.tyokokeilut_pvm || ''); 
            
            // UUDET KENTÄT BACKENDISTÄ (kun se päivitetään)
            setEscoProfession(aiData.esco_ammatti || '');
            setAltProfessions(aiData.vaihtoehtoiset_ammatit || []);
            setEducationIdeas(aiData.koulutusehdotukset || []);
            
            setActiveTriggers(aiData.loydetyt_triggerit || []);
            setIsStudent(aiData.nykyinen_opiskelija === true);
            setIsEntrepreneur(aiData.nykyinen_yrittaja === true);
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
            // 1. Tekstien rakennus Työtilanteeseen (Ensin työhistoria, sitten ammatit)
            let tyotilanneLisatiedot = state['custom-tyotilanne'] || '';
            let aiKoonti = '';

            // A) Työhistoria ensin
            if (workDraft) {
                aiKoonti = workDraft;
            }

            // B) Sitten ESCO-pääammatti ja vaihtoehdot
            if (escoProfession) {
                let escoSentence = `Asiakkaan tavoiteammattina on ${escoProfession.toLowerCase()}.`;
                
                if (selectedAltProfessions.length > 0) {
                    const altText = selectedAltProfessions.join(' ja ');
                    escoSentence += ` Asiakkaalla on kiinnostusta myös seuraaviin aloihin: ${altText.toLowerCase()}.`;
                }
                
                aiKoonti = aiKoonti ? `${aiKoonti}\n\n${escoSentence}` : escoSentence;
            }

            // Yhdistetään olemassa olevaan tekstiin
            if (aiKoonti) {
                tyotilanneLisatiedot = tyotilanneLisatiedot ? `${tyotilanneLisatiedot}\n\n${aiKoonti}` : aiKoonti;
                actions.onUpdateCustomText('tyotilanne', tyotilanneLisatiedot);
            }

            if (eduDraft) actions.onUpdateCustomText('ai_koulutushistoria', eduDraft);
            
            // 2. Koulutusideat piiloon odottamaan Koulutus-välilehteä
            if (educationIdeas.length > 0) {
                actions.onUpdateCustomText('ai_koulutus_ideat', JSON.stringify(educationIdeas));
            }
            
            // 3. Työkokeilut Palkkatukilaskuriin
            if (tkDraft) {
                if (typeof actions.onUpdatePalkkatuki === 'function') {
                    actions.onUpdatePalkkatuki('tyokokeilu_historia', tkDraft);
                } else {
                    actions.onUpdateVariable('palkkatuki', 'tyokokeilu_historia', tkDraft);
                }
            }

            // 4. Triggerit
            activeTriggers.forEach(trigger => {
                actions.onUpdateVariable('tyotilanne', trigger, true);
                if (typeof actions.updateSignal === 'function') actions.updateSignal(trigger, true);
                if (typeof actions.onAddSignal === 'function') actions.onAddSignal(trigger); 
            });

            // 5. Virallinen ESCO-ammatti (Vain pääammatti menee tilastoihin)
            if (escoProfession) {
                const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoProfession)}&language=fi&type=occupation`);
                const escoJson = await escoRes.json();
                
                let uri = '';
                let title = escoProfession; 
                
                if (escoJson._embedded && escoJson._embedded.results && escoJson._embedded.results.length > 0) {
                    uri = escoJson._embedded.results[0].uri;
                    title = escoJson._embedded.results[0].title;
                }

                if (typeof actions.onUpdateAsiakas === 'function') {
                    actions.onUpdateAsiakas('tavoiteammatti_esco_uri', uri);
                    actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', title);
                } else {
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_uri', uri);
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_nimi', title); 
                }
            }

            // --- 6. UUSI: SILTA TYÖTTÖMYYSTURVAAN (Tämä on nyt oikeassa paikassa!) ---
            if (isStudent || isEntrepreneur) {
                if (typeof actions.onUpdateTyottomyysturva === 'function') {
                    if (isStudent) {
                        actions.onUpdateTyottomyysturva('updateKysymys', { id: 'opiskelija', value: true });
                        actions.onUpdateTyottomyysturva('ai_tunnistus_opiskelija', true); // Visuaalista merkkiä varten
                    }
                    if (isEntrepreneur) {
                        actions.onUpdateTyottomyysturva('updateKysymys', { id: 'yritystoiminta', value: true });
                        actions.onUpdateTyottomyysturva('ai_tunnistus_yritystoiminta', true);
                    }
                }
            }
            
            onClose(); 
            
        } catch (err) {
            setError("Tietojen siirrossa tapahtui virhe."); console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content" style={{ maxWidth: '850px', padding: 0, overflow: 'hidden' }}>
                
                {/* Header */}
                <div className="admin-modal-header">
                    <h3 className="icon-heading text-primary" style={{ marginBottom: 0 }}>
                        <Wand2 size={20} /> Työ- ja palveluhistorian AI-analyysi
                    </h3>
                    <button onClick={onClose} className="modal-close-button" style={{ position: 'static' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="admin-modal-body-scroll">
                    {error && (
                        <div className="alert-box alert-box--danger">
                            <div className="alert-box-content">
                                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span className="alert-box-text">{error}</span>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div>
                            <label className="icon-label"><FileText size={16} /> Liitä URA-historia tähän</label>
                            <textarea 
                                className="form-input text-mono" 
                                rows="12" 
                                value={rawData} 
                                onChange={(e) => setRawData(e.target.value)} 
                                disabled={isAnalyzing} 
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <>
                            <div className="grid-cols-2-tight">
                                <div className="panel-ai-work">
                                    <label className="icon-label"><Briefcase size={16} /> Työ- ja palveluhistoria</label>
                                    <textarea className="form-input" rows="8" value={workDraft} onChange={(e) => setWorkDraft(e.target.value)} />
                                </div>
                                <div className="panel-ai-edu">
                                    <label className="icon-label"><GraduationCap size={16} /> Suoritetut tutkinnot ja kortit</label>
                                    <textarea className="form-input" rows="8" value={eduDraft} onChange={(e) => setEduDraft(e.target.value)} />
                                </div>
                            </div>

                            {tkDraft && (
                                <div className="panel-ai-tk">
                                    <label className="icon-label"><CalendarClock size={16} /> Löydetyt työkokeilut (Siirretään palkkatukilaskuriin)</label>
                                    <textarea className="form-input text-mono" rows="2" value={tkDraft} onChange={(e) => setTkDraft(e.target.value)} />
                                </div>
                            )}

                            {/* Info koulutusehdotuksista, jos niitä löytyi */}
                            {educationIdeas.length > 0 && (
                                <div className="panel-ai-edu" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Info size={20} color="#b45309" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.9rem', color: '#b45309' }}>
                                        <strong>Tekoäly ideoi asiakkaalle {educationIdeas.length} uutta koulutuspolkua.</strong> Nämä siirretään automaattisesti "Koulutus ja yrittäjyys" -välilehdelle yhteistä tarkastelua varten.
                                    </span>
                                </div>
                            )}

                            <div className="grid-cols-2-tight">
                                <div className="card-inner-sm">
                                    <label className="icon-label text-success"><Briefcase size={16} /> Tunnistetut ammattisuunnat (ESCO)</label>
                                    
                                    {escoProfession ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className="tag-dismissible tag-dismissible--success" style={{ alignSelf: 'flex-start' }}>
                                                {escoProfession}
                                                <button onClick={() => setEscoProfession('')} className="btn-tag-dismiss" title="Poista pääammatti"><X size={14} /></button>
                                            </div>
                                            
                                            {/* Vaihtoehtoiset ammatit */}
                                            {altProfessions.length > 0 && (
                                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)' }}>
                                                    <span className="stat-label">Muut kiinnostuksen kohteet (Klikkaa valitaksesi):</span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                                                        {altProfessions.map((alt, idx) => {
                                                            const isSelected = selectedAltProfessions.includes(alt);
                                                            return (
                                                                <button 
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        if (isSelected) setSelectedAltProfessions(prev => prev.filter(p => p !== alt));
                                                                        else setSelectedAltProfessions(prev => [...prev, alt]);
                                                                    }}
                                                                    className={`tag-dismissible ${isSelected ? 'tag-dismissible--primary' : ''}`}
                                                                    style={{ 
                                                                        cursor: 'pointer', 
                                                                        border: isSelected ? '' : '1px solid var(--color-border)', 
                                                                        backgroundColor: isSelected ? '' : 'var(--color-background)', 
                                                                        color: isSelected ? '' : 'var(--color-text-secondary)' 
                                                                    }}
                                                                >
                                                                    {alt}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : <span className="stat-label" style={{ fontStyle: 'italic', marginBottom: '1rem', display: 'block' }}>Ei tunnistettu.</span>}

                                    {/* SIIRRETTY TÄNNE ALAS: Näytetään aina, jos opiskelija/yrittäjä tunnistettiin */}
                                    {(isStudent || isEntrepreneur) && (
                                        <div className="alert-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)', color: '#6d28d9', marginTop: '1rem' }}>
                                            <div className="alert-box-content">
                                                <Wand2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <span className="alert-box-text">
                                                    Tekoäly havaitsi asiakkaan olevan tällä hetkellä: 
                                                    <strong>{isStudent ? ' Opiskelija' : ''}</strong>
                                                    <strong>{isStudent && isEntrepreneur ? ' ja ' : ''}</strong>
                                                    <strong>{isEntrepreneur ? ' Yrittäjä' : ''}</strong>. 
                                                    Tieto siirretään automaattisesti Työttömyysturva-osiolle.
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="card-inner-sm">
                                    <label className="icon-label text-primary"><Tag size={16} /> Automaattisesti täpättävät signaalit</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {activeTriggers.length > 0 ? activeTriggers.map((trigger, idx) => (
                                            <span key={idx} className="tag-dismissible tag-dismissible--primary">
                                                {trigger}
                                                <button onClick={() => setActiveTriggers(prev => prev.filter(t => t !== trigger))} className="btn-tag-dismiss" title="Poista signaali"><X size={12} /></button>
                                            </span>
                                        )) : <span className="stat-label" style={{ fontStyle: 'italic' }}>Ei signaaleja.</span>}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="admin-modal-footer" style={{ backgroundColor: 'var(--color-background)' }}>
                    <button className="btn btn--secondary" onClick={onClose} disabled={isAnalyzing || isSaving}>Peruuta</button>
                    {step === 1 ? (
                        <button className="btn" onClick={handleAnalyze} disabled={isAnalyzing || !rawData.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isAnalyzing ? <><Loader2 size={16} className="animate-spin" /> Analysoidaan...</> : <><Wand2 size={16} /> Pura ja jäsennä historia</>}
                        </button>
                    ) : (
                        <button className="btn" onClick={handleAccept} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Siirretään...</> : <><Check size={16} /> Hyväksy ja siirrä suunnitelmaan</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UraAnalyzerModal;