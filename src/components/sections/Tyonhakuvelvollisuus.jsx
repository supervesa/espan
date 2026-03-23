// --- src/components/sections/Tyonhakuvelvollisuus.jsx ---

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import THVSmartAnalysisBox from './THV-smart-analysis-box';
import { ChevronDown, ChevronUp, Lock, AlertCircle, Info, FileText } from 'lucide-react';

// --- 1. ALENNUSTYÖKALU ---
const Alennustyokalu = ({ alennusPhrases, selection, onUpdate, onCancel }) => {
    const [perustelut, setPerustelut] = useState(selection.alentamisenPerustelut || {});
    const [vapaaTeksti, setVapaaTeksti] = useState(selection.alentamisenVapaaTeksti || '');

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

        let teksti = '';
        if (valitutTekstit.length > 0) teksti += valitutTekstit.join(' ');
        if (vapaaTeksti) teksti += ` ${vapaaTeksti}`;
        return teksti.trim();
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
            <h4 className="alennus-header">
                <Info size={18} color="var(--color-primary)" /> Alentamisen viralliset perustelut
            </h4>
            <div className="perustelut-valinnat">
                {alennusPhrases.map(p => (
                    <div key={p.id} className="checkbox-wrapper">
                        <input 
                            type="checkbox" 
                            id={`perustelu-${p.phrase_key}`} 
                            checked={!!perustelut[p.phrase_key]} 
                            onChange={() => handlePerusteluChange(p.phrase_key)} 
                            className="modern-checkbox"
                        />
                        <label htmlFor={`perustelu-${p.phrase_key}`} className="modern-checkbox-label" style={{ margin: 0 }}>
                            {p.short_title}
                        </label>
                    </div>
                ))}
            </div>
            <div className="vapaa-teksti-container">
                <label htmlFor="vapaa-teksti-alennus">Tarkemmat perustelut (vapaa sana):</label>
                <textarea id="vapaa-teksti-alennus" className="form-input" rows="3" value={vapaaTeksti} onChange={(e) => setVapaaTeksti(e.target.value)} />
            </div>
            <div className="esikatselu-laatikko">
                <strong>Esikatselu valmiista tekstistä:</strong>
                <p className="esikatselu-teksti">{esikatselu || "Ei perusteluja valittu."}</p>
            </div>
            <div className="alennus-tyokalu-actions">
                <button onClick={handleSave} className="btn">Tallenna perustelut</button>
                <button onClick={onCancel} className="btn btn--secondary">Peruuta</button>
            </div>
        </div>
    );
};

// --- 2. VAKIOTEKSTITYÖKALU (UUSI ÄLYKÄS LAKITEKSTIEN HALLINTA) ---
const VakiotekstiTyokalu = ({ vakiotekstit, selection, onUpdate }) => {
    const prevLkmRef = useRef(selection?.muuttujat?.LKM);

    useEffect(() => {
        if (!selection || vakiotekstit.length === 0) return;
        
        const currentLkm = selection.muuttujat?.LKM;
        const currentSelected = selection.valitutVakiotekstit || {};
        let newSelected = { ...currentSelected };
        let hasChanges = false;

        // 1. Alustus: Jos valintoja ei ole vielä tehty ollenkaan
        if (Object.keys(currentSelected).length === 0) {
            vakiotekstit.forEach(vt => {
                if (vt.title.includes('Oikeudet ja velvollisuudet') || vt.title.includes('Täydentävät- ja Työnhakukeskustelut')) {
                    newSelected[vt.id] = true;
                } else if (vt.title.includes('toteuttaminen ja seuranta')) {
                    newSelected[vt.id] = Number(currentLkm) > 0;
                } else {
                    newSelected[vt.id] = false;
                }
            });
            hasChanges = true;
        } 
        // 2. Dynaaminen reagointi: Jos LKM muuttuu asiantuntijan tai automaation toimesta
        else if (currentLkm !== prevLkmRef.current) {
             vakiotekstit.forEach(vt => {
                 if (vt.title.includes('toteuttaminen ja seuranta')) {
                     const shouldBeOn = Number(currentLkm) > 0;
                     if (newSelected[vt.id] !== shouldBeOn) {
                         newSelected[vt.id] = shouldBeOn;
                         hasChanges = true;
                     }
                 }
             });
        }

        if (hasChanges) {
            const combined = vakiotekstit
                .filter(vt => newSelected[vt.id])
                .map(vt => vt.content_text)
                .join('\n\n');
            onUpdate({ ...selection, valitutVakiotekstit: newSelected, vakiotekstitYhdistetty: combined });
        }
        
        prevLkmRef.current = currentLkm;
    }, [selection?.muuttujat?.LKM, vakiotekstit, selection, onUpdate]);

    const handleToggle = (vtId, isChecked) => {
        const newSelected = { ...(selection?.valitutVakiotekstit || {}), [vtId]: isChecked };
        const combined = vakiotekstit
            .filter(vt => newSelected[vt.id])
            .map(vt => vt.content_text)
            .join('\n\n');
        onUpdate({ ...selection, valitutVakiotekstit: newSelected, vakiotekstitYhdistetty: combined });
    };

    return (
        <div className="thv-locked-text-container">
            <div className="thv-locked-text-header">
                <Lock size={16} /> Lakisääteiset vakiotekstit ja ehdot
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {vakiotekstit.map(vt => (
                    <div key={vt.id} className="checkbox-wrapper" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <input 
                            type="checkbox" 
                            id={`vt-${vt.id}`}
                            checked={!!selection?.valitutVakiotekstit?.[vt.id]}
                            onChange={(e) => handleToggle(vt.id, e.target.checked)}
                            className="modern-checkbox"
                            style={{ marginTop: '0.2rem' }}
                        />
                        <label htmlFor={`vt-${vt.id}`} className="modern-checkbox-label" style={{ margin: 0, fontWeight: '500' }}>
                            {vt.title}
                        </label>
                    </div>
                ))}
            </div>
            
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Esikatselu asiakirjaan tulostuvasta tekstistä:</strong>
            <div className="thv-locked-text-body" style={{ backgroundColor: '#fff', padding: '1rem', border: '1px solid #dee2e6', borderRadius: '6px', marginTop: '0.5rem' }}>
                {selection?.vakiotekstitYhdistetty || 'Ei valittuja vakiotekstejä.'}
            </div>
        </div>
    );
};


// --- 3. PÄÄKOMPONENTTI ---
const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const [phrases, setPhrases] = useState([]);
    const [alennusPhrases, setAlennusPhrases] = useState([]);
    const [variables, setVariables] = useState([]);
    const [rules, setRules] = useState([]);
    const [vakiotekstit, setVakiotekstit] = useState([]); // UUSI: Lista vakioteksteille
    
    const [loading, setLoading] = useState(true);
    const [alennusToolVisible, setAlennusToolVisible] = useState(false);
    const [showAllOptions, setShowAllOptions] = useState(false);

    const selection = state['tyonhakuvelvollisuus']; 

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [phrasesRes, alennusRes, varsRes, rulesRes, kbRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', '5db6c713-639a-4124-8236-7f72a6f9e32e').order('priority_score', { ascending: true }),
                    supabase.from('phrases').select('*').eq('grouping_key', 'alennusperustelu').order('short_title'),
                    supabase.from('variables').select('*'),
                    supabase.from('business_rules').select('*'),
                    // HAETAAN KAIKKI VAKIOTEKSTIT KATEGORIAN PERUSTEELLA
                    supabase.from('knowledge_base').select('*').eq('category', 'Vakiotekstit')
                ]);

                if (phrasesRes.data) setPhrases(phrasesRes.data);
                if (alennusRes.data) setAlennusPhrases(alennusRes.data);
                if (varsRes.data) setVariables(varsRes.data);
                if (rulesRes.data) setRules(rulesRes.data);
                
                if (kbRes.data) {
                    // Suodatetaan pois vanha pitkä "THV Lopputeksti" -möhkäle, jos se on yhä tietokannassa
                    const filteredVt = kbRes.data.filter(kb => kb.title !== 'THV Lopputeksti');
                    
                    // Järjestetään tekstit loogiseen järjestykseen
                    const order = ['Oikeudet ja velvollisuudet', 'Täydentävät- ja Työnhakukeskustelut', 'Työnhakuvelvollisuuden toteuttaminen ja seuranta (todennettava)'];
                    filteredVt.sort((a, b) => {
                        const indexA = order.indexOf(a.title);
                        const indexB = order.indexOf(b.title);
                        // Jos otsikkoa ei löydy order-listalta, laitetaan se loppuun
                        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
                    });
                    
                    setVakiotekstit(filteredVt);
                }

            } catch (error) {
                console.error("Virhe tiedonhaussa:", error);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

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
        } catch (e) {
            return false;
        }
    };

    const { displayPhrases } = useMemo(() => {
        if (loading) return { displayPhrases: [] };

        const visiblePhrases = [];

        for (const phrase of phrases) {
            const phraseRules = rules.filter(r => r.target_id === phrase.id);
            const phraseVars = variables.filter(v => v.phrase_id === phrase.id);
            
            const muuttujatObj = {};
            const isThisPhraseSelected = selection?.avainsana === phrase.phrase_key;

            phraseVars.forEach(v => { 
                const savedValue = isThisPhraseSelected && selection?.muuttujat ? selection.muuttujat[v.variable_key] : undefined;
                muuttujatObj[v.variable_key] = { 
                    oletus: v.default_value,
                    arvo: savedValue !== undefined ? savedValue : v.default_value,
                    value: savedValue !== undefined ? savedValue : v.default_value
                }; 
            });
            
            const enrichedPhrase = { 
                ...phrase, 
                avainsana: phrase.phrase_key, 
                lyhenne: phrase.short_title, 
                selite: phrase.base_text,
                otsikko: phrase.short_title, 
                teksti: phrase.base_text,    
                title: phrase.short_title,   
                content: phrase.base_text,   
                muuttujat: muuttujatObj 
            };

            const visibilityRules = phraseRules.filter(r => r.rule_type === 'visibility');
            const isVisible = visibilityRules.every(rule => evaluateRule(rule.condition_json, state));
            
            if (!isVisible) continue; 
            visiblePhrases.push(enrichedPhrase);
        }

        return { displayPhrases: visiblePhrases };
    }, [phrases, variables, rules, state, selection, loading]);

    const primaryPhrase = useMemo(() => {
        if (displayPhrases.length === 0) return null;
        const selected = displayPhrases.find(p => p.phrase_key === selection?.avainsana);
        return selected || displayPhrases[0];
    }, [displayPhrases, selection]);

    const phrasesToRender = showAllOptions ? displayPhrases : (primaryPhrase ? [primaryPhrase] : []);

    const handleVariableUpdate = (sectionId, phraseKeyword, variableName, newValue) => {
        onUpdateVariable(sectionId, phraseKeyword, variableName, newValue);
        
        const phrase = displayPhrases.find(p => p.phrase_key === phraseKeyword);
        if (phrase && variableName === 'LKM') {
            const defaultValue = phrase.muuttujat?.LKM?.oletus;
            if (defaultValue !== undefined && Number(newValue) < Number(defaultValue)) {
                setAlennusToolVisible(true);
            }
        }
    };

    if (loading) return <div className="section-container"><p>Ladataan työnhakuvelvollisuuden aivoja...</p></div>;

    const dummySection = { id: 'tyonhakuvelvollisuus', otsikko: 'Työnhakuvelvollisuus' };

    return (
        <section className="section-container" style={{ position: 'relative' }}>
            <h2 className="section-title thv-section-title">
                <FileText size={22} color="var(--color-primary)" /> Työnhakuvelvollisuus
            </h2>
            
            {/* ÄLYKÄS RATKAISUKESKUS */}
            <THVSmartAnalysisBox state={state} actions={actions} />
            
            {/* VAIHTOEHTOJEN LISTAUS */}
            <div className="options-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {phrasesToRender.map(phrase => (
                    <PhraseOption 
                        key={phrase.id}
                        phrase={phrase} 
                        section={dummySection} 
                        isSelected={selection?.avainsana === phrase.phrase_key} 
                        onSelect={onSelect} 
                        onUpdateVariable={handleVariableUpdate} 
                    />
                ))}
            </div>

            {/* NÄYTÄ LISÄÄ -NAPPI */}
            {displayPhrases.length > 1 && (
                <div className="thv-show-more-container">
                    <button 
                        onClick={() => setShowAllOptions(!showAllOptions)} 
                        className="btn btn--secondary thv-show-more-btn"
                    >
                        {showAllOptions ? <><ChevronUp size={16} /> Piilota ylimääräiset vaihtoehdot</> : <><ChevronDown size={16} /> Näytä muut vaihtoehdot ({displayPhrases.length - 1} kpl)</>}
                    </button>
                </div>
            )}
            
            {/* ALENNUSTYÖKALUN AVAUSNAPPI */}
            {selection && (
                 <div className="alennus-nappi-container">
                    <button 
                        onClick={() => setAlennusToolVisible(!alennusToolVisible)}
                        className="btn btn--secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {alennusToolVisible ? <ChevronUp size={16}/> : <AlertCircle size={16}/>}
                        {alennusToolVisible ? 'Piilota alennusperustelut' : 'Alenna velvollisuutta / Kirjaa perustelut lakia varten'}
                    </button>
                 </div>
            )}
            
            {/* ITSE ALENNUSTYÖKALU */}
            {alennusToolVisible && selection && (
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

            {/* LISÄTIEDOT */}
            <div className="custom-text-container">
                <label htmlFor={`custom-text-tyonhakuvelvollisuus`} className="custom-text-label">Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-tyonhakuvelvollisuus`} 
                    className="form-input"
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-tyonhakuvelvollisuus`] || ''} 
                    onChange={(e) => onUpdateCustomText('tyonhakuvelvollisuus', e.target.value)} 
                />
            </div>

            {/* UUSI: LAKISÄÄTEISTEN VAKIOTEKSTIEN HALLINTA */}
            {vakiotekstit.length > 0 && (
                <VakiotekstiTyokalu 
                    vakiotekstit={vakiotekstit}
                    selection={selection}
                    onUpdate={(updatedSelection) => {
                        onSelect('tyonhakuvelvollisuus', updatedSelection.avainsana, false, updatedSelection);
                    }}
                />
            )}
        </section>
    );
};

export default Tyonhakuvelvollisuus;