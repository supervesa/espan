// --- src/components/koulutusYrittajyys/PatevyydetOsio.jsx ---
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import PatevyysAutocomplete from '../common/PatevyysAutocomplete';
import ChipList from '../common/ChipList';
import { ShieldCheck, TrendingUp } from 'lucide-react';

const PatevyydetOsio = ({ state, actions }) => {
    const { onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;
    const [topKortit, setTopKortit] = useState([]);
    
    // Pidämme useRefissä kirjaa aktiivisista "pehmeistä tallennuksista"
    const loggingTimeouts = useRef({});

    // Puretaan tilasta jo valitut kortit (talletetaan JSON-merkkijonona)
    let valitutKortit = [];
    try {
        if (state['custom-valitut_ammattikortit']) {
            valitutKortit = JSON.parse(state['custom-valitut_ammattikortit']);
        }
    } catch (e) {}

    // Haetaan top 10 View-taulusta vain kerran kun komponentti ladataan
    useEffect(() => {
        const fetchTop = async () => {
            const { data, error } = await supabase.from('v_top_patevyydet').select('*').limit(10);
            if (data && !error) setTopKortit(data);
        };
        fetchTop();
    }, []);

    const handleAddKortti = async (kortti) => {
        // Jos on jo valittu, ei tehdä mitään
        if (valitutKortit.find(k => k.id === kortti.id)) return;

        const uusiLista = [...valitutKortit, { id: kortti.id, nimi: kortti.nimi }];
        onUpdateCustomText('valitut_ammattikortit', JSON.stringify(uusiLista));

        // --- SIGNAALIN REKISTERÖINTI NIMELLÄ (EIKÄ ID:LLÄ) ---
        // Muutetaan nimi siistiksi avaimeksi: esim. "Tulityökortti 1" -> "tulityokortti_1"
        const safeName = kortti.nimi.toLowerCase().replace(/[^a-z0-9äöå]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '');
        const signalKey = `patevyys_${safeName}`;
        
        // Varmistetaan, että signaali on olemassa järjestelmän päätaulussa (jotta AI löytää sen)
        await supabase.from('system_signals').upsert({
            signal_key: signalKey,
            label: `Pätevyys: ${kortti.nimi}`,
            category: 'Pätevyydet',
            description: `Asiakkaalla on voimassa oleva pätevyys: ${kortti.nimi}.`
        }, { onConflict: 'signal_key' });

        // Kytketään signaali päälle asiakkaan tilassa
        if (onAddSignal) onAddSignal(signalKey);

        // --- PEHMEÄ LOKITUS (Debounce & Fire-and-forget) ---
        // Lähetetään tietokantaan merkintä vasta 3 sekunnin päästä, jos sitä ei ole otettu pois
        loggingTimeouts.current[kortti.id] = setTimeout(() => {
            supabase.from('patevyydet_log').insert([{ patevyys_id: kortti.id }]).then();
            delete loggingTimeouts.current[kortti.id];
        }, 3000);
    };

    const handleRemoveKortti = (kortti) => {
        const uusiLista = valitutKortit.filter(k => k.id !== kortti.id);
        onUpdateCustomText('valitut_ammattikortit', JSON.stringify(uusiLista));

        // Sammutetaan signaali samalla nimeämislogiikalla
        const safeName = kortti.nimi.toLowerCase().replace(/[^a-z0-9äöå]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '');
        const signalKey = `patevyys_${safeName}`;
        if (onRemoveSignal) onRemoveSignal(signalKey);

        // Jos poistettiin nopeasti ennen kuin lokitus ehti tapahtua, perutaan lokitus
        if (loggingTimeouts.current[kortti.id]) {
            clearTimeout(loggingTimeouts.current[kortti.id]);
            delete loggingTimeouts.current[kortti.id];
        }
    };

    return (
        <div className="options-container card-options" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <h4 className="subsection-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShieldCheck size={20} /> Pätevyydet ja ammattikortit
            </h4>
            
            <div style={{ marginBottom: '1rem' }}>
                <PatevyysAutocomplete onSelect={handleAddKortti} />
            </div>

            {topKortit.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                        <TrendingUp size={14} /> Suosituimmat pätevyydet
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {topKortit.map(tk => {
                            const isSelected = valitutKortit.some(vk => vk.id === tk.id);
                            return (
                                <button
                                    key={tk.id}
                                    type="button"
                                    onClick={() => handleAddKortti(tk)}
                                    disabled={isSelected}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.85rem',
                                        backgroundColor: isSelected ? 'var(--color-bg-secondary)' : 'var(--color-background)',
                                        border: `1px solid ${isSelected ? 'var(--color-border)' : 'var(--color-primary)'}`,
                                        color: isSelected ? 'var(--color-text-muted)' : 'var(--color-primary)',
                                        borderRadius: '4px',
                                        cursor: isSelected ? 'default' : 'pointer',
                                        opacity: isSelected ? 0.6 : 1
                                    }}
                                >
                                    {tk.nimi}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="panel-gray" style={{ padding: '1rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>Valitut kortit ja pätevyydet:</h5>
                <ChipList items={valitutKortit} onRemove={handleRemoveKortti} placeholder="Etsi tai valitse pätevyyksiä yltä." />
            </div>
        </div>
    );
};

export default PatevyydetOsio;