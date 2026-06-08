// --- src/components/common/AutocompleteSignalInput.jsx ---
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Plus, Loader2 } from 'lucide-react';

const AutocompleteSignalInput = ({ category, value, onChange, onSignalToggle, placeholder }) => {
    const [options, setOptions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const wrapperRef = useRef(null);

    // Haetaan tietokannasta tähän kategoriaan (esim. "Äidinkieli") kuuluvat signaalit
    useEffect(() => {
        const fetchOptions = async () => {
            const { data, error } = await supabase.from('system_signals').select('*').eq('category', category);
            if (data && !error) {
                setOptions(data);
                setFiltered(data);
            }
        };
        if (category) fetchOptions();
    }, [category]);

    // Sulkee pudotusvalikon kun klikataan ohi
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
        const val = e.target.value;
        onChange(val);
        setIsOpen(true);
        
        if (val.trim()) {
            const lowerVal = val.toLowerCase();
            const matches = options.filter(opt => 
                (opt.label && opt.label.toLowerCase().includes(lowerVal)) || 
                (opt.signal_key && opt.signal_key.toLowerCase().includes(lowerVal))
            );
            setFiltered(matches);
        } else {
            setFiltered(options);
        }
    };

    const handleSelect = (option) => {
        const cleanValue = option.label.trim();
        onChange(cleanValue);
        if (onSignalToggle) onSignalToggle(option.signal_key);
        setIsOpen(false);
    };

    const handleSaveNew = async () => {
        if (!value || !value.trim()) return;
        setIsSaving(true);
        
        const safeValue = value.trim();
        const newKey = safeValue.toLowerCase().replace(/\s+/g, '_');
        
        // KORJATTU: Jos kyseessä on äidinkieli, pakotetaan se kokonaan pieneksi suomen kielen sääntöjen mukaan
        const newLabel = category === 'Äidinkieli' ? safeValue.toLowerCase() : safeValue;
        
        const newSignal = {
            signal_key: newKey,
            label: newLabel,
            category: category,
            description: `Asiakkaan ${category.toLowerCase()} on ${safeValue.toLowerCase()}`
        };

        const { error } = await supabase.from('system_signals').insert([newSignal]);
        
        if (!error) {
            setOptions(prev => [...prev, newSignal]);
            onChange(newLabel);
            if (onSignalToggle) onSignalToggle(newKey);
            setIsOpen(false);
        } else {
            console.error("Virhe tallennettaessa uutta signaalia:", error);
            alert("Tietokantavirhe uuden sanan tallennuksessa.");
        }
        setIsSaving(false);
    };

    const exactMatchFound = options.some(opt => 
        opt.label?.toLowerCase() === value?.trim().toLowerCase() || 
        opt.signal_key?.toLowerCase() === value?.trim().toLowerCase()
    );

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <input 
                type="text" 
                className="input-field" 
                placeholder={placeholder} 
                value={value || ''} 
                onChange={handleInputChange}
                onFocus={() => { setFiltered(options); setIsOpen(true); }}
            />
            
            {isOpen && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, 
                    background: 'var(--color-background)', border: '1px solid var(--color-border)', 
                    borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
                    maxHeight: '200px', overflowY: 'auto' 
                }}>
                    {filtered.map(opt => (
                        <div 
                            key={opt.signal_key} 
                            onClick={() => handleSelect(opt)}
                            style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {opt.label}
                        </div>
                    ))}
                    
                    {!exactMatchFound && value && value.trim().length > 1 && (
                        <div 
                            onClick={handleSaveNew}
                            style={{ 
                                padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--color-primary)', 
                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500',
                                backgroundColor: 'var(--color-bg-secondary)'
                            }}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Tallenna uusi "{value.trim().toLowerCase()}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AutocompleteSignalInput;