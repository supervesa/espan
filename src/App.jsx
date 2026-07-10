import React, { useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { usePlanState } from './hooks/usePlanState';

// Adapteri joka ymmärtää URA-imurin puhetta!
import { useScraperAdapter } from './hooks/useScraperAdapter';

// --- LISÄTTY: Tuodaan sekä hook ETTÄ Provider ---
import { useLightSentinel, LightSentinelProvider } from './context/LightSentinelContext';
import { supabase } from './utils/supabaseClient';

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

// --- UUSI RAKENNE: Tämä on varsinainen ohjelma, joka on suojattu ---
function EspanCore() {
    const { session, profile, isLoading, isManager, logout } = useLightSentinel();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    const [isScraperOpen, setIsScraperOpen] = useState(false);
    const [isScraperV2Open, setIsScraperV2Open] = useState(false);
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

    const handleSupabaseLogin = async (email, password, duration) => {
        setIsLoggingIn(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (duration > 0) {
                localStorage.setItem('espan_auth_expiry', Date.now() + duration);
            } else {
                localStorage.removeItem('espan_auth_expiry');
            }

            return true;
        } catch (error) {
            console.error("Kirjautumisvirhe:", error.message);
            return false;
        } finally {
            setIsLoggingIn(false);
        }
    };

    if (isLoading) {
        return (
            <div className="app-container">
                <header className="app-header"><h1>Työllisyyssuunnitelman rakennustyökalu</h1></header>
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <h2>Ladataan Sentinel-turvayhteyttä...</h2>
                </div>
            </div>
        );
    }

    if (!session) {
        return <LoginScreen onLogin={handleSupabaseLogin} isLoggingIn={isLoggingIn} />;
    }

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
                <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Työllisyyssuunnitelman rakennustyökalu</h1>
                    <button className="btn btn--secondary" onClick={logout} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                        Kirjaudu ulos
                    </button>
                </header>
                <div className="tab-navigation">
                    <button className={`tab-button ${activeTab === 'suunnitelma' ? 'active' : ''}`} onClick={() => setActiveTab('suunnitelma')}>Suunnitelman rakennus</button>
                    <button className={`tab-button ${activeTab === 'viestit' ? 'active' : ''}`} onClick={() => setActiveTab('viestit')}>Viestigeneraattori</button>
                    {isManager && (
                        <button className={`tab-button ${activeTab === 'hallinta' ? 'active' : ''}`} onClick={() => setActiveTab('hallinta')}>Hallinta</button>
                    )}
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

                            <ScraperModal 
                                isOpen={isScraperOpen} 
                                onClose={() => setIsScraperOpen(false)} 
                                onApply={injectScrapedData}  
                                state={state}      
                                actions={actions}
                                asiantuntijaId={profile?.id}
                            />

                            <ScraperModalV2 
                                isOpen={isScraperV2Open} 
                                onClose={() => setIsScraperV2Open(false)} 
                                onApply={injectScrapedDataV2} 
                                asiantuntijaId={profile?.id}
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
                                asiantuntijaId={profile?.id} 
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

                {activeTab === 'hallinta' && isManager && (
                     <div className="main-grid-single">
                        <main className="sections-container"><AdminStudio /></main>
                    </div>
                )}
            </div>
        </SignalProvider>
    );
}

// --- UUSI RAKENNE: Viedään ulos kääre, joka asettaa Providerin EspanCoren ympärille ---
export default function App() {
    return (
        <LightSentinelProvider>
            <EspanCore />
        </LightSentinelProvider>
    );
}