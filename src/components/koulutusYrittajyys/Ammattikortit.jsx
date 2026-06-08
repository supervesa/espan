import React from 'react';
import { PhraseOption } from '../PhraseOption'; 

const Ammattikortit = ({ sectionId, sectionState, korttiFraasit, actions }) => {
    
    if (!korttiFraasit || korttiFraasit.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    return (
        <div className="options-container card-options">
            <h4 className="subsection-subtitle" style={{ width: '100%', marginBottom: '0.5rem' }}>
                Ammattikortit
            </h4>
            {korttiFraasit.map((kortti) => {
                // Käytetään kortin avainsanaa (phrase_key) tilan tarkistamiseen,
                // koska monivalinnat tallennetaan state[UI_KORTIT][avainsana]
                const isSelected = !!sectionState?.[kortti.avainsana];

                return (
                    <PhraseOption
                        key={kortti.id}
                        phrase={kortti} // Kortti sisältää jo index.jsx:ssä mapatut avainsana, teksti, jne.
                        section={{ id: sectionId, monivalinta: true }} 
                        isSelected={isSelected}
                        onSelect={onSelect}
                        onUpdateVariable={onUpdateVariable}
                    />
                );
            })}
        </div>
    );
};

export default Ammattikortit;