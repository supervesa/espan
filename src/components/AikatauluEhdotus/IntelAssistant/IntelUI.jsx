// src/components/AikatauluEhdotus/IntelAssistant/IntelUI.jsx

import React from 'react';
import { Calendar, MapPin, Clock, Zap, Info, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

const ICON_MAP = {
    Info, Sparkles, Calendar, Zap, AlertTriangle, CheckCircle2, ShieldAlert
};

const IntelUI = ({ suggestion, onApply, basket, analysis }) => {
    
    if (!suggestion) return null;

    const hasBasket = basket.length > 0;
    const isCompromise = hasBasket && analysis?.isCompromise;

    const getHeaderIcon = () => {
        if (hasBasket) return <Zap size={18} className={isCompromise ? 'text-warning' : 'text-ai'} />;
        switch (suggestion.priority) {
            case 1: return <Info size={16} />;
            case 2: return <Sparkles size={16} />;
            default: return <Calendar size={16} />;
        }
    };

    const formattedDate = suggestion.targetDate instanceof Date 
        ? suggestion.targetDate.toLocaleDateString('fi-FI')
        : (suggestion.targetDate ? new Date(suggestion.targetDate).toLocaleDateString('fi-FI') : null);

    return (
        <div className="smart-analysis-box" style={{ 
            margin: '0 0 1.5rem 0', 
            borderLeft: isCompromise ? '4px solid #f59e0b' : '4px solid var(--color-ai)',
            backgroundColor: isCompromise ? '#fffbeb' : 'var(--color-bg-ai)',
            padding: '12px'
        }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: isCompromise ? '#b45309' : 'var(--color-ai)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        {getHeaderIcon()} 
                        {hasBasket ? 'Intel Assistant - Päätöspuu' : 'Älykäs ehdotus'}
                    </div>
                    
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: '4px 0', color: '#0f172a' }}>
                        {suggestion.rule?.title}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                        <strong>Peruste:</strong> {suggestion.reason}
                    </p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                        {formattedDate && (
                            <span style={{ fontSize: '0.7rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> Kohdeviikko: {formattedDate}
                            </span>
                        )}
                       {/* 🟢 Nyt näytetään lokaatio vain, jos se on aidosti pakotettu tai asiakkaan lokaatio tiedetään! */}
                    {suggestion.forcedMode === 'kaynti' && suggestion.toimipiste && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '4px', fontWeight: 'bold' }}>
                            <MapPin size={12} style={{ display: 'inline', marginRight: '4px', position: 'relative', top: '2px' }}/>
                            Ihannesijainti: {suggestion.toimipiste}
                        </p>
                    )}

                    {suggestion.forcedMode && (
                        <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            Pakotettu tapa: {suggestion.forcedMode === 'kaynti' ? 'Käynti' : 'Puhelu'}
                        </p>
                    )}
                        {suggestion.forcedMode && (
                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>
                                Pakotettu: {suggestion.forcedMode === 'kaynti' ? 'Käynti' : 'Puhelu'}
                            </span>
                        )}
                    </div>
                </div>

                {!hasBasket && onApply && (
                    <button 
                        className="btn" 
                        onClick={() => onApply(suggestion.rule.id, suggestion.suggestedCount, suggestion.suggestedPeriod, suggestion.forcedMode, suggestion.targetDate)}
                    >
                        Käytä
                    </button>
                )}
            </div>

            {hasBasket && analysis && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>
                            {analysis.kestoSelite}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                            <Clock size={14} style={{ display: 'inline', marginRight: '4px', position: 'relative', top: '2px' }} />
                            Aika: {analysis.expectedDuration} min
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '10px' }}>
                        {analysis.logs.map((log, i) => {
                            const LogIcon = ICON_MAP[log.iconName] || Info;
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem',
                                    color: log.type === 'danger' ? '#dc2626' : (log.type === 'warning' ? '#d97706' : '#334155'),
                                    fontWeight: log.type === 'danger' || log.type === 'warning' ? 'bold' : 'normal'
                                }}>
                                    <div style={{ marginTop: '2px', opacity: 0.8 }}><LogIcon size={14} /></div>
                                    <span style={{ lineHeight: 1.4 }}>{log.msg}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntelUI;