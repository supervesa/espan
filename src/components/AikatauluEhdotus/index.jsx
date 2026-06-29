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

import { useViestiKokoamo } from '../../hooks/useViestiKokoamo';
import TilausAssistenttiPaneeli from './TilausAssistenttiPaneeli';

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

const AikatauluEhdotus = ({ state, actions }) => {
    // 1. OTETAAN MYÖS getSignalInfo KÄYTTÖÖN
    const { activeSignals, getSignalInfo } = useSignal();

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
    const [isMandatory, setIsMandatory] = useState(true);
    const [expertLocations, setExpertLocations] = useState([]);

    const prevPhraseRef = useRef("");

    // --- UUSI TÄYSIN DYNAAMINEN TULKKIPÄÄTTELY ---
    const interpreterState = useMemo(() => {
        let lang = state?.asiakas?.asiointikieli || state?.asiakas?.aidinkieli || 'suomi';
        let explicitTulkki = false;

        Object.keys(activeSignals || {}).forEach(key => {
            const val = activeSignals[key];
            if (!val || val.isMuted) return; // Ohitetaan mykistetyt

            if (key === 'osallistuu_tulkki') {
                explicitTulkki = true;
            }

            // Kysytään sanakirjalta, mihin kategoriaan tämä signaali kuuluu
            const info = getSignalInfo(key);
            if (info && (info.cat === 'Äidinkieli' || info.cat === 'Asiointikieli')) {
                lang = info.label;
            }
        });

        const isDomestic = ['suomi', 'ruotsi', 'englanti'].includes(lang.toLowerCase().trim());
        const needsInterpreter = !isDomestic || explicitTulkki;

        return {
            language: lang,
            displayLanguage: !isDomestic ? lang : (explicitTulkki ? 'Määrittelemätön kieli' : 'suomi'),
            needsInterpreter,
            hasTulkkiSignal: explicitTulkki
        };
    }, [state?.asiakas, activeSignals, getSignalInfo]);

    // 2. VÄLITETÄÄN TULKKIPAKETTI SUORAAN HOOKILLE
    const { virallinenTeksti, virallinenTekstiICS, smsTeksti, resolvedAddress } = useViestiKokoamo(
        selectedRule,
        basket.length > 0 ? basket : confirmedSlots,
        isMandatory,
        expertLocations,
        interpreterState
    );

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [kb, er, av, locs] = await Promise.all([
                    supabase.schema('espan').from('knowledge_base').select('*'),
                    supabase.schema('espan').from('expert_availability_rules').select('*').eq('expert_id', EXPERT_ID),
                    supabase.schema('espan').from('availability').select('*').eq('expert_id', EXPERT_ID),
                    supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', EXPERT_ID)
                ]);
                setRules(kb.data || []);
                setExpertRules(er.data || []);
                setBookedSlots(av.data || []);
                setExpertLocations(locs.data || []); 
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

    const { suggestion: activeSuggestion, diagnostics } = useMemo(() => {
        const services = Array.isArray(state.sessionServices) ? state.sessionServices : [];
        return analyzeSchedule(rules, activeSignals, services, perustiedotVars);
    }, [rules, activeSignals, state.sessionServices, perustiedotVars]);

    useEffect(() => {
        if (!selectedRule) { setProposedSlots([]); return; }
        let type = 'normi';
        if (selectedRule.metadata?.triggers?.require_yleistuki) type = 'aktivointi';
        else if (selectedRule.title.toLowerCase().includes('täydentävä')) type = 'taydentava';
        
        let baseSearchStart = new Date();
        if (activeSuggestion && selectedRule.id === activeSuggestion.rule.id && activeSuggestion.targetDate) {
            baseSearchStart = new Date(activeSuggestion.targetDate);
            baseSearchStart.setDate(baseSearchStart.getDate() - 14);
            if (baseSearchStart < new Date()) baseSearchStart = new Date();
        }
        const searchStart = new Date(baseSearchStart);
        searchStart.setDate(searchStart.getDate() + (weekOffset * 7));
        setProposedSlots(findAvailableSlots(type, expertRules, bookedSlots, searchStart, 1));
    }, [selectedRule, expertRules, bookedSlots, weekOffset, activeSuggestion]);

    const handleRuleChange = (ruleId, suggestedCount = 1, suggestedPeriod = 3, forcedMode = null) => {
        const rule = rules.find(r => r.id === ruleId);
        setSelectedRule(rule);
        if (rule) {
            setCount(suggestedCount);
            setPeriod(suggestedPeriod);
            setActiveForcedMode(forcedMode);
            setIsMandatory(rule.title.toLowerCase().includes('alkuhaastattelu') || rule.title.toLowerCase().includes('työnhakukeskustelu'));
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
        if (selectedRule.metadata?.triggers?.require_yleistuki) type = 'aktivointi';
        else if (selectedRule.title.toLowerCase().includes('täydentävä')) type = 'taydentava';
        
        const inserts = basket.map(item => ({ expert_id: EXPERT_ID, start_time: item.time.toISOString(), meeting_type: type, contact_method: item.mode, is_blocked: true }));
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
            {!selectedRule && (
                <SmartSuggestionBox suggestion={activeSuggestion} onApply={handleRuleChange} />
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

            {selectedRule && (
                <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: isMandatory ? '#fff5f5' : '#f8fafc', border: `1px solid ${isMandatory ? '#fecaca' : '#e2e8f0'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" id="velvoittavuus-tapka" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="velvoittavuus-tapka" style={{ fontSize: '0.85rem', fontWeight: '600', color: isMandatory ? '#991b1b' : '#334155', cursor: 'pointer' }}>
                        Tapaaminen on velvoittava
                    </label>
                </div>
            )}

            <div className="summary-preview" style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Suunnitelmateksti</h4>
                </div>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'pre-line', margin: '10px 0' }}>{generatePhrase()}</p>
                <div style={{ marginTop: '1rem' }}>
                    <CopyButton text={generatePhrase()} />
                </div>
            </div>

            <div style={{ marginTop: '2rem', borderTop: '2px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <TilausAssistenttiPaneeli 
                    basket={basket.length > 0 ? basket : confirmedSlots} 
                    virallinenTeksti={virallinenTeksti}
                    virallinenTekstiICS={virallinenTekstiICS}
                    smsTeksti={smsTeksti}
                    selectedRule={selectedRule}
                    expertLocations={expertLocations} 
                    resolvedAddress={resolvedAddress}
                    interpreterState={interpreterState} // 3. TULKKIPAKETTI PANEELILLE
                />
            </div>
        </Card>
    );
};

export default AikatauluEhdotus;