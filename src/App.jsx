import React, { useState, useCallback } from 'react';
// import Summary from './components/Summary'; // POISTETTU VANHA
import SummaryPanel from './components/SummaryPanel'; // << UUSI PANEELI
import Scraper from './components/Scraper';
import MessageGenerator from './components/MessageGenerator';
import SuunnitelmanTyyppi from './components/sections/SuunnitelmanTyyppi';
import Perustiedot from './components/sections/Perustiedot';
import Tyottomyysturva from './components/sections/Tyottomyysturva';
import Tyotilanne from './components/sections/Tyotilanne';
import KoulutusJaYrittajyys from './components/koulutusYrittajyys';
import Tyokyky from './components/sections/Tyokyky';
import PalkkatukiCalculator from './components/sections/PalkkatukiCalculator';
import Palveluunohjaus from './components/sections/Palveluunohjaus';
import Suunnitelma from './components/sections/Suunnitelma';
import Tyonhakuvelvollisuus from './components/sections/Tyonhakuvelvollisuus';
import Kielitaso from './components/sections/Kielitaso';
import AiAnalyysi from './components/AiAnalyysi';
import { planData } from './data/planData';
import './styles/rakenteet.css';
import './styles/tyylit.css';
import './styles/espan2.css'; // Varmista, että tämä ladataan

// Deep merge function remains the same
const deepMerge = (target, source) => {
    // ... (koodi ennallaan) ...
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target) || target[key] === null) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};


function App() {
    const [state, setState] = useState({});
    const [activeTab, setActiveTab] = useState('suunnitelma');

    // --- Callback-funktiot (ennallaan) ---
    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);
    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        // ... (koodi ennallaan) ...
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));

            const section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section || !section.fraasit) {
                console.error(`Section data not found for id: ${sectionId}`);
                return currentState;
            }

            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
            if (!phrase) {
                 console.error(`Phrase not found for avainsana: ${avainsana} in section: ${sectionId}`);
                 return currentState;
            }

            if (updatedSelection) {
                newState[sectionId] = updatedSelection;
                return newState;
            }

            if (!newState[sectionId]) {
                newState[sectionId] = {};
            }
            const currentSelections = newState[sectionId];

            if (isMultiSelect) {
                // TÄMÄ LOHKO KORJATTU "suunnitelman_perustiedot" -osion KÄSITTELYÄ VARTEN
                if (currentSelections[avainsana]) {
                    // Poista valinta (jos klikataan uudelleen)
                    delete currentSelections[avainsana];
                } else {
                    // Lisää valinta. TALLENNETAAN OBJEKTINA, JOTTA VOIDAAN LIITTÄÄ MUUTTUJAT.
                    const initialVariables = {};
                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                initialVariables[key] = config.oletus !== undefined ? config.oletus : (config.vaihtoehdot ? config.vaihtoehdot[0] : '');
                            } else {
                                initialVariables[key] = '';
                            }
                        });
                    }
                    currentSelections[avainsana] = {
                        avainsana: avainsana, // Tallenna myös avainsana tunnistusta varten
                        muuttujat: initialVariables // Alustetaan muuttujat tähän
                    };
                }

            } else { // Yksivalinta (esim. Koulutus, Yrittäjyys)
                if (currentSelections.avainsana === avainsana) {
                    delete currentSelections.avainsana;
                    delete currentSelections.muuttujat;
                } else {
                    currentSelections.avainsana = phrase.avainsana;
                    currentSelections.muuttujat = {};

                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                currentSelections.muuttujat[key] = config.oletus !== undefined ? config.oletus : (config.vaihtoehdot ? config.vaihtoehdot[0] : '');
                            } else {
                                initialVariables[key] = '';
                            }
                        });
                    }
                }
            }

            return newState;
        });
    }, []);
    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        // ... (koodi ennallaan) ...
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            const section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section) return currentState;

            let target;
            if (section.monivalinta) {
                // Monivalinnoissa, kuten "suunnitelman_perustiedot", kohde on avainsanan alla
                target = newState[sectionId]?.[avainsana];
            } else {
                // Yksivalinnoissa kohde on suoraan sectionId:n alla
                target = newState[sectionId];
            }

            if (target) {
                if (!target.muuttujat) target.muuttujat = {};
                target.muuttujat[variableKey] = value;
            }
            return newState;
        });
    }, []);
    const handleUpdateCustomText = useCallback((sectionId, value) => {
        // ... (koodi ennallaan) ...
        const customKey = sectionId === 'kielitaso' ? `custom-kielitaso` : `custom-${sectionId}`;
        setState(currentState => ({ ...currentState, [customKey]: value }));
    }, []);
    const handleUpdateTyokyky = useCallback((key, value) => {
        // ... (koodi ennallaan) ...
        setState(prevState => {
            const newTyokykyState = { ...(prevState.tyokyky || {}) };
            if (key === 'togglePalveluohjaus') {
                const currentOhjaukset = { ...(newTyokykyState.palveluohjaukset || {}) };
                if (currentOhjaukset[value.avainsana]) delete currentOhjaukset[value.avainsana];
                else currentOhjaukset[value.avainsana] = value;
                newTyokykyState.palveluohjaukset = currentOhjaukset;
            } else if (key === 'updateKeskustelutieto') {
                 const currentTiedot = { ...(newTyokykyState.keskustelunTiedot || {}) };
                 currentTiedot[value.id] = value.value;
                 newTyokykyState.keskustelunTiedot = currentTiedot;
            } else {
                newTyokykyState[key] = value;
            }
            return { ...prevState, tyokyky: newTyokykyState };
        });
    }, []);
    const handleUpdatePalkkatuki = useCallback((key, value) => {
        // ... (koodi ennallaan) ...
        setState(prevState => ({
            ...prevState,
            palkkatuki: {
                ...(prevState.palkkatuki || {}),
                [key]: value
            }
        }));
    }, []);
    const handleUpdateTyottomyysturva = useCallback((key, value) => {
        // ... (koodi ennallaan) ...
        setState(prevState => {
            const newTtState = { ...(prevState.tyottomyysturva || {}) };

            if (key === 'updateKysymys') {
                const currentAnswers = { ...(newTtState.answers || {}) };
                currentAnswers[value.id] = value.value;
                newTtState.answers = currentAnswers;
            } else if (key === 'updateSummaries') {
                newTtState.koonti = value.koonti;
                newTtState.yhteenvetoFraasi = value.yhteenvetoFraasi;
            } else if (key === 'updateYhteenveto') {
                newTtState.yhteenvetoFraasi = value;
            } else {
                newTtState[key] = value;
            }
            return { ...prevState, tyottomyysturva: newTtState };
        });
    }, []);
    const handleUpdateKielitaso = useCallback((key, value) => {
        // ... (koodi ennallaan) ...
        setState(prevState => {
            const currentKielitaso = prevState.kielitaso || { aidinkieli: '', muutKielet: [{ kieli: 'Suomi', taso: '' }] };
            let updatedKielitaso = JSON.parse(JSON.stringify(currentKielitaso));

            if (key === 'updateAidinkieli') {
                updatedKielitaso.aidinkieli = value;
            } else if (key === 'updateMuuKieli') {
                const { index, field, value: langValue } = value;
                if (!updatedKielitaso.muutKielet) updatedKielitaso.muutKielet = [];
                while (updatedKielitaso.muutKielet.length <= index) {
                     updatedKielitaso.muutKielet.push({ kieli: index === 0 ? 'Suomi' : '', taso: ''});
                }
                updatedKielitaso.muutKielet[index] = { ...updatedKielitaso.muutKielet[index], [field]: langValue };
            }

            return { ...prevState, kielitaso: updatedKielitaso };
        });
    }, []);
    // --- LISÄTTY: handleUpdateSuunnitelma ---
    const handleUpdateSuunnitelma = useCallback((phraseId, isChecked) => {
        setState(prevState => {
            const newSuunnitelmaState = { ...(prevState.suunnitelma || {}) };
            if (isChecked) {
                newSuunnitelmaState[phraseId] = true; // Tai tallenna { avainsana: phraseId } jos tarvitset enemmän tietoa
            } else {
                delete newSuunnitelmaState[phraseId];
            }
            return { ...prevState, suunnitelma: newSuunnitelmaState };
        });
    }, []);

    // --- Actions-objekti päivitetyillä funktioilla ---
    const actions = {
        onSelect: handleSelectPhrase,
        onUpdateVariable: handleUpdateVariable,
        onUpdateCustomText: handleUpdateCustomText,
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
        onUpdateKielitaso: handleUpdateKielitaso,
        onUpdateSuunnitelma: handleUpdateSuunnitelma, // LISÄTTY
        handleScrape: handleScrape, // Lisätty handleScrape tänne
    };

    // --- MUUTETTU: sectionsForPanel-taulukko on täydennetty ---
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


    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Työllisyyssuunnitelman rakennustyökalu</h1>
            </header>
            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'suunnitelma' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suunnitelma')}
                >
                    Suunnitelman rakennus
                </button>
                <button
                    className={`tab-button ${activeTab === 'viestit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('viestit')}
                >
                    Viestigeneraattori
                </button>
            </div>
            {activeTab === 'suunnitelma' && (
                <div className="main-grid">
                    {/* --- PÄÄSISÄLTÖ --- */}
                    <main className="sections-container">
                        <Scraper onScrape={handleScrape} /> {/* Käytetään handleScrapea */}

                        {/* --- MUUTETTU: Lisätty ID:t puuttuville osioille --- */}
                        <section id="osio-suunnitelman-tyyppi"><SuunnitelmanTyyppi state={state} actions={actions} /></section>
                        <section id="osio-suunnitelman-perustiedot"><Perustiedot state={state} actions={actions} /></section>
                        <section id="osio-tyottomyysturva"><Tyottomyysturva state={state} actions={actions} /></section>

                        {/* --- Nämä olivat jo olemassa --- */}
                        <section id="osio-tyotilanne"><Tyotilanne state={state} actions={actions} /></section>
                        <section id="osio-koulutus"><KoulutusJaYrittajyys state={state} actions={actions} /></section>
                        <Kielitaso state={state} actions={actions} />
                        <section id="osio-tyokyky"><Tyokyky state={state} actions={actions} /></section>
                        <section id="osio-palkkatuki"><PalkkatukiCalculator state={state} actions={actions} /></section>
                        <section id="osio-palveluohjaus"><Palveluunohjaus state={state} actions={actions} /></section>
                        <section id="osio-suunnitelma"><Suunnitelma state={state} actions={actions} /></section>
                        <section id="osio-tyonhaku"><Tyonhakuvelvollisuus state={state} actions={actions} /></section>
                        
                        <AiAnalyysi state={state} actions={actions} />
                    </main>

                    {/* --- SIVUPANEELI (Käyttää rakenteet.css:n käärettä) --- */}
                    <div className="summary-sticky-container">
                        <SummaryPanel state={state} sections={sectionsForPanel} />
                    </div>
                </div>
            )}

         {activeTab === 'viestit' && (
                 <div className="main-grid-single">
                    <main className="sections-container">
                        {/*
                          TÄMÄ ON AINOA MUUTOS TÄSSÄ TIEDOSTOSSA:
                          Lisätään state={state} propiksi MessageGeneratorille.
                        */}
                        <MessageGenerator state={state} />
                    </main>
                </div>
            )}
        </div>
    );
}

export default App;