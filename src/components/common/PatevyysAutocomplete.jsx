import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Plus, Loader2, Search } from 'lucide-react';

const PatevyysAutocomplete = ({ onSelect, placeholder = "Etsi pätevyyskorttia nimellä..." }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const wrapperRef = useRef(null);

    // Haetaan kaikki kerralla (tai voisi hakea vasta kirjoittaessa, mutta master on yleensä tarpeeksi pieni selaimen muistiin)
    useEffect(() => {
        const fetchOptions = async () => {
            const { data, error } = await supabase.from('patevyydet_master').select('*').order('nimi');
            if (data && !error) {
                setOptions(data);
                setFiltered(data);
            }
        };
        fetchOptions();
    }, []);

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
        setInputValue(val);
        setIsOpen(true);
        
        if (val.trim()) {
            const lowerVal = val.toLowerCase();
            const matches = options.filter(opt => opt.nimi.toLowerCase().includes(lowerVal));
            setFiltered(matches);
        } else {
            setFiltered(options);
        }
    };

    const handleOptionSelect = (option) => {
        onSelect(option);
        setInputValue(''); // Tyhjennetään kenttä valinnan jälkeen
        setIsOpen(false);
    };

    const handleSaveNew = async () => {
        if (!inputValue || !inputValue.trim()) return;
        setIsSaving(true);
        
        const uusiNimi = inputValue.trim();
        // Generoidaan uusi UUID (Supabase osaa myös tehdä automaattisesti jos taulun default on gen_random_uuid(), mutta varmuuden vuoksi lähetetään vain nimi)
        const newEntry = { nimi: uusiNimi, kategoria: 'Yleinen' };

        const { data, error } = await supabase.from('patevyydet_master').insert([newEntry]).select().single();
        
        if (!error && data) {
            setOptions(prev => [...prev, data]);
            handleOptionSelect(data);
        } else {
            console.error("Virhe tallennettaessa uutta pätevyyttä:", error);
            alert("Tietokantavirhe uuden kortin tallennuksessa.");
        }
        setIsSaving(false);
    };

    const exactMatchFound = options.some(opt => opt.nimi.toLowerCase() === inputValue.trim().toLowerCase());

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder={placeholder} 
                    value={inputValue} 
                    onChange={handleInputChange}
                    onFocus={() => { setFiltered(options); setIsOpen(true); }}
                />
            </div>
            
            {isOpen && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, 
                    background: 'var(--color-background)', border: '1px solid var(--color-border)', 
                    borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                    maxHeight: '250px', overflowY: 'auto' 
                }}>
                    {filtered.map(opt => (
                        <div 
                            key={opt.id} 
                            onClick={() => handleOptionSelect(opt)}
                            style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {opt.nimi}
                        </div>
                    ))}
                    
                    {!exactMatchFound && inputValue.trim().length > 1 && (
                        <div 
                            onClick={handleSaveNew}
                            style={{ 
                                padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--color-primary)', 
                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500',
                                backgroundColor: 'var(--color-bg-secondary)'
                            }}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Lisää uusi pätevyys: "{inputValue.trim()}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatevyysAutocomplete;