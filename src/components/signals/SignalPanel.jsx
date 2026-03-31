// --- src/components/signals/SignalPanel.jsx ---

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient'; // LISÄTTY SUPABASE
import { Activity, Plus, X, Eye, EyeOff, Bell, BellOff, Info } from 'lucide-react';

const SignalPanel = ({ activeSignals = {}, dbPlanData, actions }) => {
    
    // UUSI: Tila järjestelmän dynaamisille signaaleille
    const [systemSignals, setSystemSignals] = useState([]);

    // Haetaan dynaamiset signaalit tietokannasta, kun komponentti ladataan
    useEffect(() => {
        const fetchSystemSignals = async () => {
            try {
                const { data, error } = await supabase.from('system_signals').select('*');
                if (!error && data) {
                    setSystemSignals(data);
                }
            } catch (err) {
                console.error("Virhe system_signals haussa:", err);
            }
        };
        fetchSystemSignals();
    }, []);

    // 1. Rakennetaan ja YHDISTETÄÄN sanakirja (Vanha dbPlanData + Uusi systemSignals)
    const combinedDictionary = useMemo(() => {
        // A. Alustetaan vanhalla datalla
        let dict = [];
        if (dbPlanData && dbPlanData.aihealueet) {
            dict = dbPlanData.aihealueet.map(section => ({
                category: section.otsikko,
                options: (section.fraasit || []).map(phrase => ({
                    key: phrase.avainsana,
                    label: phrase.lyhenne || phrase.teksti.substring(0, 30) + '...',
                    description: null // Vanhalla datalla ei välttämättä ole erillistä selitettä
                }))
            })).filter(section => section.options.length > 0);
        }

        // B. Yhdistetään uudet dynaamiset signaalit listaan
        if (systemSignals.length > 0) {
            // Ryhmitellään uudet signaalit kategorioittain
            const sysCategories = {};
            systemSignals.forEach(sig => {
                if (!sysCategories[sig.category]) {
                    sysCategories[sig.category] = { category: sig.category, options: [] };
                }
                sysCategories[sig.category].options.push({
                    key: sig.signal_key,
                    label: sig.label,
                    description: sig.description
                });
            });

            // Sulautetaan ryhmät perussanakirjaan
            Object.values(sysCategories).forEach(sysCat => {
                const existingCat = dict.find(c => c.category === sysCat.category);
                if (existingCat) {
                    // Kategoria löytyy jo (esim. "Koulutus"), lisätään uudet avaimet sen alle
                    sysCat.options.forEach(opt => {
                        if (!existingCat.options.find(o => o.key === opt.key)) {
                            existingCat.options.push(opt);
                        }
                    });
                } else {
                    // Täysin uusi kategoria, lisätään listan hännille
                    dict.push(sysCat);
                }
            });
        }

        return dict;
    }, [dbPlanData, systemSignals]);

    // 2. Käsittelijä uuden signaalin valinnalle (pudotusvalikosta)
    const handleAddSignal = (e) => {
        const selectedKey = e.target.value;
        if (selectedKey && actions.onAddSignal) {
            actions.onAddSignal(selectedKey);
        }
        e.target.value = "";
    };

    // 3. Hae signaalin tiedot (Nimi ja Ohje)
    const getSignalInfo = (signalKey) => {
        for (const section of combinedDictionary) {
            const found = section.options.find(opt => opt.key === signalKey);
            if (found) return { label: found.label, description: found.description };
        }
        // Fallback jos ei löydy kummastakaan
        return { label: signalKey.replace(/_/g, ' '), description: null };
    };

    const activeSignalKeys = Object.keys(activeSignals);

    return (
        <div className="smart-analysis-box signal-panel-container">
            
            <div className="smart-analysis-header signal-panel-header">
                <Activity size={20} />
                <span className="signal-panel-title">Asiakkaan tilannekuva</span>
            </div>
            
            <p className="signal-panel-description">
                Tähän kerätään asiakkaan ydintiedot. Signaalit ohjaavat järjestelmän automaatiota ja sääntömoottoria.
            </p>

            {/* MANUAALINEN LISÄYSTYÖKALU */}
            <div className="signal-select-wrapper">
                <div className="signal-select-inner">
                    <select 
                        className="input-field signal-select-input" 
                        onChange={handleAddSignal}
                        defaultValue=""
                    >
                        <option value="" disabled>+ Lisää uusi havainto / signaali...</option>
                        {combinedDictionary.map(section => (
                            <optgroup key={section.category} label={section.category}>
                                {section.options.map(opt => (
                                    <option 
                                        key={opt.key} 
                                        value={opt.key}
                                        disabled={activeSignals[opt.key]} 
                                    >
                                        {opt.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <Plus size={16} color="var(--color-primary)" className="signal-select-icon" />
                </div>
            </div>

            {/* AKTIIVISTEN SIGNAALIEN LISTA */}
            {activeSignalKeys.length === 0 ? (
                <div className="signal-empty-state">
                    Ei aktiivisia signaaleja. Tee valintoja lomakkeella tai lisää havainto yltä.
                </div>
            ) : (
                <div className="signal-list-container">
                    {activeSignalKeys.map(key => {
                        const signalData = activeSignals[key];
                        const isMuted = signalData?.isMuted || false;
                        const isPrintable = signalData?.isPrintable || false;
                        
                        // Haetaan nimi ja mahdollinen ohjeteksti
                        const { label, description } = getSignalInfo(key);

                        return (
                            <div 
                                key={key} 
                                className={`signal-item ${isMuted ? 'signal-item--muted' : ''}`}
                            >
                                <span 
                                    className={`signal-item-label ${isMuted ? 'signal-item-label--muted' : ''}`}
                                    title={description || label} // Näytetään tooltip, kun hiiri on päällä
                                >
                                    {label}
                                    {description && <Info size={12} style={{ marginLeft: '4px', opacity: 0.6, display: 'inline' }} />}
                                </span>
                                
                                <div className="signal-actions">
                                    
                                    {/* Tulostuksen hallinta (Silmä) */}
                                    <button 
                                        type="button"
                                        onClick={() => actions.onToggleSignalSetting(key, 'isPrintable')}
                                        title={isPrintable ? "Tulostuu asiakirjaan" : "Vain sisäinen merkintä"}
                                        className={`signal-action-btn ${isPrintable ? 'signal-action-btn--printable' : 'signal-action-btn--hidden'}`}
                                    >
                                        {isPrintable ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    {/* Sääntömoottorin hiljennys (Kello) */}
                                    <button 
                                        type="button"
                                        onClick={() => actions.onToggleSignalSetting(key, 'isMuted')}
                                        title={isMuted ? "Hiljennetty (Ei vaikuta sääntöihin)" : "Aktiivinen sääntömoottorissa"}
                                        className={`signal-action-btn ${isMuted ? 'signal-action-btn--muted' : 'signal-action-btn--active'}`}
                                    >
                                        {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
                                    </button>

                                    {/* Poisto (X) */}
                                    <button 
                                        type="button"
                                        onClick={() => actions.onRemoveSignal(key)}
                                        title="Poista signaali"
                                        className="signal-action-btn signal-action-btn--delete"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SignalPanel;