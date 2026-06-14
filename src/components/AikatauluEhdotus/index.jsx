import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import NumericSelector from '../common/NumericSelector';
import CopyButton from '../common/CopyButton';
import BasketSlotPicker from './BasketSlotPicker';
import { findAvailableSlots, parseSafeDate } from './schedulingUtils';
import { generateSmartDraft } from './draftingEngine';
import { Sparkles, FlaskConical, Calendar, User, Activity, CheckCircle2, Phone, Info } from 'lucide-react';

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

const AikatauluEhdotus = ({ state, actions }) => {
    const [rules, setRules] = useState([]);
    const [expertRules, setExpertRules] = useState([]);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedRule, setSelectedRule] = useState(null);
    const [proposedSlots, setProposedSlots] = useState([]);
    const [confirmedSlots, setConfirmedSlots] = useState([]);
    const [count, setCount] = useState(1);
    const [period, setPeriod] = useState(3);
    const [debugMode, setDebugMode] = useState(false);
    
    const [weekOffset, setWeekOffset] = useState(0);
    const [basket, setBasket] = useState([]);

    const prevPhraseRef = useRef("");

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

    const thAlkamisPvm = useMemo(() => perustiedotVars?.PVM || perustiedotVars?.PÄIVÄMÄÄRÄ || state.signals?.tyonhaku_alkanut || null, [perustiedotVars, state.signals]);
    const laskettuKestoKk = useMemo(() => {
        const startDate = parseSafeDate(thAlkamisPvm);
        if (!startDate) return 0;
        const today = new Date();
        return Math.max(0, (today.getFullYear() - startDate.getFullYear()) * 12 - startDate.getMonth() + today.getMonth());
    }, [thAlkamisPvm]);

    const syntyVuosi = useMemo(() => perustiedotVars?.SYNTYMÄVUOSI || state.signals?.syntymavuosi || null, [perustiedotVars, state.signals]);
    const laskettuIka = useMemo(() => {
        if (!syntyVuosi) return null;
        const nro = parseInt(String(syntyVuosi).replace(/\D/g, ''), 10);
        return isNaN(nro) ? null : ((nro > 1900) ? new Date().getFullYear() - nro : nro);
    }, [syntyVuosi]);

    const activeSignals = state?.signals || {};
    const onYleistuki = !!activeSignals.tt_etuus_yleistuki;
    const onToimeentulotuki = !!activeSignals.ETUUS_TOIMEENTULOTUKI;

    const laatimisTapa = perustiedotVars?.YHTEYDENOTTOTAPA || "–";
    const suunnitelmaLaadittuPvm = perustiedotVars?.PÄIVÄMÄÄRÄ || "–";

    const suggestion = useMemo(() => {
        if (!rules.length) return null;
        if (onYleistuki) return { rule: rules.find(r => r.metadata?.triggers?.require_yleistuki === true), reason: "Yleistuki (Aktivointijakso)", type: 'aktivointi' };
        if (laskettuKestoKk >= 6) return { rule: rules.find(r => r.title.includes("Täydentävät")), reason: `Työnhaku kestänyt ${laskettuKestoKk} kk`, type: 'normi' };
        return null;
    }, [rules, onYleistuki, laskettuKestoKk]);

    // UI-GRIDIN HAKU KORJATTU YMMÄRTÄMÄÄN "TÄYDENTÄVÄ"
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

    const handleRuleChange = (ruleId) => {
        const rule = rules.find(r => r.id === ruleId);
        setSelectedRule(rule);
        if (rule) {
            let newCount = 1;
            let newPeriod = 3;
            if (rule.metadata?.triggers?.require_yleistuki) { newCount = 3; newPeriod = 3; }
            setCount(newCount);
            setPeriod(newPeriod);
            
            setBasket(generateSmartDraft(rule, expertRules, bookedSlots, newCount, newPeriod));
        } else {
            setBasket([]);
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

    // TALLENNUSFUNKTIO KORJATTU YMMÄRTÄMÄÄN "TÄYDENTÄVÄ"
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

    if (loading) return <Card title="Ladataan aikatauluavustajaa..."></Card>;

    return (
        <Card title="Sentinel Guardian: Aikatauluavustaja">
            
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FlaskConical size={14} /> LIVE SIGNAL MONITOR
                    </span>
                    <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem' }}>
                    <div className="debug-item"><Phone size={12}/> Tapa: <strong>{laatimisTapa}</strong></div>
                    <div className="debug-item"><Calendar size={12}/> Laadittu: {suunnitelmaLaadittuPvm}</div>
                    <div className="debug-item"><User size={12}/> Ikä: {laskettuIka || '–'} v</div>
                    <div className="debug-item"><Activity size={12}/> TH-kesto: <span style={{fontWeight:'bold', color:'var(--color-primary)'}}>{laskettuKestoKk} kk</span></div>
                    <div className="debug-item"><Activity size={12}/> Yleistuki: {onYleistuki ? <span style={{color:'green', fontWeight:'bold'}}>K</span> : 'E'}</div>
                    <div className="debug-item"><Activity size={12}/> Toimeentulo: {onToimeentulotuki ? <span style={{color:'green', fontWeight:'bold'}}>K</span> : 'E'}</div>
                </div>
            </div>

            {suggestion && !selectedRule && (
                <div className="smart-analysis-box" style={{ borderLeft: '4px solid var(--color-ai)', background: 'var(--color-bg-ai)', marginBottom: '1.5rem', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: 'var(--color-ai)', fontWeight: 'bold', fontSize: '0.85rem' }}><Sparkles size={16} /> Älykäs ehdotus</div>
                            <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: '4px 0' }}>{suggestion.rule?.title}</p>
                            <p style={{ fontSize: '0.7rem', color: '#6b7280' }}><strong>Peruste:</strong> {suggestion.reason}</p>
                        </div>
                        <button className="btn" onClick={() => handleRuleChange(suggestion.rule.id)}>Käytä</button>
                    </div>
                </div>
            )}

            <div className="subsection">
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Valitse sääntö:</label>
                <select className="modern-select" value={selectedRule?.id || ""} onChange={e => handleRuleChange(e.target.value)}>
                    <option value="">-- Ei säännöllistä tarvetta --</option>
                    {rules.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>

            {selectedRule && (
                <>
                    <BasketSlotPicker 
                        slots={proposedSlots} 
                        basket={basket}
                        bookedSlots={bookedSlots} // <-- LISÄTTY
                        setBasket={setBasket}
                        onBook={handleBooking} 
                        isAktivointi={selectedRule.metadata?.triggers?.require_yleistuki} 
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
                <CopyButton text={generatePhrase()} />
            </div>
        </Card>
    );
};

export default AikatauluEhdotus;