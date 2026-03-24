// --- src/components/sections/Palveluohjaus.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { Compass, Search, Info, PlusCircle, CheckCircle, ExternalLink, Sparkles, FileText, Languages, Lock } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

// 1. KIELITASOJEN HIERARKIA (Pienimmästä suurimpaan)
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
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Kaikki');
    const [expandedService, setExpandedService] = useState(null);

    const valinnatArray = Array.isArray(state.suunnitelma) ? state.suunnitelma : [];
    const signals = state.signals || {};
    
    // Luetaan kielitason valinta suoraan statesta (KoulutusJaYrittajyys-komponentin tallentama arvo)
    const currentLanguageLevel = state['custom-kielitaso_suomi'];

    // 2. HAETAAN PALVELUT SUPABASESTA
    useEffect(() => {
        const fetchServices = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('services')
                    .select('*')
                    .order('title', { ascending: true });
                
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

    // 3. APUFUNKTIO: RIITTÄÄKÖ KIELITAITO?
    // Tämä funktio on "puhdas", se saa tarvittavat tiedot argumentteina useMemo-kutsuista
    const checkLanguageMatch = (service, signals, manualLevel) => {
        const req = service.language_req;
        if (!req || req.trim() === '') return { match: true };

        let userScore = 0;
        
        // JÄRJESTYS: 1. Tulkki-signaali (lukitus alas) -> 2. Manuaalinen valinta -> 3. Signaalit
        if (signals['osallistuu_tulkki']) {
            userScore = 1; // A1.1 taso
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
        
        return {
            match: userScore >= reqScore,
            userScore,
            reqScore
        };
    };

    // 4. ÄLYKKÄÄT SUOSITUKSET
    const recommendedServices = useMemo(() => {
        return services.filter(service => {
            if (!service.triggers) return false;

            // KIELITARKKISTUS
            const langCheck = checkLanguageMatch(service, signals, currentLanguageLevel);
            if (!langCheck.match) return false;

            // TRIGGERI-TARKISTUS
            const triggerList = service.triggers.split(',').map(t => t.trim()).filter(Boolean);
            
            return triggerList.some(triggerKey => {
                // Normaali signaali TAI tulkki-signaali rinnastetaan kielitaidon puutteeseen
                if (signals[triggerKey]) return true;
                if (signals['osallistuu_tulkki'] && (triggerKey === 'kielitaidon_puute' || triggerKey === 'kielitaito_heikko')) return true;
                return false;
            });
        });
        // TÄRKEÄÄ: useMemo reagoi heti kun signals tai currentLanguageLevel muuttuu
    }, [services, signals, currentLanguageLevel]);

    // 5. KATEGORIAT JA SUODATUS
    const categories = useMemo(() => {
        const cats = new Set(services.map(s => s.category).filter(Boolean));
        return ['Kaikki', ...Array.from(cats)];
    }, [services]);

    const filteredServices = useMemo(() => {
        return services.filter(service => {
            const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = activeCategory === 'Kaikki' || service.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, activeCategory]);

    // 6. KÄSITTELIJÄT
    const handleToggleService = (id, isChecked) => {
        if (actions.onUpdateSuunnitelma) {
            actions.onUpdateSuunnitelma(id, isChecked);
        } else if (actions.updateSectionData) {
            const newList = isChecked ? [...valinnatArray, id] : valinnatArray.filter(i => i !== id);
            actions.updateSectionData('suunnitelma', newList);
        }
    };

    const toggleExpand = (id) => setExpandedService(expandedService === id ? null : id);

    // 7. KORTIN PIIRTÄMINEN
    const renderCard = (service, isRecommendation = false) => {
        const isSelected = valinnatArray.includes(service.id);
        const cardKey = isRecommendation ? `rec-${service.id}` : service.id;
        
        // Tarkistetaan kielitaito lennosta jokaiselle kortille
        const langInfo = checkLanguageMatch(service, signals, currentLanguageLevel);
        const isLanguageLocked = !langInfo.match;

        return (
            <div key={cardKey} className={`service-card ${isSelected ? 'service-card--selected' : ''} ${isLanguageLocked ? 'service-card--locked' : ''}`}>
                <div className="service-card-header">
                    <span className={`tag ${isRecommendation ? 'tag--warning' : 'tag--pending'}`}>
                        {service.category || 'Yleinen'}
                    </span>
                    {service.language_req && (
                        <span className={`tag ${isLanguageLocked ? 'tag--danger' : 'tag--success'}`} style={{ marginLeft: '0.5rem' }}>
                            <Languages size={12} style={{ marginRight: '4px' }} />
                            Taso: {service.language_req}
                        </span>
                    )}
                </div>
                
                <h4 className="service-card-title">
                    {isLanguageLocked && <Lock size={14} style={{ marginRight: '6px', color: 'var(--color-danger)' }} />}
                    {service.title}
                </h4>
                
                <div className="service-card-actions">
                    <button className="btn-icon" onClick={() => toggleExpand(cardKey)} title="Lue palvelukuvaus">
                        <Info size={18} />
                    </button>
                    <button 
                        className={`thv-action-button ${isSelected ? 'btn-selected' : ''} ${isLanguageLocked ? 'btn--disabled' : ''}`}
                        onClick={() => !isLanguageLocked && handleToggleService(service.id, !isSelected)}
                        disabled={isLanguageLocked}
                    >
                        {isLanguageLocked ? 'Kielitaito ei riitä' : (isSelected ? <CheckCircle size={16} /> : <PlusCircle size={16} />)}
                        {!isLanguageLocked && (isSelected ? 'Valittu' : 'Lisää suunnitelmaan')}
                    </button>
                </div>

                {expandedService === cardKey && (
                    <div className="service-card-details">
                        {isLanguageLocked && (
                            <div className="info-note info-note--error" style={{ marginBottom: '1rem', backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' }}>
                                <strong>Pääsy evätty:</strong> Tämä palvelu vaatii vähintään {service.language_req} tason.
                                {signals['osallistuu_tulkki'] ? ' Tulkki-signaali rajoittaa valintoja.' : ''}
                            </div>
                        )}
                        <p>{service.description}</p>
                        <p className="service-card-plan-text">
                            <strong>Suunnitelmaan tuleva teksti:</strong><br/>
                            {service.plan_text}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Ladataan palveluhakemistoa...</div>;

    return (
        <div className="palveluohjaus-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
                <Compass size={24} color="var(--color-primary)" />
                Palveluohjaukset ja suositukset
            </h3>

            {/* AI-SUOSITUKSET */}
            {recommendedServices.length > 0 ? (
                <div className="smart-analysis-box" style={{ marginBottom: '2.5rem', border: '1px solid var(--color-warning)' }}>
                    <div className="smart-analysis-header" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
                        <Sparkles size={20} color="var(--color-warning)" />
                        Sopivimmat palvelut asiakkaalle
                    </div>
                    <div className="service-card-grid">
                        {recommendedServices.map(s => renderCard(s, true))}
                    </div>
                </div>
            ) : (
                <div className="info-note" style={{ marginBottom: '2rem' }}>
                    Ei automaattisia suosituksia nykyisillä signaaleilla ja kielitasolla.
                </div>
            )}

            {/* HAKU JA SUODATUS */}
            <div className="service-filter-bar" style={{ marginBottom: '2rem' }}>
                <div className="search-wrapper" style={{ position: 'relative', flex: 1 }}>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Hae palveluita (esim. 'suomi', 'digi', 'psykologi')..."
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

            {/* KAIKKI PALVELUT */}
            <div className="service-card-grid">
                {filteredServices.length > 0 ? (
                    filteredServices.map(s => renderCard(s, false))
                ) : (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1 / -1' }}>
                        <p>Hakuehdoilla ei löytynyt palveluita.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Palveluohjaus;