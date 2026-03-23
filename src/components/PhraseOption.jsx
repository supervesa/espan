import React from 'react';

const VariableInput = ({ sectionId, avainsana, config, variableKey, value, onUpdate }) => {
    const handleChange = (e) => onUpdate(sectionId, avainsana, variableKey, e.target.value);
    const id = `${sectionId}-${avainsana}-${variableKey}`;
    const label = <label htmlFor={id}>{variableKey}</label>;
    
    const displayValue = value !== undefined ? value : (config.oletus || '');

    if (config.tyyppi === 'numero') return <div className="variable-input">{label}<input type="number" id={id} value={displayValue} onChange={handleChange} /></div>;
    if (config.tyyppi === 'valinta') return <div className="variable-input">{label}<select id={id} value={displayValue} onChange={handleChange}>{config.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>;
    return <div className="variable-input">{label}<input type="text" id={id} value={displayValue} placeholder={config.oletus || ''} onChange={handleChange} /></div>;
};

export const PhraseOption = ({ phrase, section, isSelected, onSelect, onUpdateVariable }) => {
    const { id: sectionId, monivalinta } = section;
    const { avainsana } = phrase;

    let displayTeksti = phrase.teksti;
    
    // Kerätään oikeat arvot talteen, jotta niitä voidaan käyttää sekä tulostuksessa että syöttökentissä
    const resolvedValues = {};

    if (phrase.muuttujat) {
        Object.entries(phrase.muuttujat).forEach(([key, config]) => {
            
            // TÄSSÄ ON TAIKA: Etsitään asiantuntijan syöttämää arvoa KAHDESTA ERI PAIKASTA
            // 1. Perustiedot käyttää tätä (isSelected.muuttujat)
            // 2. Työnhakuvelvollisuus käyttää tätä (config.value)
            let savedValue = undefined;
            
            if (isSelected?.muuttujat?.[key] !== undefined) {
                savedValue = isSelected.muuttujat[key];
            } else if (config.value !== undefined) {
                savedValue = config.value;
            }

            // Tallennetaan löydetty arvo muistiin apulaista varten
            resolvedValues[key] = savedValue;

            const finalValue = savedValue !== undefined && savedValue !== '' 
                ? savedValue 
                : (config.oletus || `[${key}]`);
            
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            displayTeksti = displayTeksti.replace(regex, finalValue);
        });
    }

    return (
        <div>
            <div 
                onClick={() => onSelect(sectionId, avainsana, monivalinta)} 
                className={`phrase-option ${isSelected ? 'selected' : ''}`}
            >
                <p style={{ whiteSpace: 'pre-line' }}>{displayTeksti}</p>
            </div>
            {isSelected && phrase.muuttujat && (
                <div className="variables-container">
                    {Object.entries(phrase.muuttujat).map(([key, config]) => 
                        <VariableInput 
                            key={key} 
                            sectionId={sectionId} 
                            avainsana={avainsana} 
                            config={config} 
                            variableKey={key} 
                            // Syötetään apulaiselle se arvo, joka löydettiin kummalta tahansa puolelta
                            value={resolvedValues[key]} 
                            onUpdate={onUpdateVariable} 
                        />
                    )}
                </div>
            )}
        </div>
    );
};