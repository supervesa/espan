// --- src/components/sections/tyokyky/ToimenpiteetJaPalvelut.jsx ---
import React from 'react';
import Checkbox from '../../common/Checkbox';
import { VariableInput } from '../../common/Inputs';
import AlertBox from '../../common/AlertBox';

const ToimenpiteetJaPalvelut = ({ state, actions, palveluohjaukset = [], toimenpiteet = [] }) => {
    const { onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;
    
    // Luetaan tallennettu tila
    let valitut = [];
    try {
        if (state['custom-tyokyky_valitut_extrat']) {
            valitut = JSON.parse(state['custom-tyokyky_valitut_extrat']);
        }
    } catch(e) {}

    const handleToggle = (phrase) => {
        const isSelected = valitut.includes(phrase.avainsana);
        let uudetValitut;

        if (isSelected) {
            uudetValitut = valitut.filter(v => v !== phrase.avainsana);
            if (onRemoveSignal) onRemoveSignal(phrase.avainsana);
        } else {
            uudetValitut = [...valitut, phrase.avainsana];
            if (onAddSignal) onAddSignal(phrase.avainsana);
        }

        onUpdateCustomText('tyokyky_valitut_extrat', JSON.stringify(uudetValitut));
    };

    // Apufunktio muuttujien tallennukseen
    const handleVarUpdate = (phraseId, varKey, value) => {
        const fullKey = `tyokyky_var_${phraseId}_${varKey}`;
        onUpdateCustomText(fullKey, value);
    };

    // Oletuspikatäytöt, jos tietokannassa ei ole määritelty vaihtoehtoja
    const defaultPikaValinnat = [
        "Suunnitelman aikana",
        "Viimeistään suunnitelman voimassa olon aikana",
        "Mahdollisimman pian",
        "1 kk kuluessa"
    ];

    return (
        <div className="grid-cols-2" style={{ marginTop: '1.5rem', alignItems: 'start', animation: 'fadeIn 0.3s ease' }}>
            
            {/* VASEN SARAKE: ASIAKKAAN TOIMENPITEET */}
            <div className="card-inner" style={{ padding: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    Asiakkaan toimenpiteet
                </h3>
                
                {toimenpiteet.length === 0 && <p className="stat-label">Ei toimenpiteitä saatavilla.</p>}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {toimenpiteet.map(toim => {
                        const isSelected = valitut.includes(toim.avainsana);

                        return (
                            <div key={toim.avainsana} style={{ backgroundColor: isSelected ? 'var(--color-bg-secondary)' : 'transparent', padding: '0.5rem', borderRadius: '4px', transition: 'all 0.2s' }}>
                                <Checkbox 
                                    label={toim.lyhyt || toim.teksti} 
                                    checked={isSelected}
                                    onChange={() => handleToggle(toim)}
                                />
                                
                                {isSelected && toim.muuttujat && (
                                    <div style={{ marginLeft: '1.75rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {Object.entries(toim.muuttujat).map(([vKey, config]) => {
                                            
                                            // Tarkistetaan onko tietokannassa määritelty vaihtoehtoja (options-sarake)
                                            // Jos ei ole, tarjoillaan vakiolista ajankohdille
                                            const pikaValinnat = (config.vaihtoehdot && config.vaihtoehdot.length > 0) 
                                                ? config.vaihtoehdot 
                                                : defaultPikaValinnat;

                                            const currentValue = state[`custom-tyokyky_var_${toim.avainsana}_${vKey}`] || '';

                                            return (
                                                <div key={vKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <VariableInput
                                                        sectionId="tyokyky"
                                                        avainsana={toim.avainsana}
                                                        variableKey={vKey}
                                                        config={config}
                                                        value={currentValue}
                                                        onUpdate={(secId, av, varKey, val) => handleVarUpdate(av, varKey, val)}
                                                    />
                                                    
                                                    {/* Pikatäyttö-napit */}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                        {pikaValinnat.map((pika, idx) => {
                                                            const isPikaSelected = currentValue === pika;
                                                            return (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => handleVarUpdate(toim.avainsana, vKey, pika)}
                                                                    style={{ 
                                                                        padding: '0.25rem 0.6rem', 
                                                                        fontSize: '0.75rem', 
                                                                        borderRadius: '12px',
                                                                        backgroundColor: isPikaSelected ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                                                        color: isPikaSelected ? '#fff' : 'var(--color-text-secondary)',
                                                                        border: '1px solid',
                                                                        borderColor: isPikaSelected ? 'var(--color-primary)' : 'var(--color-border)',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    {pika}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* OIKEA SARAKE: PALVELUOHJAUKSET */}
            <div className="card-inner" style={{ padding: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    Palveluohjaukset (Asiantuntija)
                </h3>
                
                {palveluohjaukset.length === 0 && <p className="stat-label">Ei palveluohjauksia saatavilla.</p>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {palveluohjaukset.map(palvelu => {
                        const isSelected = valitut.includes(palvelu.avainsana);
                        
                        return (
                            <div key={palvelu.avainsana}>
                                <Checkbox 
                                    label={palvelu.lyhyt || palvelu.teksti} 
                                    checked={isSelected}
                                    onChange={() => handleToggle(palvelu)}
                                />
                            </div>
                        );
                    })}
                </div>

                {valitut.includes('ohjaus_terveystarkastus') && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <AlertBox type="info">
                            Muista tehdä lähete terveystarkastukseen ja huomioida tämä työnhakuvelvollisuuden alennuksissa, kunnes tarkastus on tehty.
                        </AlertBox>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ToimenpiteetJaPalvelut;