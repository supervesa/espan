// --- src/components/scraper/ScraperVariablesPanel.jsx ---
import React from 'react';
import { Calendar, Briefcase, User, Lightbulb } from 'lucide-react';
import BooleanQuestion from '../common/BooleanQuestion';

const ScraperVariablesPanel = ({ variables, onUpdate }) => {
    return (
        <div className="panel-gray" style={{ margin: 0, padding: '1rem 1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--color-primary)"/> Poimitut erikoismuuttujat
            </h4>
            
            <div className="grid-cols-2-tight" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <label className="stat-label">Palvelu alkaa</label>
                    <input type="text" className="form-input text-mono" value={variables['palvelu_alku'] || ''} onChange={(e) => onUpdate('palvelu_alku', e.target.value)} />
                </div>
                <div>
                    <label className="stat-label">Palvelu päättyy</label>
                    <input type="text" className="form-input text-mono" value={variables['palvelu_loppu'] || ''} onChange={(e) => onUpdate('palvelu_loppu', e.target.value)} />
                </div>
                <div>
                    <label className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <User size={12} /> Äidinkieli
                    </label>
                    <input type="text" className="form-input" value={variables['aidinkieli'] || ''} onChange={(e) => onUpdate('aidinkieli', e.target.value)} />
                </div>
                <div>
                    <label className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Briefcase size={12} /> Tavoiteammatti (ESCO)
                    </label>
                    <input type="text" className="form-input" value={variables['tavoiteammatti_esco'] || ''} onChange={(e) => onUpdate('tavoiteammatti_esco', e.target.value)} />
                </div>
            </div>

            {/* UUSI: Yrittäjyys kytkettynä BooleanQuestion-komponenttiin */}
            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1rem' }}>
                 <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb size={16} color="var(--color-primary)"/> Yrittäjyys (Havaittu tekstistä)
                </h4>
                <BooleanQuestion 
                    label="Onko asiakas kiinnostunut yrittäjyydestä?"
                    value={variables['yrittajyys_kiinnostus'] === 'kylla'} 
                    onChange={(isYes) => onUpdate('yrittajyys_kiinnostus', isYes ? 'kylla' : 'ei')}
                />
            </div>
        </div>
    );
};

export default ScraperVariablesPanel;