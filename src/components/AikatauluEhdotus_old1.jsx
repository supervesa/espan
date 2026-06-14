import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import Card from './common/Card';
import Accordion from './common/Accordion';
import NumericSelector from './common/NumericSelector';
import CopyButton from './common/CopyButton';
import { Sparkles, FlaskConical, Info, Calendar, User, Clock, CheckCircle2 } from 'lucide-react';

const AikatauluEhdotus = ({ state, actions }) => {
    // --- STATE ---
    const [rules, setRules] = useState([]);
    const [selectedRule, setSelectedRule] = useState(null);
    const [count, setCount] = useState(1);
    const [period, setPeriod] = useState(3);
    const [manualEndDate, setManualEndDate] = useState(null);
    const [radioEndDate, setRadioEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSynced, setIsSynced] = useState(false); // Visuaalinen vahvistus (4. kohta)
    
    // Kehitystila (Toggle)
    const [debugMode, setDebugMode] = useState(false);
    const [simulatedSignal, setSimulatedSignal] = useState(null);

    const prevPhraseRef = useRef("");

    // --- APUFUNKTIOT (3. kohta: Smart Dates & Laskurit) ---
    const parseDate = (val) => {
        if (!val) return null;
        const d = new Date(val);
        if (isNaN(d.getTime()) && typeof val === 'string') {
            const parts = val.split('.');
            if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return isNaN(d.getTime()) ? null : d;
    };

    const formatDate = (date) => {
        const d = parseDate(date);
        return d ? d.toLocaleDateString('fi-FI') : "";
    };

    const calculateAge = (year) => year ? new Date().getFullYear() - parseInt(year) : null;
    
    const calculateMonths = (dateStr) => {
        const start = parseDate(dateStr);
        if (!start) return 0;
        const now = new Date();
        return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    };

    // Aktiiviset signaalit (yhdistää oikeat ja simuloidut)
    const activeSignals = useMemo(() => {
        const sigs = { ...(state?.signals || {}) };
        if (debugMode && simulatedSignal) sigs[simulatedSignal] = true;
        return sigs;
    }, [state?.signals, debugMode, simulatedSignal]);

    const activeDateRaw = manualEndDate !== null ? manualEndDate : radioEndDate;

    // --- TIETOKANTAHAKU ---
    useEffect(() => {
        const fetchRules = async () => {
            setLoading(true);
            try {
                const { data: mappings } = await supabase
                    .schema('espan')
                    .from('section_knowledge')
                    .select('espan_knowledge_id')
                    .eq('section_id', '7a94c3d2-0bcc-4222-824f-8d0f471e0f47');

                if (mappings?.length > 0) {
                    const ids = mappings.map(m => m.espan_knowledge_id);
                    const { data: rulesData } = await supabase
                        .schema('espan')
                        .from('knowledge_base')
                        .select('*')
                        .in('id', ids);
                    setRules(rulesData || []);
                }
            } catch (err) {
                console.error("Fallback aktivoitu: Virhe tietokantayhteydessä", err);
                // 5. kohta: Fallback-teksti ja tila hoidetaan oletusarvoilla (rules=[])
            }
            setLoading(false);
        };
        fetchRules();
    }, []);

    // --- TAPAHTUMAKUUNTELIJA (Päättymispäivä) ---
    useEffect(() => {
        const handleRadio = (event) => {
            if (event.detail?.loppu) setRadioEndDate(event.detail.loppu);
        };
        window.addEventListener('palvelu_ajankohta_paivitetty', handleRadio);
        return () => window.removeEventListener('palvelu_ajankohta_paivitetty', handleRadio);
    }, []);

    // --- AUTOMAATIO JA PRIORITEETIT (1. ja 2. kohta) ---
    const suggestion = useMemo(() => {
        if (!rules.length) return null;

        // Prioriteetti 1: Lakisääteinen 46 § (Päättyminen)
        if (activeDateRaw) {
            const rule = rules.find(r => r.metadata?.triggers?.event === "palvelu_paattyy_1kk");
            if (rule) return { 
                rule, 
                reason: "Palvelun päättymispäivä havaittu. Laki (46 §) edellyttää tarkastelua kuukautta ennen loppua." 
            };
        }

        // Prioriteetti 2: Yleistuki (Aktivointijakso)
        if (activeSignals.tt_etuus_yleistuki) {
            const rule = rules.find(r => r.metadata?.triggers?.require_yleistuki === true);
            if (rule) return { 
                rule, 
                reason: "Asiakkaalla on Yleistuki. Aktivointijakson kriteerit täyttyvät." 
            };
        }

        // Prioriteetti 3: Pitkittynyt työnhaku (Smart Dates)
        if (calculateMonths(activeSignals.tyonhaku_alkanut) >= 6) {
            const rule = rules.find(r => r.title.includes("Täydentävät"));
            if (rule) return { 
                rule, 
                reason: "Työnhaku kestänyt yli 6 kk. Suositellaan säännöllistä seurantaa." 
            };
        }

        return null;
    }, [rules, activeSignals, activeDateRaw]);

    // --- TEKSTIN GENEROINTI ---
    const generatePhrase = () => {
        if (!selectedRule) return "Asiakkaan palvelutarve on arvioitu, eikä säännöllisille täydentäville työnhakukeskusteluille ole tarvetta.";
        
        let text = selectedRule.metadata?.base_text || "";
        let dateTeksti = "[pvm]";
        
        const parsed = parseDate(activeDateRaw);
        if (parsed) {
            const targetDate = new Date(parsed);
            targetDate.setMonth(targetDate.getMonth() - 1);
            dateTeksti = formatDate(targetDate);
        }

        return text
            .replace('{count_teksti}', count)
            .replace('{period_teksti}', period)
            .replace('{date_teksti}', dateTeksti);
    };

    // --- SYNKRONOINTI (Legacy Radio + Modern State) ---
    useEffect(() => {
        const currentPhrase = generatePhrase();
        if (prevPhraseRef.current !== currentPhrase) {
            // 1. Legacy Radio-event
            window.dispatchEvent(new CustomEvent('aikataulu_radio', { detail: currentPhrase }));
            
            // 2. Modern State Sync
            if (actions?.onUpdateCustomText) {
                actions.onUpdateCustomText('aikataulu_ehdotus', currentPhrase);
            }

            // 4. Visuaalinen vahvistus
            setIsSynced(true);
            const timer = setTimeout(() => setIsSynced(false), 2000);
            
            prevPhraseRef.current = currentPhrase;
            return () => clearTimeout(timer);
        }
    }, [selectedRule, count, period, activeDateRaw]);

    const applySuggestion = () => {
        if (suggestion) {
            setSelectedRule(suggestion.rule);
            setCount(suggestion.rule.metadata?.triggers?.event === "palvelu_paattyy_1kk" ? 1 : 3);
            setPeriod(suggestion.rule.metadata?.triggers?.event === "palvelu_paattyy_1kk" ? 1 : 3);
        }
    };

    if (loading) return <Card title="Ladataan..."></Card>;

    return (
        <Card title="Lakisääteiset tapaamiset">
            
          {/* DEBUG-PANEELI (Korjattu versio) */}
<div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FlaskConical size={14} /> DEBUG: HAVAINNOT
        </span>
        <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem' }}>
        {/* Korjaus: Tarkistetaan vain onko signaali olemassa (Kyllä/Ei), 
            koska varsinainen pvm-arvo on yleensä toisessa osassa statea */}
        <div className="debug-item">
            <Calendar size={12}/> TH Alkanut: {activeSignals.tyonhaku_alkanut ? 'AKTIIVINEN' : '–'}
        </div>
        <div className="debug-item">
            <User size={12}/> Syntymävuosi: {activeSignals.syntymavuosi ? 'AKTIIVINEN' : '–'}
        </div>
        <div className="debug-item">
            <Info size={12}/> Yleistuki: {activeSignals.tt_etuus_yleistuki ? 'AKTIIVINEN' : 'EI'}
        </div>
        <div className="debug-item">
            <Clock size={12}/> Päättymispv: {radioEndDate || '–'}
        </div>
    </div>

    {debugMode && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
            <button className="btn--secondary" style={{fontSize: '0.65rem'}} onClick={() => setSimulatedSignal('tt_etuus_yleistuki')}>Simuloi Yleistuki</button>
            <button className="btn--secondary" style={{fontSize: '0.65rem'}} onClick={() => setRadioEndDate('2026-12-01')}>Simuloi Päättyminen</button>
        </div>
    )}
</div>

            {/* AUTOMAATTINEN EHDOTUS (1. Perustelulogiikka) */}
            {suggestion && (
                <div className="smart-analysis-box" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-ai)', background: '#f5f3ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: 'var(--color-ai)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Sparkles size={16} /> Älykäs ehdotus
                            </div>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', margin: '4px 0' }}>{suggestion.rule.title}</p>
                            <p style={{ fontSize: '0.7rem', color: '#6b7280' }}><strong>Peruste:</strong> {suggestion.reason}</p>
                        </div>
                        <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={applySuggestion}>Käytä</button>
                    </div>
                </div>
            )}

            <div className="subsection">
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Valitse sääntö:</label>
                <select 
                    className="modern-select" 
                    onChange={(e) => setSelectedRule(rules.find(r => r.id === e.target.value))}
                    value={selectedRule?.id || ""}
                >
                    <option value="">-- Ei säännöllistä tarvetta --</option>
                    {rules.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>

            {selectedRule && (
                <>
                    <Accordion title="Lakiopas (Tietopankki)">
                        <p style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedRule.content_text}</p>
                    </Accordion>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                        <NumericSelector label="Määrä:" options={[0, 1, 2, 3, 5]} value={count} onChange={setCount} />
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Aikaikkuna (kk):</label>
                            <select className="modern-select" value={period} onChange={(e) => setPeriod(parseInt(e.target.value))}>
                                {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} kk</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Palvelun päättymispäivä:</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                className="modern-select" 
                                placeholder="pp.kk.vvvv" 
                                value={manualEndDate !== null ? manualEndDate : formatDate(radioEndDate)}
                                onChange={(e) => setManualEndDate(e.target.value)}
                            />
                            {manualEndDate !== null && (
                                <button onClick={() => setManualEndDate(null)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* PREVIEW (4. Visuaalinen vahvistus) */}
            <div className="summary-preview" style={{ marginTop: '1.5rem', border: isSynced ? '1px solid #10b981' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Suunnitelmateksti</h4>
                    {isSynced && <span style={{ color: '#10b981', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={12}/> Tallennettu</span>}
                </div>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', lineHeight: '1.4' }}>{generatePhrase()}</p>
                <div style={{ marginTop: '1rem' }}>
                    <CopyButton text={generatePhrase()} />
                </div>
            </div>
        </Card>
    );
};

export default AikatauluEhdotus;