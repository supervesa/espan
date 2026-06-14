// --- src/components/common/Button.jsx ---
import React from 'react';

const Button = ({ 
    children, 
    onClick, 
    variant = 'primary', 
    size = 'md', 
    icon: Icon, 
    disabled = false, 
    className = '',
    type = 'button',
    fullWidth = false
}) => {
    
    // Perusluokat, jotka kaikilla napeilla on
    let baseStyles = {
        fontFamily: 'var(--font-sans)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        borderRadius: 'var(--border-radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        border: '1px solid transparent',
        width: fullWidth ? '100%' : 'auto',
    };

    // Variantti-kohtaiset tyylit (Korvaa vanhat .btn, .btn--secondary, .btn-ai jne.)
    let variantStyles = {};
    switch (variant) {
        case 'secondary':
            variantStyles = {
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border)',
            };
            if (!disabled) variantStyles.hover = { transform: 'translateY(-1px)', borderColor: 'var(--color-text-primary)' };
            break;
        case 'danger':
            variantStyles = {
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger)',
            };
            if (!disabled) variantStyles.hover = { backgroundColor: 'rgba(227,74,74,0.1)' };
            break;
        case 'ai':
            variantStyles = {
                backgroundColor: 'var(--color-ai)',
                color: 'white',
            };
            if (!disabled) variantStyles.hover = { backgroundColor: 'var(--color-ai-hover)', transform: 'translateY(-1px)' };
            break;
        case 'ghost':
            // Näkymätön tausta, sopii ikoninappeihin (korvaa .btn-icon)
            variantStyles = {
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                borderColor: 'transparent',
            };
            if (!disabled) variantStyles.hover = { color: 'var(--color-primary)', backgroundColor: 'var(--color-background)' };
            break;
        case 'primary':
        default:
            // Oletuksena brändin mukainen gradientti-nappi
            variantStyles = {
                background: 'linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))',
                color: 'white',
            };
            if (!disabled) variantStyles.hover = { transform: 'translateY(-2px)', opacity: 0.9 };
            break;
    }

    // Koko-kohtaiset tyylit
    let sizeStyles = {};
    switch (size) {
        case 'sm':
            sizeStyles = { padding: '0.4rem 0.8rem', fontSize: 'var(--text-xs)', fontWeight: 600 };
            break;
        case 'lg':
            sizeStyles = { padding: '1rem 2rem', fontSize: 'var(--text-base)', fontWeight: 700 };
            break;
        case 'md':
        default:
            sizeStyles = { padding: '0.6rem 1.2rem', fontSize: 'var(--text-sm)', fontWeight: 600 };
            break;
    }

    // Yhdistetään tyylit ja huomioidaan disabled-tila
    const finalStyle = {
        ...baseStyles,
        ...variantStyles,
        ...sizeStyles,
        ...(disabled && variant !== 'secondary' ? { opacity: 0.5, transform: 'none' } : {}),
        ...(disabled && variant === 'secondary' ? { backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--color-text-secondary)' } : {})
    };

    return (
        <button 
            type={type}
            onClick={disabled ? undefined : onClick}
            className={`espan-btn ${className}`}
            style={finalStyle}
            disabled={disabled}
            onMouseOver={(e) => !disabled && variantStyles.hover && Object.assign(e.currentTarget.style, variantStyles.hover)}
            onMouseOut={(e) => {
                if (!disabled && variantStyles.hover) {
                    // Palautetaan alkuperäiset tyylit kun hiiri poistuu
                    e.currentTarget.style.transform = baseStyles.transform || 'none';
                    e.currentTarget.style.opacity = baseStyles.opacity || 1;
                    e.currentTarget.style.backgroundColor = variantStyles.backgroundColor || 'transparent';
                    e.currentTarget.style.borderColor = variantStyles.borderColor || 'transparent';
                    e.currentTarget.style.color = variantStyles.color || 'inherit';
                }
            }}
        >
            {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
            {children}
        </button>
    );
};

export default Button;