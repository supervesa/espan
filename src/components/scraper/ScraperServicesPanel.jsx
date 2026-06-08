// --- src/components/scraper/ScraperServicesPanel.jsx ---
import React from 'react';
import { Briefcase, X, Link } from 'lucide-react';

const ScraperServicesPanel = ({ services = [], onToggleService }) => {
    if (!services || services.length === 0) return null;

    return (
        <div className="card-inner" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} color="var(--color-primary)" />
                Tunnistetut Palvelut
            </h4>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                Järjestelmä löysi tekstistä seuraavat palvelut ja aktivoi niihin liittyvät kielivaatimukset/signaalit.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {services.map((service, idx) => (
                    <div key={`${service.id}-${idx}`} className="panel-gray" style={{ margin: 0, padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                                {service.title}
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                Tyyppi: {service.type || 'Palvelu'}
                            </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button 
                                className="btn-tag-dismiss" 
                                onClick={() => onToggleService(service.id)} 
                                title="Poista tämä palvelu valinnoista"
                                style={{ padding: '0.4rem', borderRadius: '4px', background: 'var(--color-background)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScraperServicesPanel;