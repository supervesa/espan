import React, { useState, useEffect } from 'react';
import { useAppData } from './hooks/useAppData';
import { usePlanState } from './hooks/usePlanState';

// Adapteri joka ymmärtää URA-imurin puhetta!
import { useScraperAdapter } from './hooks/useScraperAdapter';

// Kirjautumiskomponentti
import LoginScreen from './components/LoginScreen';
import { SignalProvider } from './components/signals/SignalContext';
import SummaryPanel from './components/SummaryPanel';
import ScraperModal from './components/scraper/ScraperModal';
import MessageGenerator from './components/MessageGenerator';
import SuunnitelmanTyyppi from './components/sections/SuunnitelmanTyyppi';
import Perustiedot from './components/sections/Perustiedot';
import Tyottomyysturva from './components/sections/Tyottomyysturva';
import Tyotilanne from './components/sections/Tyotilanne';
import KoulutusJaYrittajyys from './components/koulutusYrittajyys';
import TyokykyOsio from './components/sections/tyokyky';
import TyollistymisenEdellytykset from './components/sections/TyollistymisenEdellytykset';
import PalkkatukiCalculator from "./components/sections/PalkkatukiCalculator";
import Palveluunohjaus from './components/sections/Palveluunohjaus';
import Suunnitelma from './components/sections/Suunnitelma';
import Tyonhakuvelvollisuus from './components/sections/Tyonhakuvelvollisuus';
import AiAnalyysi from './components/AiAnalyysi';
import Jalkimarkkinointi from './components/Jalkimarkkinointi';
import AdminStudio from './components/admin/AdminStudio';
import PuzzleGenerator from './components/PuzzleGenerator';
import SignalPanel from './components/signals/SignalPanel';
import ScraperModalV2 from './components/scraper/ScraperModalV2.jsx';
import { useScraperAdapterV2 } from './hooks/useScraperAdapterV2';

import './styles/rakenteet.css';
import './styles/tyylit.css';
import './styles/espan2.css';
import './styles/fontit.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    
    // --- KORJATTU: Käytetään näitä nimiä johdonmukaisesti ---
    const [isScraperOpen, setIsScraperOpen] = useState(false);
    const [isScraperV2Open, setIsScraperV2Open] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const authDataStr = localStorage.getItem('auth_expiry');
            if (authDataStr) {
                try {
                    const authData = JSON.parse(authDataStr);
                    if (authData.expiry > Date.now()) {
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('auth_expiry');
                    }
                } catch (e) {
                    localStorage.removeItem('auth_expiry');
                }
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, []);

    const handleLogin = (password, duration) => {
        let correctPassword = import.meta.env.VITE_ACCESS_PASSWORD;
        if (!correctPassword) {
            correctPassword = "admin";
        }
        if (password === correctPassword) {
            if (duration > 0) {
                const expiry = Date.now() + duration;
                localStorage.setItem('auth_expiry', JSON.stringify({ expiry }));
            }
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const [activeTab, setActiveTab] = useState('suunnitelma');
    const { dbPlanData, dbMessages, dbKnowledge, isLoadingData } = useAppData();
    const { state, setState, actions } = usePlanState(dbPlanData);
    const { injectScrapedData } = useScraperAdapter(actions, dbPlanData);
    const { injectScrapedData: injectScrapedDataV2 } = useScraperAdapterV2(actions);

    const sectionsForPanel = [
        { id: 'osio-suunnitelman-tyyppi', name: 'Suunnitelman tyyppi' },
        { id: 'osio-suunnitelman-perustiedot', name: 'Perustiedot' },
        { id: 'osio-tyottomyysturva', name: 'Työttömyysturva' },
        { id: 'osio-tyotilanne', name: 'Työtilanne' },
        { id: 'osio-koulutus', name: 'Koulutus & Osaam.' },
        { id: 'osio-tyokyky', name: 'Työkyky' },
        { id: 'osio-edellytykset', name: 'Työllistymisen edellytysten arviointi' },
        { id: 'osio-palkkatuki', name: 'Palkkatuki' },
        { id: 'osio-palveluohjaus', name: 'Palveluohjaus' },
        { id: 'osio-suunnitelma', name: 'Suunnitelma' },
        { id: 'osio-tyonhaku', name: 'Työnhakuvelv.' },
    ];

    if (isCheckingAuth) return null;
    if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

    if (isLoadingData) {
        return (
            <div className="app-container">
                <header className="app-header"><h1>Työllisyyssuunnitelman rakennustyökalu</h1></header>
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <h2>Ladataan järjestelmää tietokannasta...</h2>
                </div>
            </div>
        );
    }

    return (
        <SignalProvider activeSignals={state.signals || {}} actions={actions}>
            <div className="app-container">
                <header className="app-header">
                    <h1>Työllisyyssuunnitelman rakennustyökalu</h1>
                </header>
                <div className="tab-navigation">
                    <button className={`tab-button ${activeTab === 'suunnitelma' ? 'active' : ''}`} onClick={() => setActiveTab('suunnitelma')}>Suunnitelman rakennus</button>
                    <button className={`tab-button ${activeTab === 'viestit' ? 'active' : ''}`} onClick={() => setActiveTab('viestit')}>Viestigeneraattori</button>
                    <button className={`tab-button ${activeTab === 'hallinta' ? 'active' : ''}`} onClick={() => setActiveTab('hallinta')}>Hallinta</button>
                </div>
                
                {activeTab === 'suunnitelma' && (
                    <div className="main-grid">
                        <main className="sections-container">
                            <button className="btn" onClick={() => setIsScraperOpen(true)}>
                                🪄 Pura vanha suunnitelma
                            </button>
                            <button onClick={() => setIsScraperV2Open(true)} className="btn btn--secondary">
                                🚀 Kokeile V2
                            </button>

                            {/* KORJATTU: Muuttujanimet täsmäämään määrittelyyn */}
                          <ScraperModal 
    isOpen={isScraperOpen} 
    onClose={() => setIsScraperOpen(false)} 
    onApply={injectScrapedData}  // <--- KORJATTU: Käytä adapteria!
    state={state}      
    actions={actions}  
/>

                            <ScraperModalV2 
                                isOpen={isScraperV2Open} 
                                onClose={() => setIsScraperV2Open(false)} 
                                onApply={injectScrapedDataV2} 
                            />

                            <section id="osio-suunnitelman-tyyppi"><SuunnitelmanTyyppi state={state} actions={actions} /></section>
                            <section id="osio-suunnitelman-perustiedot"><Perustiedot state={state} actions={actions} planData={dbPlanData} /></section>
                            <section id="osio-tyottomyysturva"><Tyottomyysturva state={state} actions={actions} /></section>
                            <section id="osio-tyotilanne"><Tyotilanne state={state} actions={actions} planData={dbPlanData} knowledgeData={dbKnowledge} /></section>
                            <section id="osio-koulutus"><KoulutusJaYrittajyys state={state} actions={actions} /></section>
                            <section id="osio-tyokyky"><TyokykyOsio state={state} actions={actions} /></section>
                            <section id="osio-edellytykset"><TyollistymisenEdellytykset state={state} actions={actions} /></section>
                            <section id="osio-palkkatuki"><PalkkatukiCalculator state={state} actions={actions} /></section>
                            <section id="osio-palveluohjaus"><Palveluunohjaus state={state} actions={actions} /></section>
                            <section id="osio-suunnitelma"><Suunnitelma state={state} actions={actions} planData={dbPlanData} /></section>
                            <section id="osio-tyonhaku"><Tyonhakuvelvollisuus state={state} actions={actions} /></section>
                            
                            <AiAnalyysi state={state} actions={actions} />
                            <Jalkimarkkinointi state={state} />
                            <hr className="section-divider" /> 
                        </main>

                        <div className="summary-sticky-container">
                            <SignalPanel activeSignals={state.signals || {}} dbPlanData={dbPlanData} actions={actions} />
                            <SummaryPanel 
                                state={state} 
                                actions={actions}  
                                sections={sectionsForPanel} 
                                dbPlanData={dbPlanData} 
                                dbKnowledge={dbKnowledge} 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'viestit' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <button className={`btn ${!state.usePuzzleMode ? '' : 'btn--secondary'}`} onClick={() => setState(prev => ({ ...prev, usePuzzleMode: false }))}>
                                Klassinen generaattori
                            </button>
                            <button className={`btn ${state.usePuzzleMode ? '' : 'btn--secondary'}`} onClick={() => setState(prev => ({ ...prev, usePuzzleMode: true }))}>
                                🧩 Kokeile uutta Puzzle-generaattoria
                            </button>
                        </div>

                        {state.usePuzzleMode ? <PuzzleGenerator state={state} /> : <MessageGenerator state={state} templates={dbMessages} />}
                    </div>
                )}

                {activeTab === 'hallinta' && (
                     <div className="main-grid-single">
                        <main className="sections-container"><AdminStudio /></main>
                    </div>
                )}
            </div>
        </SignalProvider>
    );
}

export default App;