import React, { useMemo } from 'react';
import { Activity, X, Eye, EyeOff, Bell, BellOff, Info, Sparkles } from 'lucide-react';
import { useSignal } from './useSignal'; // UUSI TUONTI
import './SignalPanel.css';

// Huomaa: Ei enää propseja! 
const SignalPanel = () => {
    // Haetaan KAIKKI tarvittava suoraan uudesta globaalista rajapinnasta
    const { dictionary, getSignalInfo, activeSignals, actions, loading } = useSignal();

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