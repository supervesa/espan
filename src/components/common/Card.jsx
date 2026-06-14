// --- src/components/common/Card.jsx ---
import React from 'react';

const Card = ({ children, title, icon: Icon, variant = 'default', className = '', headerAction }) => {
    
    // Määritellään varianttien tuomat lisäluokat ja tyylit
    let cardClass = 'card-base ';
    let dynamicStyle = {};

    switch (variant) {
        case 'bordered':
            // Paksulla vasemmalla reunalla varustettu korostuskortti
            cardClass += 'bg-surface border-left-heavy ';
            dynamicStyle = { borderLeft: '4px solid var(--color-text-secondary)', borderRadius: '0 var(--border-radius) var(--border-radius) 0' };
            break;
        case 'ai':
            // Tekoäly-teemainen kortti (vaalea liila)
            cardClass += 'bg-ai-light border-ai ';
            dynamicStyle = { backgroundColor: 'var(--color-ai-bg)', border: '1px solid var(--color-ai-border)' };
            break;
        case 'default':
        default:
            // Se kuuluisa gradientti-reunustettu peruskortti!
            cardClass += 'card-gradient-border ';
            dynamicStyle = {
                backgroundColor: 'var(--color-surface)',
                border: '1px solid transparent',
                backgroundImage: 'linear-gradient(var(--color-surface), var(--color-surface)), linear-gradient(to bottom right, var(--color-border), rgba(255,255,255,0.2), var(--color-border))',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                boxShadow: 'var(--shadow)'
            };
            break;
    }

    // Yhdistetään luokat
    const finalClassName = `${cardClass} ${className}`.trim();

    return (
        <div 
            className={finalClassName} 
            style={{ 
                padding: '1.5rem', 
                borderRadius: 'var(--border-radius)', 
                marginBottom: '1.5rem',
                position: 'relative',
                ...dynamicStyle 
            }}
        >
            {/* Kortin yläosa (Otsikko, ikoni ja mahdolliset napit) */}
            {(title || Icon || headerAction) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {Icon && <Icon size={20} className="text-primary" />}
                        {title && <h3 style={{ margin: 0 }} className="text-lg fw-semibold">{title}</h3>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            
            {/* Kortin sisältö */}
            <div className="card-content">
                {children}
            </div>
        </div>
    );
};

export default Card;