// --- src/components/signals/SignalPanel.jsx ---

import React, { useMemo } from 'react';
import { Activity, Plus, X, Eye, EyeOff, Bell, BellOff } from 'lucide-react';

const SignalPanel = ({ activeSignals = {}, dbPlanData, actions }) => {
    
    // 1. Rakennetaan dynaaminen sanakirja lomakedatan pohjalta
    const signalDictionary = useMemo(() => {
        if (!dbPlanData || !dbPlanData.aihealueet) return [];
        
        return dbPlanData.aihealueet.map(section => {
            return {
                category: section.otsikko,
                options: (section.fraasit || []).map(phrase => ({
                    key: phrase.avainsana,
                    label: phrase.lyhenne || phrase.teksti.substring(0, 30) + '...'
                }))
            };
        }).filter(section => section.options.length > 0);
    }, [dbPlanData]);

    // 2. Käsittelijä uuden signaalin valinnalle (pudotusvalikosta)
    const handleAddSignal = (e) => {
        const selectedKey = e.target.value;
        if (selectedKey && actions.onAddSignal) {
            actions.onAddSignal(selectedKey);
        }
        // Palautetaan select takaisin oletusarvoon
        e.target.value = "";
    };

    // 3. Apufunktio signaalin ihmisluettavan nimen hakemiseen
    const getSignalLabel = (signalKey) => {
        for (const section of signalDictionary) {
            const found = section.options.find(opt => opt.key === signalKey);
            if (found) return found.label;
        }
        return signalKey; // Fallback, jos nimeä ei löydy
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
                        {signalDictionary.map(section => (
                            <optgroup key={section.category} label={section.category}>
                                {section.options.map(opt => (
                                    <option 
                                        key={opt.key} 
                                        value={opt.key}
                                        disabled={activeSignals[opt.key]} // Estetään jo valittujen lisääminen uudelleen
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

                        return (
                            <div 
                                key={key} 
                                className={`signal-item ${isMuted ? 'signal-item--muted' : ''}`}
                            >
                                <span className={`signal-item-label ${isMuted ? 'signal-item-label--muted' : ''}`}>
                                    {getSignalLabel(key)}
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