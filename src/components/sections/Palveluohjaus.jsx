// --- src/components/sections/Palveluohjaus.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { Compass, Search, Info, PlusCircle, CheckCircle, ExternalLink, Sparkles, FileText, Languages, Lock, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const CEFR_SCORES = {
    'a1.1': 1, 'a1.2': 2, 'a1.3': 3,
    'a2.1': 4, 'a2.2': 5,
    'b1.1': 6, 'b1.2': 7,
    'b2.1': 8, 'b2.2': 9,
    'c1.1': 10, 'c1.2': 11,
    'c2.1': 12, 'c2.2': 13
};

const Palveluohjaus = ({ state, actions, onServicesLoaded }) => {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // UUDET: Päävälilehti ja "Näytä lisää" -rajoitin
    const [activeTab, setActiveTab] = useState('palvelu'); // 'palvelu' | 'koulutus'
    const [visibleCount, setVisibleCount] = useState(6);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Kaikki');
    const [expandedService, setExpandedService] = useState(null);

    const valinnatArray = Array.isArray(state.suunnitelma) ? state.suunnitelma : [];
    const signals = state.signals || {};
    const currentLanguageLevel = state['custom-kielitaso_suomi'];

    // UUSI LAYER: Luetaan myös Master-profiilista, onko palvelu valittuna
    const masterValinnat = state.asiakas?.valitut_palvelut_id || [];

    // Resetoidaan näkyvien määrä, jos haku tai välilehti muuttuu
    useEffect(() => {
        setVisibleCount(6);
    }, [searchTerm, activeCategory, activeTab]);

    useEffect(() => {
        const fetchServices = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('services').select('*').order('title', { ascending: true });
                if (error) throw error;
                if (data) {
                    setServices(data);
                    if (onServicesLoaded) onServicesLoaded(data);
                }
            } catch (error) {
                console.error("Virhe palveluiden latauksessa:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchServices();
    }, [onServicesLoaded]);

    const checkLanguageMatch = (service, signals, manualLevel) => {
        const req = service.language_req;
        if (!req || req.trim() === '') return { match: true };

        let userScore = 0;
        
        if (signals['osallistuu_tulkki']) {
            userScore = 1;
        } else if (manualLevel) {
            const levelKey = manualLevel.toLowerCase().trim();
            userScore = CEFR_SCORES[levelKey] || 0;
        } else {
            Object.keys(signals).forEach(key => {
                if (signals[key] === true && key.startsWith('language_fi_')) {
                    const levelStr = key.replace('language_fi_', '').replace('_', '.').toLowerCase();
                    const score = CEFR_SCORES[levelStr] || 0;
                    if (score > userScore) userScore = score;
                }
            });
        }

        const reqScore = CEFR_SCORES[req.toLowerCase().trim()] || 0;
        return { match: userScore >= reqScore, userScore, reqScore };
    };

    // PÄIVITETTY: Suositukset ottavat huomioon välilehden
    const recommendedServices = useMemo(() => {
        return services.filter(service => {
            const sType = service.service_type || 'palvelu';
            if (sType !== activeTab) return false;
            if (!service.triggers) return false;

            const langCheck = checkLanguageMatch(service, signals, currentLanguageLevel);
            if (!langCheck.match) return false;

            const triggerList = service.triggers.split(',').map(t => t.trim()).filter(Boolean);
            return triggerList.some(triggerKey => {
                if (signals[triggerKey]) return true;
                if (signals['osallistuu_tulkki'] && (triggerKey === 'kielitaidon_puute' || triggerKey === 'kielitaito_heikko')) return true;
                return false;
            });
        });
    }, [services, signals, currentLanguageLevel, activeTab]);

    const categories = useMemo(() => {
        // Haetaan kategoriat vain aktiivisen välilehden palveluista
        const tabServices = services.filter(s => (s.service_type || 'palvelu') === activeTab);
        const cats = new Set(tabServices.map(s => s.category).filter(Boolean));
        return ['Kaikki', ...Array.from(cats)];
    }, [services, activeTab]);

    // PÄIVITETTY: Älykäs lajittelu ja haku
    const filteredServices = useMemo(() => {
        let filtered = services.filter(service => {
            const sType = service.service_type || 'palvelu';
            if (sType !== activeTab) return false;

            const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = activeCategory === 'Kaikki' || service.category === activeCategory;
            return matchesSearch && matchesCategory;
        });

        // Lajitellaan: Koulutuksissa lähimpänä umpeutuvat ensin, menneet hännille.
        filtered.sort((a, b) => {
            if (activeTab === 'koulutus') {
                const aExp = a.enrollment_deadline && new Date(a.enrollment_deadline) < new Date();
                const bExp = b.enrollment_deadline && new Date(b.enrollment_deadline) < new Date();
                
                if (aExp && !bExp) return 1;
                if (!aExp && bExp) return -1;
                
                if (a.enrollment_deadline && b.enrollment_deadline) {
                    return new Date(a.enrollment_deadline) - new Date(b.enrollment_deadline);
                }
                if (a.enrollment_deadline) return -1;
                if (b.enrollment_deadline) return 1;
            }
            return a.title.localeCompare(b.title);
        });

        return filtered;
    }, [services, searchTerm, activeCategory, activeTab]);

    // Leikattu lista näytettäväksi
    const displayedServices = filteredServices.slice(0, visibleCount);

    const handleToggleService = (id, isChecked) => {
        let newList = valinnatArray;

        // 1. Päivitetään vanha paikallinen tila (Suunnitelma-komponenttia varten)
        if (actions.onUpdateSuunnitelma) {
            actions.onUpdateSuunnitelma(id, isChecked);
        } else if (actions.updateSectionData) {
            newList = isChecked ? [...valinnatArray, id] : valinnatArray.filter(i => i !== id);
            actions.updateSectionData('suunnitelma', newList);
        }

        // 2. UUSI LAYER: Tallennetaan tieto suoraan Master-profiiliin (Jälkimarkkinointia varten)
        if (typeof actions.onUpdateAsiakas === 'function') {
            // Yhdistetään varmuuden vuoksi kaikki aiemmat valinnat (myös ne, jotka on ehkä tehty toisessa komponentissa)
            const combinedSet = new Set([...valinnatArray, ...masterValinnat]);
            if (isChecked) {
                combinedSet.add(id);
            } else {
                combinedSet.delete(id);
            }
            actions.onUpdateAsiakas('valitut_palvelut_id', Array.from(combinedSet));
        }
    };

    const toggleExpand = (id) => setExpandedService(expandedService === id ? null : id);

    const renderCard = (service, isRecommendation = false) => {
        // Tarkistetaan valinta molemmista listoista varmuuden vuoksi
        const isSelected = valinnatArray.includes(service.id) || masterValinnat.includes(service.id);
        const cardKey = isRecommendation ? `rec-${service.id}` : service.id;
        
        const langInfo = checkLanguageMatch(service, signals, currentLanguageLevel);
        const isLanguageLocked = !langInfo.match;
        const isExpired = service.enrollment_deadline && new Date(service.enrollment_deadline) < new Date();
        
        // Yhdistetty lukko (Kielitaito TAI Hakuaika mennyt)
        const isLocked = isLanguageLocked || isExpired;

        return (
            <div key={cardKey} className={`service-card ${isSelected ? 'service-card--selected' : ''} ${isLocked ? 'service-card--locked' : ''}`} style={{ opacity: isExpired && !isSelected ? 0.65 : 1 }}>
                <div className="service-card-header">
                    <span className={`tag ${isRecommendation ? 'tag--warning' : 'tag--pending'}`}>
                        {service.category || 'Yleinen'}
                    </span>
                    {service.service_type === 'koulutus' && (
                        <span className="tag tag--warning" style={{ marginLeft: '0.5rem', fontWeight: 'bold' }}>TVM</span>
                    )}
                    {service.language_req && (
                        <span className={`tag ${isLanguageLocked ? 'tag--danger' : 'tag--success'}`} style={{ marginLeft: '0.5rem' }}>
                            <Languages size={12} style={{ marginRight: '4px' }} />
                            Taso: {service.language_req}
                        </span>
                    )}
                </div>
                
                <h4 className="service-card-title">
                    {isLanguageLocked && <Lock size={14} style={{ marginRight: '6px', color: 'var(--color-danger)' }} />}
                    {isExpired && !isLanguageLocked && <AlertCircle size={14} style={{ marginRight: '6px', color: 'var(--color-danger)' }} />}
                    {service.title}
                </h4>

                {/* TVM-kriittiset tiedot suoraan etupuolella */}
                {service.service_type === 'koulutus' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {service.ura_number && <span><strong>URA:</strong> {service.ura_number}</span>}
                        {service.provider && <span><strong>Järjestäjä:</strong> {service.provider}</span>}
                        {service.enrollment_deadline && (
                            <span style={{ color: isExpired ? 'var(--color-danger)' : 'var(--color-primary)', fontWeight: isExpired ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Calendar size={12} /> Haku: {new Date(service.enrollment_deadline).toLocaleDateString('fi-FI')}
                            </span>
                        )}
                        {service.start_date && <span><strong>Alkaa:</strong> {service.start_date}</span>}
                    </div>
                )}
                
                <div className="service-card-actions">
                    <button className="btn-icon" onClick={() => toggleExpand(cardKey)} title="Lue palvelukuvaus">
                        <Info size={18} />
                    </button>
                    <button 
                        className={`thv-action-button ${isSelected ? 'btn-selected' : ''} ${isLocked ? 'btn--disabled' : ''}`}
                        onClick={() => !isLocked && handleToggleService(service.id, !isSelected)}
                        disabled={isLocked}
                    >
                        {isLocked ? (isExpired ? 'Hakuaika päättynyt' : 'Kielitaito ei riitä') : (isSelected ? <CheckCircle size={16} /> : <PlusCircle size={16} />)}
                        {!isLocked && (isSelected ? 'Valittu' : 'Lisää suunnitelmaan')}
                    </button>
                </div>

                {expandedService === cardKey && (
                    <div className="service-card-details">
                        {isLanguageLocked && (
                            <div className="info-note info-note--error" style={{ marginBottom: '1rem', backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' }}>
                                <strong>Pääsy evätty:</strong> Tämä vaatii vähintään {service.language_req} tason.
                                {signals['osallistuu_tulkki'] ? ' Tulkki-signaali rajoittaa valintoja.' : ''}
                            </div>
                        )}
                        
                        {/* Näytetään poimitut tagit/vaatimukset */}
                        {service.triggers && (
                            <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {service.triggers.split(',').map(t => (
                                    <span key={t} style={{ backgroundColor: 'var(--color-border)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                                        #{t.trim()}
                                    </span>
                                ))}
                            </div>
                        )}

                        <p style={{ whiteSpace: 'pre-line' }}>{service.description}</p>
                        <p className="service-card-plan-text" style={{ whiteSpace: 'pre-line' }}>
                            <strong>Suunnitelmaan tuleva teksti:</strong><br/>
                            {service.plan_text}
                        </p>
                        
                        {(service.url || service.brochure_url) && (
                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-border)', flexWrap: 'wrap' }}>
                                {service.url && (
                                    <a href={service.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
                                        <ExternalLink size={16} /> Siirry sivuille
                                    </a>
                                )}
                                {service.brochure_url && (
                                    <a href={service.brochure_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
                                        <FileText size={16} /> Avaa esite
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Ladataan hakemistoa...</div>;

    return (
        <div className="palveluohjaus-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
                <Compass size={24} color="var(--color-primary)" />
                Palveluohjaukset ja suositukset
            </h3>

            {/* PÄÄVÄLILEHDET */}
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
                <button 
                    onClick={() => setActiveTab('palvelu')} 
                    style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontSize: '1.05rem', cursor: 'pointer', color: activeTab === 'palvelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'palvelu' ? '600' : 'normal', borderBottom: activeTab === 'palvelu' ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s' }}
                >
                    Työllisyyspalvelut
                </button>
                <button 
                    onClick={() => setActiveTab('koulutus')} 
                    style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontSize: '1.05rem', cursor: 'pointer', color: activeTab === 'koulutus' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'koulutus' ? '600' : 'normal', borderBottom: activeTab === 'koulutus' ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s' }}
                >
                    Työvoimakoulutukset (TVM)
                </button>
            </div>

            {/* AI-SUOSITUKSET */}
            {recommendedServices.length > 0 ? (
                <div className="smart-analysis-box" style={{ marginBottom: '2.5rem', border: '1px solid var(--color-warning)' }}>
                    <div className="smart-analysis-header" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
                        <Sparkles size={20} color="var(--color-warning)" />
                        Sopivimmat {activeTab === 'palvelu' ? 'palvelut' : 'koulutukset'}
                    </div>
                    <div className="service-card-grid">
                        {recommendedServices.map(s => renderCard(s, true))}
                    </div>
                </div>
            ) : (
                <div className="info-note" style={{ marginBottom: '2rem' }}>
                    Ei automaattisia suosituksia valitussa osiossa.
                </div>
            )}

            {/* HAKU JA KATEGORIAT */}
            <div className="service-filter-bar" style={{ marginBottom: '2rem' }}>
                <div className="search-wrapper" style={{ position: 'relative', flex: 1 }}>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder={`Hae ${activeTab === 'palvelu' ? 'palveluita' : 'koulutuksia'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                    />
                    <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                </div>
                
                <div className="category-scroll" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {categories.map(category => (
                        <button 
                            key={category}
                            className={`chip ${activeCategory === category ? 'chip--active' : ''}`}
                            onClick={() => setActiveCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* KAIKKI PALVELUT / KOULUTUKSET */}
            <div className="service-card-grid">
                {displayedServices.length > 0 ? (
                    displayedServices.map(s => renderCard(s, false))
                ) : (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1 / -1' }}>
                        <p>Hakuehdoilla ei löytynyt tuloksia.</p>
                    </div>
                )}
            </div>

            {/* NÄYTÄ LISÄÄ -NAPPI */}
            {filteredServices.length > visibleCount && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                    <button 
                        className="btn btn--secondary" 
                        onClick={() => setVisibleCount(prev => prev + 6)}
                        style={{ padding: '0.75rem 2rem', borderRadius: '99px' }}
                    >
                        Näytä lisää ({filteredServices.length - visibleCount}) ...
                    </button>
                </div>
            )}
        </div>
    );
};

export default Palveluohjaus;