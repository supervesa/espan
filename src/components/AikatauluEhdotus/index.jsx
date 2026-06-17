import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useSignal } from '../signals/useSignal';
import { ENTITY_DEFINITIONS } from './schedulePriorityEngine'; 
import Card from '../common/Card';
import NumericSelector from '../common/NumericSelector';
import CopyButton from '../common/CopyButton';
import BasketSlotPicker from './BasketSlotPicker';
import SmartSuggestionBox from './SmartSuggestionBox';
import { analyzeSchedule } from './schedulePriorityEngine';
import { findAvailableSlots } from './schedulingUtils';
import { generateSmartDraft } from './draftingEngine';
import { FlaskConical, Calendar, User, Activity, CheckCircle2, Phone, Database, Link, AlertCircle } from 'lucide-react';

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

const AikatauluEhdotus = ({ state, actions }) => {
    const { activeSignals } = useSignal();

    const [rules, setRules] = useState([]);
    const [expertRules, setExpertRules] = useState([]);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedRule, setSelectedRule] = useState(null);
    const [proposedSlots, setProposedSlots] = useState([]);
    const [confirmedSlots, setConfirmedSlots] = useState([]);
    const [count, setCount] = useState(1);
    const [period, setPeriod] = useState(3);
    const [activeForcedMode, setActiveForcedMode] = useState(null);
    const [debugMode, setDebugMode] = useState(false);
    
    const [weekOffset, setWeekOffset] = useState(0);
    const [basket, setBasket] = useState([]);

    const prevPhraseRef = useRef("");

    // --- LISÄTTY: Seurataan datan saapumista AikatauluEhdotukseen ---
    useEffect(() => {
        if (debugMode) {
            console.log("AIKATAULU_DEBUG: state.sessionServices:", state.sessionServices);
        }
    }, [state.sessionServices, debugMode]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [kb, er, av] = await Promise.all([
                    supabase.schema('espan').from('knowledge_base').select('*'),
                    supabase.schema('espan').from('expert_availability_rules').select('*').eq('expert_id', EXPERT_ID),
                    supabase.schema('espan').from('availability').select('*').eq('expert_id', EXPERT_ID)
                ]);
                setRules(kb.data || []);
                setExpertRules(er.data || []);
                setBookedSlots(av.data || []);
            } catch (err) { console.error("Tietokantavirhe:", err); }
            setLoading(false);
        };
        loadData();
    }, []);

    const perustiedotVars = useMemo(() => {
        const section = state.suunnitelman_perustiedot || {};
        return Object.values(section).reduce((acc, curr) => {
            if (curr && typeof curr === 'object' && curr.muuttujat) return { ...acc, ...curr.muuttujat };
            return acc;
        }, {});
    }, [state.suunnitelman_perustiedot]);

    const laatimisTapa = perustiedotVars?.YHTEYDENOTTOTAPA || "–";
    const suunnitelmaLaadittuPvm = perustiedotVars?.PÄIVÄMÄÄRÄ || "–";

    // Kutsutaan moottoria
    const { suggestion: activeSuggestion, diagnostics } = useMemo(() => {
        const services = Array.isArray(state.sessionServices) ? state.sessionServices : [];
        return analyzeSchedule(rules, activeSignals, services, perustiedotVars);
    }, [rules, activeSignals, state.sessionServices, perustiedotVars]);

    useEffect(() => {
        if (!selectedRule) { setProposedSlots([]); return; }
        
        let type = 'normi';
        if (selectedRule.metadata?.triggers?.require_yleistuki) {
            type = 'aktivointi';
        } else if (selectedRule.title.toLowerCase().includes('täydentävä')) {
            type = 'taydentava';
        }
        
        const searchStart = new Date();
        searchStart.setDate(searchStart.getDate() + (weekOffset * 7));
        
        setProposedSlots(findAvailableSlots(type, expertRules, bookedSlots, searchStart, 1));
    }, [selectedRule, expertRules, bookedSlots, weekOffset]);

    const handleRuleChange = (ruleId, suggestedCount = 1, suggestedPeriod = 3, forcedMode = null) => {
        const rule = rules.find(r => r.id === ruleId);
        setSelectedRule(rule);
        
        if (rule) {
            setCount(suggestedCount);
            setPeriod(suggestedPeriod);
            setActiveForcedMode(forcedMode);
            setBasket(generateSmartDraft(rule, expertRules, bookedSlots, suggestedCount, suggestedPeriod));
        } else {
            setBasket([]);
            setActiveForcedMode(null);
        }
    };

    const handleCountChange = (newCount) => {
        setCount(newCount);
        setBasket(generateSmartDraft(selectedRule, expertRules, bookedSlots, newCount, period));
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        setBasket(generateSmartDraft(selectedRule, expertRules, bookedSlots, count, newPeriod));
    };

    const handleBooking = async () => {
        if (basket.length === 0) return;
        
        let type = 'normi';
        if (selectedRule.metadata?.triggers?.require_yleistuki) {
            type = 'aktivointi';
        } else if (selectedRule.title.toLowerCase().includes('täydentävä')) {
            type = 'taydentava';
        }
        
        const inserts = basket.map(item => ({ 
            expert_id: EXPERT_ID, start_time: item.time.toISOString(), meeting_type: type, contact_method: item.mode, is_blocked: true 
        }));
        
        try {
            const { error } = await supabase.schema('espan').from('availability').insert(inserts);
            if (!error) {
                setConfirmedSlots(basket);
                setBookedSlots([...bookedSlots, ...inserts]);
            }
        } catch (err) { alert("Varaus epäonnistui."); }
    };

    const generatePhrase = () => {
        let text = selectedRule ? (selectedRule.metadata?.base_text || "") : "Asiakkaan palvelutarve on arvioitu, eikä säännöllisille tapaamisille ole tarvetta.";
        text = text.replace('{count_teksti}', count).replace('{period_teksti}', period);
        
        const activeList = confirmedSlots.length > 0 ? confirmedSlots : basket;
        
        if (activeList.length > 0) {
            const times = activeList.sort((a,b) => a.time - b.time).map(item => {
                const h = item.time.getHours();
                const m = String(item.time.getMinutes()).padStart(2, '0');
                const modeText = item.mode === 'kaynti' ? 'käynti' : 'puhelu';
                return `${item.time.toLocaleDateString('fi-FI')} klo ${h}:${m} (${modeText})`;
            }).join(', ');
            text += ` \n\nSovittu tapaamiset seuraavasti: ${times}.`;
        }
        return text;
    };

    useEffect(() => {
        const p = generatePhrase();
        if (prevPhraseRef.current !== p) {
            if (actions?.onUpdateCustomText) actions.onUpdateCustomText('aikataulu_ehdotus', p);
            prevPhraseRef.current = p;
        }
    });

    const sessionServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];

    if (loading) return <Card title="Ladataan aikatauluavustajaa..."></Card>;

    return (
        <Card title="Sentinel Guardian: Aikatauluavustaja">
            
            {/* DEBUG LAATIKKO */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FlaskConical size={14} /> LIVE ENGINE DIAGNOSTICS
                    </span>
                    <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem', marginBottom: debugMode ? '10px' : '0' }}>
                    <div className="debug-item"><Phone size={12}/> Tapa: <strong>{laatimisTapa}</strong></div>
                    <div className="debug-item"><Calendar size={12}/> Laadittu: <strong>{suunnitelmaLaadittuPvm}</strong></div>
                    <div className="debug-item"><User size={12}/> Ikä: {diagnostics.ika || '–'} v</div>
                    <div className="debug-item"><Activity size={12}/> TH-kesto: <span style={{fontWeight:'bold', color:'var(--color-primary)'}}>{diagnostics.thKestoKk !== null ? `${diagnostics.thKestoKk} kk` : 'Tuntematon'}</span></div>
                    <div className="debug-item"><Activity size={12}/> Yleistuki: {activeSignals.tt_etuus_yleistuki ? <span style={{color:'green', fontWeight:'bold'}}>K</span> : 'E'}</div>
                    <div className="debug-item"><Activity size={12}/> Toimeentulo: {activeSignals.ETUUS_TOIMEENTULOTUKI ? <span style={{color:'green', fontWeight:'bold'}}>K</span> : 'E'}</div>
                </div>

                {/* HAVAITUT PALVELUT (AINA DIAGNOSOITU) */}
                {debugMode && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #cbd5e1', fontSize: '0.7rem' }}>
                        <div style={{ marginBottom: '8px', color: 'var(--color-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Link size={12}/> DETECTED SERVICES (GM Array):
                        </div>
                        
                        {sessionServices.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                {sessionServices.map((s, idx) => (
                                    <div key={idx} style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                        <span><strong>{ENTITY_DEFINITIONS[s.entity_key]?.label || s.entity_key}</strong></span>
                                        <span style={{ color: '#64748b' }}>{s.data.alku} – {s.data.loppu}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 0', color: '#94a3b8', fontStyle: 'italic', marginBottom: '10px' }}>
                                <AlertCircle size={12} /> No services detected in state.sessionServices
                            </div>
                        )}

                        <div style={{ marginBottom: '5px', color: '#64748b', fontWeight: 'bold' }}>RAW JSON:</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', backgroundColor: '#f1f5f9', padding: '5px', borderRadius: '4px', fontSize: '0.65rem' }}>
                            {JSON.stringify(state.sessionServices || [], null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {!selectedRule && (
                <SmartSuggestionBox 
                    suggestion={activeSuggestion} 
                    onApply={handleRuleChange} 
                />
            )}

            <div className="subsection">
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Valitse sääntö:</label>
                <select className="modern-select" value={selectedRule?.id || ""} onChange={e => handleRuleChange(e.target.value, 1, 3, null)}>
                    <option value="">-- Ei säännöllistä tarvetta --</option>
                    {rules.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>

            {selectedRule && (
                <>
                    <BasketSlotPicker 
                        slots={proposedSlots} 
                        basket={basket}
                        bookedSlots={bookedSlots}
                        setBasket={setBasket}
                        onBook={handleBooking} 
                        isAktivointi={selectedRule.metadata?.triggers?.require_yleistuki} 
                        forcedMode={activeForcedMode}
                        confirmedCount={confirmedSlots.length} 
                        weekOffset={weekOffset}
                        onOffsetChange={(val) => setWeekOffset(prev => Math.max(0, prev + val))}
                    />
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                        <NumericSelector label="Määrä:" options={[1, 2, 3, 4, 5]} value={count} onChange={handleCountChange} />
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Aikaikkuna (kk):</label>
                            <select className="modern-select" value={period} onChange={e => handlePeriodChange(parseInt(e.target.value))}>
                                {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} kk</option>)}
                            </select>
                        </div>
                    </div>
                </>
            )}

            <div className="summary-preview" style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Suunnitelmateksti</h4>
                    {confirmedSlots.length > 0 && <CheckCircle2 size={16} color="#10b981" />}
                </div>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'pre-line', margin: '10px 0' }}>{generatePhrase()}</p>
                <div style={{ marginTop: '1rem' }}>
                    <CopyButton text={generatePhrase()} />
                </div>
            </div>
        </Card>
    );
};

export default AikatauluEhdotus;