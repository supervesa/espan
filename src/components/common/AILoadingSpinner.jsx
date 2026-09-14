import React from 'react';
import { Loader2 } from 'lucide-react';

const AILoadingSpinner = ({ text = "Tekoäly etsii tietoja..." }) => {
    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            padding: '1rem', 
            color: 'var(--color-primary)',
            backgroundColor: 'rgba(0, 112, 244, 0.05)',
            borderRadius: '8px',
            border: '1px dashed var(--color-primary)'
        }}>
            {/* Pyörivä Loader-ikoni */}
            <Loader2 className="spinner" size={20} style={{ animation: 'spin 2s linear infinite' }} />
            
            <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{text}</span>
            
            {/* Varmistetaan, että pyörimisanimaatio on määritelty (jos ei tule globaalista CSS:stä) */}
            <style>{`
                @keyframes spin { 
                    100% { transform: rotate(360deg); } 
                }
            `}</style>
        </div>
    );
};

export default AILoadingSpinner;