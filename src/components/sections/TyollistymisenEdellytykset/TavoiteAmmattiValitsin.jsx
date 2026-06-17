import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Briefcase, Layers, X, Plus, Star, Zap, CheckCircle2 } from 'lucide-react';
import Tag from '../../common/Tag';

const ISCO_MAIN_GROUPS = {
    '1': 'Johtotehtävät',
    '2': 'Erityisasiantuntijatyö',
    '3': 'Asiantuntijatyö',
    '4': 'Toimisto- ja asiakaspalveluala',
    '5': 'Palvelu- ja myyntiala',
    '6': 'Maa- ja metsätalousala',
    '7': 'Rakennus-, korjaus- ja valmistusala',
    '8': 'Prosessi- ja kuljetusala',
    '9': 'Avustava työ',
    '0': 'Sotilasala'
};

const TavoiteAmmattiValitsin = ({ state, actions }) => {
    // --- 1. PÄÄAMMATIN TILAT ---
    const escoNimi = state.asiakas?.tavoiteammatti_esco_nimi || '';
    const escoUri = state.asiakas?.tavoiteammatti_esco_uri || '';
    const finescoAla = state.asiakas?.tavoiteammatti_finesco_ala || '';

    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [finescoTerm, setFinescoTerm] = useState('');

    // --- 2. VAIHTOEHTOISET AMMATIT ---
    const vaihtoehtoisetAlat = useMemo(() => {
        try {
            const raw = state['custom-vaihtoehtoiset_ammatit'];
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }, [state['custom-vaihtoehtoiset_ammatit']]);

    const [altSearchTerm, setAltSearchTerm] = useState('');
    const [altResults, setAltResults] = useState([]);
    const [isAltSearching, setIsAltSearching] = useState(false);
    const [showAltDropdown, setShowAltDropdown] = useState(false);

    // --- 3. ESCO TAIDOT (BETA) ---
    const [suggestedSkills, setSuggestedSkills] = useState([]);
    const [isFetchingSkills, setIsFetchingSkills] = useState(false);
    
    const valitutTaidot = useMemo(() => {
        try {
            const raw = state['custom-valitut_esco_taidot'];
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }, [state['custom-valitut_esco_taidot']]);

    const dropdownRef = useRef(null);
    const altDropdownRef = useRef(null);

    // --- HAKU: Pääammatti ---
    useEffect(() => {
        if (!searchTerm || searchTerm === escoNimi || searchTerm.length < 3) {
            setResults([]);
            setShowDropdown(false);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(searchTerm)}&language=fi&type=occupation&limit=10`);
                if (response.ok) {
                    const json = await response.json();
                    if (json._embedded?.results) {
                        setResults(json._embedded.results);
                        setShowDropdown(true);
                    }
                }
            } catch (err) {} finally { setIsSearching(false); }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, escoNimi]);

    // --- HAKU: Vaihtoehtoiset ammatit ---
    useEffect(() => {
        if (!altSearchTerm || altSearchTerm.length < 3) {
            setAltResults([]);
            setShowAltDropdown(false);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsAltSearching(true);
            try {
                const response = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(altSearchTerm)}&language=fi&type=occupation&limit=10`);
                if (response.ok) {
                    const json = await response.json();
                    if (json._embedded?.results) {
                        setAltResults(json._embedded.results);
                        setShowAltDropdown(true);
                    }
                }
            } catch (err) {} finally { setIsAltSearching(false); }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [altSearchTerm]);

    // --- AUTOMAATTINEN TAITOJEN HAKU (ESCO RESOURCE API) ---
    useEffect(() => {
        const fetchSkills = async () => {
            if (!escoUri) {
                setSuggestedSkills([]);
                return;
            }
            setIsFetchingSkills(true);
            try {
                // Haetaan kyseisen ammatin tarkat tiedot
                const response = await fetch(`https://ec.europa.eu/esco/api/resource/occupation?uri=${encodeURIComponent(escoUri)}&language=fi`);
                if (response.ok) {
                    const data = await response.json();
                    // ESCO palauttaa linkit pakollisiin taitoihin: _links.hasEssentialSkill
                    if (data._links && data._links.hasEssentialSkill) {
                        // Rajoitetaan määrä 12:een, ettei UI tukkeudu
                        const skills = data._links.hasEssentialSkill.slice(0, 12).map(skill => ({
                            uri: skill.href,
                            title: skill.title
                        }));
                        setSuggestedSkills(skills);
                    } else {
                        setSuggestedSkills([]);
                    }
                }
            } catch (err) {
                console.error("Taitojen haku epäonnistui:", err);
            } finally {
                setIsFetchingSkills(false);
            }
        };

        fetchSkills();
    }, [escoUri]);

    // Klikkaukset ohi valikoiden
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false);
            if (altDropdownRef.current && !altDropdownRef.current.contains(event.target)) setShowAltDropdown(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- KÄSITTELIJÄT: FINESCO ---
    const handleSetFinesco = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            if (finescoTerm.trim()) {
                actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finescoTerm.trim());
                setFinescoTerm(''); 
            }
        }
    };
    const handleClearFinesco = () => actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', '');

    // --- KÄSITTELIJÄT: ESCO PÄÄAMMATTI ---
    const handleSelectMain = (item) => {
        actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', item.title);
        actions.onUpdateAsiakas('tavoiteammatti_esco_uri', item.uri);
        
        if (item.code && typeof item.code === 'string') {
            const mainCategoryCode = item.code.charAt(0);
            const autoCategory = ISCO_MAIN_GROUPS[mainCategoryCode];
            if (autoCategory) {
                actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', autoCategory);
            } else {
                actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', '');
            }
        } else {
            actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', '');
        }
        
        // Nollataan valitut taidot ammattia vaihtaessa
        actions.onUpdateCustomText('valitut_esco_taidot', JSON.stringify([]));
        
        setSearchTerm(''); 
        setShowDropdown(false);
    };

    const handleClearMain = () => {
        actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', '');
        actions.onUpdateAsiakas('tavoiteammatti_esco_uri', '');
        actions.onUpdateCustomText('valitut_esco_taidot', JSON.stringify([]));
    };

    // --- KÄSITTELIJÄT: VAIHTOEHTOISET AMMATIT ---
    const handleSelectAlt = (item) => {
        if (!vaihtoehtoisetAlat.some(a => a.nimi === item.title)) {
            const updatedAlat = [...vaihtoehtoisetAlat, { nimi: item.title, uri: item.uri }];
            actions.onUpdateCustomText('vaihtoehtoiset_ammatit', JSON.stringify(updatedAlat));
        }
        setAltSearchTerm(''); 
        setShowAltDropdown(false);
    };

    const handleRemoveAlt = (nimi) => {
        const updatedAlat = vaihtoehtoisetAlat.filter(a => a.nimi !== nimi);
        actions.onUpdateCustomText('vaihtoehtoiset_ammatit', JSON.stringify(updatedAlat));
    };

    // --- KÄSITTELIJÄT: ESCO TAIDOT ---
    const toggleSkill = (skillTitle) => {
        let updatedSkills;
        if (valitutTaidot.includes(skillTitle)) {
            updatedSkills = valitutTaidot.filter(t => t !== skillTitle);
        } else {
            updatedSkills = [...valitutTaidot, skillTitle];
        }
        actions.onUpdateCustomText('valitut_esco_taidot', JSON.stringify(updatedSkills));
    };

    return (
        <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* FINESCO-ALA */}
                <div>
                    <label className="icon-label"><Layers size={16} /> Ammattiala (Finesco / ISCO)</label>
                    <div style={{ minHeight: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                        {finescoAla ? (
                            <Tag type="primary" onRemove={handleClearFinesco} customStyle={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                {finescoAla}
                            </Tag>
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei määritelty</span>
                        )}
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Layers size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder={finescoAla ? "Vaihda alaa kirjoittamalla..." : "Kirjoita ala ja paina Enter..."}
                            value={finescoTerm}
                            onChange={(e) => setFinescoTerm(e.target.value)}
                            onKeyDown={handleSetFinesco}
                            style={{ paddingLeft: '32px' }}
                        />
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px' }}>Täyttyy automaattisesti ammatin perusteella. (Voit ylikirjoittaa ja painaa Enter)</p>
                </div>

                {/* ESCO-PÄÄAMMATTI */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <label className="icon-label"><Briefcase size={16} /> Tavoiteammatti (ESCO)</label>
                    <div style={{ minHeight: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                        {escoNimi ? (
                            <Tag type="success" onRemove={handleClearMain} customStyle={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                <Star size={14} fill="currentColor" /> {escoNimi}
                            </Tag>
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei valittua pääammattia</span>
                        )}
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder={escoNimi ? "Vaihda pääammattia hakemalla..." : "Hae ESCO-ammattia..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '32px' }}
                        />
                        {isSearching && <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: '10px', color: '#94a3b8' }} />}
                    </div>
                    
                    {showDropdown && results.length > 0 && (
                        <div style={{ 
                            position: 'absolute', top: '100%', left: 0, right: 0, 
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', 
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, 
                            maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                        }}>
                            {results.map((r, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleSelectMain(r)}
                                    style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: idx < results.length -1 ? '1px solid #f1f5f9' : 'none' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                >
                                    {r.title}
                                </div>
                            ))}
                        </div>
                    )}
                    <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px' }}>Tarkka tavoiteammatti (Euroopan laajuinen sanasto)</p>
                </div>
            </div>

            {/* ESCO TAITO-EHDOTUKSET (BETA) - Näkyy vain jos on valittu ammatti */}
            {escoNimi && (
                <div className="panel-gray" style={{ marginTop: '1.5rem', backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7' }}>
                        <Zap size={16} /> 
                        ESCO Taitosuositukset ammatille: {escoNimi}
                    </h4>
                    
                    {isFetchingSkills ? (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Loader2 size={14} className="animate-spin" /> Haetaan osaamissisältöä Euroopan komission tietokannasta...
                        </div>
                    ) : suggestedSkills.length > 0 ? (
                        <>
                            <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '10px', marginTop: 0 }}>
                                Mitkä näistä taidoista tai tiedoista asiakkaalla on jo? Klikkaa lisätäksesi osaamiseen.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {suggestedSkills.map((skill, idx) => {
                                    const isSelected = valitutTaidot.includes(skill.title);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => toggleSkill(skill.title)}
                                            style={{
                                                background: isSelected ? '#10b981' : '#fff',
                                                color: isSelected ? '#fff' : '#334155',
                                                border: `1px solid ${isSelected ? '#10b981' : '#cbd5e1'}`,
                                                borderRadius: '16px',
                                                padding: '4px 10px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {isSelected && <CheckCircle2 size={12} />}
                                            {skill.title}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                            Tälle ammatille ei löytynyt suoraan kytkettyjä erikoistaitoja ESCO-kannasta.
                        </p>
                    )}
                </div>
            )}

            {/* VAIHTOEHTOISET AMMATIT */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem' }}>
                <label className="icon-label"><Plus size={16} /> Vaihtoehtoiset tavoiteammatit (ESCO)</label>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', minHeight: '32px' }}>
                    {vaihtoehtoisetAlat.map((alt, idx) => (
                        <Tag key={idx} type="primary" onRemove={() => handleRemoveAlt(alt.nimi)} customStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}>
                            {alt.nimi}
                        </Tag>
                    ))}
                    {vaihtoehtoisetAlat.length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>Ei vaihtoehtoisia ammatteja</span>
                    )}
                </div>

                <div ref={altDropdownRef} style={{ position: 'relative', width: '50%' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Hae lisättävä ammatti..."
                            value={altSearchTerm}
                            onChange={(e) => setAltSearchTerm(e.target.value)}
                            style={{ paddingLeft: '32px' }}
                        />
                        {isAltSearching && <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: '10px', color: '#94a3b8' }} />}
                    </div>

                    {showAltDropdown && altResults.length > 0 && (
                        <div style={{ 
                            position: 'absolute', top: '100%', left: 0, right: 0, 
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', 
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, 
                            maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                        }}>
                            {altResults.map((r, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleSelectAlt(r)}
                                    style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: idx < altResults.length -1 ? '1px solid #f1f5f9' : 'none' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                >
                                    {r.title}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TavoiteAmmattiValitsin;