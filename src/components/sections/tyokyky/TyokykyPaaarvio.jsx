// --- src/components/sections/tyokyky/TyokykyPaaarvio.jsx ---
import React, { useEffect } from 'react';
import OptionGroup from '../../common/OptionGroup';

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
        <div className="card-inner" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                Asiantuntijan arvio työkyvystä
            </h3>

            <OptionGroup 
                options={paavalintaOptions}
                selectedValue={valittuAvainsana}
                onChange={handlePaavalintaChange}
            />

            {valittuAvainsana === 'tyokyky_alentunut' && (
                <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease' }}>
                    <label htmlFor="alentuma-kuvaus" style={{ fontWeight: '500' }}>Kuvaus työkyvyn alentumasta:</label>
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
                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Asiakkaan oma arvio työkyvystään (1-10)</h3>
                    {arvioKysymykset.map(q => {
                        const stateKey = `custom-tyokyky_arvio_${q.id}`;
                        const currentValue = state[stateKey];
                        return (
                            <div key={q.id} style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{q.teksti}</label>
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                    {[...Array(10)].map((_, i) => {
                                        const num = i + 1;
                                        const isSelected = parseInt(currentValue, 10) === num;
                                        return (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => handleNumberClick(q.id, num)}
                                                style={{
                                                    padding: '0.5rem 0.8rem',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '4px',
                                                    backgroundColor: isSelected ? 'var(--color-primary)' : '#fff',
                                                    color: isSelected ? '#fff' : 'var(--color-text)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {num}
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
};

export default TyokykyPaaarvio;