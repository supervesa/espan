#!/bin/bash

# Espan-projektin päivitysskripti
# Tämä skripti palauttaa Työnhakuvelvollisuus-osioon aiemmin
# suunnitellut älykkäät ominaisuudet.

echo "Palautetaan älykkäät ominaisuudet Työnhakuvelvollisuus-osioon..."

# --- 1. PÄIVITETÄÄN SCRAPER LISÄÄMÄÄN EDELLISEN THV:N LUKU ---
echo "Päivitetään src/utils/scraper.js..."
cat <<'EOF' > src/utils/scraper.js
import { planData } from '../data/planData';

const createPhraseObject = (sectionId, avainsana, muuttujat = {}) => {
    const section = planData.aihealueet.find(s => s.id === sectionId);
    if (!section || !section.fraasit) return null;
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;
    const newPhrase = { avainsana, teksti: phraseTemplate.teksti, muuttujat: {} };
    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            newPhrase.muuttujat[key] = muuttujat[key] || config.oletus || '';
        });
    }
    return newPhrase;
};

export const parseTextToState = (text) => {
    let state = {};
    let workText = `\n${text}\n`;

    // Etsitään ensin edellinen THV-kirjaus
    const thvMatch = workText.match(/(TYÖNHAKUVELVOITE:|TYÖNHAKUVELVOLLISUUS)[\s\S]*/i);
    if (thvMatch) {
        // Etsitään seuraava pääotsikko tai tekstin loppu
        const subsequentText = thvMatch[0];
        const endMatch = subsequentText.substring(1).match(/\n[A-ZÖÄÅ -]{5,}:/);
        const thvBlock = endMatch ? subsequentText.substring(0, endMatch.index + 1) : subsequentText;
        state.previousThvText = thvBlock.replace(/(TYÖNHAKUVELVOITE:|TYÖNHAKUVELVOLLISUUS)/i, '').trim();
    }

    const rules = [
        { r: /Työnhakijaksi\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, tyonhaku_alkanut: createPhraseObject('suunnitelman_perustiedot','tyonhaku_alkanut',{PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /peruskoulutus\s+\((\d{4})\)/gi, a: (m,s) => { const year = parseInt(m[1], 10); s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, syntymavuosi: createPhraseObject('suunnitelman_perustiedot','syntymavuosi',{SYNTYMÄVUOSI: year - 16})};}},
        { r: /päivitetty\s+puhelimitse\s+([\d.]+)/gi, a: (m,s) => { s.suunnitelman_perustiedot = {...s.suunnitelman_perustiedot, laadittu: createPhraseObject('suunnitelman_perustiedot','laadittu',{YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: m[1]})};}},
        { r: /lomautettu/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, lomautettu: createPhraseObject('tyotilanne','lomautettu')};}},
        { r: /työtön työhakija/gi, a: (m,s) => { s.tyotilanne = {...s.tyotilanne, tyoton: createPhraseObject('tyotilanne','tyoton')};}},
        { r: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/gi, a: (m,s) => { s.koulutus_yrittajyys = {...s.koulutus_yrittajyys, koulutus_tausta: createPhraseObject('koulutus_yrittajyys','koulutus_tausta',{KOULUTUS: m[1]})};}},
        { r: /pistemääräkseen\s+(\d+)/i, a: (m,s) => { s.tyokyky = {...s.tyokyky, omaArvio: m[1]};}},
        { r: /Työnhakuvelvollisuus on (\d+)\s+kpl\/kk/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: m[1], AIKAJAKSO: 'kuukaudessa'});}},
        { r: /hakea vähintään (neljää|4)\s+työmahdollisuutta (kuukaudessa)/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','paasaanto',{LKM: 4, AIKAJAKSO: m[2]});}},
        { r: /Työnhakuvelvoitetta ei asetettu/gi, a: (m,s) => { s.tyonhakuvelvollisuus = createPhraseObject('tyonhakuvelvollisuus','ei_velvoitetta_tyokyky');}},
    ];

    rules.forEach(rule => {
        const matches = [...workText.matchAll(rule.r)];
        matches.forEach(match => {
            rule.a(match, state);
        });
    });

    return state;
};
EOF


# --- 2. PÄIVITETÄÄN Tyonhakuvelvollisuus.jsx KOKONAAN ---
echo "Päivitetään src/components/sections/Tyonhakuvelvollisuus.jsx..."
cat <<'EOF' > src/components/sections/Tyonhakuvelvollisuus.jsx
import React from 'react';
import { useMemo } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';

const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyonhakuvelvollisuus');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    // VAIHE 1: Kontekstin kerääminen scraperin datasta
    const previousThvText = state.previousThvText;

    // VAIHE 2: Läpinäkyvä sääntömoottori
    const analysis = useMemo(() => {
        const tilanneAvainsanat = state.tyotilanne ? Object.keys(state.tyotilanne) : [];
        const tyokykyAvainsana = state.tyokyky?.paavalinta?.avainsana;

        let detectedConditions = [];
        let ruleText = "Yleinen harkinta.";
        let recommendation = null;
        
        if (tilanneAvainsanat.includes('lomautettu')) detectedConditions.push("Asiakkaan työtilanne: Lomautettu");
        else if (tilanneAvainsanat.includes('osa-aikainen')) detectedConditions.push("Asiakkaan työtilanne: Osa-aikatyössä");
        else if (tilanneAvainsanat.includes('tyoton')) detectedConditions.push("Asiakkaan työtilanne: Työtön");
        
        if (tyokykyAvainsana === 'tyokyky_selvityksessa' || tyokykyAvainsana === 'tyokyky_alentunut') detectedConditions.push("Työkyky: Alentunut / Selvityksessä");
        else if (tyokykyAvainsana === 'tyokyky_normaali') detectedConditions.push("Työkyky: Normaali");

        if (tilanneAvainsanat.length > 0 && tyokykyAvainsana) {
            for (const phrase of sectionData.fraasit) {
                if (!phrase.ehdot) continue;
                const tyotilanneEhtoOk = phrase.ehdot.tyotilanne ? phrase.ehdot.tyotilanne.some(ehto => tilanneAvainsanat.includes(ehto)) : true;
                const tyokykyEhtoOk = phrase.ehdot.tyokyky ? phrase.ehdot.tyokyky.includes(tyokykyAvainsana) : true;
                if (tyotilanneEhtoOk && tyokykyEhtoOk) {
                    recommendation = phrase;
                    break;
                }
            }
        }
        
        let ehdotusTeksti = "Ehdotus: Valitse manuaalinen asetus tai tarkista aiemmat valinnat.";
        if (recommendation) {
            if (recommendation.avainsana === 'paasaanto') {
                ehdotusTeksti = "Ehdotus: Asetetaan palvelumallin mukainen pääsääntö.";
                ruleText = "Asiakas on työtön ja työkyky on normaali.";
            } else if (recommendation.avainsana === 'alennettu_osa_aikainen') {
                 ehdotusTeksti = "Ehdotus: Asetetaan alennettu velvollisuus osa-aikatyön vuoksi.";
                 ruleText = "Lain mukaan osa-aikatyössä olevalle voidaan asettaa alennettu velvoite.";
            } else if (recommendation.avainsana === 'ei_velvoitetta_lomautus') {
                ehdotusTeksti = "Ehdotus: Ei aseteta työnhakuvelvoitetta.";
                ruleText = "Lain mukaan lomautetulle ei aseteta työnhakuvelvoitetta ensimmäisen kolmen kuukauden aikana.";
            } else if (recommendation.avainsana === 'ei_velvoitetta_tyokyky') {
                ehdotusTeksti = "Ehdotus: Ei aseteta työnhakuvelvoitetta.";
                ruleText = "Työkyvyn selvittäminen on peruste jättää velvoite asettamatta.";
            }
        }

        return {
            conditions: detectedConditions,
            ruleText,
            proposalText: ehdotusTeksti,
            recommendedKeyword: recommendation ? recommendation.avainsana : null
        };

    }, [state.tyotilanne, state.tyokyky, sectionData.fraasit]);

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            
            {previousThvText && (
                <div className="context-box">
                    <h3>Edellisessä suunnitelmassa asetettu:</h3>
                    <p>{previousThvText}</p>
                </div>
            )}

            <div className="analysis-box">
                <div className="analysis-header">Analyysi ja ehdotus</div>
                <div className="analysis-content">
                    {analysis.conditions.length > 0 && (
                        <>
                            <h4>Havaittu tila:</h4>
                            <ul>{analysis.conditions.map((cond, i) => <li key={i}>{cond}</li>)}</ul>
                        </>
                    )}
                    <h4>Sovellettu sääntö:</h4>
                    <p><i>{analysis.ruleText}</i></p>
                    <p className="ehdotus">{analysis.proposalText}</p>
                </div>
            </div>

            <div className="options-container">
                {sectionData.fraasit.map(phrase => {
                    const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana;
                    return <PhraseOption 
                        key={phrase.avainsana}
                        phrase={phrase} 
                        section={sectionData} 
                        isSelected={isSelected} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                        isRecommended={phrase.avainsana === analysis.recommendedKeyword}
                    />;
                })}
            </div>

            <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-${sectionData.id}`} 
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-${sectionData.id}`] || ''} 
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Tyonhakuvelvollisuus;
EOF


# --- 3. PÄIVITETÄÄN App.jsx ---
echo "Päivitetään src/App.jsx käsittelemään scraperin uutta dataa..."
# Poistetaan vanha handleScrape ja lisätään uusi, joka osaa käsitellä `previousThvText`-tietoa.
# Tämä on turvallisin tapa varmistaa, että funktio on oikeassa muodossa.
rm -f src/App.jsx
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
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && !source[key].teksti) {
                if (!(key in target)) Object.assign(output, { [key]: source[key] });
                else output[key] = deepMerge(target[key], source[key]);
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

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect) => {
        setState(currentState => {
            const newState = { ...currentState };
            const section = planData.aihealueet.find(s => s.id === sectionId);
            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
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
                if (currentSelections[avainsana]) delete currentSelections[avainsana];
                else currentSelections[avainsana] = newPhraseObject;
                newState[sectionId] = currentSelections;
            } else {
                if (newState[sectionId]?.avainsana === avainsana) delete newState[sectionId];
                else newState[sectionId] = newPhraseObject;
            }
            return newState;
        });
    }, []);
    
    // Muut handle-funktiot (ennallaan)
    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => { setState(currentState => { const newState = JSON.parse(JSON.stringify(currentState)); const section = planData.aihealueet.find(s => s.id === sectionId); const target = section.monivalinta ? newState[sectionId]?.[avainsana] : newState[sectionId]; if (target) { if (!target.muuttujat) target.muuttujat = {}; target.muuttujat[variableKey] = value; } return newState; }); }, []);
    const handleUpdateCustomText = useCallback((sectionId, value) => { setState(currentState => ({ ...currentState, [`custom-${sectionId}`]: value })); }, []);
    const handleUpdateTyokyky = useCallback((key, value) => { setState(prevState => { const newTyokykyState = { ...(prevState.tyokyky || {}) }; if (key === 'togglePalveluohjaus') { const currentOhjaukset = { ...(newTyokykyState.palveluohjaukset || {}) }; if (currentOhjaukset[value.avainsana]) delete currentOhjaukset[value.avainsana]; else currentOhjaukset[value.avainsana] = value; newTyokykyState.palveluohjaukset = currentOhjaukset; } else if (key === 'updateKeskustelutieto') { const currentTiedot = { ...(newTyokykyState.keskustelunTiedot || {}) }; currentTiedot[value.id] = value.value; newTyokykyState.keskustelunTiedot = currentTiedot; } else { newTyokykyState[key] = value; } return { ...prevState, tyokyky: newTyokykyState }; }); }, []);
    const handleUpdatePalkkatuki = useCallback((key, value) => { setState(prevState => ({ ...prevState, palkkatuki: { ...(prevState.palkkatuki || {}), [key]: value } })); }, []);
    const handleUpdateTyottomyysturva = useCallback((key, value) => { setState(prevState => { const newTtState = { ...(prevState.tyottomyysturva || {}) }; if (key === 'updateKysymys') { const currentAnswers = { ...(newTtState.answers || {}) }; currentAnswers[value.id] = value.value; newTtState.answers = currentAnswers; } else { newTtState[key] = value; } return { ...prevState, tyottomyysturva: newTtState }; }); }, []);
    
    const actions = { onSelect: handleSelectPhrase, onUpdateVariable: handleUpdateVariable, onUpdateCustomText: handleUpdateCustomText, onUpdateTyokyky: handleUpdateTyokyky, onUpdatePalkkatuki: handleUpdatePalkkatuki, onUpdateTyottomyysturva: handleUpdateTyottomyysturva };

    return (
        <div className="app-container">
            <header className="app-header"><h1>Työllisyyssuunnitelman rakennustyökalu</h1></header>
            <div className="main-grid">
                <Scraper onScrape={handleScrape} />
                <main className="sections-container">
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

echo "Päivitys valmis! Työnhakuvelvollisuus-osio on nyt päivitetty."
echo "Voit käynnistää sovelluksen komennolla: npm run dev"