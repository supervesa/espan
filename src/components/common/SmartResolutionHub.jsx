import React from 'react';
import { Zap, ChevronRight } from 'lucide-react';

const SmartResolutionHub = ({ 
    title = "Älykäs Ratkaisukeskus", 
    icon: Icon = Zap,
    signals = [], 
    emptySignalsText = "Ei vahvoja signaaleja.",
    strategies = [] 
}) => {
    return (
        <div className="smart-analysis-box">
            {/* Otsikko (Tumman sininen teema CSS:stäsi) */}
            <div className="smart-analysis-header">
                <Icon size={22} /> 
                {title}
            </div>
            
            <div className="smart-analysis-grid">
                {/* Vasen palsta: Havaitut signaalit */}
                <div className="smart-analysis-column">
                    <h4 className="smart-analysis-title">Havaitut signaalit</h4>
                    {signals.length > 0 ? (
                        <ul className="thv-resolution-signals" style={{ marginTop: '0.5rem' }}>
                            {signals.map((signal, idx) => (
                                <li key={idx} style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
                                    {signal.label || signal}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '0.5rem 0 0 0' }}>
                            {emptySignalsText}
                        </p>
                    )}
                </div>

                {/* Oikea palsta: Suositellut toimenpidepolut */}
                <div className="smart-analysis-column">
                    <h4 className="smart-analysis-title">Suositellut toimenpidepolut</h4>
                    
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: '1rem', 
                        marginTop: '0.75rem' 
                    }}>
                        {strategies.length > 0 ? (
                            strategies.map((strategy) => (
                                <div key={strategy.id} className="card-inner-sm" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    
                                    {/* Kortin otsikko ja ikoni */}
                                    <h5 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)', fontSize: '1rem' }}>
                                        <span style={{ color: 'var(--color-primary)', display: 'flex' }}>
                                            {strategy.icon}
                                        </span>
                                        {strategy.title}
                                    </h5>
                                    
                                    {/* Kortin toimenpidelista */}
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', flexGrow: 1 }}>
                                        {strategy.items.map(item => (
                                            <li key={item.id} style={{ marginBottom: '0.3rem' }}>
                                                {item.label}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Kortin toimintopainike */}
                                    <button 
                                        className="thv-action-button" 
                                        onClick={() => strategy.onAction()}
                                        style={{ justifyContent: 'center', marginTop: '0.5rem' }}
                                    >
                                        {strategy.actionLabel || `Valitse ${strategy.title}`}
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '0.5rem 0 0 0' }}>
                                Ei suositeltuja polkuja näillä signaaleilla.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartResolutionHub;