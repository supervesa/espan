// --- src/App.js ---

import React, { useState, useEffect } from 'react';
import { useAppData } from './hooks/useAppData';
import { usePlanState } from './hooks/usePlanState';

// UUSI: Kirjautumiskomponentti
import LoginScreen from './components/LoginScreen';

import SummaryPanel from './components/SummaryPanel';
import ScraperModal from './components/scraper/ScraperModal';
import MessageGenerator from './components/MessageGenerator';
import SuunnitelmanTyyppi from './components/sections/SuunnitelmanTyyppi';
import Perustiedot from './components/sections/Perustiedot';
import Tyottomyysturva from './components/sections/Tyottomyysturva';
import Tyotilanne from './components/sections/Tyotilanne';
import KoulutusJaYrittajyys from './components/koulutusYrittajyys';
import Tyokyky from './components/sections/Tyokyky';
import PalkkatukiCalculator from "./components/sections/PalkkatukiCalculator";
import Palveluunohjaus from './components/sections/Palveluunohjaus';
import Suunnitelma from './components/sections/Suunnitelma';
import Tyonhakuvelvollisuus from './components/sections/Tyonhakuvelvollisuus';
import AiAnalyysi from './components/AiAnalyysi';
import Jalkimarkkinointi from './components/Jalkimarkkinointi';
import AdminWorkspace from './components/admin/AdminWorkspace';
import PuzzleGenerator from './components/PuzzleGenerator';
import SignalPanel from './components/signals/SignalPanel';

import './styles/rakenteet.css';
import './styles/tyylit.css';
import './styles/espan2.css';

function App() {
    // --- 1. LISÄTTY KIRJAUTUMISLOGIIKKA ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isScraperOpen, setIsScraperOpen] = useState(false);

    // Tarkistetaan localStorage heti latauksessa
    useEffect(() => {
        const checkAuth = () => {
            const authDataStr = localStorage.getItem('auth_expiry');
            if (authDataStr) {
                try {
                    const authData = JSON.parse(authDataStr);
                    // Jos nykyhetki on pienempi kuin vanhentumisaika, istunto on voimassa
                    if (authData.expiry > Date.now()) {
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('auth_expiry'); // Vanhentunut
                    }
                } catch (e) {
                    localStorage.removeItem('auth_expiry'); // Virheellinen data
                }
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, []);

    const handleLogin = (password, duration) => {
        // Luetaan salasana turvallisesti Vite-ympäristöstä
        let correctPassword = import.meta.env.VITE_ACCESS_PASSWORD;

        // Fallback: Jos .env puuttuu tai muuttujaa ei löydy, käytetään oletusta
        if (!correctPassword) {
            console.warn("VITE_ACCESS_PASSWORD puuttuu. Käytetään oletusta 'admin'.");
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
    // ----------------------------------------

    const [activeTab, setActiveTab] = useState('suunnitelma');
    
    // 1. Ladataan data tietokannasta uudella Hookilla
    const { dbPlanData, dbMessages, dbKnowledge, isLoadingData } = useAppData();
    
    // 2. Alustetaan sääntölogiikka ja tila toisella Hookilla
    const { state, setState, actions } = usePlanState(dbPlanData);

    const sectionsForPanel = [
        { id: 'osio-suunnitelman-tyyppi', name: 'Suunnitelman tyyppi' },
        { id: 'osio-suunnitelman-perustiedot', name: 'Perustiedot' },
        { id: 'osio-tyottomyysturva', name: 'Työttömyysturva' },
        { id: 'osio-tyotilanne', name: 'Työtilanne' },
        { id: 'osio-koulutus', name: 'Koulutus & Osaam.' },
        { id: 'osio-tyokyky', name: 'Työkyky' },
        { id: 'osio-palkkatuki', name: 'Palkkatuki' },
        { id: 'osio-palveluohjaus', name: 'Palveluohjaus' },
        { id: 'osio-suunnitelma', name: 'Suunnitelma' },
        { id: 'osio-tyonhaku', name: 'Työnhakuvelv.' },
    ];

    const handleApplyParsedData = (parsedData) => {
        // Ladataan kaikki olemassa olevat välilehdet, jotta tiedämme minne mikäkin ruksi kuuluu
        const allSections = [...(dbPlanData?.aihealueet || [])];
        
        // 1. Ruksitaan vakiolauseet ja syötetään niiden päivämäärät
        if (parsedData.phrases) {
            parsedData.phrases.forEach(phrase => {
                let sectionId = null;
                let isMulti = false;

                // Etsitään mihin välilehteen tämä rasti kuuluu
                for (const sec of allSections) {
                    if (sec.fraasit && sec.fraasit.some(f => f.avainsana === phrase.id)) {
                        sectionId = sec.id;
                        isMulti = sec.monivalinta;
                        break;
                    }
                }

                if (sectionId) {
                    // Laitetaan rasti ruutuun!
                    actions.onSelect(sectionId, phrase.id, isMulti);
                    
                    // Syötetään poimitut muuttujat (esim. [PÄIVÄMÄÄRÄ]) kenttiin
                    if (phrase.variables) {
                        Object.entries(phrase.variables).forEach(([vKey, vVal]) => {
                            actions.onUpdateVariable(sectionId, phrase.id, vKey, vVal);
                        });
                    }
                } else {
                    // Hätävara signaaleille/erikoisille säännöille
                    actions.onAddSignal(phrase.id);
                }
            });
        }

        // 2. Aktivoidaan erilliset signaalit (kielitasot, ammattikortit)
        if (parsedData.signals) {
            parsedData.signals.forEach(signal => {
                actions.onAddSignal(signal.id);
            });
        }

        // 3. Viedään vapaat tekstit välilehtien tekstikenttiin
        if (parsedData.customTexts) {
            Object.entries(parsedData.customTexts).forEach(([sectionId, text]) => {
                if (text && text.trim()) {
                    actions.onUpdateCustomText(sectionId, text.trim());
                }
            });
        }

        // 4. Tallennetaan erikoismuuttujat globaalisti asiakkaan tietoihin (esco, palvelu_alku)
        if (parsedData.variables) {
            Object.entries(parsedData.variables).forEach(([key, value]) => {
                actions.onUpdateAsiakas(key, value);
            });
        }

        console.log("✅ URA-imurin tiedot injektoitu lomakkeelle onnistuneesti!");
    };

    // --- 3. RENDERÖINNIN EHDOT (Auth & Loading) ---

    if (isCheckingAuth) {
        return null; // Odotetaan auth-tarkistusta
    }

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
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

    // --- 4. ALKUPERÄINEN APP UI ---

    return (
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
   🪄 Pura vanha suunnitelma (URA-imuri)
</button>

<ScraperModal 
        isOpen={isScraperOpen} 
        onClose={() => setIsScraperOpen(false)} 
        // Kutsumme suoraan luomaasi putkimiestä ja varmistamme, ettei tule tuplakutsuja
        onApply={(data) => {
            console.log("Valmiit tiedot lähetettiin tilakoneelle!", data);
            handleApplyParsedData(data); 
        }} 
    />

                        <section id="osio-suunnitelman-tyyppi"><SuunnitelmanTyyppi state={state} actions={actions} /></section>
                        <section id="osio-suunnitelman-perustiedot"><Perustiedot state={state} actions={actions} planData={dbPlanData} /></section>
                        <section id="osio-tyottomyysturva"><Tyottomyysturva state={state} actions={actions} /></section>
                        <section id="osio-tyotilanne"><Tyotilanne state={state} actions={actions} planData={dbPlanData} knowledgeData={dbKnowledge} /></section>
                        <section id="osio-koulutus"><KoulutusJaYrittajyys state={state} actions={actions} /></section>
                        <section id="osio-tyokyky"><Tyokyky state={state} actions={actions} /></section>
                        <section id="osio-palkkatuki"><PalkkatukiCalculator state={state} actions={actions} /></section>
                        <section id="osio-palveluohjaus"><Palveluunohjaus state={state} actions={actions} /></section>
           <section id="osio-suunnitelma"><Suunnitelma state={state} actions={actions} planData={dbPlanData} /></section>
                        <section id="osio-tyonhaku"><Tyonhakuvelvollisuus state={state} actions={actions} /></section>
                        
                        <AiAnalyysi state={state} actions={actions} />
                        <Jalkimarkkinointi state={state} />
                        <hr className="section-divider" /> 
                    </main>

                    <div className="summary-sticky-container">
                        <SignalPanel 
                            activeSignals={state.signals || {}} 
                            dbPlanData={dbPlanData} 
                            actions={actions} 
                        />
                        <SummaryPanel state={state} sections={sectionsForPanel} dbPlanData={dbPlanData} dbKnowledge={dbKnowledge} />
                    </div>
                </div>
            )}

            {activeTab === 'viestit' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <button 
                            className={`btn ${!state.usePuzzleMode ? '' : 'btn--secondary'}`} 
                            onClick={() => setState(prev => ({ ...prev, usePuzzleMode: false }))}
                        >
                            Klassinen generaattori
                        </button>
                        <button 
                            className={`btn ${state.usePuzzleMode ? '' : 'btn--secondary'}`} 
                            onClick={() => setState(prev => ({ ...prev, usePuzzleMode: true }))}
                        >
                            🧩 Kokeile uutta Puzzle-generaattoria
                        </button>
                    </div>

                    {state.usePuzzleMode ? (
                        <PuzzleGenerator state={state} />
                    ) : (
                        <MessageGenerator state={state} templates={dbMessages} />
                    )}
                </div>
            )}

            {activeTab === 'hallinta' && (
                 <div className="main-grid-single">
                    <main className="sections-container">
                        <AdminWorkspace />
                    </main>
                </div>
            )}
        </div>
    );
}

export default App;