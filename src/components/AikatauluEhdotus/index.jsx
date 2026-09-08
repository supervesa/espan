// --- src/components/AikatauluEhdotus/AikatauluEhdotus.jsx ---
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

import { generateGreetingToken } from '../../utils/tokenGenerator';
import { findAvailableSlots } from './schedulingUtils'; 

import { generateSmartDraft } from './draftingEngine';
import { getAlueJaToimipiste } from '../../hooks/usePostinumero';
import { FlaskConical, Calendar, User, Activity, CheckCircle2, Phone, Database, Link, AlertCircle, History, Download, Zap, Beaker } from 'lucide-react';

import { useViestiKokoamo } from '../../hooks/useViestiKokoamo';
import TilausAssistenttiPaneeli from './TilausAssistenttiPaneeli';
import { getInterpretedWeekSlots } from './locationInterpreter';

// UUDEN ÄLYKALENTERIN IMPORTIT
import IntelAssistant from './IntelAssistant';
import IntelBasketSlotPicker from './IntelBasketSlotPicker';
import { findAvailableSlots as findIntelSlots } from './IntelSchedulingUtils';
import { calculateExpectedDuration } from './IntelAssistant/IntelEngine';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const AikatauluEhdotus = ({ state, actions }) => {
    const { activeSignals, getSignalInfo } = useSignal();

    const [expertId, setExpertId] = useState(null);
    const [useIntelEngine, setUseIntelEngine] = useState(false);
    
    // 🟢 UUSI: Testitilan kytkin (Oletuksena true, jotta vältytään vahingoilta)
    const [isTestMode, setIsTestMode] = useState(true);
    
    const [rules, setRules] = useState([]);
    const [expertRules, setExpertRules] = useState([]);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [expertLocations, setExpertLocations] = useState([]);
    const [dbSettings, setDbSettings] = useState(null); 
    const [dbUniversalData, setDbUniversalData] = useState([]); 
    const [roomBookings, setRoomBookings] = useState([]); // 🟢 UUSI: Huonevaraukset tilamuuttujaan
    const [loading, setLoading] = useState(true);

    const [selectedRule, setSelectedRule] = useState(null);
    const [proposedSlots, setProposedSlots] = useState([]);
    const [confirmedSlots, setConfirmedSlots] = useState([]);
    const [count, setCount] = useState(1);
    const [period, setPeriod] = useState(3);
    const [activeForcedMode, setActiveForcedMode] = useState(null);
    
    const [weekOffset, setWeekOffset] = useState(0);
    const [basket, setBasket] = useState([]);
    const [isMandatory, setIsMandatory] = useState(true);
    
    const [viewMode, setViewMode] = useState('puhelu');
    const [intelDuration, setIntelDuration] = useState(60); 

    const prevPhraseRef = useRef("");

    const interpreterState = useMemo(() => {
        let lang = state?.asiakas?.asiointikieli || state?.asiakas?.aidinkieli || 'suomi';
        let explicitTulkki = false;

        Object.keys(activeSignals || {}).forEach(key => {
            const val = activeSignals[key];
            if (!val || val.isMuted) return; 

            if (key === 'osallistuu_tulkki') explicitTulkki = true;

            const info = getSignalInfo(key);
            if (info && (info.cat === 'Äidinkieli' || info.cat === 'Asiointikieli')) lang = info.label;
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
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                setExpertId(currentExpertId);

                const queryIds = [currentExpertId, LEGACY_ID];

                // 🟢 LISÄTTY: Haetaan myös room_bookings
                const [kb, er, av, locs, sets, uni, rooms] = await Promise.all([
                    supabase.schema('espan').from('knowledge_base').select('*'),
                    supabase.schema('espan').from('expert_availability_rules').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('availability').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('settings_ajanvaraus').select('*').in('asiantuntija_id', queryIds),
                    supabase.schema('espan').from('universaali_kesto_analytiikka').select('*').in('asiantuntija_id', queryIds),
                    supabase.schema('espan').from('room_bookings').select('*').in('expert_id', queryIds)
                ]);
                
                setRules(kb.data || []);
                setExpertRules(er.data || []);
                setBookedSlots(av.data || []);
                setExpertLocations(locs.data || []); 
                setDbSettings(sets.data?.[0] || null);
                setDbUniversalData(uni.data || []);
                setRoomBookings(rooms.data || []); // 🟢 Tallennetaan huonevaraukset
            } catch (err) { 
                console.error("Tietokantavirhe:", err); 
            }
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
        const result = analyzeSchedule(rules, activeSignals, services, perustiedotVars);

        if (result.suggestion) {
            const postinro = state?.asiakas?.postinumero;
            if (postinro) {
                const { toimipiste } = getAlueJaToimipiste(postinro);
                result.suggestion.toimipiste = toimipiste;
            } else {
                result.suggestion.toimipiste = 'Malminkatu (Oletus)';
            }
        }

        return result;
    }, [rules, activeSignals, state.sessionServices, perustiedotVars, state?.asiakas?.postinumero]);

    const getIdealLocation = () => {
        const postinro = state?.asiakas?.postinumero;
        return postinro ? getAlueJaToimipiste(postinro).toimipiste : 'Malminkatu (Oletus)';
    };

    const getTargetDuration = (type, modeOverride) => {
        const durationData = calculateExpectedDuration({
            settings: dbSettings,
            clientType: type,
            mode: modeOverride,
            needsInterpreter: interpreterState.needsInterpreter,
            isFamiliar: state?.suunnitelman_perustiedot?.tapaamishistoria?.length > 0,
            clientVaultData: state?.asiakas?.kestot || {},
            universalData: dbUniversalData
        });
        return durationData.expectedDuration;
    };

    useEffect(() => {
        if (!selectedRule) { setProposedSlots([]); return; }
        let type = 'normi';
        if (selectedRule.metadata?.triggers?.require_yleistuki) type = 'aktivointi';
        else if (selectedRule.title.toLowerCase().includes('täydentävä')) type = 'taydentava';
        
        const searchStart = new Date();
        searchStart.setDate(searchStart.getDate() + (weekOffset * 7));

        if (useIntelEngine) {
            const idealLocation = getIdealLocation();
            const targetDur = getTargetDuration(type, activeForcedMode || viewMode);
            setIntelDuration(targetDur);

            // 🟢 LISÄTTY: Välitetään roomBookings älymoottorille viimeisenä parametrina!
            const slots = findIntelSlots(
                type, expertRules, bookedSlots, searchStart, targetDur, 2, 
                dbSettings, activeSuggestion?.priority === 1, expertLocations, {}, 
                activeForcedMode || viewMode, idealLocation, roomBookings
            );
            setProposedSlots(slots);
        } else {
            const slots = getInterpretedWeekSlots(type, expertRules, bookedSlots, searchStart, expertLocations, viewMode);
            setProposedSlots(slots);
        }
    }, [selectedRule, expertRules, bookedSlots, weekOffset, activeSuggestion, expertLocations, viewMode, useIntelEngine, dbSettings, dbUniversalData, interpreterState, state?.asiakas, state?.suunnitelman_perustiedot, roomBookings]); // 🟢 Varmistettu, että useEffect päivittyy huoneiden muuttuessa

    const handleBasketUpdate = (newBasketAction) => {
        setBasket(prevBasket => {
            let newBasket = typeof newBasketAction === 'function' ? newBasketAction(prevBasket) : newBasketAction;
            
            if (useIntelEngine && count === 1 && newBasket.length > 1) {
                newBasket = [newBasket[newBasket.length - 1]];
            }

            const updatedBasket = [];
            const newlyUsedTokens = [];

            for (const item of newBasket) {
                if (item.sync_token) {
                    updatedBasket.push(item);
                    newlyUsedTokens.push({ dateStr: new Date(item.time).toISOString().split('T')[0], token: item.sync_token });
                    continue;
                }

                const dateStr = new Date(item.time).toISOString().split('T')[0];
                const existingForDay = bookedSlots
                    .filter(b => b.start_time && b.start_time.startsWith(dateStr) && b.sync_token)
                    .map(b => b.sync_token);

                const newlyGeneratedForDay = newlyUsedTokens
                    .filter(t => t.dateStr === dateStr)
                    .map(t => t.token);

                const allUsed = [...existingForDay, ...newlyGeneratedForDay];
                const safeToken = generateGreetingToken(item.time, allUsed);
                
                updatedBasket.push({ ...item, sync_token: safeToken });
                newlyUsedTokens.push({ dateStr, token: safeToken });
            }

            return updatedBasket;
        });
    };

    const runSmartDraft = (ruleObj, newCount, newPeriod, forcedMode, passedTargetDate) => {
        if (!ruleObj) return;
        let type = 'normi';
        if (ruleObj.metadata?.triggers?.require_yleistuki) type = 'aktivointi';
        else if (ruleObj.title.toLowerCase().includes('täydentävä')) type = 'taydentava';

        let draftBasket = [];

        if (useIntelEngine) {
            const mode = forcedMode || 'puhelu';
            const duration = getTargetDuration(type, mode);
            const idealLoc = getIdealLocation();
            
            draftBasket = generateSmartDraft(
                ruleObj, expertRules, bookedSlots, newCount, newPeriod, passedTargetDate, 
                expertLocations, dbSettings, mode, idealLoc, duration, roomBookings // 🟢 Lisätty huoneet tähänkin
            );
        } else {
            draftBasket = generateSmartDraft(ruleObj, expertRules, bookedSlots, newCount, newPeriod, passedTargetDate, expertLocations);
        }

        handleBasketUpdate(draftBasket);
    };

    const handleRuleChange = (ruleId, suggestedCount = 1, suggestedPeriod = 3, forcedMode = null) => {
        const rule = rules.find(r => r.id === ruleId);
        setSelectedRule(rule);
        if (rule) {
            let finalCount = suggestedCount;
            let finalMode = forcedMode;
            if (rule.metadata?.triggers?.require_yleistuki) {
                finalCount = 2; 
                finalMode = 'kaynti';
            }

            setCount(finalCount);
            setPeriod(suggestedPeriod);
            setActiveForcedMode(finalMode);
            if (finalMode) setViewMode(finalMode);
            
            setIsMandatory(rule.title.toLowerCase().includes('alkuhaastattelu') || rule.title.toLowerCase().includes('työnhakukeskustelu') || rule.metadata?.triggers?.require_yleistuki);
            
            const passedTargetDate = (activeSuggestion && rule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
            
            let newOffset = 0;
            if (passedTargetDate) {
                const now = new Date();
                now.setHours(0,0,0,0);
                const target = new Date(passedTargetDate);
                target.setHours(0,0,0,0);
                if (target > now) {
                    newOffset = Math.max(0, Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));
                }
            }
            setWeekOffset(newOffset);
            
            runSmartDraft(rule, finalCount, suggestedPeriod, finalMode, passedTargetDate);
        } else {
            handleBasketUpdate([]);
            setActiveForcedMode(null);
            setWeekOffset(0);
        }
    };

    const handleCountChange = (newCount) => {
        setCount(newCount);
        const passedTargetDate = (activeSuggestion && selectedRule && selectedRule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
        runSmartDraft(selectedRule, newCount, period, activeForcedMode, passedTargetDate);
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        const passedTargetDate = (activeSuggestion && selectedRule && selectedRule.id === activeSuggestion.rule.id) ? activeSuggestion.targetDate : null;
        runSmartDraft(selectedRule, count, newPeriod, activeForcedMode, passedTargetDate);
    };

    const handleBooking = async () => {
        if (basket.length === 0 || !expertId) return; 
        
        let type = 'normi';
        if (selectedRule.metadata?.triggers?.require_yleistuki) type = 'aktivointi';
        else if (selectedRule.title.toLowerCase().includes('täydentävä')) type = 'taydentava';
        
        // 🟢 Välitetään kantaan "testi": isTestMode !
        // 🟢 KORJATTU keston luku: item.duration_minutes || ...
        const inserts = basket.map(item => ({ 
            expert_id: expertId, 
            start_time: item.time.toISOString(), 
            meeting_type: type, 
            contact_method: item.mode, 
            is_blocked: true,
            sync_token: item.sync_token,
            duration_minutes: item.duration_minutes || (useIntelEngine ? intelDuration : 60),
            testi: isTestMode 
        }));
        
        try {
            const { error: insertError } = await supabase.schema('espan').from('availability').insert(inserts);
            
            if (!insertError) {
                setConfirmedSlots(basket);
                setBookedSlots([...bookedSlots, ...inserts]);
            } else {
                throw insertError;
            }
        } catch (err) { 
            console.error(err);
            alert("Varaus epäonnistui."); 
        }
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

    const hasTranslatedSlots = proposedSlots.some(s => s.isTranslated) || basket.some(s => s.isTranslated);

    if (loading) return <Card title="Ladataan aikatauluavustajaa..."></Card>;

    return (
        <Card title="Sentinel Guardian: Aikatauluavustaja">
            
            {/* 🟢 YLÄRIVIN KYTKIMET: Testi-tila ja BETA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                <label className="custom-checkbox-row" style={{ padding: '0.4rem 0.8rem', background: isTestMode ? '#fefce8' : '#f8fafc', border: `1px solid ${isTestMode ? '#fde047' : '#e2e8f0'}`, borderRadius: '8px', margin: 0 }}>
                    <input 
                        type="checkbox" 
                        className="modern-checkbox" 
                        checked={isTestMode} 
                        onChange={(e) => setIsTestMode(e.target.checked)} 
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Beaker size={16} className={isTestMode ? "text-warning" : "text-secondary"} />
                        <span className={`text-sm fw-semibold ${isTestMode ? 'text-warning' : 'text-secondary'}`} style={{ color: isTestMode ? '#a16207' : '' }}>
                            Testivaraus (Haamudata)
                        </span>
                    </div>
                </label>

                <button 
                    className={`btn ${useIntelEngine ? '' : 'btn--secondary'}`} 
                    onClick={() => setUseIntelEngine(!useIntelEngine)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <Zap size={16} fill={useIntelEngine ? '#fff' : 'none'} color={useIntelEngine ? '#fff' : 'var(--color-primary)'}/> 
                    {useIntelEngine ? 'Palaa perinteiseen kalenteriin' : 'Kokeile uutta Älykalenteria (BETA)'}
                </button>
            </div>

            {!selectedRule && (
                <SmartSuggestionBox suggestion={activeSuggestion} onApply={handleRuleChange} />
            )}

            <div className="subsection">
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Valitse sääntö:</label>
                <select 
                    className="modern-select" 
                    value={selectedRule?.id || ""} 
                    onChange={e => {
                        const ruleId = e.target.value;
                        if (!ruleId) {
                            handleRuleChange("", 1, 3, null);
                            return;
                        }
                        
                        const selectedObj = rules.find(r => r.id === ruleId);
                        let defaultCount = 1;
                        let defaultMode = null;
                        
                        if (selectedObj?.metadata?.triggers?.require_yleistuki) {
                            defaultCount = 2; 
                            defaultMode = 'kaynti';
                        }
                        
                        handleRuleChange(ruleId, defaultCount, 3, defaultMode);
                    }}
                >
                    <option value="">-- Ei säännöllistä tarvetta --</option>
                    {rules.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>

            {selectedRule && (
                <>
                    {useIntelEngine && (
                        <div style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                            <IntelAssistant 
                                suggestion={{
                                    ...activeSuggestion,
                                    toimipiste: state?.asiakas?.postinumero ? getAlueJaToimipiste(state.asiakas.postinumero).toimipiste : 'Malminkatu (Oletus)',
                                    forcedMode: activeForcedMode || viewMode
                                }}
                                onApply={() => {}} 
                                basket={basket}
                                clientType={selectedRule.metadata?.triggers?.require_yleistuki ? 'aktivointi' : (selectedRule.title.toLowerCase().includes('täydentävä') ? 'taydentava' : 'normi')}
                                is46={activeSuggestion?.priority === 1}
                                needsInterpreter={interpreterState.needsInterpreter}
                                isFamiliar={state?.suunnitelman_perustiedot?.tapaamishistoria?.length > 0}
                                expertLocations={expertLocations}
                                clientVaultData={state?.asiakas?.kestot || {}}
                                injectedSettings={dbSettings}
                            />
                        </div>
                    )}

                    {!useIntelEngine && hasTranslatedSlots && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <AlertCircle size={18} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.4 }}>
                                <strong>Älykäs sovitus aktiivinen:</strong> Järjestelmä on lennosta kääntänyt osan avoimista ajoista (käynti ↔ puhelu) vastaamaan kalenteriisi lukittua etä- tai lähityöpaikkaa.
                            </div>
                        </div>
                    )}

                    {useIntelEngine ? (
                        <IntelBasketSlotPicker 
                            slots={proposedSlots} 
                            basket={basket}
                            bookedSlots={bookedSlots}
                            setBasket={handleBasketUpdate} 
                            onBook={handleBooking} 
                            isAktivointi={selectedRule.metadata?.triggers?.require_yleistuki} 
                            confirmedCount={confirmedSlots.length} 
                            weekOffset={weekOffset}
                            onOffsetChange={(val) => setWeekOffset(prev => Math.max(0, prev + val))}
                            currentMode={viewMode}
                            onModeChange={setViewMode}
                        />
                    ) : (
                        <BasketSlotPicker 
                            slots={proposedSlots} 
                            basket={basket}
                            bookedSlots={bookedSlots}
                            setBasket={handleBasketUpdate} 
                            onBook={handleBooking} 
                            isAktivointi={selectedRule.metadata?.triggers?.require_yleistuki} 
                            forcedMode={activeForcedMode}
                            confirmedCount={confirmedSlots.length} 
                            weekOffset={weekOffset}
                            onOffsetChange={(val) => setWeekOffset(prev => Math.max(0, prev + val))}
                            currentMode={viewMode}
                            onModeChange={setViewMode}
                        />
                    )}
                    
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
                    interpreterState={interpreterState}
                />
            </div>
        </Card>
    );
};

export default AikatauluEhdotus;