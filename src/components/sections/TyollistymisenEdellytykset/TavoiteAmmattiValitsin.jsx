import React, { useState, useEffect } from 'react';
import { Search, X, CheckCircle2, Layers, Plus } from 'lucide-react';
import Tag from '../../common/Tag';
import ChipList from '../../common/ChipList';

// Apuhook ESCO API -hakuihin (Debounced)
const useEscoSearch = (query) => {
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const fetchEsco = async () => {
            if (query.length < 3) {
                setResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const res = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(query)}&language=fi&type=occupation`);
                const data = await res.json();
                if (data._embedded && data._embedded.results) {
                    setResults(data._embedded.results.slice(0, 10));
                } else {
                    setResults([]);
                }
            } catch (e) {
                console.error("ESCO API virhe:", e);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchEsco, 350); // 350ms viive estää turhat API-kutsut kirjoitettaessa
        return () => clearTimeout(timer);
    }, [query]);

    return { results, isSearching, setResults };
};

const TavoiteAmmattiValitsin = ({ data, updateData, actions, globalSignals }) => {
    // Tilat ensisijaiselle haulle
    const [primaryQuery, setPrimaryQuery] = useState('');
    const { results: primaryResults, isSearching: isPrimarySearching, setResults: setPrimaryResults } = useEscoSearch(primaryQuery);

    // Tilat vaihtoehtoiselle haulle
    const [altQuery, setAltQuery] = useState('');
    const { results: altResults, isSearching: isAltSearching, setResults: setAltResults } = useEscoSearch(altQuery);

    // Tuodut signaalit
    const onYrittajyysKiinnostus = Object.keys(globalSignals).some(key => key.includes('yritta') || key.includes('yritys'));
    const onHyvatDigitaidot = globalSignals['hyvat_digitaidot'];

    // --- ENSISIJAISEN AMMATIN KÄSITTELY ---
    const handleSelectPrimary = (ammattiNimi) => {
        updateData('escoNimi', ammattiNimi);
        
        if (actions && typeof actions.onUpdateAsiakas === 'function') {
            actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', ammattiNimi);
        }
        
        setPrimaryQuery('');
        setPrimaryResults([]);
    };

    const handleClearPrimary = () => {
        updateData('escoNimi', '');
        if (actions && typeof actions.onUpdateAsiakas === 'function') {
            actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', '');
        }
    };

    const handleFinescoChange = (e) => {
        const val = e.target.value;
        updateData('finescoAla', val);
        if (actions && typeof actions.onUpdateAsiakas === 'function') {
            actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', val);
        }
    };

    // --- VAIHTOEHTOISTEN ALOJEN/AMMATTIEN KÄSITTELY ---
    const addAlternative = (nimi) => {
        if (!nimi.trim()) return;
        const newAla = { id: Date.now(), nimi: nimi.trim() };
        updateData('vaihtoehtoisetAlat', [...data.vaihtoehtoisetAlat, newAla]);
        setAltQuery('');
        setAltResults([]);
    };

    const handleAltKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addAlternative(altQuery);
        }
    };

    const handleRemoveAlt = (itemToRemove) => {
        updateData('vaihtoehtoisetAlat', data.vaihtoehtoisetAlat.filter(item => item.id !== itemToRemove.id));
    };

    // --- RENDERÖINTI ---
    return (
        <div style={{ marginBottom: '2rem' }}>
            <label className="stat-label">Ensisijainen tavoite (ESCO)</label>
            
            {!data.escoNimi ? (
                // 1. TILANNE: Ammattia ei ole vielä valittu (Hakukenttä näkyy)
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#6B7280' }} />
                        <input 
                            type="text" 
                            className="modern-input" 
                            style={{ paddingLeft: '2.5rem' }}
                            placeholder="Hae ESCO-ammattia (esim. putkiasentaja)..."
                            value={primaryQuery}
                            onChange={(e) => setPrimaryQuery(e.target.value)}
                        />
                        {isPrimarySearching && <span style={{ position: 'absolute', right: '10px', top: '10px', fontSize: '0.8rem', color: '#6B7280' }}>Haetaan...</span>}
                    </div>
                    
                    {primaryResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #D1D5DB', borderRadius: '4px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxHeight: '250px', overflowY: 'auto' }}>
                            {primaryResults.map((sug, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleSelectPrimary(sug.title)}
                                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#F9FAFB'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                >
                                    <Plus size={14} color="var(--color-primary)" />
                                    <span style={{ fontWeight: 500, color: '#374151' }}>{sug.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // 2. TILANNE: Ammatti on valittu (Vihreä laatikko muokkausmahdollisuudella)
                <div className="info-box" style={{ borderLeft: '4px solid var(--color-success)', backgroundColor: 'rgba(30,154,90,0.05)', position: 'relative', marginBottom: '1rem' }}>
                    <button type="button" onClick={handleClearPrimary} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '0.2rem' }} title="Vaihda ammatti">
                        <X size={18} />
                    </button>
                    
                    <div style={{ color: 'var(--color-success)', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                        <CheckCircle2 size={18} /> {data.escoNimi}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1.75rem', marginBottom: '0.75rem' }}>
                        <Layers size={14} color="#6B7280" />
                        <label style={{ fontSize: '0.85rem', color: '#6B7280', margin: 0 }}>Toimiala (FinESCO):</label>
                        <input 
                            type="text" 
                            value={data.finescoAla || ''} 
                            onChange={handleFinescoChange}
                            placeholder="Esim. Rakennusala..."
                            style={{ border: '1px solid #D1D5DB', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.85rem', flex: 1, maxWidth: '200px' }}
                        />
                    </div>
                    
                    <div style={{ marginTop: '0.5rem', marginLeft: '1.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {onHyvatDigitaidot && <Tag type="success" customStyle={{ borderRadius: '16px', padding: '0.2rem 0.6rem' }}>Hyvät digitaidot</Tag>}
                        {onYrittajyysKiinnostus && <Tag type="primary" customStyle={{ borderRadius: '16px', padding: '0.2rem 0.6rem' }}>Kiinnostus yrittäjyyteen</Tag>}
                    </div>
                </div>
            )}

            {/* VAIHTOEHTOISET ALAT JA AMMATIT */}
            <label className="stat-label" style={{ marginTop: '1.5rem' }}>Vaihtoehtoiset tavoitteet (Hae ESCO-ammattia tai kirjoita vapaasti ja paina Enter)</label>
            
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <input 
                    type="text" 
                    className="modern-input" 
                    value={altQuery} 
                    onChange={(e) => setAltQuery(e.target.value)} 
                    onKeyDown={handleAltKeyDown} 
                    placeholder="Esim. Logistiikka tai Hae: trukkikuski..." 
                />
                
                {/* ESCO-pudotusvalikko vaihtoehtoisille */}
                {altResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #D1D5DB', borderRadius: '4px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                        {altResults.map((sug, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => addAlternative(sug.title)}
                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', fontSize: '0.9rem' }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#F9FAFB'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                                <span style={{ color: 'var(--color-primary)', marginRight: '0.5rem' }}>+</span>
                                {sug.title}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <ChipList items={data.vaihtoehtoisetAlat} onRemove={handleRemoveAlt} placeholder="Ei vaihtoehtoisia tavoitteita lisätty" />
        </div>
    );
};

export default TavoiteAmmattiValitsin;