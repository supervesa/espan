import React from 'react';
// Import language levels from guide.js
import { kielitaitoTasot } from '../../data/guide';
import { planData } from '../../data/planData'; // Import planData for section title

const Kielitaso = ({ state, actions }) => {
    // Find section data for title etc.
    const sectionData = planData.aihealueet.find(s => s.id === 'kielitaso') || { otsikko: "Kielitaito" };
    const { onUpdateKielitaso, onUpdateCustomText } = actions;
    
    // Ensure default state structure is robust
    const kielitasoState = state.kielitaso || { aidinkieli: '', muutKielet: [{ kieli: 'Suomi', taso: '' }] };
    
    // Get the first language object (assuming Suomi)
    const suomiState = kielitasoState.muutKielet?.[0] || { kieli: 'Suomi', taso: '' };

    // Handler for mother tongue input
    const handleAidinkieliChange = (e) => {
        onUpdateKielitaso('updateAidinkieli', e.target.value);
    };

    // Handler for changes in the "other languages" section
    const handleMuutKieletChange = (index, field, value) => {
        // Only update Suomi at index 0 as per simplified logic
        if (index === 0) {
             onUpdateKielitaso('updateMuuKieli', { index, field, value });
        }
    };

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>

            {/* Mother tongue input */}
            <div className="language-row">
                <label htmlFor="aidinkieli">Äidinkieli:</label>
                <input
                    type="text"
                    id="aidinkieli"
                    value={kielitasoState.aidinkieli || ''}
                    onChange={handleAidinkieliChange}
                    placeholder="Esim. Ranska"
                />
            </div>

            {/* Section for other languages (Simplified for Suomi) */}
            <div className="subsection">
                <h3 className="subsection-title">Muut kielet</h3>
                <div className="language-row">
                     <label htmlFor="muu-kieli-0">{suomiState.kieli}:</label>
                     <select
                        id="muu-kieli-taso-0"
                        value={suomiState.taso || ''}
                        onChange={(e) => handleMuutKieletChange(0, 'taso', e.target.value)}
                     >
                        <option value="">Valitse työelämän osaamista kuvaava lause...</option>
                        
                        {/* KÄYTTÖLIITTYMÄMUUTOS:
                          - Käyttäjä näkee nyt 'selkokuvaus'-lauseen.
                          - 'value'-attribuutti tallentaa edelleen koneluettavan 'tasoKey' (esim. "A1.1").
                        */}
                        {Object.keys(kielitaitoTasot).map(tasoKey => (
                            <option key={tasoKey} value={tasoKey}>
                                {kielitaitoTasot[tasoKey].selkokuvaus}
                            </option>
                        ))}
                     </select>
                </div>
                 
                 {/* KÄYTTÖLIITTYMÄMUUTOS:
                   - Näytetään työntekijälle vahvistuksena, mikä luokitus valintaa vastaa.
                 */}
                 {suomiState.taso && kielitaitoTasot[suomiState.taso] && (
                    <p className='info-note'>
                        (Järjestelmään tallennettava luokitus: {suomiState.taso} - {kielitaitoTasot[suomiState.taso].nimi})
                    </p>
                 )}
            </div>

            {/* Custom text area (Vapaa kuvaus) */}
            <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id || 'kielitaso'}`}>Tarkempi kuvaus kielitaidosta (vapaa teksti):</label>
                <textarea
                    id={`custom-text-${sectionData.id || 'kielitaso'}`}
                    rows="3"
                    placeholder="Tähän voi kirjoittaa tarkempia havaintoja, esim. 'Ymmärtää puhetta hyvin, mutta oma tuottaminen on vaikeaa...'"
                    value={state[`custom-kielitaso`] || ''}
                    onChange={(e) => onUpdateCustomText('kielitaso', e.target.value)}
                />
            </div>
        </section>
    );
};

export default Kielitaso;