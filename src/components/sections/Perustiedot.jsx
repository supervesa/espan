import React from 'react';
import { PhraseOption } from '../PhraseOption';

// HUOM! Vastaanottaa planData-propsin App.jsx:ltä
const Perustiedot = ({ state, actions, planData }) => {
    const sectionData = planData?.aihealueet?.find(s => s.id === 'suunnitelman_perustiedot');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    if (!sectionData) return null; // Varmistus, ettei kaadu ennen datan latautumista

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            <div className="options-container">
                {sectionData.fraasit.map(phrase => {
                    const isSelected = sectionData.monivalinta 
                        ? state[sectionData.id]?.[phrase.avainsana] 
                        : state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                    return (
                        <PhraseOption 
                            key={phrase.avainsana} 
                            phrase={phrase} 
                            section={sectionData} 
                            isSelected={isSelected} 
                            onSelect={onSelect} 
                            onUpdateVariable={onUpdateVariable} 
                        />
                    );
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

export default Perustiedot;