import React from 'react';
import { PhraseOption } from './PhraseOption'; // Oletetaan, että PhraseOption on samassa kansiossa

/**
 * Komponentti ammattikorttien valintojen renderöintiä varten.
 *
 * Props:
 * sectionId: Tämän osion ID (esim. 'koulutus_yrittajyys')
 * sectionState: Tämän osion tilaobjekti (esim. state.koulutus_yrittajyys)
 * korttiFraasit: Lista renderöitävistä korttifraaseista (valmiiksi suodatettu)
 * actions: Sisältää onSelect- ja onUpdateVariable-funktiot
 */
const Ammattikortit = ({ sectionId, sectionState, korttiFraasit, actions }) => {
    
    if (korttiFraasit.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    const renderCardPhrase = (phrase) => {
        // KORJATTU LOGIIKKA:
        // Ammattikortit ovat monivalintoja. Tila tarkistetaan suoraan avaimen perusteella.
        // esim. state.koulutus_yrittajyys['hygieniapassi'] === true
        const isSelected = !!sectionState?.[phrase.avainsana];

        return (
            <PhraseOption
                key={phrase.avainsana}
                phrase={phrase}
                // Annetaan PhraseOptionille tieto, että tämä osio tukee monivalintaa
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