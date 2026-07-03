// --- src/components/common/MetricBox.jsx ---
import React from 'react';

const MetricBox = ({ title, icon: Icon, variant = 'default', children, headerAction }) => {
    // Sidotaan värit suoraan espan2.css muuttujiin
    const getStyles = () => {
        switch(variant) {
            case 'dashed':
                return { 
                    bg: 'var(--color-surface)', 
                    border: '1px dashed var(--color-border)', 
                    titleColor: 'var(--color-primary)' 
                };
            case 'highlight':
                return { 
                    bg: 'rgba(30, 154, 90, 0.05)', // Vastaa --color-success teemaa
                    border: '1px solid rgba(30, 154, 90, 0.2)', 
                    titleColor: 'var(--color-success)' 
                };
            default: // 'solid'
                return { 
                    bg: 'var(--color-background)', 
                    border: '1px solid var(--color-border)', 
                    titleColor: 'var(--color-text-primary)' 
                };
        }
    };

    const { bg, border, titleColor } = getStyles();

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: bg, 
            padding: '1.25rem', // Hieman enemmän ilmaa
            borderRadius: 'var(--border-radius)', 
            border: border,
            boxSizing: 'border-box',
            height: '100%' // Grid venyttää automaattisesti, mutta box-sizing pitää sisällön kurissa
        }}>
            {/* Otsikkorivi */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: titleColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={18} />}
                    {title}
                </div>
                {headerAction && <div>{headerAction}</div>}
            </div>
            
            {/* Sisältö - flexGrow työntää mahdollisen alareunan sisällön oikealle paikalleen */}
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                {children}
            </div>
        </div>
    );
};

export default MetricBox;