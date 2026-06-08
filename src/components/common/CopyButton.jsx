// --- src/components/common/CopyButton.jsx ---
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CopyButton = ({ 
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

export default CopyButton;