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
                {services.map((s) => (
                    <div key={s.id} className="panel-gray" style={{ margin: 0, padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {ENTITY_DEFINITIONS[s.entity_key]?.label || s.entity_key}
                            </span>
                            <button onClick={() => onRemove(s.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Nimi / Oppilaitos -kenttä (Esim. "luulaja") */}
                        <div style={{ marginBottom: '8px' }}>
                            <input 
                                type="text" 
                                className="modern-select" 
                                style={{ fontSize: '0.75rem', padding: '6px', width: '100%' }}
                                placeholder="Nimi / Oppilaitos"
                                value={s.data.nimi || ''} 
                                onChange={(e) => handleFieldChange(s.id, 'nimi', e.target.value)} 
                            />
                        </div>

                        {/* Päivämäärät */}
                        <div className="grid-cols-2-tight">
                            <input 
                                type="text" 
                                className="modern-select" 
                                style={{ fontSize: '0.75rem', padding: '6px' }}
                                placeholder="Alku"
                                value={s.data.alku || ''} 
                                onChange={(e) => handleFieldChange(s.id, 'alku', e.target.value)} 
                            />
                            <input 
                                type="text" 
                                className="modern-select" 
                                style={{ fontSize: '0.75rem', padding: '6px' }}
                                placeholder="Loppu"
                                value={s.data.loppu || ''} 
                                onChange={(e) => handleFieldChange(s.id, 'loppu', e.target.value)} 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScraperGMServicePanel;