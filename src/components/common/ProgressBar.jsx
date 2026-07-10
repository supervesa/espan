// --- src/components/common/ProgressBar.jsx ---
import React from 'react';

const ProgressBar = ({ 
    value = 0, 
    target = 50, 
    label, 
    subLabel,
    className = '' 
}) => {
    const safePercent = Math.min(100, Math.max(0, value));
    const isTargetAchieved = safePercent >= target;
    
    // Sidotaan väri suoraan Espan2.css muuttujiin
    const barColor = isTargetAchieved 
        ? 'var(--color-success)' 
        : 'var(--color-primary)';

    return (
        <div className={`progress-bar-container ${className}`} style={{ width: '100%' }}>
            {/* Otsikkorivi */}
            {(label || subLabel) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    {label && <span className="fw-semibold text-md text-slate-700">{label}</span>}
                    {subLabel && <span className="font-mono text-sm text-secondary">{subLabel}</span>}
                </div>
            )}

            {/* Palkkiura */}
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                height: '16px', 
                backgroundColor: 'var(--color-border)', 
                borderRadius: '8px', 
                overflow: 'visible',
                marginTop: '4px'
            }}>
                {/* Tavoiteviivan indikaattori (pystyviiva ja teksti) */}
                <div style={{ 
                    position: 'absolute', 
                    left: `${target}%`, 
                    top: '-4px', 
                    bottom: '-4px', 
                    width: '2px', 
                    backgroundColor: 'var(--color-text-primary)', 
                    zIndex: 10 
                }} />
                
                <div className="text-uppercase fw-bold" style={{ 
                    position: 'absolute', 
                    left: `${target}%`, 
                    top: '-20px', 
                    transform: 'translateX(-50%)', 
                    fontSize: '0.65rem', 
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap'
                }}>
                    Tavoite {target}%
                </div>

                {/* Varsinainen täyttöpalkki */}
                <div style={{ 
                    width: `${safePercent}%`, 
                    height: '100%', 
                    backgroundColor: barColor, 
                    borderRadius: '8px',
                    transition: 'width 0.4s ease'
                }} />
            </div>
        </div>
    );
};

export default ProgressBar;