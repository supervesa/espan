import React from 'react';
import { PhraseOption } from '../PhraseOption'; 

const Ammattikortit = ({ sectionId, sectionState, korttiFraasit, actions }) => {
    
    if (!korttiFraasit || korttiFraasit.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    const renderCardPhrase = (phrase) => {
        const isSelected = !!sectionState?.[phrase.avainsana];

        return (
            <PhraseOption
                key={phrase.avainsana}
                phrase={phrase}
                // --- TÄRKEÄ MUUTOS ---
                // Kerrotaan PhraseOptionille, että tämä on monivalintaosio
                section={{ id: sectionId, monivalinta: true }} 
                isSelected={isSelected}
                onSelect={onSelect}
                onUpdateVariable={onUpdateVariable}
            />
        );
    };

    return (
        <div className="options-container card-options">
            <h4 className="subsection-subtitle" style={{ width: '100%', marginBottom: '0.5rem' }}>Ammattikortit</h4>
            {korttiFraasit.map(renderCardPhrase)}
        </div>
    );
};

export default Ammattikortit;