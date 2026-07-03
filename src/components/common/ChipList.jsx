// --- src/components/common/ChipList.jsx ---
import React from 'react';
import { X } from 'lucide-react';

// --- UUSI VERSIO (Espan-teemaan sidottu) ---
const ChipList = ({ items, onRemove, placeholder = "Ei valittuja" }) => {
    if (!items || items.length === 0) {
        // Käytetään fontit.css:n apuluokkia
        return <p className="text-sm text-secondary font-italic" style={{ margin: 0 }}>{placeholder}</p>;
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {items.map((item, idx) => (
                // Käytetään espan2.css:n valmista .chip -luokkaa!
                <div key={item.id || idx} className="chip">
                    <span>{item.nimi || item.label}</span>
                    <button 
                        onClick={(e) => { e.preventDefault(); onRemove(item); }} 
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'inherit', display: 'flex', alignItems: 'center',
                            padding: '0'
                        }}
                        title="Poista"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ChipList;

/* 
=========================================
VARMUUSKOPIO VANHASTA VERSIOSTA (Alkuperäinen)
=========================================

const ChipList_OLD = ({ items, onRemove, placeholder = "Ei valittuja" }) => {
    if (!items || items.length === 0) {
        return <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{placeholder}</p>;
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {items.map((item, idx) => (
                <div 
                    key={item.id || idx} 
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary-dark)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        border: '1px solid var(--color-primary)'
                    }}
                >
                    <span>{item.nimi || item.label}</span>
                    <button 
                        onClick={(e) => { e.preventDefault(); onRemove(item); }} 
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'inherit', display: 'flex', alignItems: 'center',
                            padding: '0', marginLeft: '0.25rem'
                        }}
                        title="Poista"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
};
*/