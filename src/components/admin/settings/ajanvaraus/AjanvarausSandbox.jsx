import React, { useState } from 'react';
import { Play, Users, Calendar, Trash2, AlertTriangle, Zap, Clock } from 'lucide-react';
import Card from '../../../common/Card';

// KORJATTU IMPORT-POLKU: Kolme tasoa ylös (components-kansioon), ja sieltä AikatauluEhdotus-kansioon
import TilausAssistenttiPaneeli from '../../../AikatauluEhdotus/TilausAssistenttiPaneeli';

/* =========================================
   MOCK DATA: Säännöt, Skenaariot ja Asiakkaat
========================================= */

const mockSettings = {
    ahkysuoja_aktiivinen: true,
    lykkays_toleranssi_pv: 14,
    kestot_perus: { alkuhaastattelu: 60, aktivointi: 45, normi: 45 },
    kesto_tuttu_asiakas: 30,
    tulkki_lisa_minuutit: 15,
    kirjaus_puskuri_minuutit: 15,
    liedennys_jarjestys: ['taydentava', 'aktivointi'],
    lukitse_alkuhaastattelu: true,
    hatavara_paivat: { taso_1: 5, viimeinen: 1 },
    poikkeus_asetukset: { tasaus: true, purku_viikot: 1 }
};

const calendarScenarios = [
    { id: 'valja', label: 'Väljä viikko', desc: 'Paljon tilaa, rutiiniajat löytyvät helposti.', icon: Calendar },
    { id: 'tetris', label: 'Tetris-helvetti', desc: '95% täynnä. Pakottaa moottorin tekemään kompromisseja.', icon: AlertTriangle },
    { id: 'loma', label: 'Lomasumppu', desc: 'Seuraavat 2 viikkoa lomaa. Testaa 50/50 -purkamista.', icon: Calendar }
];

const clientTemplates = {
    perus: { type: 'taydentava', name: 'Matti Normaali', deadlineDays: 21, isFamiliar: false, needsInterpreter: false, is46: false },
    hata: { type: 'alkuhaastattelu', name: 'Hätäinen Heikki', deadlineDays: 3, isFamiliar: false, needsInterpreter: false, is46: true },
    tulkki: { type: 'taydentava', name: 'Tariq Tulkki', deadlineDays: 14, isFamiliar: false, needsInterpreter: true, is46: false },
    tuttu: { type: 'taydentava', name: 'Tuttu Tiina', deadlineDays: 14, isFamiliar: true, needsInterpreter: false, is46: false }
};

/* =========================================
   HIEKKALAATIKON PÄÄKOMPONENTTI
========================================= */

const AjanvarausSandbox = () => {
    const [selectedScenario, setSelectedScenario] = useState('valja');
    const [clientQueue, setClientQueue] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [simulationResults, setSimulationResults] = useState(null);

    const handleAddClient = (templateKey) => {
        const newClient = {
            ...clientTemplates[templateKey],
            id: `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        setClientQueue(prev => [...prev, newClient]);
        setSimulationResults(null); 
    };

    const handleClearQueue = () => {
        setClientQueue([]);
        setSimulationResults(null);
    };

    const handleRunSimulation = () => {
        if (clientQueue.length === 0) return;
        setIsRunning(true);
        
        setTimeout(() => {
            setSimulationResults({
                scenario: selectedScenario,
                settings: mockSettings,
                queue: [...clientQueue]
            });
            setIsRunning(false);
        }, 600);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="text-2xl fw-bold text-ai icon-heading" style={{ marginBottom: '0.5rem' }}>
                    <Zap size={28} /> Assistentin Hiekkalaatikko
                </h1>
                <p className="text-sm text-secondary lh-tight">
                    Tämä on erillinen testiympäristö. Syötä tekoälylle simuloituja asiakkaita ja katso, 
                    miten se soveltaa Ajanvaraus-ohjeistustanne eri ruuhkatilanteissa.
                </p>
            </div>

            <div className="layout-container">
                
                {/* VASEM PALSTA: Hallintapaneeli */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <Card title="1. Kalenterin tila" icon={Calendar}>
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
                                    <span className="fw-semibold text-sm">{scen.label}</span>
                                    <span className={`text-xs ${selectedScenario === scen.id ? 'text-surface' : 'text-secondary'}`} style={{ color: selectedScenario === scen.id ? '#fff' : '' }}>
                                        {scen.desc}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    <Card title="2. Syötä asiakkaita jonoon" icon={Users}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <button onClick={() => handleAddClient('perus')} className="btn btn--secondary text-sm">
                                + Normaali
                            </button>
                            <button onClick={() => handleAddClient('hata')} className="btn btn--secondary text-sm text-danger" style={{ borderColor: 'var(--color-danger)' }}>
                                + 46 § Kiire
                            </button>
                            <button onClick={() => handleAddClient('tulkki')} className="btn btn--secondary text-sm text-primary">
                                + Tulkkitarve
                            </button>
                            <button onClick={() => handleAddClient('tuttu')} className="btn btn--secondary text-sm text-success">
                                + Tuttu as.
                            </button>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span className="text-sm fw-semibold text-primary">Jono ({clientQueue.length})</span>
                                {clientQueue.length > 0 && (
                                    <button onClick={handleClearQueue} className="btn-clear text-xs flex align-center gap-1">
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
                                                <span className="text-sm fw-semibold">{client.name}</span>
                                                <span className="text-xs text-secondary">{client.type}</span>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                                <span className={`text-xs fw-bold ${client.is46 ? 'text-danger' : 'text-primary'}`}>
                                                    {client.deadlineDays} vrk aikaa
                                                </span>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                                    {client.is46 && <span className="tag tag--warning">46 §</span>}
                                                    {client.needsInterpreter && <span className="tag">Tulkki</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>

                    <button 
                        onClick={handleRunSimulation} 
                        disabled={clientQueue.length === 0 || isRunning}
                        className="btn-ai" 
                        style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}
                    >
                        {isRunning ? 'Lasketaan...' : 'Aja Assistentti'} <Play size={18} />
                    </button>
                </div>

                {/* OIKEA PALSTA: Assistentin käyttöliittymä */}
                <div className="side-bordered-panel" style={{ height: '100%', margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
                    {!simulationResults ? (
                        <div className="admin-empty-state">
                            <Clock size={48} className="text-secondary" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <span className="fw-semibold text-primary text-lg">Assistentti odottaa töitä</span>
                            <span className="text-sm mt-2">Lisää asiakkaita jonoon ja paina "Aja Assistentti".</span>
                        </div>
                    ) : (
                        <TilausAssistenttiPaneeli 
                            scenario={simulationResults.scenario}
                            settings={simulationResults.settings}
                            clients={simulationResults.queue}
                        />
                    )}
                </div>

            </div>
        </div>
    );
};

export default AjanvarausSandbox;