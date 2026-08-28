// src/components/admin/settings/ajanvaraus/AjanvarausSandbox.jsx

import React, { useState, useEffect } from 'react';
import { Play, Users, Calendar, Trash2, AlertTriangle, Zap, Clock, Bot, Database } from 'lucide-react';
import Card from '../../../common/Card';

// SUPABASE-YHTEYS
import { supabase } from '../../../../utils/supabaseClient';

// KOMPONENTIT & MOOTTORIT
import TilausAssistenttiPaneeli from '../../../AikatauluEhdotus/TilausAssistenttiPaneeli';
import BasketSlotPicker from '../../../AikatauluEhdotus/BasketSlotPicker';
import IntelAssistant from '../../../AikatauluEhdotus/IntelAssistant';

import { findAvailableSlots } from '../../../AikatauluEhdotus/IntelSchedulingUtils';
import { generateGreetingToken } from '../../../../utils/tokenGenerator';
import { clientTemplates } from './dummy';

/* =========================================
   MOCK DATA: Skenaariot
========================================= */

const calendarScenarios = [
    { id: 'aito', label: 'Aito kalenteri (Nykytila)', desc: 'Käyttää tietokannan aitoja varauksia, lomia ja lokaatioita sellaisenaan.', icon: Database },
    { id: 'tetris', label: 'Aito + Tetris-ruuhka (4 kk)', desc: 'Tukkii aitojen sääntöjesi mukaiset ajat 90% täyteen simuloidakseen ruuhkaa.', icon: AlertTriangle },
    { id: 'loma_2vk', label: 'Simuloitu 2 viikon loma', desc: 'Blokkaa heti seuraavat 14 päivää loma-asetuksella.', icon: Calendar },
    { id: 'tuuraus_1vk', label: 'Simuloitu 1 viikon poissaolo', desc: 'Blokkaa seuraavat 7 päivää poissaololla/koulutuksella.', icon: Clock }
];

/* =========================================
   DYNAAMINEN TULOSKATSELIJA (YKSI GRIDIN KORTTI)
========================================= */
const SandboxResultViewer = ({ res, index, dbRules, dbSettings }) => {
    const defaultMode = res.basket.length > 0 ? res.basket[0].mode : 'puhelu';
    const [mode, setMode] = useState(defaultMode);
    
    const calculateInitialOffset = () => {
        if (!res.basket || res.basket.length === 0) return 0;
        const now = new Date();
        now.setHours(0,0,0,0);
        const day = now.getDay() || 7;
        const startOfCurrentWeek = new Date(now);
        startOfCurrentWeek.setDate(now.getDate() - day + 1);

        const t = new Date(res.basket[0].time);
        t.setHours(0,0,0,0);
        const targetDay = t.getDay() || 7;
        const startOfTargetWeek = new Date(t);
        startOfTargetWeek.setDate(t.getDate() - targetDay + 1);

        const diff = Math.round((startOfTargetWeek.getTime() - startOfCurrentWeek.getTime()) / (1000 * 60 * 60 * 24 * 7));
        return diff > 0 ? diff : 0;
    };

    const [offset, setOffset] = useState(calculateInitialOffset());

    const searchStart = new Date();
    searchStart.setDate(searchStart.getDate() + (offset * 7));
    
    // 🟢 VÄLITETÄÄN expertLocations MOOTTORILLE!
    const liveSlots = findAvailableSlots(
        res.client.type,
        dbRules,
        res.tempBookedAtTheTime,
        searchStart,
        2,
        dbSettings,
        res.client.is46,
        res.expertLocations 
    );

    return (
        <div className="ai-workspace" style={{ padding: '1.5rem', margin: 0, borderTop: '4px solid var(--color-primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                        #{index + 1} {res.client.name.split(' (')[0]}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <span className="tag">{res.client.type}</span>
                        {res.client.is46 && <span className="tag tag--warning">46 § Hätätapaus</span>}
                    </div>
                </div>
            </div>
            
            {res.basket.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    
                <IntelAssistant 
                        suggestion={res.mockSuggestion}
                        onApply={() => {}}
                        basket={res.basket}
                        clientType={res.client.type}
                        is46={res.client.is46}
                        needsInterpreter={res.client.needsInterpreter}
                        isFamiliar={res.client.isFamiliar}
                        expertLocations={res.expertLocations}
                        
                        // 🟢 LISÄÄ TÄMÄ RIVI! Tämä syöttää dummy-kestot IntelAssistantin aivoille!
                        clientVaultData={res.client.mockState.kestot || {}} 
                    />

                    <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px dashed var(--color-border)', flex: 1 }}>
                        <h4 className="text-sm fw-bold text-secondary mb-1">Moottorin näkemä kalenteritilanne:</h4>
                        <div style={{ opacity: 0.9 }}>
                            <BasketSlotPicker 
                                slots={liveSlots}
                                basket={res.basket}
                                bookedSlots={res.tempBookedAtTheTime}
                                setBasket={() => {}} 
                                onBook={() => {}}
                                isAktivointi={res.client.type === 'aktivointi'}
                                confirmedCount={0}
                                weekOffset={offset}
                                onOffsetChange={setOffset}
                                currentMode={mode}
                                onModeChange={setMode}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <h4 className="text-sm fw-bold text-secondary mb-3">Lopullinen TilausAssistentin valinta:</h4>
                        <TilausAssistenttiPaneeli 
                            basket={res.basket}
                            selectedRule={res.selectedRule}
                            expertLocations={res.expertLocations}
                            interpreterState={res.interpreterState}
                            virallinenTeksti={`Simuloitu virallinen kutsu asiakkaalle ${res.client.name}...`}
                            smsTeksti={`Hei ${res.client.name}, tässä on pika-kutsusi...`}
                        />
                    </div>
                </div>
            ) : (
                <div className="alert-box alert-box--warning" style={{ marginTop: 'auto' }}>
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Ei vapaita aikoja!</strong>
                        <p className="text-xs mt-1 mb-0">Sääntömoottori ei löytänyt tietokannan säännöistä vapaata aikaa tälle asiakastyypille ja ruuhkatasolle.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

/* =========================================
   HIEKKALAATIKON PÄÄKOMPONENTTI
========================================= */

const AjanvarausSandbox = () => {
    const [dbRules, setDbRules] = useState([]);
    const [dbBooked, setDbBooked] = useState([]);
    const [dbLocations, setDbLocations] = useState([]);
    const [dbSettings, setDbSettings] = useState(null);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [selectedScenario, setSelectedScenario] = useState('aito');
    const [clientQueue, setClientQueue] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [simulationResults, setSimulationResults] = useState(null);

    useEffect(() => {
        const loadDbData = async () => {
            setIsLoadingData(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                const queryIds = [currentExpertId, '00000000-0000-0000-0000-000000000000'];

                const [er, av, locs, sets] = await Promise.all([
                    supabase.schema('espan').from('expert_availability_rules').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('availability').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryIds),
                    supabase.schema('espan').from('settings_ajanvaraus').select('*').in('asiantuntija_id', queryIds)
                ]);

                setDbRules(er.data || []);
                setDbBooked(av.data || []);
                setDbLocations(locs.data || []);
                setDbSettings(sets.data?.[0] || null);
            } catch (err) {
                console.error("Virhe tietojen haussa:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadDbData();
    }, []);

    const handleAddClient = (templateKey) => {
        const newClient = {
            ...clientTemplates[templateKey],
            id: `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        setClientQueue(prev => [...prev, newClient]);
        setSimulationResults(null); 
    };

    const handleRunSimulation = () => {
        if (clientQueue.length === 0) return;
        setIsRunning(true);
        
        setTimeout(() => {
            const sortedQueue = [...clientQueue].sort((a, b) => {
                if (a.is46 && !b.is46) return -1;
                if (!a.is46 && b.is46) return 1;
                return (a.jumpMonths || 0) - (b.jumpMonths || 0) || (a.jumpDays || 0) - (b.jumpDays || 0);
            });

            let tempBooked = [...dbBooked];
            let mockLocations = [...dbLocations];
            const today = new Date();

            // Apufunktio lokaalin YYYY-MM-DD -muodon saamiseksi (välttää UTC-aikavyöhykeongelmat)
            const getLocalDateString = (dateObj) => {
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };

            if (selectedScenario === 'tetris') {
                for (let i = 0; i < 120; i++) {
                    let d = new Date(today);
                    d.setDate(d.getDate() + i);
                    let jsDay = d.getDay() === 0 ? 7 : d.getDay();
                    
                    const dayRules = dbRules.filter(r => r.day_of_week === jsDay && r.is_active);
                    
                    dayRules.forEach((rule, ruleIdx) => {
                        if ((i + ruleIdx) % 5 !== 0) {
                            let slot = new Date(d);
                            const [startH, startM] = rule.start_time.split(':');
                            slot.setHours(parseInt(startH), parseInt(startM), 0, 0);
                            tempBooked.push({ start_time: slot.toISOString(), sync_token: 'tetris-block' });
                        }
                    });
                }
            } else if (selectedScenario === 'loma_2vk') {
                for (let i = 0; i < 14; i++) {
                    let d = new Date(today);
                    d.setDate(d.getDate() + i);
                    const dateStr = getLocalDateString(d);
                    
                    // Siivotaan kyseisen päivän aidot toimistomerkinnät pois tieltä
                    mockLocations = mockLocations.filter(loc => loc.date !== dateStr);
                    
                    mockLocations.push({
                        date: dateStr,
                        location_type: 'loma',
                        location_name: 'Simuloitu 2 vko Loma'
                    });
                }
            } else if (selectedScenario === 'tuuraus_1vk') {
                for (let i = 0; i < 7; i++) {
                    let d = new Date(today);
                    d.setDate(d.getDate() + i);
                    const dateStr = getLocalDateString(d);
                    
                    // Siivotaan kyseisen päivän aidot toimistomerkinnät pois tieltä
                    mockLocations = mockLocations.filter(loc => loc.date !== dateStr);
                    
                    mockLocations.push({
                        date: dateStr,
                        location_type: 'koulutus',
                        location_name: 'Simuloitu Tuuraus / Poissaolo'
                    });
                }
            }

            const results = sortedQueue.map(client => {
                const mockRule = {
                    id: `simulated-rule-${client.type}`,
                    title: client.type === 'taydentava' ? 'Täydentävä tapaaminen' : 'Alkuhaastattelu',
                    metadata: { 
                        triggers: { require_yleistuki: client.type === 'aktivointi' },
                        base_text: 'Tämä on Sandboxin simuloima suunnitelmateksti.'
                    }
                };

                let target = new Date();
                if (client.jumpMonths) target.setMonth(target.getMonth() + client.jumpMonths);
                else if (client.jumpDays !== undefined) target.setDate(target.getDate() + client.jumpDays);

                let forcedMode = null;
                let reasonText = 'Lakisääteinen 3 kk rytmi';
                let prio = 3;

                if (client.is46) {
                    prio = 1;
                    reasonText = '46 § Kriittinen lakisääteinen määräaika';
                } else if (client.type === 'aktivointi') {
                    prio = 2;
                    reasonText = 'Aktivointijakso (Etuus havaittu)';
                    forcedMode = 'kaynti';
                } else if (client.name.includes('Lähivelvoite')) {
                    reasonText = 'Lakisääteinen 6 kk lähikäyntivelvoite ylittynyt';
                    forcedMode = 'kaynti';
                } else if (client.name.includes('Uusi')) {
                    reasonText = 'Työnhaku alkanut (Ei aiempaa historiaa)';
                    forcedMode = 'kaynti';
                }

                const mockSuggestion = {
                    priority: prio,
                    rule: mockRule,
                    reason: reasonText,
                    targetDate: target,
                    toimipiste: 'Malminkatu (Oletus)',
                    forcedMode: forcedMode
                };

                const tempBookedSnapshot = [...tempBooked];

                // 🟢 VÄLITETÄÄN mockLocations (mockLocations) MOOTTORILLE!
                const rawBasket = findAvailableSlots(
                    client.type,
                    dbRules,
                    tempBooked,
                    target,
                    2,
                    dbSettings,
                    client.is46,
                    mockLocations
                );

                const chosenSlots = rawBasket.slice(0, 1).map(s => ({
                    time: s.time,
                    mode: s.mode,
                    isBorrowed: s.isBorrowed,
                    label: s.label
                }));

                const finalBasket = (chosenSlots || []).map(item => {
                    const dateStr = new Date(item.time).toISOString().split('T')[0];
                    const existingForDay = tempBooked
                        .filter(b => b.start_time && b.start_time.startsWith(dateStr) && b.sync_token)
                        .map(b => b.sync_token);
                    
                    let safeToken = 'Oletus-Token';
                    try { safeToken = generateGreetingToken(item.time, existingForDay); } catch(e) {}
                    
                    tempBooked.push({ start_time: new Date(item.time).toISOString(), sync_token: safeToken });
                    return { ...item, sync_token: safeToken };
                });

                return {
                    client,
                    basket: finalBasket,
                    tempBookedAtTheTime: tempBookedSnapshot,
                    selectedRule: mockRule,
                    mockSuggestion,
                    expertLocations: mockLocations, // Välitetään kortille näkyviin
                    interpreterState: {
                        needsInterpreter: client.needsInterpreter,
                        displayLanguage: client.needsInterpreter ? 'Arabia' : ''
                    }
                };
            });

            setSimulationResults({
                scenario: selectedScenario,
                queue: results
            });
            setIsRunning(false);
        }, 800);
    };

    if (isLoadingData) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Database size={48} className="text-ai" style={{ animation: 'pulse 1.5s infinite', margin: '0 auto 1rem' }} />
                <h3 className="fw-bold text-primary">Ladataan aitoa dataa tietokannasta...</h3>
                <p className="text-secondary text-sm">Haetaan asiantuntijan sääntöjä, asetuksia ja varauksia.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 className="text-3xl fw-bold text-ai icon-heading" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Zap size={32} /> Assistentin Hiekkalaatikko
                </h1>
                <p className="text-base text-secondary lh-tight" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    Simuloi kalenterisi tilaa, testaa lomat ja poissaolot reaaliaikaisesti.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                
                <Card title="1. Kalenterin tila (Skenaariot)" icon={Database}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {calendarScenarios.map(scen => (
                            <button
                                key={scen.id}
                                onClick={() => { setSelectedScenario(scen.id); setSimulationResults(null); }}
                                className={`btn--secondary ${selectedScenario === scen.id ? 'chip--active' : ''}`}
                                style={{ 
                                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                    padding: '0.75rem', borderRadius: '6px', textAlign: 'left',
                                    border: selectedScenario === scen.id ? 'none' : '1px solid var(--color-border)'
                                }}
                            >
                                <span className="fw-semibold text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <scen.icon size={14} /> {scen.label}
                                </span>
                                <span className={`text-xs ${selectedScenario === scen.id ? 'text-surface' : 'text-secondary'}`} style={{ color: selectedScenario === scen.id ? '#fff' : '', marginTop: '4px' }}>
                                    {scen.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </Card>

                <Card title="2. Syötä testiasiakkaita jonoon" icon={Users}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {Object.entries(clientTemplates).map(([key, tpl]) => (
                            <button 
                                key={key} 
                                onClick={() => handleAddClient(key)} 
                                className={`btn btn--secondary text-sm ${tpl.is46 ? 'text-danger' : (tpl.needsInterpreter ? 'text-primary' : '')}`}
                                style={tpl.is46 ? { borderColor: 'var(--color-danger)' } : {}}
                            >
                                + {tpl.name.split(' (')[0]}
                            </button>
                        ))}
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span className="text-sm fw-semibold text-primary">Jono ({clientQueue.length})</span>
                            {clientQueue.length > 0 && (
                                <button onClick={() => { setClientQueue([]); setSimulationResults(null); }} className="btn-clear text-xs flex align-center gap-1">
                                    <Trash2 size={14} /> Tyhjennä
                                </button>
                            )}
                        </div>
                        
                        {clientQueue.length === 0 ? (
                            <div className="admin-empty-state" style={{ minHeight: '100px' }}>
                                Jono on tyhjä.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {clientQueue.map(client => (
                                    <div key={client.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span className="text-sm fw-semibold">{client.name.split(' (')[0]}</span>
                                            <span className="text-xs text-secondary mt-1">{client.description}</span>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', minWidth: '70px' }}>
                                            <span className={`text-xs fw-bold ${client.is46 ? 'text-danger' : 'text-primary'}`}>
                                                Tavoite: {client.jumpMonths ? `+${client.jumpMonths} kk` : `+${client.jumpDays} pv`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
                <button 
                    onClick={handleRunSimulation} 
                    disabled={clientQueue.length === 0 || isRunning}
                    className="btn-ai" 
                    style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '50px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
                >
                    {isRunning ? 'Lasketaan aitoja reittejä...' : 'Aja Assistentti'} <Play size={20} style={{ marginLeft: '8px' }}/>
                </button>
            </div>

            {!simulationResults ? (
                <div className="admin-empty-state" style={{ maxWidth: '600px', margin: '0 auto', border: '2px dashed var(--color-border)' }}>
                    <Clock size={48} className="text-secondary" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <span className="fw-semibold text-primary text-lg">Odotetaan skenaarion ajoa</span>
                    <span className="text-sm mt-2">Valitse asiakkaat yläpuolelta.</span>
                </div>
            ) : (
                <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                    <div className="smart-analysis-box" style={{ margin: '0 auto 2rem auto', maxWidth: '800px', textAlign: 'center' }}>
                        <div className="smart-analysis-header" style={{ justifyContent: 'center' }}>
                            <Bot size={20} className="text-ai" />
                            <span>Moottori analysoi lomat ja poissaolot</span>
                        </div>
                        <p className="text-sm text-secondary m-0 mt-2">
                            Ajo tehty. Moottori ja Intel Assistant huomioivat nyt suoraan valitut loma- ja poissaolojaksot kalenterissa.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
                        {simulationResults.queue.map((res, index) => (
                            <SandboxResultViewer key={index} res={res} index={index} dbRules={dbRules} dbSettings={dbSettings} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AjanvarausSandbox;