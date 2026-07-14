// --- src/components/sections/tyokyky/ToimenpiteetJaPalvelut.jsx ---
import React from 'react';
import Checkbox from '../../common/Checkbox';
import { VariableInput } from '../../common/Inputs';
import AlertBox from '../../common/AlertBox';

// UUDET TUONNIT UI-KIRJASTOSTA:
import Card from '../../common/Card';
import Button from '../../common/Button';

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
        <div className="grid-cols-2 mt-4" style={{ alignItems: 'start', animation: 'fadeIn 0.3s ease' }}>
            
            {/* VASEN SARAKE: ASIAKKAAN TOIMENPITEET */}
            <Card title="Asiakkaan toimenpiteet">
                {toimenpiteet.length === 0 && (
                    <p className="text-sm text-secondary m-0">Ei toimenpiteitä saatavilla.</p>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {toimenpiteet.map(toim => {
                        const isSelected = valitut.includes(toim.avainsana);

                        return (
                            <div 
                                key={toim.avainsana} 
                                style={{ 
                                    backgroundColor: isSelected ? 'var(--color-bg-secondary, rgba(0,0,0,0.02))' : 'transparent', 
                                    padding: '0.5rem', 
                                    borderRadius: 'var(--border-radius)', 
                                    transition: 'all 0.2s' 
                                }}
                            >
                                <Checkbox 
                                    label={toim.lyhyt || toim.teksti} 
                                    checked={isSelected}
                                    onChange={() => handleToggle(toim)}
                                />
                                
                                {isSelected && toim.muuttujat && (
                                    <div style={{ marginLeft: '1.75rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {Object.entries(toim.muuttujat).map(([vKey, config]) => {
                                            
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
                                                    
                                                    {/* Pikatäyttö-napit toteutettu uudella yhtenäisellä Button-komponentilla! */}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {pikaValinnat.map((pika, idx) => {
                                                            const isPikaSelected = currentValue === pika;
                                                            return (
                                                                <Button
                                                                    key={idx}
                                                                    size="sm"
                                                                    variant={isPikaSelected ? 'primary' : 'secondary'}
                                                                    onClick={() => handleVarUpdate(toim.avainsana, vKey, pika)}
                                                                >
                                                                    {pika}
                                                                </Button>
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
            </Card>

            {/* OIKEA SARAKE: PALVELUOHJAUKSET */}
            <Card title="Palveluohjaukset (Asiantuntija)">
                {palveluohjaukset.length === 0 && (
                    <p className="text-sm text-secondary m-0">Ei palveluohjauksia saatavilla.</p>
                )}

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
                    <div className="mt-4">
                        <AlertBox type="info">
                            Muista tehdä lähete terveystarkastukseen ja huomioida tämä työnhakuvelvollisuuden alennuksissa, kunnes tarkastus on tehty.
                        </AlertBox>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ToimenpiteetJaPalvelut;