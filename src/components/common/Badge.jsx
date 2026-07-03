// --- src/components/common/Badge.jsx ---
import React from 'react';
import { X } from 'lucide-react';

const Badge = ({ children, variant = 'default', onDismiss, icon: Icon }) => {
    
    let badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '9999px',
        // KORJAUS: Nyt hyödynnetään suoraan fontit.css:n muuttujia!
        fontSize: 'var(--text-xs)', 
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        border: '1px solid transparent'
    };

    // Varianttien värit
    switch (variant) {
        case 'success':
            badgeStyle.backgroundColor = 'rgba(30, 154, 90, 0.1)';
            badgeStyle.color = 'var(--color-success)';
            badgeStyle.borderColor = 'rgba(30, 154, 90, 0.2)';
            break;
        case 'danger':
            badgeStyle.backgroundColor = 'rgba(227, 74, 74, 0.1)';
            badgeStyle.color = 'var(--color-danger)';
            badgeStyle.borderColor = 'rgba(227, 74, 74, 0.2)';
            break;
        case 'warning':
            badgeStyle.backgroundColor = 'rgba(255, 176, 32, 0.1)';
            badgeStyle.color = 'var(--color-warning)';
            badgeStyle.borderColor = 'rgba(255, 176, 32, 0.2)';
            break;
        case 'primary':
            badgeStyle.backgroundColor = 'rgba(255, 107, 0, 0.1)';
            badgeStyle.color = 'var(--color-primary)';
            badgeStyle.borderColor = 'rgba(255, 107, 0, 0.2)';
            break;
        case 'ai':
            badgeStyle.backgroundColor = 'var(--color-ai-bg)';
            badgeStyle.color = 'var(--color-ai)';
            badgeStyle.borderColor = 'var(--color-ai-border)';
            break;
        case 'default':
        default:
            badgeStyle.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            badgeStyle.color = 'var(--color-text-secondary)';
            badgeStyle.borderColor = 'var(--color-border)';
            break;
    }

    return (
        <span style={badgeStyle}>
            {Icon && <Icon size={12} />}
            {children}
            {onDismiss && (
                <button 
                    onClick={onDismiss}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        display: 'flex', 
                        cursor: 'pointer', 
                        color: 'inherit',
                        opacity: 0.7 
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                    onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
};

export default Badge;