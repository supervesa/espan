// --- src/components/sections/Palveluohjaus.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { Compass, Search, Info, PlusCircle, CheckCircle, ExternalLink, Sparkles, FileText } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient'; // Oletetaan, että tämä polku on oikea projektissasi

const Palveluohjaus = ({ state, actions, onServicesLoaded }) => {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Kaikki');
    const [expandedService, setExpandedService] = useState(null);

    const valinnatArray = Array.isArray(state.suunnitelma) ? state.suunnitelma : [];
    const signals = state.signals || {};

    // 1. HAETAAN PALVELUT SUPABASESTA
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
                    // Lähetetään ladattu data Suunnitelma.jsx:lle, jotta se osaa generoida tekstin!
                    if (onServicesLoaded) {
                        onServicesLoaded(data);
                    }
                }
            } catch (error) {
                console.error("Virhe palveluiden latauksessa:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchServices();
    }, [onServicesLoaded]);

    // 2. ÄLYKKÄÄT SUOSITUKSET (Verrataan tietokannan triggers-kenttää state.signalseihin)
    const recommendedServices = useMemo(() => {
        return services.filter(service => {
            if (!service.triggers) return false;
            // Pilkotaan tietokannan merkkijono "tyoton, asunnottomuus" listaksi
            const triggerList = service.triggers.split(',').map(t => t.trim()).filter(Boolean);
            // Tarkistetaan, löytyykö asiakkaan signaaleista jokin näistä
            return triggerList.some(triggerKey => signals[triggerKey]);
        });
    }, [services, signals]);

    // 3. KATEGORIAT JA SUODATUS
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

    // 4. KÄSITTELIJÄT
    const handleToggleService = (id, isChecked) => {
        if (actions.onUpdateSuunnitelma) {
            actions.onUpdateSuunnitelma(id, isChecked);
        } else if (actions.updateSectionData) {
            const newList = isChecked ? [...valinnatArray, id] : valinnatArray.filter(i => i !== id);
            actions.updateSectionData('suunnitelma', newList);
        }
    };

    const toggleExpand = (id) => {
        setExpandedService(expandedService === id ? null : id);
    };

    // 5. APUKOMPONENTTI KORTILLE
    const renderCard = (service, isRecommendation = false) => {
        const isSelected = valinnatArray.includes(service.id);
        const cardKey = isRecommendation ? `rec-${service.id}` : service.id;
        
        return (
            <div key={cardKey} className={`service-card ${isSelected ? 'service-card--selected' : ''}`}>
                <div className="service-card-header">
                    <span className={`tag ${isRecommendation ? 'tag--warning' : 'tag--pending'}`}>
                        {service.category || 'Yleinen'}
                    </span>
                    {service.language_req && (
                        <span className="tag tag--success" style={{ marginLeft: '0.5rem' }}>
                            {service.language_req}
                        </span>
                    )}
                </div>
                <h4 className="service-card-title">{service.title}</h4>
                <div className="service-card-actions">
                    <button className="btn-icon" onClick={() => toggleExpand(cardKey)} title="Lue palvelukuvaus">
                        <Info size={18} />
                    </button>
                    <button 
                        className={`thv-action-button ${isSelected ? 'btn-selected' : ''}`}
                        onClick={() => handleToggleService(service.id, !isSelected)}
                    >
                        {isSelected ? <CheckCircle size={16} /> : <PlusCircle size={16} />}
                        {isSelected ? 'Valittu' : 'Lisää suunnitelmaan'}
                    </button>
                </div>

                {expandedService === cardKey && (
                    <div className="service-card-details">
                        <p>{service.description}</p>
                        <p className="service-card-plan-text">
                            <strong>Asiakirjaan tulostuva teksti:</strong><br/>
                            {service.plan_text}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            {service.url && (
                                <a href={service.url} target="_blank" rel="noopener noreferrer" className="service-card-link">
                                    Siirry palvelun sivuille <ExternalLink size={14} />
                                </a>
                            )}
                            {service.brochure_url && (
                                <a href={service.brochure_url} target="_blank" rel="noopener noreferrer" className="service-card-link" style={{ color: 'var(--color-success)' }}>
                                    Avaa esite <FileText size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return <div style={{ marginTop: '3rem', marginBottom: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Ladataan palveluhakemistoa...</div>;
    }

    return (
        <div style={{ marginTop: '3rem', marginBottom: '3rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Compass size={22} color="var(--color-primary)" />
                Palveluohjaukset ja tukipalvelut (AI)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                Etsi ja valitse asiakkaalle sopivia ulkoisia tai sisäisiä palveluita. Nämä tekstit tulostuvat Suunnitelma-osioon.
            </p>

            {/* AI-SUOSITUKSET */}
            {recommendedServices.length > 0 && (
                <div className="smart-analysis-box" style={{ marginBottom: '1.5rem' }}>
                    <div className="smart-analysis-header">
                        <Sparkles size={20} color="var(--color-warning)" />
                        Tekoälyn suositukset asiakkaan tilanteen perusteella
                    </div>
                    <div className="service-card-grid">
                        {recommendedServices.map(s => renderCard(s, true))}
                    </div>
                </div>
            )}

            {/* HAKU JA SUODATUS */}
            <div className="service-filter-container">
                <div className="signal-select-wrapper">
                    <div className="signal-select-inner">
                        <input 
                            type="text" 
                            className="input-field signal-select-input" 
                            placeholder="Hae palveluita nimellä tai hakusanalla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={16} color="var(--color-text-secondary)" className="signal-select-icon" />
                    </div>
                </div>
                <div className="summary-progress-tracker" style={{ marginTop: '1rem' }}>
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
                    <div className="admin-empty-state" style={{ gridColumn: '1 / -1' }}>
                        Ei hakuehtoja vastaavia palveluita.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Palveluohjaus;