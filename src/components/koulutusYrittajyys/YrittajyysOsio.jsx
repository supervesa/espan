// --- src/components/koulutusYrittajyys/YrittajyysOsio.jsx ---
import React, { useEffect, useMemo } from 'react';
import { Briefcase, Info, CheckSquare } from 'lucide-react';

const VERKOSTOPALVELUT = [
    { id: 'business_helsinki', label: 'Business Helsinki' },
    { id: 'ely_yrityspalvelut', label: 'ELY-keskuksen yrityspalvelut' },
    { id: 'yrittajan_talousapu', label: 'Yrittäjän talousapu' },
    { id: 'tyosuojelu', label: 'Työsuojelu.fi' },
    { id: 'yrityssuomi', label: 'YritysSuomi' },
    { id: 'suomen_yrittajat', label: 'Suomen Yrittäjät' },
    { id: 'finnvera', label: 'Finnvera' },
    { id: 'business_finland', label: 'Business Finland' },
    { id: 'tyonantajaliitto', label: 'Työnantajaliitot' }
];

const YrittajyysOsio = ({ state, actions }) => {
    const { onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;
    
    // Tilojen luku
    const customKiinnostus = state['custom-yrittajyys_kiinnostus'] || '';
    const isKiinnostunut = customKiinnostus === 'kylla';
    
    const rawVerkostot = state['custom-yrittajyys_verkostot_valinnat'];
    const valitutVerkostot = rawVerkostot ? JSON.parse(rawVerkostot) : [];

    // Käsittelijä kiinnostuksen tilalle (Kyllä / Ei)
    const handleKiinnostusToggle = (tila) => {
        onUpdateCustomText('yrittajyys_kiinnostus', tila);
        
        if (tila === 'kylla') {
            if (onAddSignal) onAddSignal('yrittajyys_kiinnostus');
            onUpdateCustomText('yrittajyys_teksti', 'Asiakas on kiinnostunut yrittäjyydestä, mutta tarkempia verkostopalveluita ei ole vielä valittu.');
        } else {
            // Poistetaan pääsignaali
            if (onRemoveSignal) onRemoveSignal('yrittajyys_kiinnostus');
            
            // Siivotaan kaikki alasignaalit ja valinnat, jos asiakas muuttaa mielensä
            valitutVerkostot.forEach(id => {
                if (onRemoveSignal) onRemoveSignal(id);
            });
            onUpdateCustomText('yrittajyys_verkostot_valinnat', JSON.stringify([]));
            onUpdateCustomText('yrittajyys_teksti', 'Keskusteltiin yrittäjyydestä. Asiakas ei ole tässä vaiheessa kiinnostunut yritystoiminnan aloittamisesta.');
        }
    };

    // Käsittelijä yksittäisille verkostopalveluille
    const handleVerkostoToggle = (id) => {
        const isSelected = valitutVerkostot.includes(id);
        let uudetValinnat;
        
        if (isSelected) {
            uudetValinnat = valitutVerkostot.filter(v => v !== id);
            if (onRemoveSignal) onRemoveSignal(id);
        } else {
            uudetValinnat = [...valitutVerkostot, id];
            if (onAddSignal) onAddSignal(id); // Tämä lähettää tarkan signaalin jälkimarkkinoinnille!
        }
        
        onUpdateCustomText('yrittajyys_verkostot_valinnat', JSON.stringify(uudetValinnat));
        
        // Älykäs tekstingenerointi suunnitelmaan
        if (uudetValinnat.length > 0) {
            const nimet = uudetValinnat.map(vid => VERKOSTOPALVELUT.find(v => v.id === vid).label);
            
            // Yhdistetään nimet kauniisti suomeksi (esim. "A, B ja C")
            const nimetTekstina = nimet.join(', ').replace(/, ([^,]*)$/, ' ja $1');
            const teksti = `Asiakas on kiinnostunut yrittäjyydestä. Asiakasta on ohjattu tutustumaan seuraavien verkostotoimijoiden palveluihin: ${nimetTekstina}.`;
            
            onUpdateCustomText('yrittajyys_teksti', teksti);
        } else {
            onUpdateCustomText('yrittajyys_teksti', 'Asiakas on kiinnostunut yrittäjyydestä, mutta tarkempia verkostopalveluita ei ole vielä valittu.');
        }
    };

    return (
        <div className="subsection" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid var(--color-border)' }}>
            <h3 className="subsection-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={20} /> Yrittäjyys ja asiantuntijaverkostot
            </h3>

            {/* Pääkytkin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontWeight: 600 }}>Onko asiakas kiinnostunut yrittäjyydestä?</span>
                <div className="boolean-buttons">
                    <button 
                        className={customKiinnostus === 'kylla' ? 'selected' : ''} 
                        onClick={() => handleKiinnostusToggle('kylla')}
                    >Kyllä</button>
                    <button 
                        className={customKiinnostus === 'ei' ? 'selected' : ''} 
                        onClick={() => handleKiinnostusToggle('ei')}
                    >Ei tällä hetkellä</button>
                </div>
            </div>

            {/* Verkostokartta (Näkyy vain jos on kiinnostunut) */}
            {isKiinnostunut && (
                <div className="side-bordered-panel" style={{ borderLeftColor: 'var(--color-primary)', animation: 'fadeIn 0.3s ease' }}>
                    <div className="alert-box alert-box--info" style={{ marginBottom: '1.5rem', padding: '0.75rem' }}>
                        <Info size={18} />
                        <div>
                            <strong>Ohjaa oikeaan palveluun:</strong> Valitsemalla alla olevia palveluita, järjestelmä lisää ne automaattisesti asiakkaan suunnitelmaan ja liittää niiden materiaalit/linkit tapaamisen jälkeiseen sähköpostiin.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
                        {VERKOSTOPALVELUT.map(verkosto => (
                            <label 
                                key={verkosto.id} 
                                className="modern-checkbox-label" 
                                style={{ 
                                    backgroundColor: 'var(--color-surface)', 
                                    padding: '0.75rem', 
                                    borderRadius: '6px', 
                                    border: valitutVerkostot.includes(verkosto.id) ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <input 
                                    type="checkbox" 
                                    className="modern-checkbox" 
                                    checked={valitutVerkostot.includes(verkosto.id)}
                                    onChange={() => handleVerkostoToggle(verkosto.id)}
                                />
                                <span style={{ fontWeight: valitutVerkostot.includes(verkosto.id) ? 600 : 400 }}>
                                    {verkosto.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default YrittajyysOsio;