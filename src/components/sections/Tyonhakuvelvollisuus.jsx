import React, { useMemo } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';

const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyonhakuvelvollisuus');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    // Yksinkertaistettu logiikka kaatumisen estämiseksi
    const analysis = useMemo(() => {
        // Tähän voidaan myöhemmin palauttaa älykäs analyysi
        return {
            conditions: [],
            proposalText: "Valitse sopiva työnhakuvelvollisuus.",
            recommendedKeyword: null
        };
    }, [state]);

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
             <div className="analysis-box">
                <div className="analysis-header">Analyysi ja ehdotus</div>
                <div className="analysis-content">
                     <p className="ehdotus">{analysis.proposalText}</p>
                </div>
            </div>
            <div className="options-container">
                {sectionData.fraasit.map(phrase => {
                    const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                    return <PhraseOption 
                        key={phrase.avainsana}
                        phrase={phrase} 
                        section={sectionData} 
                        isSelected={isSelected} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                    />;
                })}
            </div>
            <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-${sectionData.id}`} 
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-${sectionData.id}`] || ''} 
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Tyonhakuvelvollisuus;
