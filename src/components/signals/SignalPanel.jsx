import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Activity, Plus, X, Eye, EyeOff, Bell, BellOff, Info, Sparkles } from 'lucide-react';

const SignalPanel = ({ activeSignals = {}, actions }) => {
    // dbPlanData on poistettu propseista, emme tarvitse sitä enää!
    
    const [systemSignals, setSystemSignals] = useState([]);
    const [allPhrases, setAllPhrases] = useState([]);

    // Haetaan MOLEMMAT tietokantataulut kerralla!
    useEffect(() => {
        const fetchDictionaries = async () => {
            try {
                const [sigRes, phraseRes] = await Promise.all([
                    supabase.from('system_signals').select('*'),
                    supabase.from('phrases').select('phrase_key, short_title, section_id')
                ]);
                
                if (sigRes.data) setSystemSignals(sigRes.data);
                if (phraseRes.data) setAllPhrases(phraseRes.data);
            } catch (err) {
                console.error("Virhe sanakirjojen haussa:", err);
            }
        };
        fetchDictionaries();
    }, []);

    // Yhdistetään kannan tiedot yhdeksi isoksi, fiksuksi pudotusvalikoksi
    const combinedDictionary = useMemo(() => {
        const dict = {};

        // 1. LISÄTÄÄN JÄRJESTELMÄN SIGNAALIT
        systemSignals.forEach(sig => {
            const cat = sig.category || 'Muut signaalit';
            if (!dict[cat]) dict[cat] = { category: cat, options: [] };
            
            dict[cat].options.push({
                key: sig.signal_key,
                label: sig.label,
                description: sig.description
            });
        });

        // 2. LISÄTÄÄN VAKIOLAUSEET (Jotta nekin näkyvät nätisti, jos imuri on ne lisännyt)
        allPhrases.forEach(phrase => {
            // Emme tiedä suoraan mihin "kategoriaan" (välilehteen) phrase kuuluu ilman joinia, 
            // joten käytetään selkeää yhteiskategoriaa, ellemme tiedä tarkasti.
            const cat = 'Lomakkeen valinnat'; 
            if (!dict[cat]) dict[cat] = { category: cat, options: [] };
            
            // Estetään tuplat, jos sama id on jo olemassa system_signals -puolella
            if (!dict[cat].options.find(o => o.key === phrase.phrase_key)) {
                dict[cat].options.push({
                    key: phrase.phrase_key,
                    label: phrase.short_title || phrase.phrase_key,
                    description: null
                });
            }
        });

        return Object.values(dict).filter(section => section.options.length > 0);
    }, [systemSignals, allPhrases]);

    const handleAddSignal = (e) => {
        const selectedKey = e.target.value;
        if (selectedKey && actions.onAddSignal) {
            actions.onAddSignal(selectedKey);
        }
        e.target.value = "";
    };

    const getSignalInfo = (signalKey) => {
        if (!signalKey) return { label: 'Tuntematon', description: null, isAi: false };

        // 1. Erikoiskäsittely dynaamisille tekoäly-signaaleille
        if (signalKey.startsWith('AI_FINESCO_')) {
            return { 
                label: signalKey.replace('AI_FINESCO_', ''), 
                description: 'Tekoälyn tunnistama ammattiala',
                isAi: true 
            };
        }
        if (signalKey.startsWith('AI_ESCO_')) {
            return { 
                label: signalKey.replace('AI_ESCO_', ''), 
                description: 'Tekoälyn tunnistama tavoiteammatti',
                isAi: true
            };
        }

        // 2. Normaali haku yhdistetystä sanakirjasta (Signals + Phrases)
        for (const section of combinedDictionary) {
            const found = section.options.find(opt => opt.key === signalKey);
            if (found) return { label: found.label, description: found.description, isAi: false };
        }
        
        // 3. Hätävara (Fallback): Muutetaan alaviivat välilyönneiksi
        return { label: signalKey.replace(/_/g, ' '), description: null, isAi: false };
    };

    const activeSignalKeys = Object.keys(activeSignals || {});

    return (
        <div className="smart-analysis-box signal-panel-container">
            
            <div className="smart-analysis-header signal-panel-header">
                <Activity size={20} />
                <span className="signal-panel-title">Asiakkaan tilannekuva</span>
            </div>
            
            <p className="signal-panel-description">
                Tähän kerätään asiakkaan ydintiedot. Signaalit ohjaavat järjestelmän automaatiota ja sääntömoottoria.
            </p>

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

            {activeSignalKeys.length === 0 ? (
                <div className="signal-empty-state">
                    Ei aktiivisia signaaleja. Tee valintoja lomakkeella tai lisää havainto yltä.
                </div>
            ) : (
                <div className="signal-list-container">
                    {activeSignalKeys.map(key => {
                        const signalData = activeSignals[key];
                        // Varmistetaan että signalData on objekti
                        const isMuted = typeof signalData === 'object' ? signalData.isMuted : false;
                        const isPrintable = typeof signalData === 'object' ? signalData.isPrintable : false;
                        
                        const { label, description, isAi } = getSignalInfo(key);

                        return (
                            <div 
                                key={key} 
                                className={`signal-item ${isMuted ? 'signal-item--muted' : ''}`}
                                style={isAi ? { backgroundColor: 'var(--color-ai-bg)', borderColor: 'var(--color-ai-border)' } : {}}
                            >
                                <span 
                                    className={`signal-item-label ${isMuted ? 'signal-item-label--muted' : ''}`}
                                    title={description || label}
                                >
                                    {isAi && <Sparkles size={12} color="var(--color-ai)" style={{ marginRight: '6px', display: 'inline', verticalAlign: 'text-bottom' }} />}
                                    {label}
                                    {description && !isAi && <Info size={12} style={{ marginLeft: '4px', opacity: 0.6, display: 'inline' }} />}
                                </span>
                                
                                <div className="signal-actions">
                                    
                                    <button 
                                        type="button"
                                        onClick={() => actions.onToggleSignalSetting(key, 'isPrintable')}
                                        title={isPrintable ? "Tulostuu asiakirjaan" : "Vain sisäinen merkintä"}
                                        className={`signal-action-btn ${isPrintable ? 'signal-action-btn--printable' : 'signal-action-btn--hidden'}`}
                                    >
                                        {isPrintable ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => actions.onToggleSignalSetting(key, 'isMuted')}
                                        title={isMuted ? "Hiljennetty (Ei vaikuta sääntöihin)" : "Aktiivinen sääntömoottorissa"}
                                        className={`signal-action-btn ${isMuted ? 'signal-action-btn--muted' : 'signal-action-btn--active'}`}
                                    >
                                        {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
                                    </button>

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