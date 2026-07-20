// --- src/components/sections/Tyonhakuvelvollisuus.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useSignal } from '../signals/useSignal';
import { PhraseOption } from '../PhraseOption';
import THVSmartAnalysisBox from './THV-smart-analysis-box';
import { ChevronDown, ChevronUp, FileText, CheckSquare, AlertCircle } from 'lucide-react';
import { planData } from '../../data/planData'; 

// Common-komponentit
import Button from '../common/Button';
import AlertBox from '../common/AlertBox';
import Checkbox from '../common/Checkbox';
import SmartTextPreview from '../common/SmartTextPreview';

const AIKATAULU_FAKE_ID = 'aikataulu-fake-id-12345';

const transformVariables = (varsArray) => {
    if (!varsArray || varsArray.length === 0) return null;
    return varsArray.reduce((acc, curr) => {
        let cleanDefault = curr.default_value;
        if (typeof cleanDefault === 'string' && cleanDefault.startsWith('"') && cleanDefault.endsWith('"')) {
            cleanDefault = cleanDefault.slice(1, -1);
        }
        acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: cleanDefault };
        return acc;
    }, {});
};

// --- 1. ALENNUSTYÖKALU ---
const Alennustyokalu = ({ alennusPhrases, selection, onUpdate, onCancel }) => {
    const [perustelut, setPerustelut] = useState(selection?.alentamisenPerustelut || {});
    const [vapaaTeksti, setVapaaTeksti] = useState(selection?.alentamisenVapaaTeksti || '');

    const handlePerusteluChange = (phraseKey) => {
        setPerustelut(prev => ({ ...prev, [phraseKey]: !prev[phraseKey] }));
    };
    
    const esikatselu = useMemo(() => {
        const valitutTekstit = Object.entries(perustelut)
            .filter(([, valittu]) => valittu)
            .map(([key]) => {
                const phrase = alennusPhrases.find(p => p.phrase_key === key);
                return phrase ? phrase.base_text : key;
            });

        if (valitutTekstit.length === 0) return vapaaTeksti ? vapaaTeksti.trim() : '';

        if (valitutTekstit.length === 1) {
            return `${valitutTekstit[0]}${vapaaTeksti ? ` ${vapaaTeksti}` : ''}`.trim();
        }

        let teksti = 'Työnhakuvelvollisuuden alentamisen tai asettamatta jättämisen perusteet:\n';
        teksti += valitutTekstit.map(t => `• ${t}`).join('\n');
        
        if (vapaaTeksti) {
            teksti += `\n\nTarkemmat perustelut:\n${vapaaTeksti}`;
        }
        
        return teksti;
    }, [perustelut, vapaaTeksti, alennusPhrases]);

    const handleSave = () => {
        onUpdate({ 
            ...selection, 
            alentamisenPerustelut: perustelut,
            alentamisenVapaaTeksti: vapaaTeksti,
            alentamisenValmisTeksti: esikatselu 
        });
    };

    return (
        <div className="alennus-tyokalu">
            <h4 className="alennus-header text-primary">
                <AlertCircle size={18} /> Alentamisen viralliset perustelut
            </h4>
            
            <div className="perustelut-valinnat">
                {alennusPhrases.map(p => (
                    <Checkbox 
                        key={p.id}
                        label={p.short_title}
                        checked={!!perustelut[p.phrase_key]}
                        onChange={() => handlePerusteluChange(p.phrase_key)}
                    />
                ))}
            </div>
            
            <div className="vapaa-teksti-container">
                <label htmlFor="vapaa-teksti-alennus" className="text-sm fw-semibold block" style={{ marginBottom: '0.5rem' }}>Tarkemmat perustelut (vapaa sana):</label>
                <textarea id="vapaa-teksti-alennus" className="form-input" rows="3" value={vapaaTeksti} onChange={(e) => setVapaaTeksti(e.target.value)} />
            </div>
            
            <div style={{ marginTop: '1.5rem' }}>
                <SmartTextPreview 
                    title="Esikatselu valmiista tekstistä" 
                    text={esikatselu} 
                    emptyText="Ei perusteluja valittu." 
                />
            </div>
            
            <div className="alennus-tyokalu-actions">
                <Button variant="primary" onClick={handleSave}>Tallenna perustelut</Button>
                <Button variant="secondary" onClick={onCancel}>Peruuta</Button>
            </div>
        </div>
    );
};

// --- 2. VAKIOTEKSTITYÖKALU (Opt-in Aikataulu ja Vale-ID kytkentä) ---
const VakiotekstiTyokalu = ({ vakiotekstit, selection, onUpdate, aikatauluTeksti }) => {
    const currentSelection = selection || {};

    const handleUpdate = (newSelectedVt, includeSchedule) => {
        const finalSelectedVt = { ...newSelectedVt };
        
        // Vale-ID:n lisääminen tai poistaminen valituista vakioteksteistä
        if (includeSchedule) {
            finalSelectedVt[AIKATAULU_FAKE_ID] = true;
        } else {
            delete finalSelectedVt[AIKATAULU_FAKE_ID];
        }

        const combinedStandard = vakiotekstit.filter(vt => finalSelectedVt[vt.id]).map(vt => vt.content_text).join('\n\n');
        const aikatauluOsa = (includeSchedule && aikatauluTeksti) ? `${aikatauluTeksti}\n\n` : '';
        const newFinalCombined = `${aikatauluOsa}${combinedStandard}`.trim();
        
        onUpdate({ 
            ...currentSelection, 
            valitutVakiotekstit: finalSelectedVt, 
            sisallytaAikataulu: includeSchedule,
            vakiotekstitYhdistetty: newFinalCombined 
        });
    };

    const handleToggleVt = (vtId, isChecked) => {
        const newSelected = { ...(currentSelection?.valitutVakiotekstit || {}), [vtId]: isChecked };
        handleUpdate(newSelected, !!currentSelection?.sisallytaAikataulu);
    };

    const handleToggleSchedule = (isChecked) => {
        handleUpdate(currentSelection?.valitutVakiotekstit || {}, isChecked);
    };

    return (
        <div className="thv-locked-text-container" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h4 className="thv-locked-text-header">
                <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} /> Aikataulu ja Lakisääteiset vakiotekstit
            </h4>
            
            {aikatauluTeksti && (
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <Checkbox 
                        label="Sisällytä tekoälyn generoima aikatauluehdotus suunnitelmaan"
                        checked={!!currentSelection?.sisallytaAikataulu}
                        onChange={(isChecked) => handleToggleSchedule(isChecked)}
                    />
                    {!!currentSelection?.sisallytaAikataulu && (
                        <div className="text-sm font-italic text-secondary" style={{ marginTop: '0.75rem', paddingLeft: '1.75rem', borderLeft: '3px solid var(--color-primary)' }}>
                            {aikatauluTeksti}
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {vakiotekstit.map(vt => (
                    <Checkbox 
                        key={vt.id}
                        label={vt.title}
                        checked={!!currentSelection?.valitutVakiotekstit?.[vt.id]}
                        onChange={(isChecked) => handleToggleVt(vt.id, isChecked)}
                    />
                ))}
            </div>
            
            <SmartTextPreview 
                title="Esikatselu asiakirjaan tulostuvasta tekstistä" 
                text={currentSelection?.vakiotekstitYhdistetty} 
                emptyText="Ei valittuja tekstejä." 
            />
        </div>
    );
};

// --- 3. PÄÄKOMPONENTTI ---
const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const UI_KEY = 'tyonhakuvelvollisuus';
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const { variables, rules, knowledgeBase, loading: signalLoading } = useSignal();
    
    const [phrases, setPhrases] = useState([]);
    const [alennusPhrases, setAlennusPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [alennusToolVisible, setAlennusToolVisible] = useState(false);
    const [showAllOptions, setShowAllOptions] = useState(false);

    const selection = state[UI_KEY]; 
    const aikatauluTeksti = state['custom-aikataulu_ehdotus'] || '';

    const handleClearPhrase = () => {
        onSelect('tyonhakuvelvollisuus', '', false, {
            ...selection,
            avainsana: '',
            alentamisenPerustelut: null,
            alentamisenVapaaTeksti: ''
        });
        setAlennusToolVisible(false);
    };

    const isPalvelussa = useMemo(() => {
        if (!state.tyotilanne) return false;
        const tt = JSON.stringify(state.tyotilanne).toLowerCase();
        return tt.includes('tyokokeilu') || tt.includes('työvoimakoulutus') || tt.includes('palkkatuki') || tt.includes('palkkatuettu');
    }, [state.tyotilanne]);

    // 1. Datan ja fraasien lataus
    useEffect(() => {
        const fetchLocalData = async () => {
            setLoading(true);
            try {
                const [phrasesRes, alennusRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', '5db6c713-639a-4124-8236-7f72a6f9e32e').order('priority_score', { ascending: true }),
                    supabase.from('phrases').select('*').eq('grouping_key', 'alennusperustelu').order('short_title'),
                    supabase.from('variables').select('*') 
                ]);

                if (phrasesRes.data) {
                    setPhrases(phrasesRes.data);
                    
                    const sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
                    if (sectionInPlanData) {
                        phrasesRes.data.forEach(dbPhrase => {
                            if (!sectionInPlanData.fraasit.find(f => f.avainsana === dbPhrase.phrase_key)) {
                                const phraseVars = varsRes.data ? varsRes.data.filter(v => v.phrase_id === dbPhrase.id) : [];
                                sectionInPlanData.fraasit.push({
                                    avainsana: dbPhrase.phrase_key, 
                                    teksti: dbPhrase.base_text,
                                    lyhenne: dbPhrase.short_title,
                                    muuttujat: transformVariables(phraseVars)
                                });
                            }
                        });
                    }
                }
                
                if (alennusRes.data) setAlennusPhrases(alennusRes.data);
            } catch (error) { console.error("Virhe:", error); }
            setLoading(false);
        };
        fetchLocalData();
    }, []);

    // 2. TULOSTUKSEN SILTA: Aikataulun dynaaminen Vale-ID injektio
    useEffect(() => {
        const sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
        if (sectionInPlanData && aikatauluTeksti) {
            // Varmistetaan, että vakiotekstit-taulukko on olemassa
            if (!sectionInPlanData.vakiotekstit) sectionInPlanData.vakiotekstit = [];
            
            let fakeObj = sectionInPlanData.vakiotekstit.find(v => v.id === AIKATAULU_FAKE_ID);
            if (!fakeObj) {
                // Injektoidaan aikataulu tulostusmoottorin sanakirjaan
                sectionInPlanData.vakiotekstit.push({
                    id: AIKATAULU_FAKE_ID,
                    title: 'Sovittu aikataulu',
                    content_text: aikatauluTeksti
                });
            } else {
                // Päivitetään teksti, jos tekoäly loi uuden ehdotuksen
                fakeObj.content_text = aikatauluTeksti;
            }
        }
    }, [aikatauluTeksti]);

    const vakiotekstit = useMemo(() => {
        if (!knowledgeBase) return [];
        const filteredVt = knowledgeBase.filter(kb => kb.title !== 'THV Lopputeksti');
        const order = ['Oikeudet ja velvollisuudet', 'Täydentävät- ja Työnhakukeskustelut', 'Työnhakuvelvollisuuden toteuttaminen ja seuranta (todennettava)'];
        return filteredVt.sort((a, b) => {
            const indexA = order.indexOf(a.title);
            const indexB = order.indexOf(b.title);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    }, [knowledgeBase]);

    const evaluateRule = (conditionStr, currentState) => {
        if (!conditionStr) return true;
        try {
            const condition = typeof conditionStr === 'string' ? JSON.parse(conditionStr) : conditionStr;
            const { section, operator, value } = condition;
            const stateValue = currentState[section];

            if (operator === 'contains') {
                if (!stateValue) return false;
                if (typeof stateValue === 'object' && !Array.isArray(stateValue)) return !!stateValue[value];
                if (Array.isArray(stateValue)) return stateValue.includes(value);
                if (typeof stateValue === 'string') return stateValue.includes(value);
            }
            if (operator === 'exists') {
                if (!stateValue) return false;
                if (typeof stateValue === 'object') return Object.values(stateValue).some(v => v);
                return !!stateValue;
            }
            if (operator === 'equals') return stateValue === value;
            return false;
        } catch (e) { return false; }
    };

    const { displayPhrases } = useMemo(() => {
        if (loading || signalLoading) return { displayPhrases: [] };
        const visiblePhrases = [];

        for (const phrase of phrases) {
            const phraseRules = rules.filter(r => r.target_id === phrase.id);
            const phraseVars = variables.filter(v => v.phrase_id === phrase.id);
            const muuttujatObj = {};
            const isThisPhraseSelected = selection?.avainsana === phrase.phrase_key;

            phraseVars.forEach(v => { 
                let parsedOptions = [];
                try {
                    if (Array.isArray(v.options)) {
                        parsedOptions = v.options;
                    } else if (typeof v.options === 'string') {
                        let temp = JSON.parse(v.options);
                        parsedOptions = typeof temp === 'string' ? JSON.parse(temp) : temp;
                    }
                } catch (e) { console.warn("Virhe JSON-parsinnassa:", v.options); }

                let cleanDefault = v.default_value;
                if (typeof cleanDefault === 'string' && cleanDefault.startsWith('"') && cleanDefault.endsWith('"')) {
                    cleanDefault = cleanDefault.slice(1, -1);
                }

                const savedValue = isThisPhraseSelected && selection?.muuttujat ? selection.muuttujat[v.variable_key] : undefined;
                const finalValue = savedValue !== undefined ? savedValue : cleanDefault;

                muuttujatObj[v.variable_key] = { 
                    oletus: cleanDefault, 
                    arvo: finalValue,
                    value: finalValue,
                    tyyppi: v.input_type,
                    vaihtoehdot: parsedOptions
                }; 
            });
            
            const enrichedPhrase = { 
                ...phrase, avainsana: phrase.phrase_key, lyhenne: phrase.short_title, 
                selite: phrase.base_text, otsikko: phrase.short_title, teksti: phrase.base_text,    
                title: phrase.short_title, content: phrase.base_text, muuttujat: muuttujatObj 
            };

            const visibilityRules = phraseRules.filter(r => r.rule_type === 'visibility');
            const isVisible = visibilityRules.every(rule => evaluateRule(rule.condition_json, state));
            if (!isVisible) continue; 
            visiblePhrases.push(enrichedPhrase);
        }
        return { displayPhrases: visiblePhrases };
    }, [phrases, variables, rules, state, selection, loading, signalLoading]);

    const primaryPhrase = useMemo(() => {
        if (displayPhrases.length === 0) return null;
        const selected = displayPhrases.find(p => p.phrase_key === selection?.avainsana);
        return selected || displayPhrases[0];
    }, [displayPhrases, selection]);

    const phrasesToRender = isPalvelussa && !showAllOptions 
        ? (selection?.avainsana ? [displayPhrases.find(p => p.phrase_key === selection.avainsana)].filter(Boolean) : []) 
        : (showAllOptions ? displayPhrases : (primaryPhrase ? [primaryPhrase] : []));

    const handlePhraseSelect = (sectionId, phraseKeyword, isToggle, payload) => {
        if (payload) {
            onSelect(sectionId, phraseKeyword, isToggle, payload);
            return;
        }
        
        const phrase = displayPhrases.find(p => p.phrase_key === phraseKeyword);
        let defaultVars = {};
        if (phrase && phrase.muuttujat) {
            Object.keys(phrase.muuttujat).forEach(key => {
                defaultVars[key] = phrase.muuttujat[key].oletus;
            });
        }

        let currentSelectedVt = { ...(selection?.valitutVakiotekstit || {}) };
        if (defaultVars.LKM && Number(defaultVars.LKM) > 0) {
            vakiotekstit.forEach(vt => {
                if (vt.title.includes('toteuttaminen ja seuranta')) {
                    currentSelectedVt[vt.id] = true;
                }
            });
        }
        
        const combinedStandard = vakiotekstit.filter(vt => currentSelectedVt[vt.id]).map(vt => vt.content_text).join('\n\n');
        const aikatauluOsa = (selection?.sisallytaAikataulu && aikatauluTeksti) ? `${aikatauluTeksti}\n\n` : '';
        const newFinalCombined = `${aikatauluOsa}${combinedStandard}`.trim();

        onSelect(sectionId, phraseKeyword, isToggle, {
            ...selection,
            avainsana: phraseKeyword,
            muuttujat: defaultVars,
            valitutVakiotekstit: currentSelectedVt,
            vakiotekstitYhdistetty: newFinalCombined
        });
        setAlennusToolVisible(false);
    };

    const handleVariableUpdate = (sectionId, phraseKeyword, variableName, newValue) => {
        onUpdateVariable(sectionId, phraseKeyword, variableName, newValue);
        const phrase = displayPhrases.find(p => p.phrase_key === phraseKeyword);
        
        if (phrase && variableName === 'LKM') {
            const defaultValue = phrase.muuttujat?.LKM?.oletus;
            if (defaultValue !== undefined && Number(newValue) < Number(defaultValue)) {
                setAlennusToolVisible(true);
            }

            if (vakiotekstit.length > 0) {
                const currentSelected = { ...(selection?.valitutVakiotekstit || {}) };
                let changed = false;
                
                vakiotekstit.forEach(vt => {
                    if (vt.title.includes('toteuttaminen ja seuranta')) {
                        const shouldBeChecked = Number(newValue) > 0;
                        if (currentSelected[vt.id] !== shouldBeChecked) {
                            currentSelected[vt.id] = shouldBeChecked;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    const combinedStandard = vakiotekstit.filter(vt => currentSelected[vt.id]).map(vt => vt.content_text).join('\n\n');
                    const aikatauluOsa = (selection?.sisallytaAikataulu && aikatauluTeksti) ? `${aikatauluTeksti}\n\n` : '';
                    const newFinalCombined = `${aikatauluOsa}${combinedStandard}`.trim();
                    
                    onSelect('tyonhakuvelvollisuus', phraseKeyword, false, {
                        ...selection,
                        muuttujat: { ...(selection?.muuttujat || {}), LKM: newValue },
                        valitutVakiotekstit: currentSelected,
                        vakiotekstitYhdistetty: newFinalCombined
                    });
                }
            }
        }
    };

    if (loading || signalLoading) return <div className="section-container"><p className="text-secondary text-sm">Ladataan työnhakuvelvollisuuden aivoja...</p></div>;

    const dummySection = { id: 'tyonhakuvelvollisuus', otsikko: 'Työnhakuvelvollisuus' };

    return (
        <section className="section-container">
            <h2 className="icon-heading text-primary">
                <FileText size={22} /> Työnhakuvelvollisuus
            </h2>
            
            <THVSmartAnalysisBox actions={actions} />
            
            {isPalvelussa && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <AlertBox type="success" customStyle={{ marginBottom: selection?.avainsana ? '0.75rem' : '0' }}>
                        <strong>Palvelu tunnistettu.</strong> Asiakas on työkokeilussa, työvoimakoulutuksessa tai palkkatuella. 
                        Numeerista hakuvelvollisuutta ei vaadita. Suunnitelmaan tulostuu automaattisesti sivun alaosan <strong>Aikatauluehdotus ja lakisääteiset vakiotekstit.</strong>
                    </AlertBox>
                    
                    {selection?.avainsana && (
                        <AlertBox type="danger" customStyle={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Huomio: Sinulla on yhä aiemmin valittu virheellinen THV-fraasi muistissa.</span>
                            <Button variant="danger" size="sm" onClick={handleClearPhrase}>Poista asiakirjasta</Button>
                        </AlertBox>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {phrasesToRender.map(phrase => (
                    <PhraseOption 
                        key={phrase.id}
                        phrase={phrase} 
                        section={dummySection} 
                        isSelected={selection?.avainsana === phrase.phrase_key} 
                        onSelect={handlePhraseSelect} 
                        onUpdateVariable={handleVariableUpdate} 
                    />
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                {displayPhrases.length > 1 && (
                    <Button variant="secondary" onClick={() => setShowAllOptions(!showAllOptions)}>
                        {showAllOptions ? <><ChevronUp size={16} /> Piilota ylimääräiset vaihtoehdot</> : <><ChevronDown size={16} /> {isPalvelussa ? 'Näytä silti numeeriset vaihtoehdot' : `Näytä muut vaihtoehdot (${displayPhrases.length - 1} kpl)`}</>}
                    </Button>
                )}
                
                {selection?.avainsana && !isPalvelussa && (
                    <Button variant="ghost" onClick={handleClearPhrase}>Poista nykyinen valinta</Button>
                )}
            </div>
            
            {selection?.avainsana && (
                 <div className="alennus-nappi-container">
                    <Button 
                        variant="secondary"
                        icon={alennusToolVisible ? ChevronUp : AlertCircle}
                        onClick={() => setAlennusToolVisible(!alennusToolVisible)}
                    >
                        {alennusToolVisible ? 'Piilota alennusperustelut' : 'Alenna velvollisuutta / Kirjaa perustelut lakia varten'}
                    </Button>
                 </div>
            )}
            
            {alennusToolVisible && selection?.avainsana && (
                <Alennustyokalu 
                    alennusPhrases={alennusPhrases} 
                    selection={selection}
                    onUpdate={(updatedSelection) => {
                        onSelect('tyonhakuvelvollisuus', updatedSelection.avainsana, false, updatedSelection);
                        setAlennusToolVisible(false);
                    }}
                    onCancel={() => setAlennusToolVisible(false)}
                />
            )}

            <div className="custom-text-container">
                <label htmlFor="custom-text-tyonhakuvelvollisuus" className="custom-text-label text-sm fw-semibold block" style={{ marginBottom: '0.5rem' }}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id="custom-text-tyonhakuvelvollisuus" 
                    className="form-input"
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-tyonhakuvelvollisuus`] || ''} 
                    onChange={(e) => onUpdateCustomText('tyonhakuvelvollisuus', e.target.value)} 
                />
            </div>

            {(vakiotekstit.length > 0 || aikatauluTeksti) && (
                <VakiotekstiTyokalu 
                    vakiotekstit={vakiotekstit}
                    selection={selection}
                    aikatauluTeksti={aikatauluTeksti}
                    onUpdate={(updatedSelection) => {
                        onSelect('tyonhakuvelvollisuus', updatedSelection.avainsana, false, updatedSelection);
                    }}
                />
            )}
        </section>
    );
};

export default Tyonhakuvelvollisuus;