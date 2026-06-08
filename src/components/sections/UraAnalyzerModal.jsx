// --- src/components/sections/UraAnalyzerModal.jsx ---
import React, { useState, useEffect, useRef } from 'react';
import { X, Wand2, FileText, Briefcase, Tag, Check, AlertCircle, Loader2, Info, GraduationCap, CalendarClock, ShieldAlert, ShieldCheck, Eye, Layers } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const UraAnalyzerModal = ({ isOpen, onClose, actions, state }) => {
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const textareaRef = useRef(null);

    // AI-tilat
    const [workDraft, setWorkDraft] = useState('');
    const [eduDraft, setEduDraft] = useState('');
    const [tkDraft, setTkDraft] = useState(''); 
    
    // ESCO, Finesco ja Koulutusideat
    const [finescoSector, setFinescoSector] = useState('');
    const [escoProfession, setEscoProfession] = useState('');
    const [altProfessions, setAltProfessions] = useState([]);
    const [selectedAltProfessions, setSelectedAltProfessions] = useState([]);
    const [educationIdeas, setEducationIdeas] = useState([]);
    
    // LOMAKE-AUTOMAATION TILAT (UUDET)
    const [tilaTyokokeilu, setTilaTyokokeilu] = useState(false);
    const [tilaPalkkatuki, setTilaPalkkatuki] = useState(false);
    const [tilaTyoton, setTilaTyoton] = useState(false);

    const [activeTriggers, setActiveTriggers] = useState([]);
    const [knownTriggers, setKnownTriggers] = useState([]);
    
    const [isStudent, setIsStudent] = useState(false);
    const [isEntrepreneur, setIsEntrepreneur] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDictionary();
            setStep(1); setRawData(''); setWorkDraft(''); setEduDraft(''); setTkDraft(''); 
            setFinescoSector(''); setEscoProfession(''); setAltProfessions([]); setSelectedAltProfessions([]); setEducationIdeas([]);
            setTilaTyokokeilu(false); setTilaPalkkatuki(false); setTilaTyoton(false);
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

    // --- VISUAALINEN ANONYMISOINTI JA YKSINKERTAISTUS ---

    const companyRegex = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(Oy|Oyj|Ab|Tmi|Ky|Ay|ry|säätiö|osuuskunta|kaupunki|kunta)\b/gi;
    const schoolRegex = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(yliopisto|lukio|ammattiopisto|amk|ammattikorkeakoulu|opisto|akatemia|koulu|koulutuskeskus|instituutti|aikuisopisto|kansanopisto)\b/gi;
    const hetuRegex = /\b\d{6}[A-Y+-]\d{3}[A-Z0-9]\b/gi;
    const dateRegex = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

    const hasRisks = rawData.match(companyRegex) || rawData.match(schoolRegex) || rawData.match(hetuRegex) || rawData.match(dateRegex);

    const getHighlightedHTML = (text) => {
        if (!text) return '<span style="color: var(--color-text-muted); font-style: italic;">Liitä teksti alla olevaan kenttään nähdäksesi esikatselun...</span>';
        
        let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const greenStyle = 'background-color: #d1fae5; color: #065f46; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px solid #34d399; font-size: 0.85em; margin: 0 2px;';
        const redStyle = 'background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #f87171; font-size: 0.85em; margin: 0 2px; cursor: help;';
        const warningStyle = 'background-color: #fffbeb; color: #b45309; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #fbbf24; font-size: 0.85em; margin: 0 2px; cursor: help;';

        // PVM Muotoiltu tukemaan kuukautta
        html = html.replace(/(\[ORGANISAATIO\]|\[OPPILAITOS\]|\[HETU\]|\[PVM: \d{2}\/\d{4}\])/g, `<span style="${greenStyle}">$1</span>`);

        html = html.replace(companyRegex, `<span style="${redStyle}" title="Tekoälylle ei tulisi lähettää työnantajien nimiä">$&</span>`);
        html = html.replace(schoolRegex, `<span style="${redStyle}" title="Tekoälylle ei tulisi lähettää oppilaitosten nimiä">$&</span>`);
        html = html.replace(hetuRegex, `<span style="${redStyle}" title="Sisältää henkilötunnuksen!">$&</span>`);
        html = html.replace(dateRegex, `<span style="${warningStyle}" title="Päivämäärä yksinkertaistetaan muotoon KK/VVVV">$&</span>`);

        return html.replace(/\n/g, '<br />');
    };

    const handleAutoAnonymize = () => {
        let cleaned = rawData;
        cleaned = cleaned.replace(companyRegex, '[ORGANISAATIO]');
        cleaned = cleaned.replace(schoolRegex, '[OPPILAITOS]');
        cleaned = cleaned.replace(hetuRegex, '[HETU]');
        // Säilytetään kuukausi AI:n aikalaskuja varten!
        cleaned = cleaned.replace(dateRegex, (match, d, m, y) => `[PVM: ${m.padStart(2, '0')}/${y}]`);
        setRawData(cleaned); 
    };

    // --- TEKOÄLYLLE LÄHETYS ---
    const handleAnalyze = async () => {
        if (!rawData.trim()) return setError("Syötä URA-historia ensin.");
        setError(null); setIsAnalyzing(true);

        // Lähetetään tekoälylle nykypäivä, jotta se voi laskea 12kk säännön
        const todayDate = new Date().toISOString().split('T')[0]; 

        try {
            const response = await fetch('/.netlify/functions/analyze_ura', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: rawData, knownTriggers, currentDate: todayDate })
            });

            if (!response.ok) throw new Error("Aivoissa ruuhkaa. Yritä hetken kuluttua uudelleen.");

            const aiData = await response.json();
            setWorkDraft(aiData.tyohistoria || '');
            setEduDraft(aiData.koulutushistoria || '');
            setTkDraft(aiData.tyokokeilut_pvm || ''); 
            
            setFinescoSector(aiData.finesco_ammattiala || ''); 
            setEscoProfession(aiData.esco_ammatti || '');
            setAltProfessions(aiData.vaihtoehtoiset_ammatit || []);
            setEducationIdeas(aiData.koulutusehdotukset || []);
            
            setTilaTyokokeilu(aiData.tila_tyokokeilu === true);
            setTilaPalkkatuki(aiData.tila_palkkatuki === true);
            setTilaTyoton(aiData.tila_tyoton === true);

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

    // --- HYVÄKSYNTÄ JA TALLENNUS ---
    const handleAccept = async () => {
        setIsSaving(true);
        try {
            
            // 1. ÄLYKÄS TEKSTIN YHDISTÄMINEN (Ei duplikaatteja)
            const AI_DIVIDER = "--- AI-YHTEENVETO URA-HISTORIASTA ---";
            let existingText = state['custom-tyotilanne'] || '';
            
            // Jos vanha AI-yhteenveto löytyy, poistetaan se ja kaikki sen alla oleva
            if (existingText.includes(AI_DIVIDER)) {
                existingText = existingText.split(AI_DIVIDER)[0].trim();
            }

            let aiKoonti = '';
            if (workDraft) aiKoonti = workDraft;

            if (finescoSector || escoProfession) {
                let escoSentence = '';
                if (finescoSector && escoProfession) {
                    escoSentence = `Asiakkaan tavoitteena on työllistyä alalle: ${finescoSector.toLowerCase()}. Tarkempana tavoiteammattina on ${escoProfession.toLowerCase()}.`;
                } else if (escoProfession) {
                    escoSentence = `Asiakkaan tavoiteammattina on ${escoProfession.toLowerCase()}.`;
                } else if (finescoSector) {
                    escoSentence = `Asiakkaan tavoitteena on työllistyä alalle: ${finescoSector.toLowerCase()}.`;
                }

                if (selectedAltProfessions.length > 0) {
                    const altText = selectedAltProfessions.join(' ja ');
                    escoSentence += ` Asiakkaalla on kiinnostusta myös seuraaviin suuntiin: ${altText.toLowerCase()}.`;
                }
                aiKoonti = aiKoonti ? `${aiKoonti}\n\n${escoSentence}` : escoSentence;
            }

            // Yhdistetään lopuksi vanha oma teksti ja uusi AI-blokki
            const finalNotes = existingText 
                ? `${existingText}\n\n${AI_DIVIDER}\n${aiKoonti}` 
                : `${AI_DIVIDER}\n${aiKoonti}`;

            actions.onUpdateCustomText('tyotilanne', finalNotes);

            if (eduDraft) actions.onUpdateCustomText('ai_koulutushistoria', eduDraft);
            if (educationIdeas.length > 0) actions.onUpdateCustomText('ai_koulutus_ideat', JSON.stringify(educationIdeas));
            
            if (tkDraft) {
                if (typeof actions.onUpdatePalkkatuki === 'function') {
                    actions.onUpdatePalkkatuki('tyokokeilu_historia', tkDraft);
                } else {
                    actions.onUpdateVariable('palkkatuki', 'tyokokeilu_historia', tkDraft);
                }
            }

            // 2. LOMAKKEEN AUTOMAATIOTÄPÄT (TÄRKEÄÄ: Vaihda avaimet tarvittaessa)
            if (tilaTyokokeilu) actions.onSelect('tyokokeilu', true);
            if (tilaPalkkatuki) actions.onSelect('palkkatuki', true);
            if (tilaTyoton) actions.onSelect('tyoton_tyonhakija', true); // Esim. avain voi olla tyoton_tyonhakija

            // 3. SIGNAALIT
            activeTriggers.forEach(trigger => {
                actions.onUpdateVariable('tyotilanne', trigger, true);
                if (typeof actions.updateSignal === 'function') actions.updateSignal(trigger, true);
                if (typeof actions.onAddSignal === 'function') actions.onAddSignal(trigger); 
            });

            if (finescoSector && typeof actions.onAddSignal === 'function') actions.onAddSignal(`AI_FINESCO_${finescoSector}`);
            if (escoProfession && typeof actions.onAddSignal === 'function') actions.onAddSignal(`AI_ESCO_${escoProfession}`);

            // 4. ESCO-TALLENNUS DATAAN
            if (finescoSector) {
                if (typeof actions.onUpdateAsiakas === 'function') actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finescoSector);
                else actions.onUpdateVariable('asiakas', 'tavoiteammatti_finesco_ala', finescoSector);
            }

            if (escoProfession) {
                let uri = ''; 
                let title = escoProfession; 
                try {
                    const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoProfession)}&language=fi&type=occupation`);
                    if (escoRes.ok) {
                        const escoJson = await escoRes.json();
                        if (escoJson._embedded && escoJson._embedded.results && escoJson._embedded.results.length > 0) {
                            uri = escoJson._embedded.results[0].uri;
                            title = escoJson._embedded.results[0].title;
                        }
                    }
                } catch (escoErr) { console.warn("ESCO API virhe", escoErr); }

                if (typeof actions.onUpdateAsiakas === 'function') {
                    actions.onUpdateAsiakas('tavoiteammatti_esco_uri', uri);
                    actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', title);
                } else {
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_uri', uri);
                    actions.onUpdateVariable('asiakas', 'tavoiteammatti_esco_nimi', title); 
                }
            }

            // 5. OPISKELIJA/YRITTÄJÄ -TUNNISTUS
            if (isStudent || isEntrepreneur) {
                if (typeof actions.onUpdateTyottomyysturva === 'function') {
                    if (isStudent) {
                        actions.onUpdateTyottomyysturva('updateKysymys', { id: 'opiskelija', value: true });
                        actions.onUpdateTyottomyysturva('ai_tunnistus_opiskelija', true);
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
            <div className="admin-modal-content" style={{ maxWidth: '900px', padding: 0, overflow: 'hidden' }}>
                
                <div className="admin-modal-header">
                    <h3 className="icon-heading text-primary" style={{ marginBottom: 0 }}>
                        <Wand2 size={20} /> Työ- ja palveluhistorian AI-analyysi
                    </h3>
                    <button onClick={onClose} className="modal-close-button" style={{ position: 'static' }}>
                        <X size={24} />
                    </button>
                </div>

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                                Liitä asiakkaan URA-historia alle. Tietosuoja turvataan ja tarkat päivämäärät yksinkertaistetaan automaattisesti vuosiksi tekoälyä varten.
                            </p>

                            <div 
                                className="card-inner-sm" 
                                style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'text' }}
                                onClick={() => textareaRef.current && textareaRef.current.focus()}
                                title="Klikkaa muokataksesi (Siirtää kursorin alempaan kenttään)"
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                    <label className="icon-label text-primary" style={{ margin: 0 }}>
                                        <Eye size={16} /> Koneen lukema esikatselu
                                    </label>
                                    {hasRisks ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                                            <ShieldAlert size={16} /> Data vaatii siistimistä
                                        </span>
                                    ) : rawData.length > 0 ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                                            <ShieldCheck size={16} /> Teksti on puhdas
                                        </span>
                                    ) : null}
                                </div>
                                <div 
                                    style={{ 
                                        minHeight: '80px', 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        fontFamily: 'monospace', 
                                        fontSize: '0.9rem', 
                                        lineHeight: '1.6',
                                        color: '#334155'
                                    }}
                                    dangerouslySetInnerHTML={{ __html: getHighlightedHTML(rawData) }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', margin: '-0.5rem 0' }}>
                                <button 
                                    className={`btn ${hasRisks ? 'btn--primary' : 'btn--secondary'}`}
                                    onClick={handleAutoAnonymize}
                                    disabled={!hasRisks}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                        borderRadius: '999px', padding: '0.5rem 1.5rem',
                                        boxShadow: hasRisks ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {hasRisks ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                                    Siisti tiedot automaattisesti
                                </button>
                            </div>

                            <div>
                                <label className="icon-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <span><FileText size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.4rem' }}/> Muokattava tekstikenttä</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Voit muokata tekstiä myös vapaasti käsin</span>
                                </label>
                                <textarea 
                                    ref={textareaRef}
                                    className="form-input text-mono" 
                                    rows="10" 
                                    value={rawData} 
                                    onChange={(e) => setRawData(e.target.value)} 
                                    disabled={isAnalyzing}
                                    placeholder="Liitä URA-historia tänne..."
                                />
                            </div>
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

                            {/* UUSI: LOMAKKEEN AUTOMAATION NÄKYMÄ */}
                            {(tilaTyoton || tilaTyokokeilu || tilaPalkkatuki) && (
                                <div className="card-inner-sm" style={{ borderLeft: '4px solid var(--color-success)', marginBottom: '1rem' }}>
                                    <label className="icon-label text-success"><Layers size={16} /> Automaattiset lomakevalinnat</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                        {tilaTyoton && <span className="tag-dismissible tag-dismissible--success">✓ Työtön</span>}
                                        {tilaTyokokeilu && <span className="tag-dismissible tag-dismissible--success">✓ Työkokeilu</span>}
                                        {tilaPalkkatuki && <span className="tag-dismissible tag-dismissible--success">✓ Palkkatuki</span>}
                                    </div>
                                    <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        Nämä laatikot ruksitaan automaattisesti Työtilanne-lomakkeella.
                                    </span>
                                </div>
                            )}

                            {tkDraft && (
                                <div className="panel-ai-tk">
                                    <label className="icon-label"><CalendarClock size={16} /> Löydetyt työkokeilut (Siirretään palkkatukilaskuriin)</label>
                                    <textarea className="form-input text-mono" rows="2" value={tkDraft} onChange={(e) => setTkDraft(e.target.value)} />
                                </div>
                            )}

                            {educationIdeas.length > 0 && (
                                <div className="panel-ai-edu" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Info size={20} color="#b45309" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.9rem', color: '#b45309' }}>
                                        <strong>Tekoäly ideoi asiakkaalle {educationIdeas.length} uutta koulutuspolkua.</strong> Nämä siirretään automaattisesti "Koulutus ja yrittäjyys" -välilehdelle.
                                    </span>
                                </div>
                            )}

                            <div className="grid-cols-2-tight">
                                <div className="card-inner-sm">
                                    <label className="icon-label text-success"><Layers size={16} /> Tunnistettu ammattialue</label>
                                    
                                    {finescoSector && (
                                        <div className="tag-dismissible" style={{ alignSelf: 'flex-start', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', marginBottom: '1rem' }}>
                                            {finescoSector}
                                            <button onClick={() => setFinescoSector('')} className="btn-tag-dismiss" title="Poista ammattiala"><X size={14} /></button>
                                        </div>
                                    )}

                                    <label className="icon-label text-success" style={{ marginTop: finescoSector ? '0' : '0' }}><Briefcase size={16} /> Tunnistettu ESCO ammatti</label>
                                    
                                    {escoProfession ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className="tag-dismissible tag-dismissible--success" style={{ alignSelf: 'flex-start' }}>
                                                {escoProfession}
                                                <button onClick={() => setEscoProfession('')} className="btn-tag-dismiss" title="Poista pääammatti"><X size={14} /></button>
                                            </div>
                                            
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

                <div className="admin-modal-footer" style={{ backgroundColor: 'var(--color-background)' }}>
                    <button className="btn btn--secondary" onClick={onClose} disabled={isAnalyzing || isSaving}>Peruuta</button>
                    {step === 1 ? (
                        <button 
                            className="btn" 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing || !rawData.trim() || hasRisks} 
                            title={hasRisks ? "Piilota tunnistetut kohteet ensin" : ""}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
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