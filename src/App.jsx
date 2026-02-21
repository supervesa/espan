import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from './utils/supabaseClient'; 
import SummaryPanel from './components/SummaryPanel';
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
import Jalkimarkkinointi from './components/Jalkimarkkinointi';
import AdminWorkspace from './components/admin/AdminWorkspace';

// STAATTINEN DATA HYBRIDIMALLIA VARTEN
import { planData } from './data/planData'; 

import './styles/rakenteet.css';
import './styles/tyylit.css';
import './styles/espan2.css';

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
    const [activeTab, setActiveTab] = useState('suunnitelma');

    const [dbPlanData, setDbPlanData] = useState({ aihealueet: [] });
    const [dbMessages, setDbMessages] = useState([]);
    const [dbKnowledge, setDbKnowledge] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoadingData(true);
            try {
                const [secRes, msgRes, knowRes] = await Promise.all([
                    supabase.from('sections').select('*, phrases (*, variables (*))').order('order_index'),
                    supabase.from('message_templates').select('*').order('title'),
                    supabase.from('knowledge_base').select('*').order('title')
                ]);

                if (secRes.data) {
                    const mappedAihealueet = secRes.data.map(sec => {
                        const alwaysMultiSelect = ['suunnitelman_perustiedot', 'tyotilanne', 'ammattikortit', 'palveluunohjaus', 'suunnitelma'];
                        const isMulti = alwaysMultiSelect.includes(sec.section_key) ? true : sec.is_multiselect;

                        return {
                            otsikko: sec.title,
                            id: sec.section_key,
                            monivalinta: isMulti,
                            tyyppi: sec.component_type,
                            fraasit: (sec.phrases || []).sort((a, b) => a.order_index - b.order_index).map(phr => {
                                const muuttujat = {};
                                if (phr.variables && phr.variables.length > 0) {
                                    phr.variables.forEach(v => {
                                        
                                        // AGGRESSIIVINEN VAIHTOEHTOJEN PURKU
                                        let optionsArray = undefined;
                                        if (v.options && v.options !== 'null' && v.options !== '[]' && v.options !== '') {
                                            try { 
                                                const parsed = typeof v.options === 'string' ? JSON.parse(v.options) : v.options; 
                                                optionsArray = Array.isArray(parsed) ? parsed : [parsed];
                                            } catch(e) {
                                                optionsArray = v.options.replace(/[\[\]"']/g, '').split(',').map(s => s.trim());
                                            }
                                        }
                                        
                                        // AGGRESSIIVINEN TYYPIN PAKOTUS
                                        let inputTyyppi = 'teksti';
                                        if (v.input_type === 'select' || v.input_type === 'valinta' || (optionsArray && optionsArray.length > 0)) {
                                            inputTyyppi = 'valinta'; // Jos vaihtoehtoja on, se on PAKKO olla valikko!
                                        } else if (v.input_type === 'number' || v.input_type === 'numero') {
                                            inputTyyppi = 'numero';
                                        }

                                        // PÄIVÄMÄÄRIEN PAKOTUS
                                        let defVal = v.default_value !== null && v.default_value !== undefined ? v.default_value : '';
                                        if ((v.variable_key.includes('PÄIVÄMÄÄRÄ') || v.variable_key.includes('PVM')) && (!defVal || defVal.trim() === '')) {
                                            defVal = new Date().toLocaleDateString('fi-FI');
                                        }
                                        
                                        // Jos on valikko eikä oletusta ole asetettu, otetaan listan ensimmäinen
                                        if (inputTyyppi === 'valinta' && (!defVal || defVal === '') && optionsArray && optionsArray.length > 0) {
                                            defVal = optionsArray[0];
                                        }

                                        muuttujat[v.variable_key] = {
                                            tyyppi: inputTyyppi,
                                            vaihtoehdot: optionsArray,
                                            oletus: defVal
                                        };
                                    });
                                }
                                return {
                                    lyhenne: phr.short_title,
                                    teksti: phr.base_text,
                                    avainsana: phr.phrase_key,
                                    ryhma: phr.grouping_key,
                                    priority: phr.priority_score,
                                    muuttujat: Object.keys(muuttujat).length > 0 ? muuttujat : undefined
                                };
                            })
                        };
                    });
                    setDbPlanData({ aihealueet: mappedAihealueet });
                }

                if (msgRes.data) {
                    const parsedMessages = msgRes.data.map(msg => {
                        let parsedFields = [];
                        let parsedAddons = [];
                        try { parsedFields = typeof msg.fields === 'string' ? JSON.parse(msg.fields) : msg.fields; } catch(e){}
                        try { parsedAddons = typeof msg.addons === 'string' ? JSON.parse(msg.addons) : msg.addons; } catch(e){}
                        return {
                            ...msg,
                            template: msg.template_body, 
                            fields: parsedFields || [],
                            addons: parsedAddons || []
                        };
                    });
                    setDbMessages(parsedMessages);
                }

                if (knowRes.data) setDbKnowledge(knowRes.data);

            } catch (error) {
                console.error("Virhe datan latauksessa:", error);
            }
            setIsLoadingData(false);
        };

        fetchAllData();
    }, []);

    const handleScrape = useCallback((scrapedState) => {
        setState(currentState => deepMerge(currentState, scrapedState));
    }, []);

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect, updatedSelection = null) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));

            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId);
            if (!section) {
                section = planData.aihealueet.find(s => s.id === sectionId);
            }

            if (!section || !section.fraasit) return currentState;

            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
            if (!phrase) return currentState;

            if (updatedSelection) {
                newState[sectionId] = updatedSelection;
                return newState;
            }

            if (!newState[sectionId]) newState[sectionId] = {};
            const currentSelections = newState[sectionId];
            
            const actualIsMultiSelect = section.monivalinta;

            if (actualIsMultiSelect) {
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                } else {
                    const initialVariables = {};
                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                let defaultVal = config.oletus !== undefined && config.oletus !== '' 
                                    ? config.oletus 
                                    : (config.vaihtoehdot && Array.isArray(config.vaihtoehdot) && config.vaihtoehdot.length > 0 ? config.vaihtoehdot[0] : '');
                                
                                if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal || defaultVal === '')) {
                                    defaultVal = new Date().toLocaleDateString('fi-FI');
                                }
                                initialVariables[key] = defaultVal;
                            } else {
                                initialVariables[key] = '';
                            }
                        });
                    }
                    currentSelections[avainsana] = {
                        avainsana: avainsana, 
                        muuttujat: initialVariables 
                    };
                }
            } else { 
                if (currentSelections.avainsana === avainsana) {
                    delete currentSelections.avainsana;
                    delete currentSelections.muuttujat;
                } else {
                    currentSelections.avainsana = phrase.avainsana;
                    currentSelections.muuttujat = {};

                    if (phrase.muuttujat) {
                        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                            if (config) {
                                let defaultVal = config.oletus !== undefined && config.oletus !== '' 
                                    ? config.oletus 
                                    : (config.vaihtoehdot && Array.isArray(config.vaihtoehdot) && config.vaihtoehdot.length > 0 ? config.vaihtoehdot[0] : '');
                                
                                if ((key.includes('PÄIVÄMÄÄRÄ') || key.includes('PVM')) && (!defaultVal || defaultVal === '')) {
                                    defaultVal = new Date().toLocaleDateString('fi-FI');
                                }
                                currentSelections.muuttujat[key] = defaultVal;
                            } else {
                                currentSelections.muuttujat[key] = '';
                            }
                        });
                    }
                }
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            const newState = JSON.parse(JSON.stringify(currentState));
            
            let section = dbPlanData.aihealueet?.find(s => s.id === sectionId);
            if (!section) section = planData.aihealueet.find(s => s.id === sectionId);
            if (!section) return currentState;

            let target = section.monivalinta ? newState[sectionId]?.[avainsana] : newState[sectionId];

            if (target) {
                if (!target.muuttujat) target.muuttujat = {};
                target.muuttujat[variableKey] = value;
            }
            return newState;
        });
    }, [dbPlanData]);

    const handleUpdateCustomText = useCallback((sectionId, value) => {
        const customKey = sectionId === 'kielitaso' ? `custom-kielitaso` : `custom-${sectionId}`;
        setState(currentState => ({ ...currentState, [customKey]: value }));
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
            palkkatuki: { ...(prevState.palkkatuki || {}), [key]: value }
        }));
    }, []);

    const handleUpdateTyottomyysturva = useCallback((key, value) => {
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

    const handleUpdateSuunnitelma = useCallback((phraseId, isChecked) => {
        setState(prevState => {
            const newSuunnitelmaState = { ...(prevState.suunnitelma || {}) };
            if (isChecked) newSuunnitelmaState[phraseId] = true; 
            else delete newSuunnitelmaState[phraseId];
            return { ...prevState, suunnitelma: newSuunnitelmaState };
        });
    }, []);

    const actions = {
        onSelect: handleSelectPhrase,
        onUpdateVariable: handleUpdateVariable,
        onUpdateCustomText: handleUpdateCustomText,
        onUpdateTyokyky: handleUpdateTyokyky,
        onUpdatePalkkatuki: handleUpdatePalkkatuki,
        onUpdateTyottomyysturva: handleUpdateTyottomyysturva,
        onUpdateKielitaso: handleUpdateKielitaso,
        onUpdateSuunnitelma: handleUpdateSuunnitelma, 
        handleScrape: handleScrape, 
    };

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
                        <Scraper onScrape={handleScrape} />

                        <section id="osio-suunnitelman-tyyppi"><SuunnitelmanTyyppi state={state} actions={actions} /></section>
                        <section id="osio-suunnitelman-perustiedot"><Perustiedot state={state} actions={actions} planData={dbPlanData} /></section>
                        <section id="osio-tyottomyysturva"><Tyottomyysturva state={state} actions={actions} /></section>
                        <section id="osio-tyotilanne"><Tyotilanne state={state} actions={actions} planData={dbPlanData} knowledgeData={dbKnowledge} /></section>
                        <section id="osio-koulutus"><KoulutusJaYrittajyys state={state} actions={actions} /></section>
                        <Kielitaso state={state} actions={actions} />
                        <section id="osio-tyokyky"><Tyokyky state={state} actions={actions} /></section>
                        <section id="osio-palkkatuki"><PalkkatukiCalculator state={state} actions={actions} /></section>
                        <section id="osio-palveluohjaus"><Palveluunohjaus state={state} actions={actions} /></section>
                        <section id="osio-suunnitelma"><Suunnitelma state={state} actions={actions} /></section>
                        <section id="osio-tyonhaku"><Tyonhakuvelvollisuus state={state} actions={actions} /></section>
                        
                        <AiAnalyysi state={state} actions={actions} />
                        <Jalkimarkkinointi state={state} />
                        <hr className="section-divider" /> 
                    </main>

                    <div className="summary-sticky-container">
                        {/* HUOM! Palautin tähän nuo kaksi elintärkeää propsia: dbPlanData ja dbKnowledge! */}
                        <SummaryPanel state={state} sections={sectionsForPanel} dbPlanData={dbPlanData} dbKnowledge={dbKnowledge} />
                    </div>
                </div>
            )}

            {/* KORJATTU: Viestigeneraattori tulostetaan nyt "vapaana", jotta sen omat sarakkeet mahtuvat ruudulle! */}
            {activeTab === 'viestit' && (
                <MessageGenerator state={state} templates={dbMessages} />
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