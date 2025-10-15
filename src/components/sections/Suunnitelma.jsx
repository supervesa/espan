import React from 'react';
import { planData } from '../../data/planData';
// LISÄYS: Tuodaan uudet vakiot ja Checkbox-komponentti
import { YLEISET_SUUNNITELMA_FRAASIT } from '../../data/constants';
import Checkbox from '../Checkbox';

const Suunnitelma = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'suunnitelma');
    // LISÄYS: Otetaan käyttöön uusi onUpdateSuunnitelma -funktio
    const { onUpdateSuunnitelma, onUpdateCustomText } = actions;

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            <div className="options-container">
                {/* --- TÄMÄ OSIO ON MUUTETTU KOKONAAN --- */}
                {Object.values(YLEISET_SUUNNITELMA_FRAASIT).map(phrase => (
                    <Checkbox
                        key={phrase.id}
                        label={phrase.teksti}
                        // Tarkistetaan, onko fraasi valittu state.suunnitelma-objektissa
                        checked={state.suunnitelma?.[phrase.id]}
                        // Kutsutaan uutta action-funktiota, kun valinta muuttuu
                        onChange={(isChecked) => onUpdateSuunnitelma(phrase.id, isChecked)}
                    />
                ))}
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

export default Suunnitelma;