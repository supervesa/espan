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
import { FlaskConical, Calendar, User, Activity, CheckCircle2, Phone, Database, Link, AlertCircle, History, Download } from 'lucide-react';

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
    
    // --- UUSI TILA BETA-OSIOTA VARTEN ---
    const [asiakasId, setAsiakasId] = useState('');

    const prevPhraseRef = useRef("");

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

    // Haetaan edellisen tapaamisen päivämäärä OIKESTA polusta
    const edellinenTapaaminenRaaka = state?.asiakas?.edellinen_tapaaminen_pvm || "–";

    // Turvamuotoilu: estää Reactin kaatumisen ja siistii mahdolliset ISO-stringit
    const edellinenTapaaminen = useMemo(() => {
        if (!edellinenTapaaminenRaaka || edellinenTapaaminenRaaka === "–") return "–";
        try {
            // Jos se on jo muodossa "12.6.2026", palautetaan sellaisenaan
            if (typeof edellinenTapaaminenRaaka === 'string' && edellinenTapaaminenRaaka.includes('.')) {
                return edellinenTapaaminenRaaka;
            }
            const d = new Date(edellinenTapaaminenRaaka);
            return isNaN(d) ? edellinenTapaaminenRaaka : d.toLocaleDateString('fi-FI');
        } catch (e) {
            return edellinenTapaaminenRaaka;
        }
    }, [edellinenTapaaminenRaaka]);

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
        
        // --- UUSI LOGIIKKA: JOUSTAVA KALENTERIHAKU TAVOITTEEN MUKAAN ---
        let baseSearchStart = new Date();
        
        // Jos käytämme moottorin ehdottamaa sääntöä jolla on "Target Date" (esim. 3 kk etappi)
        if (activeSuggestion && selectedRule.id === activeSuggestion.rule.id && activeSuggestion.targetDate) {
            baseSearchStart = new Date(activeSuggestion.targetDate);
            // Haetaan ehdotuksia esim. 14 pv ennen virallista eräpäivää
            baseSearchStart.setDate(baseSearchStart.getDate() - 14);
            
            // Estetään kuitenkin haun meneminen menneisyyteen
            const today = new Date();
            if (baseSearchStart < today) {
                baseSearchStart = today;
            }
        }
        // ---------------------------------------------------------------
        
        const searchStart = new Date(baseSearchStart);
        searchStart.setDate(searchStart.getDate() + (weekOffset * 7));
        
        setProposedSlots(findAvailableSlots(type, expertRules, bookedSlots, searchStart, 1));
    }, [selectedRule, expertRules, bookedSlots, weekOffset, activeSuggestion]); // < Lisätty activeSuggestion

    const handleRuleChange = (ruleId, suggestedCount = 1, suggestedPeriod = 3, forcedMode = null) => {
        const rule = rules.find(r => r.id === ruleId);
        setSelectedRule(rule);
        
        if (rule) {
            setCount(suggestedCount);
            setPeriod(suggestedPeriod);
            setActiveForcedMode(forcedMode);
            
            // Välitetään tavoitepäivä, jos sääntö täsmää moottorin ehdotukseen
            const passedTargetDate = (activeSuggestion && rule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
            setBasket(generateSmartDraft(rule, expertRules, bookedSlots, suggestedCount, suggestedPeriod, passedTargetDate));
        } else {
            setBasket([]);
            setActiveForcedMode(null);
        }
    };

    const handleCountChange = (newCount) => {
        setCount(newCount);
        const passedTargetDate = (activeSuggestion && selectedRule && selectedRule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
        setBasket(generateSmartDraft(selectedRule, expertRules, bookedSlots, newCount, period, passedTargetDate));
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        const passedTargetDate = (activeSuggestion && selectedRule && selectedRule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
        setBasket(generateSmartDraft(selectedRule, expertRules, bookedSlots, count, newPeriod, passedTargetDate));
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

    // --- UUSI BETA-OMINAISUUS: LATAUSFUNKTIO ---
    const handleDownloadICS = () => {
        const activeList = confirmedSlots.length > 0 ? confirmedSlots : basket;
        if (activeList.length === 0) return;

        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SentinelGuardian//FI\nCALSCALE:GREGORIAN\n";

        activeList.forEach((slot, index) => {
            const startDate = new Date(slot.time);
            // Oletetaan tapaamisen kestoksi 1 tunti
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); 

            // iCal vaatii aikaleimat UTC muodossa ilman erikoismerkkejä (esim. 20260618T120000Z)
            const formatICSDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const modeText = slot.mode === 'kaynti' ? 'läsnä' : 'puhelu';
            const rawId = asiakasId.trim();
            const title = `Ajanvaraus/${modeText}${rawId ? ` ${rawId}` : ''}`;

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:sentinel-event-${startDate.getTime()}-${index}\n`;
            icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
            icsContent += `DTSTART:${formatICSDate(startDate)}\n`;
            icsContent += `DTEND:${formatICSDate(endDate)}\n`;
            icsContent += `SUMMARY:${title}\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        // Luodaan tiedosto ja ladataan se selaimen kautta
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', 'asiakas_ajat.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
                    <div className="debug-item"><History size={12}/> Edellinen: <strong>{edellinenTapaaminen}</strong></div>
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

            {/* BETA: ICS VIENTI */}
            {(basket.length > 0 || confirmedSlots.length > 0) && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#166534', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' }}>
                        BETA: Vie kalenteriin
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: '#15803d', marginBottom: '10px', fontStyle: 'italic' }}>
                        Syötä alle asiakkaan tunniste (esim. asiointinumero). Tieto lisätään vain luotavan tiedoston otsikkoon, <strong>sitä ei tallenneta järjestelmään.</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Asiakkaan ID"
                            value={asiakasId}
                            onChange={(e) => setAsiakasId(e.target.value)}
                            style={{ 
                                flex: 1, 
                                padding: '0.4rem 0.6rem', 
                                border: '1px solid #bbf7d0', 
                                borderRadius: '4px', 
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleDownloadICS}
                            style={{
                                padding: '0.4rem 1rem',
                                backgroundColor: '#22c55e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
                        >
                            <Download size={14} /> Lataa .ics
                        </button>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default AikatauluEhdotus;