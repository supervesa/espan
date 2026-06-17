import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { PhraseOption } from '../../PhraseOption';
import { ENTITY_DEFINITIONS } from '../../../data/entityDefinitions';
import { Wand2, CalendarClock, Save, Trash2, CheckCircle2, Zap, Check, Clock, History, PlayCircle, Sparkles, Layers, Briefcase } from 'lucide-react'; 

import UraAnalyzer from './UraAnalyzer'; 
import TyotilanneNotes from './TyotilanneNotes';
import ATmtGuidance from './ATmtGuidance';

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const currentSectionState = state[UI_KEY] || {};
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const [tempDates, setTempDates] = useState({ alku: "", loppu: "" });
    const [pasteArea, setPasteArea] = useState("");
    const [saveStatus, setSaveStatus] = useState(null);

    // --- 1. APUFUNKTIOT: PÄIVÄMÄÄRÄT JA AIKAMUODOT ---
    
    const parseDate = (s) => {
        if (!s) return null;
        const p = s.split('.');
        if (p.length !== 3) return new Date(s);
        return new Date(p[2], p[1] - 1, p[0]);
    };

    const getServiceStatus = (alku, loppu) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const s = parseDate(alku);
        const e = parseDate(loppu);

        if (!s || !e || isNaN(s) || isNaN(e)) return 'future';
        if (e < now) return 'past';
        if (s <= now && e >= now) return 'present';
        return 'future';
    };

    // --- 2. TUNNISTUS: Mikä palvelu on valittu ---
    const activeServiceType = useMemo(() => {
        const selectedKeys = Object.keys(currentSectionState).filter(k => currentSectionState[k]);
        
        for (const key of selectedKeys) {
            const phrase = phrases.find(p => p.phrase_key === key);
            if (!phrase) continue;
            
            const text = (phrase.base_text || "").toLowerCase();
            const pKey = (phrase.phrase_key || "").toLowerCase();
            
            if (text.includes('työkokeilu') || pKey.includes('kokeilu')) return 'tyokokeilu';
            if (text.includes('palkkatuki') || pKey.includes('palkka')) return 'palkkatuki';
            if (text.includes('työvoimakoulutus') || text.includes('koulutus') || pKey.includes('voima')) return 'tyovoimakoulutus';
        }
        return null;
    }, [phrases, currentSectionState]);

    // --- 3. KAKSISUUNTAINEN KYTKENTÄ (Auto-fill) ---
    // A) Jos asiantuntija klikkaa raksia ja taulukossa on jo dataa, täytetään kentät
    useEffect(() => {
        if (activeServiceType) {
            const saved = (state.sessionServices || []).find(s => s.entity_key === activeServiceType);
            if (saved) {
                setTempDates({ alku: saved.data.alku, loppu: saved.data.loppu });
            } else {
                setTempDates({ alku: "", loppu: "" });
            }
        }
    }, [activeServiceType, state.sessionServices]);

    // B) Kytketään raksi päälle automaattisesti, jos imuri on laittanut palvelun taulukkoon
    useEffect(() => {
        if (!phrases || phrases.length === 0) return;
        const services = Array.isArray(state.sessionServices) ? state.sessionServices : [];
        
        ['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus'].forEach(type => {
            const hasInGM = services.some(s => s.entity_key === type);
            if (hasInGM) {
                const phrase = phrases.find(p => {
                    const text = (p.base_text || "").toLowerCase();
                    const key = (p.phrase_key || "").toLowerCase();
                    if (type === 'tyokokeilu') return text.includes('työkokeilu') || key.includes('kokeilu');
                    if (type === 'palkkatuki') return text.includes('palkkatuki') || key.includes('palkka');
                    if (type === 'tyovoimakoulutus') return text.includes('työvoimakoulutus') || text.includes('koulutus') || key.includes('voima');
                    return false;
                });

                if (phrase && !currentSectionState[phrase.phrase_key]) {
                    onSelect(UI_KEY, phrase.phrase_key, true);
                }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.sessionServices, phrases]);

    // --- 4. TEKSTIGENERAATTORI AIKAMUODOILLA ---
    const rebuildServiceText = (services) => {
        let currentText = state[`custom-${UI_KEY}`] || '';
        const regex = /(?:^|\n)Asiakas (?:osallistuu|on parhaillaan|on ollut) (?:työllisyyttä edistävään palveluun|työkokeiluun|palkkatukityöhön|työvoimakoulutukseen) ajalla .*?(?:\.|$)/gi;
        let cleanText = currentText.replace(regex, '').trim();

        const newLines = services.map(s => {
            const status = getServiceStatus(s.data.alku, s.data.loppu);
            
            let nimi = "palveluun";
            let verbi = "osallistuu"; // Tulevaisuus

            if (status === 'past') verbi = "on ollut";
            if (status === 'present') verbi = "on parhaillaan";

            if (s.entity_key === 'tyokokeilu') nimi = status === 'past' ? "työkokeilussa" : "työkokeiluun";
            if (s.entity_key === 'palkkatuki') nimi = status === 'past' ? "palkkatukityössä" : "palkkatukityöhön";
            if (s.entity_key === 'tyovoimakoulutus') nimi = status === 'past' ? "työvoimakoulutuksessa" : "työvoimakoulutukseen";

            if (status === 'present') {
                if (s.entity_key === 'tyokokeilu') nimi = "työkokeilussa";
                if (s.entity_key === 'palkkatuki') nimi = "palkkatukityössä";
                if (s.entity_key === 'tyovoimakoulutus') nimi = "työvoimakoulutuksessa";
            }

            let line = `Asiakas ${verbi} ${nimi} ajalla ${s.data.alku}–${s.data.loppu}.`;
            
            if (status !== 'past') {
                const start = parseDate(s.data.alku);
                const end = parseDate(s.data.loppu);
                const kesto = end && start ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) : 0;
                if (kesto >= 30) line += ` Kyseessä on yli kuukauden kestävä palvelu (46 §).`;
            }
            return line;
        });

        const finalLines = newLines.join('\n\n');
        const updatedFullText = finalLines 
            ? (cleanText ? `${cleanText}\n\n${finalLines}` : finalLines)
            : cleanText;

        onUpdateCustomText(UI_KEY, updatedFullText);
    };

    // --- 5. TOIMINNOT ---
    const handlePasteChange = (val) => {
        setPasteArea(val);
        const match = val.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (match) {
            setTempDates({ alku: match[1], loppu: match[2] });
            setPasteArea("");
        }
    };

    const handleSaveService = () => {
        if (!tempDates.alku || !tempDates.loppu || !activeServiceType) return;
        setSaveStatus('saving');

        const newService = {
            id: window.crypto.randomUUID(),
            entity_key: activeServiceType,
            data: { alku: tempDates.alku, loppu: tempDates.loppu },
            meta: { source: 'manual', timestamp: new Date().toISOString() }
        };

        const currentServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];
        const filtered = currentServices.filter(s => s.entity_key !== activeServiceType);
        const updatedServices = [...filtered, newService];

        onUpdateVariable('global', 'sessionServices', updatedServices);
        rebuildServiceText(updatedServices);

        window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { detail: { loppu: tempDates.loppu } }));

        setTimeout(() => {
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
        }, 300);
    };

    const handleRemoveService = (id) => {
        const currentServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];
        const updatedServices = currentServices.filter(s => s.id !== id);
        onUpdateVariable('global', 'sessionServices', updatedServices);
        rebuildServiceText(updatedServices);
    };

    // --- FETCH ---
    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('phrases').select('*').eq('section_id', DB_TYOTILANNE).order('created_at');
            if (data) setPhrases(data);
            setLoading(false);
        };
        fetchData();
    }, []);

    // --- TEKOÄLYN LÖYDÖT (Globaalista tilasta) ---
    const finescoAla = state.asiakas?.tavoiteammatti_finesco_ala;
    const escoNimi = state.asiakas?.tavoiteammatti_esco_nimi; 
    const tkHistoria = state.palkkatuki?.tyokokeilu_historia;

    if (loading) return <div className="section-container">Ladataan...</div>;

    const savedServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title thv-section-title">Asiakkaan työtilanne</h2>
                <button className="btn-ai" onClick={() => setIsAnalyzerOpen(true)}>
                    <Wand2 size={16} /> Tuo ja analysoi URA-historia
                </button>
            </div>

            {/* TEKOÄLYN VISUALISOINTI (PALAUTETTU) */}
            {(finescoAla || escoNimi || tkHistoria) && (
                <div className="panel-gray" style={{ backgroundColor: 'var(--color-ai-bg)', borderColor: 'var(--color-ai-border)', animation: 'fadeIn 0.3s ease-out' }}>
                    <label className="icon-label" style={{ marginBottom: '1rem' }}><Sparkles size={18} color="var(--color-ai)" /> AI-analyysin tulokset (URA-historia)</label>
                    <div className="grid-cols-2-tight">
                        {finescoAla && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}><Layers size={14} /> Ammattiala (Finesco)</label>
                                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{finescoAla}</span>
                            </div>
                        )}
                        {escoNimi && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}><Briefcase size={14} /> Tavoiteammatti (ESCO)</label>
                                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{escoNimi}</span>
                            </div>
                        )}
                        {tkHistoria && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-info-text)', marginBottom: '0.25rem' }}><CalendarClock size={14} /> Työkokeilut</label>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-info-dark)' }}>Siirretty {tkHistoria.split('\n').filter(l => l.trim().length > 0).length} jaksoa Palkkatukilaskuriin!</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="options-container">
                {phrases.map(phrase => (
                    <PhraseOption
                        key={phrase.id}
                        phrase={{ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title }}
                        section={{ id: UI_KEY, monivalinta: true }}
                        isSelected={currentSectionState[phrase.phrase_key]}
                        onSelect={onSelect}
                    />
                ))}
            </div>

            {/* SYÖTTÖLOMAKE */}
            {activeServiceType && (
                <div className={`panel-gray ${saveStatus === 'success' ? 'success-flash' : ''}`} 
                     style={{ marginTop: '1.5rem', border: '2px solid var(--color-primary)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CalendarClock size={20} className="text-primary" />
                            <h3 className="subsection-title" style={{ margin: 0 }}>
                                {ENTITY_DEFINITIONS[activeServiceType]?.label}
                            </h3>
                        </div>
                        {getServiceStatus(tempDates.alku, tempDates.loppu) === 'present' && (
                            <span className="tag tag--success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <PlayCircle size={12} /> KÄYNNISSÄ
                            </span>
                        )}
                    </div>

                    <div className="flex-col-gap mb-4">
                        <input 
                            type="text" 
                            className="modern-select" 
                            style={{ backgroundColor: '#fff7ed' }}
                            placeholder="PIKASYÖTTÖ: Liitä pvm-väli tästä..."
                            value={pasteArea}
                            onChange={(e) => handlePasteChange(e.target.value)}
                        />
                    </div>

                    <div className="grid-cols-2-tight">
                        <input type="text" className="modern-select" placeholder="Alkaa" value={tempDates.alku} onChange={(e) => setTempDates({ ...tempDates, alku: e.target.value })} />
                        <input type="text" className="modern-select" placeholder="Päättyy" value={tempDates.loppu} onChange={(e) => setTempDates({ ...tempDates, loppu: e.target.value })} />
                    </div>

                    <button className="btn" style={{ width: '100%', marginTop: '1.25rem' }} onClick={handleSaveService}>
                        {saveStatus === 'success' ? <><Check size={18} /> Päivitetty!</> : <><Save size={18} /> Tallenna palvelu</>}
                    </button>
                </div>
            )}

            {/* LISTAUS TALLENNETUISTA */}
            {savedServices.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div className="flex-col-gap">
                        {savedServices.filter(s => ['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus'].includes(s.entity_key)).map(s => {
                            const status = getServiceStatus(s.data.alku, s.data.loppu);
                            return (
                                <div key={s.id} className="card-inner-sm" style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    backgroundColor: status === 'present' ? '#f0fdf4' : status === 'past' ? '#f8fafc' : '#f0f9ff',
                                    opacity: status === 'past' ? 0.7 : 1
                                }}>
                                    <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {status === 'present' ? <PlayCircle size={14} color="green" /> : status === 'past' ? <History size={14} /> : <Clock size={14} />}
                                        <strong>{ENTITY_DEFINITIONS[s.entity_key]?.label}:</strong> {s.data.alku} – {s.data.loppu}
                                    </div>
                                    <button onClick={() => handleRemoveService(s.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <TyotilanneNotes customText={state[`custom-${UI_KEY}`]} onUpdateCustomText={onUpdateCustomText} uiKey={UI_KEY} actions={actions} phrases={phrases} />
            <ATmtGuidance currentSectionState={currentSectionState} state={state} knowledgeData={knowledgeData} />
            <UraAnalyzer isOpen={isAnalyzerOpen} onClose={() => setIsAnalyzerOpen(false)} actions={actions} state={state} />
        </section>
    );
};

export default Tyotilanne;