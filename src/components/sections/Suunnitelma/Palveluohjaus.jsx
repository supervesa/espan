import React, { useState, useMemo, useEffect } from 'react';
import { Compass, Search, Info, PlusCircle, CheckCircle, ExternalLink, Sparkles, FileText, Languages, Lock, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';

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
    
    const [activeTab, setActiveTab] = useState('palvelu'); 
    const [visibleCount, setVisibleCount] = useState(6);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Kaikki');
    const [expandedService, setExpandedService] = useState(null);

    const rawValinnat = state.suunnitelma || {};
    const valinnatObj = useMemo(() => {
        if (Array.isArray(rawValinnat)) {
            return rawValinnat.reduce((acc, key) => ({ ...acc, [key]: true }), {});
        }
        return rawValinnat;
    }, [rawValinnat]);

    const signals = state.signals || {};
    const currentLanguageLevel = state['custom-kielitaso_suomi'];
    const masterValinnat = state.asiakas?.valitut_palvelut_id || [];

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

        const reqScore = CEFR_SCORES[req.toLowerCase().trim()] || 0;
        let userScore;

        const hasLanguageSignals = Object.keys(signals).some(key => key.startsWith('language_fi_'));
        const hasLanguageDeficiency = signals['kielitaidon_puute'] || signals['kielitaito_heikko'];
        
        if (signals['osallistuu_tulkki']) {
            userScore = 1; 
        } else if (manualLevel) {
            const levelKey = manualLevel.toLowerCase().trim();
            userScore = CEFR_SCORES[levelKey] || 0;
        } else if (hasLanguageSignals) {
            userScore = 0;
            Object.keys(signals).forEach(key => {
                if (signals[key] === true && key.startsWith('language_fi_')) {
                    const levelStr = key.replace('language_fi_', '').replace('_', '.').toLowerCase();
                    const score = CEFR_SCORES[levelStr] || 0;
                    if (score > userScore) userScore = score;
                }
            });
        } else if (hasLanguageDeficiency) {
            userScore = 1; 
        } else {
            userScore = 99; 
        }

        return { match: userScore >= reqScore, userScore, reqScore };
    };

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
        const tabServices = services.filter(s => (s.service_type || 'palvelu') === activeTab);
        const cats = new Set(tabServices.map(s => s.category).filter(Boolean));
        return ['Kaikki', ...Array.from(cats)];
    }, [services, activeTab]);

    const filteredServices = useMemo(() => {
        let filtered = services.filter(service => {
            const sType = service.service_type || 'palvelu';
            if (sType !== activeTab) return false;

            const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = activeCategory === 'Kaikki' || service.category === activeCategory;
            return matchesSearch && matchesCategory;
        });

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

    const displayedServices = filteredServices.slice(0, visibleCount);

    const handleToggleService = (id, isChecked) => {
        const newValinnat = { ...valinnatObj };
        
        if (isChecked) {
            newValinnat[id] = true;
        } else {
            delete newValinnat[id];
        }

        if (actions.updateSectionData) {
            actions.updateSectionData('suunnitelma', newValinnat);
        } else if (actions.updateSection) {
            actions.updateSection('suunnitelma', newValinnat);
        }

        if (typeof actions.onUpdateAsiakas === 'function') {
            const currentMaster = new Set(masterValinnat);
            if (isChecked) {
                currentMaster.add(id);
            } else {
                currentMaster.delete(id);
            }
            actions.onUpdateAsiakas('valitut_palvelut_id', Array.from(currentMaster));
        }
    };

    const toggleExpand = (id) => setExpandedService(expandedService === id ? null : id);

    const renderCard = (service, isRecommendation = false) => {
        const isSelected = !!valinnatObj[service.id] || masterValinnat.includes(service.id);
        const cardKey = isRecommendation ? `rec-${service.id}` : service.id;
        
        const langInfo = checkLanguageMatch(service, signals, currentLanguageLevel);
        const isLanguageLocked = !langInfo.match;
        const isExpired = service.enrollment_deadline && new Date(service.enrollment_deadline) < new Date();
        
        const isLocked = isLanguageLocked || isExpired;

        return (
            <div key={cardKey} className={`service-card ${isSelected ? 'service-card--selected' : ''} ${isLocked ? 'service-card--locked' : ''}`} style={{ opacity: isExpired && !isSelected ? 0.65 : 1 }}>
                <div className="service-card-header">
                    <span className={`tag ${isRecommendation ? 'tag--warning' : 'tag--pending'}`}>
                        {service.category || 'Yleinen'}
                    </span>
                    
                    {/* UUSI: Velvoittava palvelu -merkki */}
                    {service.hard_service && (
                        <span className="tag tag--danger" style={{ marginLeft: '0.5rem', fontWeight: 'bold' }}>
                            <AlertCircle size={12} style={{ marginRight: '4px' }} />
                            Velvoittava
                        </span>
                    )}

                    {/* UUSI: Vaatii lähetteen -merkki */}
                    {service.requires_referral && (
                        <span className="tag tag--success" style={{ marginLeft: '0.5rem', backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                            <FileText size={12} style={{ marginRight: '4px' }} />
                            Vaatii lähetteen
                        </span>
                    )}

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

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
                <button onClick={() => setActiveTab('palvelu')} style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontSize: '1.05rem', cursor: 'pointer', color: activeTab === 'palvelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'palvelu' ? '600' : 'normal', borderBottom: activeTab === 'palvelu' ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s' }}>Työllisyyspalvelut</button>
                <button onClick={() => setActiveTab('koulutus')} style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontSize: '1.05rem', cursor: 'pointer', color: activeTab === 'koulutus' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'koulutus' ? '600' : 'normal', borderBottom: activeTab === 'koulutus' ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s' }}>Työvoimakoulutukset (TVM)</button>
            </div>

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
                <div className="info-note" style={{ marginBottom: '2rem' }}>Ei automaattisia suosituksia valitussa osiossa.</div>
            )}

            <div className="service-filter-bar" style={{ marginBottom: '2rem' }}>
                <div className="search-wrapper" style={{ position: 'relative', flex: 1 }}>
                    <input type="text" className="form-input" placeholder={`Hae ${activeTab === 'palvelu' ? 'palveluita' : 'koulutuksia'}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem', width: '100%' }} />
                    <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                </div>
                <div className="category-scroll" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {categories.map(category => (
                        <button key={category} className={`chip ${activeCategory === category ? 'chip--active' : ''}`} onClick={() => setActiveCategory(category)}>{category}</button>
                    ))}
                </div>
            </div>

            <div className="service-card-grid">
                {displayedServices.length > 0 ? displayedServices.map(s => renderCard(s, false)) : <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1 / -1' }}><p>Hakuehdoilla ei löytynyt tuloksia.</p></div>}
            </div>

            {filteredServices.length > visibleCount && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                    <button className="btn btn--secondary" onClick={() => setVisibleCount(prev => prev + 6)} style={{ padding: '0.75rem 2rem', borderRadius: '99px' }}>Näytä lisää ({filteredServices.length - visibleCount}) ...</button>
                </div>
            )}
        </div>
    );
};

export default Palveluohjaus;