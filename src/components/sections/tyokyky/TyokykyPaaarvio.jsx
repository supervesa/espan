import React, { useEffect } from 'react';
import OptionGroup from '../../common/OptionGroup';
// UUDET TUONNIT:
import NumericSelector from '../../common/NumericSelector';
import Card from '../../common/Card';

const TyokykyPaaarvio = ({ state, actions, paavalinnat = [], arvioKysymykset = [] }) => {
    const { onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;
    
    const valittuAvainsana = state['custom-tyokyky_paavalinta'];

    const handleNumberClick = (id, val) => {
        const stateKey = `tyokyky_arvio_${id}`;
        onUpdateCustomText(stateKey, val);

        // 1. POISTETAAN VANHAT ARVOSANASIGNAALIT (ettei paneeliin jää vanhoja numeroita roikkumaan)
        for (let i = 1; i <= 10; i++) {
            onRemoveSignal?.(`Työkykyarvio:_${i}`);
        }
        
        // 2. LISÄTÄÄN UUSI DYNAAMINEN ARVOSANASIGNAALI
        onAddSignal?.(`Työkykyarvio:_${val}`);

        // 3. JÄRJESTELMÄN LAKISÄÄTEINEN SIGNAALI (≤ 5)
        if (parseInt(val, 10) <= 5) {
            onAddSignal?.('tyokyky_oma_arvio_matala');
        } else {
            // Tarkistetaan onko muilla kysymyksillä vielä matalia arvoja
            const onkoMuitaMatala = arvioKysymykset.some(q => 
                q.id !== id && parseInt(state[`custom-tyokyky_arvio_${q.id}`] || 10, 10) <= 5
            );
            if (!onkoMuitaMatala) {
                onRemoveSignal?.('tyokyky_oma_arvio_matala');
            }
        }
    };

    // --- UUSI LISÄYS: Synkronoidaan imurin tuoma "oma arvio" käyttöliittymään ---
    const scrapedOmaArvio = state['custom-tyokyky_oma_arvio'];
    useEffect(() => {
        if (scrapedOmaArvio && arvioKysymykset.length > 0) {
            // Otetaan kiinni arviointipatteriston ensimmäinen kysymys
            const firstQuestionId = arvioKysymykset[0].id;
            
            // Simuloidaan napin painallusta, jotta myös kaikki signaalit päivittyvät!
            handleNumberClick(firstQuestionId, scrapedOmaArvio);
            
            // Tyhjennetään siirtomuuttuja, jotta tämä ei jää luuppaamaan
            onUpdateCustomText('tyokyky_oma_arvio', '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrapedOmaArvio, arvioKysymykset]);
    // --------------------------------------------------------------------------

    const handlePaavalintaChange = (valittuOptio) => {
        const originalPhrase = paavalinnat.find(p => p.avainsana === valittuOptio.id);
        if (!originalPhrase) return;

        if (valittuAvainsana && onRemoveSignal) onRemoveSignal(valittuAvainsana);

        onUpdateCustomText('tyokyky_paavalinta', originalPhrase.avainsana);
        if (onAddSignal) onAddSignal(originalPhrase.avainsana);
    };

    const paavalintaOptions = paavalinnat.map(p => ({
        id: p.avainsana,
        label: p.lyhyt || p.teksti
    }));

    return (
        <Card title="Asiantuntijan arvio työkyvystä" className="mb-4">
            
            <OptionGroup 
                options={paavalintaOptions}
                selectedValue={valittuAvainsana}
                onChange={handlePaavalintaChange}
            />

            {valittuAvainsana === 'tyokyky_alentunut' && (
                <div className="mt-3" style={{ animation: 'fadeIn 0.3s ease' }}>
                    <label htmlFor="alentuma-kuvaus" className="text-sm fw-medium mb-1 block">
                        Kuvaus työkyvyn alentumasta:
                    </label>
                    <textarea 
                        id="alentuma-kuvaus" 
                        className="form-input"
                        rows="3" 
                        placeholder="Kirjaa tähän asiantuntijan havainnot tai asiakkaan kertomus alentumasta..."
                        value={state['custom-tyokyky_alentuma_kuvaus'] || ''} 
                        onChange={(e) => onUpdateCustomText('tyokyky_alentuma_kuvaus', e.target.value)} 
                    />
                </div>
            )}

            {arvioKysymykset.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <h3 className="text-md fw-semibold mb-3">Asiakkaan oma arvio työkyvystään (1-10)</h3>
                    {arvioKysymykset.map(q => {
                        const stateKey = `custom-tyokyky_arvio_${q.id}`;
                        const currentValue = state[stateKey];
                        return (
                            <NumericSelector
                                key={q.id}
                                label={q.teksti}
                                options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                                value={currentValue ? parseInt(currentValue, 10) : null}
                                onChange={(val) => handleNumberClick(q.id, val)}
                                className="mb-3"
                            />
                        );
                    })}
                </div>
            )}
        </Card>
    );
};

export default TyokykyPaaarvio;