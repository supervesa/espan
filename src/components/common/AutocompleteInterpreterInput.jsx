import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import BaseAutocompleteInput from './BaseAutocompleteInput'; // HUOM: Import!

const AutocompleteInterpreterInput = ({ 
    language, 
    value, 
    onChange, 
    placeholder = "Toivottu vakiotulkki (esim. Ali)" 
}) => {
    const [options, setOptions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [autoSelected, setAutoSelected] = useState(false);

    // 1. Hae tulkit
    useEffect(() => {
        const fetchOptions = async () => {
            if (!language || language === 'Määrittelemätön kieli') return;

            const { data, error } = await supabase
                .schema('espan') 
                .from('vakiotulkit')
                .select('*')
                .eq('kieli', language.toLowerCase()); 

            if (data && !error) {
                // Määritellään Supabase-data suoraan Base-komponentin muotoon (id, label, subLabel)
                const mappedData = data.map(tulkki => ({
                    id: tulkki.id,
                    label: tulkki.tulkin_nimi,
                    subLabel: tulkki.toissijainen_kieli ? `Info: ${tulkki.toissijainen_kieli}` : null,
                    original: tulkki // Pidetään alkuperäinen rivi varmuuden vuoksi tallessa
                }));

                setOptions(mappedData);
                setFiltered(mappedData);

                // Autovalinta
                if (mappedData.length === 1 && (!value || value.trim() === '')) {
                    onChange(mappedData[0].label);
                    setAutoSelected(true);
                    setTimeout(() => setAutoSelected(false), 3000);
                }
            }
        };
        fetchOptions();
    }, [language]); 

    // 2. Filtteröi paikallisesti kun käyttäjä kirjoittaa kenttään
    const handleTyping = (val) => {
        onChange(val);
        setAutoSelected(false); // Sammuttaa kimalle-efektin kun käyttäjä korjaa/poistaa tekstiä
        
        if (val.trim()) {
            const matches = options.filter(opt => 
                opt.label.toLowerCase().includes(val.toLowerCase())
            );
            setFiltered(matches);
        } else {
            setFiltered(options);
        }
    };

    // 3. Uuden tulkin tallennus (INSERT)
    const handleSaveNew = async () => {
        if (!value || !value.trim() || !language) return;
        setIsSaving(true);
        
        const safeValue = value.trim();
        const newInterpreter = { tulkin_nimi: safeValue, kieli: language.toLowerCase() };

        const { data, error } = await supabase
            .schema('espan')
            .from('vakiotulkit')
            .insert([newInterpreter])
            .select()
            .single();
        
        if (!error && data) {
            const newMappedOpt = {
                id: data.id,
                label: data.tulkin_nimi,
                subLabel: data.toissijainen_kieli ? `Info: ${data.toissijainen_kieli}` : null
            };
            
            setOptions(prev => [...prev, newMappedOpt]);
            setFiltered(prev => [...prev, newMappedOpt]);
            onChange(safeValue);
        } else {
            console.error("Virhe tulkin tallennuksessa", error);
        }
        setIsSaving(false);
    };

    const exactMatchFound = options.some(opt => opt.label.toLowerCase() === value?.trim().toLowerCase());
    const isValidLanguage = language && language !== 'Määrittelemätön kieli';

    return (
        <BaseAutocompleteInput
            value={value}
            onChange={handleTyping}                     // Typings logiikka asuu tässä komponentissa
            onSelect={(opt) => onChange(opt.label)}     // Asettaa valitun nimen value-tilaan
            onFocus={() => setFiltered(options)}        // Nollataan suodatus, kun kenttää klikataan
            onSaveNew={handleSaveNew}                   // Suorittaa tallennuksen ja kantaan laittamisen
            options={filtered}                          // Datan visuaaliselle puolelle
            placeholder={placeholder}
            isSaving={isSaving}
            autoSelected={autoSelected}
            
            // Logiikka joka päättää näytetäänkö "Tallenna uusi" -rivi:
            showSaveNew={!exactMatchFound && value && value.trim().length > 0 && isValidLanguage}
            saveNewText={`Tallenna uusi: "${value?.trim()}"`}
            emptyMessage={!value ? `Ei tallennettuja vakiotulkkeja kielelle: ${language}` : null}
        />
    );
};

export default AutocompleteInterpreterInput;