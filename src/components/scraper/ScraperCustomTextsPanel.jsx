// --- src/components/scraper/ScraperCustomTextsPanel.jsx ---
import React from 'react';
import { FileText, Layers } from 'lucide-react';
import Checkbox from '../common/Checkbox';

const ScraperCustomTextsPanel = ({ customTexts, activeSections, onToggleSection, onUpdateText }) => {
    const populatedSections = Object.keys(customTexts);

    return (
        <div className="card-inner flex-grow">
            <h4 className="icon-heading" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                <FileText size={18} /> Vapaa teksti
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                Voit valita ruksaamalla mitkä vapaan tekstin osiot haluat tuoda uuteen suunnitelmaan, ja muokata tekstiä lennosta.
            </p>

            {populatedSections.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
                        <Layers size={14} style={{ marginRight: '0.25rem' }}/> Kohdevälilehdet:
                    </span>
                    {populatedSections.map(secKey => (
                        <span key={secKey} style={{ 
                            fontSize: '0.75rem', 
                            backgroundColor: activeSections[secKey] ? 'var(--color-bg-secondary)' : 'transparent', 
                            color: activeSections[secKey] ? 'inherit' : 'var(--color-text-muted)',
                            textDecoration: activeSections[secKey] ? 'none' : 'line-through',
                            opacity: activeSections[secKey] ? 1 : 0.6,
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            fontWeight: '500',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s'
                        }}>
                            {secKey.replace('_', ' ')}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex-col-gap">
                {populatedSections.length === 0 && (
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                        Kaikki teksti tunnistettiin vakiolauseiksi. Ei vapaata tekstiä.
                    </p>
                )}
                {Object.entries(customTexts).map(([section, text]) => (
                    <div key={section} style={{ opacity: activeSections[section] ? 1 : 0.5, transition: 'opacity 0.2s', backgroundColor: activeSections[section] ? 'transparent' : 'var(--color-bg-secondary)', padding: activeSections[section] ? '0' : '0.5rem', borderRadius: '4px' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Checkbox 
                                label={`Tuo välilehdelle: ${section.toUpperCase()}`}
                                checked={!!activeSections[section]}
                                onChange={() => onToggleSection(section)}
                            />
                        </div>
                        <textarea 
                            className="form-input" 
                            rows="4" 
                            value={text}
                            onChange={(e) => onUpdateText(section, e.target.value)}
                            disabled={!activeSections[section]} 
                            style={{ backgroundColor: !activeSections[section] ? 'var(--color-bg-tertiary)' : 'var(--color-background)' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScraperCustomTextsPanel;