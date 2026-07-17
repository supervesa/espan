// --- src/components/scraper/ScraperServicesPanel.jsx ---
import React from 'react';
import { Activity, X, AlertCircle } from 'lucide-react';

const ScraperServicesPanel = ({ services = [], onUpdateService, onRemoveService }) => {
    if (!services || services.length === 0) return null;

    const handleFieldChange = (id, field, value) => {
        const updated = services.map(s => 
            s.id === id ? { ...s, [field]: value } : s
        );
        onUpdateService(updated);
    };

    return (
        <div className="card-inner" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '4px solid #0ea5e9' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="#0ea5e9" />
                Asiantuntijapalvelut (Tilannekatsaus)
            </h4>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                Päivitä aiemmin sovittujen palveluiden elinkaari. Negatiivinen tila aktivoi automaattisesti este-signaalin tekoälylle.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {services.map((service) => {
                    const isNegative = ['ei soveltuva', 'peruuntunut', 'keskeytynyt'].includes(service.tila?.toLowerCase());
                    
                    return (
                        <div key={service.id} className="panel-gray" style={{ 
                            margin: 0, 
                            padding: '10px', 
                            border: isNegative ? '1px solid var(--color-warning)' : '1px solid transparent' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.85rem' }}>{service.title}</strong>
                                <button 
                                    onClick={() => onRemoveService(service.id)} 
                                    style={{ color: 'var(--color-text-muted)', border: 'none', background: 'none', cursor: 'pointer' }}
                                    title="Poista palvelu"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                <select 
                                    className="modern-select" 
                                    style={{ fontSize: '0.75rem', padding: '6px', width: '100%', borderColor: isNegative ? 'var(--color-warning)' : '' }}
                                    value={service.tila || 'ohjattu'}
                                    onChange={(e) => handleFieldChange(service.id, 'tila', e.target.value)}
                                >
                                    <option value="ohjattu">Ohjattu (Odottaa)</option>
                                    <option value="alkanut">Alkanut / Käynnissä</option>
                                    <option value="suoritettu">Suoritettu</option>
                                    <option value="keskeytynyt">Keskeytynyt</option>
                                    <option value="peruuntunut">Peruuntunut</option>
                                    <option value="ei soveltuva">Ei soveltuva</option>
                                </select>

                                {/* Jos negatiivinen tila valitaan, tekstikenttä suurenee pakottaen perustelun */}
                                {isNegative ? (
                                    <div style={{ position: 'relative' }}>
                                        <AlertCircle size={14} style={{ position: 'absolute', top: '8px', left: '8px', color: 'var(--color-warning)' }} />
                                        <textarea 
                                            className="form-input" 
                                            rows="2"
                                            placeholder="Syy (esim. miksi ei soveltunut)... Tämä viesti ohjaa tekoälyä jatkossa."
                                            value={service.lisatieto || ''}
                                            onChange={(e) => handleFieldChange(service.id, 'lisatieto', e.target.value)}
                                            style={{ fontSize: '0.75rem', padding: '6px 6px 6px 28px', width: '100%', resize: 'vertical', borderColor: 'var(--color-warning)' }}
                                        />
                                    </div>
                                ) : (
                                    <input 
                                        type="text"
                                        className="form-input" 
                                        placeholder="Lisätiedot (valinnainen)..."
                                        value={service.lisatieto || ''}
                                        onChange={(e) => handleFieldChange(service.id, 'lisatieto', e.target.value)}
                                        style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ScraperServicesPanel;