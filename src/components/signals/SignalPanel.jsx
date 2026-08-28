import React, { useMemo, useState } from 'react';
import { Activity, X, Eye, EyeOff, Bell, BellOff, Info, Sparkles, Copy, Check, Clock, Phone, Building, Video } from 'lucide-react';
import { useSignal } from './useSignal';
import './SignalPanel.css';

// Varmistetaan, että kestoTapa on otettu vastaan propseissa!
const SignalPanel = ({ kesto, kestoErotus, kestoTyyppi, kestoTapa, onClearKesto }) => {
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
        let copyText = `ID/KEY: ${item.key}\nKATEGORIA: ${item.cat}`;
        
        if (item.variables && item.variables.length > 0) {
            copyText += `\nMUUTTUJAT:`;
            item.variables.forEach(v => {
                copyText += `\n  - ${v.variable_key} (${v.input_type})`;
                if (v.default_value) copyText += ` | Oletus: ${v.default_value}`;
                if (v.options) {
                    const opts = typeof v.options === 'string' ? v.options : JSON.stringify(v.options);
                    copyText += ` | Optiot: ${opts}`;
                }
                copyText += `\n    -> Polku (lomake): state["${item.cat}"]?.${v.variable_key}`;
                copyText += `\n    -> Polku (tausta): state.asiakas?.${v.variable_key}`;
            });
        }

        navigator.clipboard.writeText(copyText);
        setCopiedKey(item.key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

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
                <select className="sig-select" onChange={handleAdd} defaultValue="">
                    <option value="" disabled>+ Lisää...</option>
                    {Object.values(dictionary).sort((a, b) => a.title.localeCompare(b.title)).map(sec => (
                        <optgroup key={sec.title} label={sec.title}>
                            {sec.options.sort((a, b) => a.label.localeCompare(b.label)).map(opt => (
                                <option key={opt.key} value={opt.key} disabled={!!activeSignals[opt.key]}>{opt.label}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            <div className="sig-body">
                
                {/* KELLON JA KESTON TILANNEKUVA */}
                {kesto && (
                    <div className="sig-group" style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed var(--color-border)' }}>
                        <div className="sig-group-label" style={{ color: 'var(--color-primary)' }}>TAPAAMISEN KESTO</div>
                        <div className="sig-item" style={{ backgroundColor: 'rgba(255, 107, 0, 0.05)', borderColor: 'var(--color-primary)', border: '1px solid rgba(255, 107, 0, 0.2)' }}>
                            <div className="sig-item-left" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                
                                {/* Dynaaminen Ikoni (Puhelu / Video / Lähikäynti) */}
                                {kestoTapa === 'Puhelu' ? <Phone size={12} className="text-primary"/> : 
                                (kestoTapa === 'Video' ? <Video size={12} className="text-primary"/> : 
                                <Building size={12} className="text-primary"/>)}
                                
                                <span className="sig-name" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    {kestoTyyppi ? `${kestoTyyppi} (${kestoTapa}): ` : ''}{kesto} min
                                </span>
                                
                                {kestoErotus !== undefined && kestoErotus !== null && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                                        (Erotus: {kestoErotus > 0 ? '+' : ''}{kestoErotus} min)
                                    </span>
                                )}
                            </div>
                            <div className="sig-actions">
                                <button type="button" onClick={onClearKesto} className="act del" title="Poista kesto">
                                    <X size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                                        <button type="button" onClick={() => handleCopy(item)} className="act"><Copy size={13} /></button>
                                        <button type="button" onClick={() => actions.onToggleSignalSetting(item.key, 'isPrintable')} className={item.settings?.isPrintable ? 'act blue' : 'act'}><Eye size={13} /></button>
                                        <button type="button" onClick={() => actions.onToggleSignalSetting(item.key, 'isMuted')} className={item.settings?.isMuted ? 'act orange' : 'act'}><Bell size={13} /></button>
                                        <button type="button" onClick={() => actions.onRemoveSignal(item.key)} className="act del"><X size={13} /></button>
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