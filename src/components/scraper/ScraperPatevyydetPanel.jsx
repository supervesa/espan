// --- src/components/scraper/ScraperPatevyydetPanel.jsx ---
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import Tag from '../common/Tag'; // Tuodaan yhteinen Tag-komponentti!

const ScraperPatevyydetPanel = ({ patevyydet = [], onRemove }) => {
    if (!patevyydet || patevyydet.length === 0) return null;

    return (
        <div className="card-inner" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-dark)' }}>
                <ShieldCheck size={18} /> Tunnistetut Ammattikortit / Pätevyydet
            </h4>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {patevyydet.map((kortti, idx) => (
                    <Tag 
                        key={kortti.id || idx} 
                        type="primary" 
                        onRemove={() => onRemove(kortti.id)}
                    >
                        {kortti.nimi}
                    </Tag>
                ))}
            </div>
            
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Nämä lisätään suoraan Koulutus ja yrittäjyys -välilehden valittuihin pätevyyksiin.
            </p>
        </div>
    );
};

export default ScraperPatevyydetPanel;