#!/bin/bash

# Espan-projektin lopullinen korjausskripti
# Tämä skripti palauttaa sovelluksen ydinlogiikan ja varmistaa,
# että suunnitelma rakentuu oikein yhteenvetoon.

echo "Palautetaan sovelluksen ydinlogiikka..."

# --- 1. KORJATAAN App.jsx KOKONAAN ---
echo "Kirjoitetaan src/App.jsx uudelleen..."
cat <<'EOF' > src/App.jsx
import React, { useState, useCallback } from 'react';
import Summary from './components/Summary';
import Scraper from './components/Scraper';
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

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = { ...currentState };
            const section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section || !section.fraasit) return newState;
            
            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
            if (!phrase) return newState; // Turvatarkistus

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
        </div>
    );
}
export default App;
EOF

# --- 2. KORJATAAN Summary.jsx ---
echo "Kirjoitetaan src/components/Summary.jsx uudelleen..."
cat <<'EOF' > src/components/Summary.jsx
import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const FINGERPRINT = '\u200B\u200D\u200C'; // Näkymätön sormenjälki

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject) => {
                let text = phraseObject.teksti;
                const phraseState = section.monivalinta ? selection?.[phraseObject.avainsana] : selection;
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                        text = text.replace(`[${key}]`, value || '');
                    });
                }
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim();
            };
            
            // --- OSIOKOHTAINEN LOGIIKKA ---
            if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    if (section.id === 'tyonhakuvelvollisuus') {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                        // Lisätään myös mahdolliset alentamisen perustelut
                        if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                             const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([,v]) => v).map(([k]) => k).join(', ');
                             let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                             if (perustelut) alennusTeksti += ` Perusteet: ${perustelut}.`;
                             if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                             text += alennusTeksti;
                        }
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
            }

            if (sectionTextParts.length > 0) {
                textParts.push(`${section.otsikko}\n${sectionTextParts.join('\n')}`);
            }
        });
        
        if (textParts.length === 0) return '';
        return FINGERPRINT + textParts.join('\n\n');

    }, [state]);

    const handleCopy = () => {
        const plainText = summaryText.replace(FINGERPRINT, '');
        navigator.clipboard.writeText(plainText).then(() => {
            setFeedback('Kopioitu!');
            setTimeout(() => setFeedback(''), 2000);
        });
    };
    
    return (
        <aside className="summary-sticky-container">
            <div className="summary-box">
                <h2>Koottu suunnitelma</h2>
                <div className="summary-content">
                    {summaryText ? (
                        summaryText.replace(FINGERPRINT, '').split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex}>
                                {paragraph.split('\n').map((line, lIndex) => {
                                    if (lIndex === 0) {
                                        return <strong key={lIndex}>{line}</strong>;
                                    }
                                    return <React.Fragment key={lIndex}><br />{line}</React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi...</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>Kopioi leikepöydälle</button>
                <p className="feedback-text">{feedback}</p>
            </div>
        </aside>
    );
};
export default Summary;
EOF

echo "Korjaus valmis! Sovelluksen perustoiminnallisuus on palautettu."
echo "Voit käynnistää sovelluksen komennolla: npm run dev"

Suunnitelman perustiedot
Asiakkaan työnhaku on alkanut 19.9.2025.
Asiakkaan syntymävuosi: 1980
Tämä suunnitelma laadittiin puhelinajalla 19.9.2025.

Asiakkaan työtilanne
Asiakas on työtön työnhakija.

Työnhakuvelvollisuus
Palvelumallin mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus. Asiakkaan tulee hakea vähintään 4 työmahdollisuutta kuukaudessa.
Haetut paikat ja suunnitelman tehtävät tulee merkata toteutuneeksi kuukausittain...