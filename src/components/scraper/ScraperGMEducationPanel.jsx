import React from 'react';
import { GraduationCap, Trash2 } from 'lucide-react';

const ScraperGMEducationPanel = ({ educations = [], onUpdate, onRemove }) => {
    if (educations.length === 0) return null;

    const handleFieldChange = (id, field, value) => {
        const updated = educations.map(e => 
            e.id === id ? { ...e, data: { ...e.data, [field]: value } } : e
        );
        onUpdate(updated);
    };

    return (
        <div className="card-inner" style={{ borderLeft: '4px solid #10b981', padding: '1rem', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={18} color="#10b981" />
                Havaitut koulutukset (GM)
            </h4>
            
            <div className="flex-col-gap">
                {educations.map((edu) => (
                    <div key={edu.id} className="panel-gray" style={{ margin: 0, padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tutkinto / Koulutus</span>
                            <button onClick={() => onRemove(edu.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                        
                        <div className="flex-col-gap" style={{ gap: '6px' }}>
                            <input 
                                type="text" 
                                className="modern-select" 
                                style={{ fontSize: '0.75rem', padding: '6px' }}
                                placeholder="Tutkinnon tai koulutuksen nimi"
                                value={edu.data.tutkinto} 
                                onChange={(e) => handleFieldChange(edu.id, 'tutkinto', e.target.value)} 
                            />
                            <input 
                                type="text" 
                                className="modern-select" 
                                style={{ fontSize: '0.75rem', padding: '6px' }}
                                placeholder="Valmistumisvuosi (esim. 2018)"
                                value={edu.data.vuosi} 
                                onChange={(e) => handleFieldChange(edu.id, 'vuosi', e.target.value)} 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScraperGMEducationPanel;