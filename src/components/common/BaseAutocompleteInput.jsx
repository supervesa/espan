import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, Sparkles } from 'lucide-react';

const BaseAutocompleteInput = ({ 
    value, 
    onChange,         // Käyttäjä kirjoittaa (teksti)
    onSelect,         // Käyttäjä valitsee listalta (option-olio)
    onFocus,          // Kun kenttään klikataan
    onSaveNew,        // Kun klikataan "+ Tallenna uusi"
    options = [],     // Taulukko muotoa: [{ id, label, subLabel }, ...]
    placeholder, 
    isSaving, 
    showSaveNew,      // boolean: näytetäänkö "tallenna uusi" -rivi
    saveNewText,      // Mitä tallennusnapissa lukee
    emptyMessage,     // Mitä näytetään jos ei tuloksia (null jos ei haluta)
    autoSelected      // boolean: aktivoiko taika-efektin (esim automaattivalinta)
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Sulkee pudotusvalikon kun klikataan ulkopuolelle
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        onChange(e.target.value);
        setIsOpen(true);
    };

    const handleSelectOption = (opt) => {
        onSelect(opt);
        setIsOpen(false);
    };

    const handleFocus = () => {
        if (onFocus) onFocus();
        setIsOpen(true);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            {/* INPUT-KENTTÄ */}
            <div style={{ position: 'relative' }}>
                <input 
                    type="text" 
                    placeholder={placeholder} 
                    value={value || ''} 
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    style={{ 
                        width: '100%', 
                        padding: '0.4rem', 
                        paddingRight: autoSelected ? '2rem' : '0.4rem',
                        fontSize: '0.8rem', 
                        border: autoSelected ? '1px solid #3b82f6' : '1px solid #86efac', 
                        borderRadius: '4px', 
                        boxSizing: 'border-box',
                        backgroundColor: autoSelected ? '#eff6ff' : '#ffffff',
                        transition: 'all 0.3s ease'
                    }}
                />
                {autoSelected && (
                    <Sparkles 
                        size={14} 
                        color="#3b82f6" 
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }} 
                    />
                )}
            </div>
            
            {/* DROPDOWN VALIKKO */}
            {isOpen && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, 
                    backgroundColor: '#ffffff', border: '1px solid #cbd5e1', 
                    borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
                    maxHeight: '200px', overflowY: 'auto' 
                }}>
                    
                    {/* Tyhjä tila (Ei vaihtoehtoja) */}
                    {options.length === 0 && emptyMessage && (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                            {emptyMessage}
                        </div>
                    )}
                    
                    {/* Valmiit vaihtoehdot */}
                    {options.map((opt) => (
                        <div 
                            key={opt.id} 
                            onClick={() => handleSelectOption(opt)}
                            style={{ 
                                padding: '0.5rem 0.75rem', cursor: 'pointer', 
                                borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' 
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.8rem' }}>{opt.label}</span>
                            {opt.subLabel && (
                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{opt.subLabel}</span>
                            )}
                        </div>
                    ))}
                    
                    {/* Tallenna uusi -nappi */}
                    {showSaveNew && (
                        <div 
                            onClick={() => {
                                onSaveNew();
                                setIsOpen(false); // Suljetaan kun tallennus alkaa
                            }}
                            style={{ 
                                padding: '0.6rem 0.75rem', cursor: 'pointer', color: '#16a34a', 
                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem',
                                backgroundColor: '#f0fdf4'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce3'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                        >
                            {isSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                            {saveNewText || `Tallenna: ${value}`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BaseAutocompleteInput;