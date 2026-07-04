// --- src/components/common/CopyButton.jsx ---
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// --- UUSI VERSIO (Espan-teema + pyöreä variantti) ---
const CopyButton = ({ 
    textToCopy, 
    label = "Kopioi", 
    successLabel = "Kopioitu", 
    className = "",
    customStyle = {},
    variant = "default" // Vaihtoehdot: "default" tai "circle"
}) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation(); // Estää mahdollisen yläelementin klikkauksen
        
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(
            () => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000); // Palautuu normaaliksi 2s kuluttua
            },
            (err) => {
                console.error('Kopiointi epäonnistui:', err);
            }
        );
    };

    // 1. UUSI MODERN PYÖREÄ VERSIO
    if (variant === 'circle') {
        return (
            <button 
                type="button"
                onClick={handleCopy}
                className={`btn-copy-circle ${className}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    // Värit suoraan espan2.css muuttujista
                    background: isCopied ? 'var(--color-success)' : 'rgba(255, 107, 0, 0.1)',
                    color: isCopied ? '#fff' : 'var(--color-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    // Tämä tekee sen tyylikkään pyörähdyksen!
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isCopied ? 'rotate(360deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                    ...customStyle
                }}
                title={isCopied ? successLabel : label} // Saavutettavuus
            >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
            </button>
        );
    }

    // 2. PERINTEINEN VERSIO (Värikkäämpi Espan-teeman mukaisesti)
    return (
        <button 
            type="button"
            onClick={handleCopy}
            className={`btn-copy ${className}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                // Värikkäämpi oletustila (oranssihtava tausta) ja selkeä vihreä kopioidessa
                background: isCopied ? 'var(--color-success)' : 'rgba(255, 107, 0, 0.05)',
                border: `1px solid ${isCopied ? 'var(--color-success)' : 'rgba(255, 107, 0, 0.3)'}`,
                borderRadius: 'var(--border-radius)', // Teeman mukainen 6px pyöristys
                padding: '0.4rem 0.75rem',
                fontSize: 'var(--text-sm)', // fontit.css:n muuttuja
                color: isCopied ? '#fff' : 'var(--color-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: '600',
                ...customStyle
            }}
            title="Kopioi leikepöydälle"
        >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? successLabel : label}
        </button>
    );
};

export default CopyButton;

/* 
=========================================
VARMUUSKOPIO VANHASTA VERSIOSTA (Alkuperäinen)
=========================================

const CopyButton_OLD = ({ 
    textToCopy, 
    label = "Kopioi", 
    successLabel = "Kopioitu", 
    className = "",
    customStyle = {}
}) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation(); // Estää mahdollisen yläelementin (esim. otsikon) klikkauksen
        
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(
            () => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000); // Palautuu normaaliksi 2s kuluttua
            },
            (err) => {
                console.error('Kopiointi epäonnistui:', err);
            }
        );
    };

    return (
        <button 
            type="button"
            onClick={handleCopy}
            className={`btn-copy ${className}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: isCopied ? 'var(--color-success-light, #edfdf4)' : 'transparent',
                border: `1px solid ${isCopied ? 'var(--color-success)' : 'var(--color-border)'}`,
                borderRadius: '4px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                color: isCopied ? 'var(--color-success-dark, #166534)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: isCopied ? '600' : '500',
                ...customStyle
            }}
            title="Kopioi leikepöydälle"
        >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? successLabel : label}
        </button>
    );
};
*/