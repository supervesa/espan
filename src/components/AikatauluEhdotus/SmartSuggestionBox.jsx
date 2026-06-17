import React from 'react';
import { Sparkles, Info, Calendar } from 'lucide-react';

const SmartSuggestionBox = ({ suggestion, onApply }) => {
    if (!suggestion) return null;

    const getIcon = () => {
        switch (suggestion.priority) {
            case 1: return <Info size={16} />;
            case 2: return <Sparkles size={16} />;
            default: return <Calendar size={16} />;
        }
    };

    return (
        <div className="smart-analysis-box" style={{ 
            borderLeft: '4px solid var(--color-ai)', 
            background: 'var(--color-bg-ai)', 
            marginBottom: '1.5rem', 
            padding: '10px' 
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: 'var(--color-ai)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {getIcon()} Älykäs ehdotus
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: '4px 0' }}>{suggestion.rule?.title}</p>
                    <p style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                        <strong>Peruste:</strong> {suggestion.reason}
                    </p>
                    {suggestion.forcedMode && (
                        <p style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            Pakotettu tapa: {suggestion.forcedMode === 'kaynti' ? 'Käyntiasiointi' : 'Puhelu'}
                        </p>
                    )}
                </div>
                <button 
                    className="btn" 
                    onClick={() => onApply(suggestion.rule.id, suggestion.suggestedCount, suggestion.suggestedPeriod, suggestion.forcedMode)}
                >
                    Käytä
                </button>
            </div>
        </div>
    );
};

export default SmartSuggestionBox;