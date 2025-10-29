import React from 'react';
import { PhraseOption } from '../PhraseOption'; // Tuodaan ylemmältä tasolta

/**
 * Komponentti yksittäisen osion renderöintiin, joka tukee YKSIVALINTOJA (radio).
 * Esim. Koulutus tai Yrittäjyys.
 */
const RadioPhraseSection = ({ title, phrases, sectionId, sectionState, actions }) => {
    
    if (!phrases || phrases.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    const renderRadioPhrase = (phrase) => {
        // YKSIVALINTA-logiikka: tarkistetaan, onko fraasin avainsana se,
        // joka on tallennettu osion stateen.
        const isSelected = sectionState?.avainsana === phrase.avainsana ? sectionState : null;

        return (
            <PhraseOption
                key={phrase.avainsana}
                phrase={phrase}
                // Pakotetaan PhraseOption käyttämään yksivalinta-logiikkaa
                section={{ id: sectionId, monivalinta: false }}
                isSelected={isSelected}
                onSelect={onSelect}
                onUpdateVariable={onUpdateVariable}
            />
        );
    };

    return (
        <div className="subsection">
            <h3 className="subsection-title">{title}</h3>
            <div className="options-container">
                {phrases.map(renderRadioPhrase)}
            </div>
        </div>
    );
};

export default RadioPhraseSection;
