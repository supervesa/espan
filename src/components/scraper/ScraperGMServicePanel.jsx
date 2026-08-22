import React from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';
import { ENTITY_DEFINITIONS } from '../../data/entityDefinitions';

const ScraperGMServicePanel = ({ services = [], onUpdate, onRemove }) => {
    if (services.length === 0) return null;

    const handleFieldChange = (id, field, value) => {
        const updated = services.map(s => 
            s.id === id ? { ...s, data: { ...s.data, [field]: value } } : s
        );
        onUpdate(updated);
    };

    return (
        <div className="card-inner" style={{ borderLeft: '4px solid var(--color-primary)', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarClock size={18} className="text-primary" />
                Tunnistetut jaksot (GM)
            </h4>
            
            <div className="flex-col-gap">
                {services.map((s) => {
                    const def = ENTITY_DEFINITIONS[s.entity_key];
                    // Jos palvelua ei tunnisteta, käytetään turvallista oletusta
                    const fields = def?.fields || { alku: 'date', loppu: 'date', nimi: 'text' };

                    return (
                        <div key={s.id} className="panel-gray" style={{ margin: 0, padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {def?.label || s.entity_key}
                                </span>
                                <button onClick={() => onRemove(s.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Nimi / Järjestäjä / Kohde -kenttä (Suluista uutettu tieto) */}
                            <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '2px', display: 'block', marginBottom: '2px' }}>
                                    Järjestäjä / Kohde
                                </label>
                                <input 
                                    type="text" 
                                    className="modern-select" 
                                    style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                    placeholder="Nimi / Järjestäjä"
                                    value={s.data.nimi || s.data.jarjestaja || s.data.tyonantaja || s.data.oppilaitos || ''} 
                                    onChange={(e) => handleFieldChange(s.id, 'nimi', e.target.value)} 
                                />
                            </div>

                            {/* Päivämäärät selkeillä pikkutunnisteilla */}
                            <div className="grid-cols-2-tight" style={{ marginBottom: (fields.paivatViikossa || fields.tunnitPaivassa) ? '8px' : '0' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '2px', display: 'block', marginBottom: '2px' }}>
                                        Alkaa
                                    </label>
                                    <input 
                                        type="text" 
                                        className="modern-select" 
                                        style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                        placeholder="pp.kk.vvvv"
                                        value={s.data.alku || ''} 
                                        onChange={(e) => handleFieldChange(s.id, 'alku', e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '2px', display: 'block', marginBottom: '2px' }}>
                                        Päättyy
                                    </label>
                                    <input 
                                        type="text" 
                                        className="modern-select" 
                                        style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                        placeholder="pp.kk.vvvv"
                                        value={s.data.loppu || ''} 
                                        onChange={(e) => handleFieldChange(s.id, 'loppu', e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* DYNAAMISET LISÄKENTÄT (Esim. Kuntouttavan työtoiminnan laajuus) selkeillä otsikoilla */}
                            {(fields.paivatViikossa || fields.tunnitPaivassa) && (
                                <div className="grid-cols-2-tight">
                                    {fields.paivatViikossa && (
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '2px', display: 'block', marginBottom: '2px', fontWeight: '500' }}>
                                                Pv / viikko
                                            </label>
                                            <input 
                                                type="text" 
                                                className="modern-select" 
                                                style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                                placeholder="Esim. 3"
                                                value={s.data.paivatViikossa || ''} 
                                                onChange={(e) => handleFieldChange(s.id, 'paivatViikossa', e.target.value)} 
                                            />
                                        </div>
                                    )}
                                    {fields.tunnitPaivassa && (
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '2px', display: 'block', marginBottom: '2px', fontWeight: '500' }}>
                                                Tuntia / päivä
                                            </label>
                                            <input 
                                                type="text" 
                                                className="modern-select" 
                                                style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                                placeholder="Esim. 4"
                                                value={s.data.tunnitPaivassa || ''} 
                                                onChange={(e) => handleFieldChange(s.id, 'tunnitPaivassa', e.target.value)} 
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ScraperGMServicePanel;