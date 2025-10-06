import React, { useState, useCallback } from 'react';
import Summary from './components/Summary';
import Scraper from './components/Scraper';
import MessageGenerator from './components/MessageGenerator';
import SuunnitelmanTyyppi from './components/sections/SuunnitelmanTyyppi';
import Perustiedot from './components/sections/Perustiedot';
import Tyottomyysturva from './components/sections/Tyottomyysturva';
import Tyotilanne from './components/sections/Tyotilanne';
import KoulutusJaYrittajyys from './components/sections/KoulutusJaYrittajyys';
import Tyokyky from './components/sections/Tyokyky';
import PalkkatukiCalculator from './components/sections/PalkkatukiCalculator';
import Palveluunohjaus from './components/sections/Palveluunohjaus';
import Suunnitelma from './components/sections/Suunnitelma';
import Tyonhakuvelvollisuus from './components/sections/Tyonhakuvelvollisuus';
import AiAnalyysi from './components/AiAnalyysi';
import { planData } from './data/planData';
import './styles/rakenteet.css';
import './styles/tyylit.css';

const deepMerge = (target, source) => {
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
    // LISÄTTY: Tila aktiivisen välilehden hallintaan
    const [activeTab, setActiveTab] = useState('suunnitelma'); 

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = { ...currentState };
            const section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section || !section.fraasit) return newState;
            
            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
            if (!phrase) return newState;

            if (updatedSelection) {
                newState[sectionId] = updatedSelection;
                return newState;
            }

            const newPhraseObject = {
                avainsana: phrase.avainsana,
                teksti: phrase.teksti,
                muuttujat: {},
            };
            if (phrase.muuttujat) {
                Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                    newPhraseObject.muuttujat[key] = config.oletus !== undefined ? config.oletus : (config.vaihtoehdot ? config.vaihtoehdot[0] : '');
                });
            }

            if (isMultiSelect) {
                const currentSelections = { ...(newState[sectionId] || {}) };
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                } else {
                    currentSelections[avainsana] = newPhraseObject;
                }
                newState[sectionId] = currentSelections;
            } else {
                if (newState[sectionId]?.avainsana === avainsana) {
                    delete newState[sectionId];
                } else {
                    newState[sectionId] = newPhraseObject;
                }
            }
            return newState;
        });
    }, []);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            const section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section) return currentState;
            const target = section.monivalinta ? newState[sectionId]?.[avainsana] : newState[sectionId];
            if (target) {
                if (!target.muuttujat) target.muuttujat = {};
                target.muuttujat[variableKey] = value;
            }
            return newState;
        });
    }, []);
    
    const handleUpdateCustomText = useCallback((sectionId, value) => {
        setState(currentState => ({ ...currentState, [`custom-${sectionId}`]: value }));
    }, []);

    const handleUpdateTyokyky = useCallback((key, value) => {
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
        setState(prevState => ({
            ...prevState,
            palkkatuki: {
                ...(prevState.palkkatuki || {}),
                [key]: value
            }
        }));
    }, []);
    
    const handleUpdateTyottomyysturva = useCallback((key, value) => {
        setState(prevState => {
            const newTtState = { ...(prevState.tyottomyysturva || {}) };
            if (key === 'updateKysymys') {
                const currentAnswers = { ...(newTtState.answers || {}) };
                currentAnswers[value.id] = value.value;
                newTtState.answers = currentAnswers;
            } else {
                newTtState[key] = value;
            }
            return { ...prevState, tyottomyysturva: newTtState };
        });
    }, []);

    const actions = { 
        onSelect: handleSelectPhrase, 
        onUpdateVariable: handleUpdateVariable, 
        onUpdateCustomText: handleUpdateCustomText,
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Työllisyyssuunnitelman rakennustyökalu</h1>
            </header>

            {/* LISÄTTY: Välilehtinavigaatio */}
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

            {/* MUOKATTU: Sisältö renderöidään ehdollisesti */}
            {activeTab === 'suunnitelma' && (
                <div className="main-grid">
                    <main className="sections-container">
                        <Scraper onScrape={handleScrape} />
                        <SuunnitelmanTyyppi state={state} actions={actions} />
                        <Perustiedot state={state} actions={actions} />
                        <Tyottomyysturva state={state} actions={actions} />
                        <Tyotilanne state={state} actions={actions} />
                        <KoulutusJaYrittajyys state={state} actions={actions} />
                        <Tyokyky state={state} actions={actions} />
                        <PalkkatukiCalculator state={state} actions={actions} />
                        <Palveluunohjaus state={state} actions={actions} />
                        <Suunnitelma state={state} actions={actions} />
                        <Tyonhakuvelvollisuus state={state} actions={actions} />
                        <AiAnalyysi state={state} actions={actions} />
                    </main>
                    <Summary state={state} />
                </div>
            )}

            {activeTab === 'viestit' && (
                <div className="main-grid-single">
                    <main className="sections-container">
                        <MessageGenerator />
                    </main>
                </div>
            )}
        </div>
    );
}

export default App;