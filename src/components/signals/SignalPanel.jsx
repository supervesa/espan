import React, { useMemo, useState, createContext, useEffect, useCallback } from 'react';
import { Activity, X, Eye, EyeOff, Bell, BellOff, Info, Sparkles, Copy, Check } from 'lucide-react';
import { useSignal } from './useSignal';
import { supabase } from '../../utils/supabaseClient';
import './SignalPanel.css';

// Huomaa: Ei enää propseja! 
const SignalPanel = () => {
    // Haetaan KAIKKI tarvittava suoraan uudesta globaalista rajapinnasta
    const { dictionary, getSignalInfo, activeSignals, actions, loading } = useSignal();
    const [copiedKey, setCopiedKey] = useState(null);

    const groupedActive = useMemo(() => {
        const groups = {};
        Object.keys(activeSignals || {}).forEach(key => {
            const info = getSignalInfo(key);
            if (!groups[info.cat]) groups[info.cat] = [];
            groups[info.cat].push({ key, ...info, settings: activeSignals[key] });
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [activeSignals, getSignalInfo]);

    const handleAdd = (e) => {
        const val = e.target.value;
        if (val && actions.onAddSignal) {
            actions.onAddSignal(val);
        }
        e.target.value = "";
    };

    const handleCopy = (item) => {
        // Rakennetaan leikepöydälle kopioitava tekstikokonaisuus polkujen kera
        let copyText = `ID/KEY: ${item.key}\n`;
        copyText += `KATEGORIA: ${item.cat}`;
        
        // Jos fraasiin liittyy muuttujia tietokannassa, lisätään ne listaan state-polun kanssa
        if (item.variables && item.variables.length > 0) {
            copyText += `\nMUUTTUJAT:`;
            item.variables.forEach(v => {
                copyText += `\n  - ${v.variable_key} (${v.input_type})`;
                if (v.default_value) copyText += ` | Oletus: ${v.default_value}`;
                if (v.options) {
                    const opts = typeof v.options === 'string' ? v.options : JSON.stringify(v.options);
                    copyText += ` | Optiot: ${opts}`;
                }
                // Automaattiset state-polut koodauksen tueksi (rehellinen salapoliisi -malli)
                copyText += `\n    -> Polku (lomake): state["${item.cat}"]?.${v.variable_key}`;
                copyText += `\n    -> Polku (tausta): state.asiakas?.${v.variable_key}`;
            });
        }

        navigator.clipboard.writeText(copyText);
        setCopiedKey(item.key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Pieni lisäys: Näytetään latausviesti, jos Context hakee vielä tietoja Supabasesta
    if (loading) {
        return (
            <div className="sig-panel">
                <div className="sig-header">
                    <div className="sig-title"><Activity size={14} /> <span>TILANNEKUVA</span></div>
                </div>
                <div className="sig-body" style={{ padding: '10px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                    Ladataan signaalisanastoa...
                </div>
            </div>
        );
    }

    return (
        <div className="sig-panel">
            <div className="sig-header">
                <div className="sig-title"><Activity size={14} /> <span>TILANNEKUVA</span></div>
                <select 
                    className="sig-select" 
                    onChange={handleAdd} 
                    defaultValue=""
                >
                    <option value="" disabled>+ Lisää...</option>
                    {Object.values(dictionary).sort((a, b) => a.title.localeCompare(b.title)).map(sec => (
                        <optgroup key={sec.title} label={sec.title}>
                            {sec.options.sort((a, b) => a.label.localeCompare(b.label)).map(opt => (
                                <option key={opt.key} value={opt.key} disabled={!!activeSignals[opt.key]}>
                                    {opt.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            <div className="sig-body">
                {groupedActive.length === 0 ? (
                    <div className="sig-empty">Ei aktiivisia havaintoja</div>
                ) : (
                    groupedActive.map(([cat, items]) => (
                        <div key={cat} className="sig-group">
                            <div className="sig-group-label">{cat}</div>
                            {items.map(item => (
                                <div key={item.key} className={`sig-item ${item.settings?.isMuted ? 'muted' : ''} ${item.isAi ? 'ai' : ''}`}>
                                    <div className="sig-item-left">
                                        {item.isAi && <Sparkles size={10} className="ai-icon" />}
                                        <span className="sig-name">{item.label}</span>
                                        {item.desc && <Info size={10} className="info-icon" title={item.desc} />}
                                    </div>
                                    <div className="sig-actions">
                                        <button 
                                            type="button"
                                            onClick={() => handleCopy(item)} 
                                            className="act"
                                            title="Kopioi signaalin ID, kategoria ja muuttujapolku"
                                        >
                                            {copiedKey === item.key ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => actions.onToggleSignalSetting(item.key, 'isPrintable')} 
                                            className={item.settings?.isPrintable ? 'act blue' : 'act'}
                                        >
                                            {item.settings?.isPrintable ? <Eye size={13} /> : <EyeOff size={13} />}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => actions.onToggleSignalSetting(item.key, 'isMuted')} 
                                            className={item.settings?.isMuted ? 'act orange' : 'act'}
                                        >
                                            {item.settings?.isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => actions.onRemoveSignal(item.key)} 
                                            className="act del"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SignalPanel;

// 1. Viedään Context (jotta useSignal.js löytää sen)
export const SignalContext = createContext(null);

const normalize = (str) => {
    if (!str) return '';
    const s = str.trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

// 2. Viedään Provider (jotta App.js löytää sen)
export const SignalProvider = ({ children, activeSignals = {}, actions = {} }) => {
    const [dbData, setDbData] = useState({ signals: [], phrases: [], sections: [], variables: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // Neljäs haku: variables-taulu. Huom. phrases-hakuun lisätty 'id', jotta yhdistys toimii.
                const [sig, phr, sec, vars] = await Promise.all([
                    supabase.from('system_signals').select('*'),
                    supabase.from('phrases').select('id, phrase_key, short_title, section_id'),
                    supabase.from('sections').select('id, title'),
                    supabase.from('variables').select('*')
                ]);
                setDbData({ 
                    signals: sig.data || [], 
                    phrases: phr.data || [], 
                    sections: sec.data || [],
                    variables: vars.data || []
                });
            } catch (err) {
                console.error("Virhe globaalissa signaalidatan haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const dictionary = useMemo(() => {
        const dict = {};
        const sectionMap = {};
        dbData.sections.forEach(s => { sectionMap[s.id] = s.title; });

        // Ryhmitellään muuttujat valmiiksi phrase_id:n perusteella
        const varsByPhraseId = {};
        dbData.variables.forEach(v => {
            if (!varsByPhraseId[v.phrase_id]) {
                varsByPhraseId[v.phrase_id] = [];
            }
            varsByPhraseId[v.phrase_id].push(v);
        });

        dbData.signals.forEach(s => {
            const cat = s.category || 'Muut';
            if (!dict[cat]) dict[cat] = { title: normalize(cat), options: [] };
            dict[cat].options.push({ key: s.signal_key, label: normalize(s.label), desc: s.description, variables: [] });
        });

        dbData.phrases.forEach(p => {
            const catName = sectionMap[p.section_id] || 'Lomakevalinnat';
            if (!dict[catName]) dict[catName] = { title: normalize(catName), options: [] };
            
            if (!dict[catName].options.find(o => o.key === p.phrase_key)) {
                // Lisätään fraasiin suoraan siihen kuuluvat muuttujat
                dict[catName].options.push({ 
                    key: p.phrase_key, 
                    label: normalize(p.short_title || p.phrase_key), 
                    desc: null,
                    variables: varsByPhraseId[p.id] || []
                });
            }
        });
        return dict;
    }, [dbData]);

    const getSignalInfo = useCallback((key) => {
        if (key.startsWith('AI_')) {
            const parts = key.split('_');
            return { label: normalize(parts[parts.length - 1]), cat: 'Tekoäly', isAi: true, variables: [] };
        }
        for (const cat in dictionary) {
            const found = dictionary[cat].options.find(o => o.key === key);
            if (found) return { ...found, cat: dictionary[cat].title };
        }
        return { label: normalize(key.replace(/_/g, ' ')), cat: 'Muut', isAi: false, variables: [] };
    }, [dictionary]);

    const value = useMemo(() => ({
        dictionary,
        getSignalInfo,
        activeSignals, 
        actions,       
        loading
    }), [dictionary, getSignalInfo, activeSignals, actions, loading]);

    return (
        <SignalContext.Provider value={value}>
            {children}
        </SignalContext.Provider>
    );
};