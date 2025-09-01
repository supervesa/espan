import React, { useMemo } from 'react';

// Apukomponentti muuttujien syöttökentille
const VariableInput = ({ sectionId, phrase, variableKey, value, onUpdate, config }) => {
    const handleChange = (e) => onUpdate(sectionId, phrase.avainsana, variableKey, e.target.value);
    const id = `${sectionId}-${phrase.avainsana}-${variableKey}`;
    
    // Jos tyyppi on 'vakio', älä renderöi mitään input-kenttää.
    if (config.tyyppi === 'vakio') {
        return null;
    }

    const label = <label htmlFor={id}>{variableKey}</label>;
    if (config.tyyppi === 'numero') return <div className="variable-input">{label}<input type="number" id={id} value={value ?? ''} onChange={handleChange} /></div>;
    if (config.tyyppi === 'valinta') return <div className="variable-input">{label}<select id={id} value={value || config.oletus} onChange={handleChange}>{config.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>;
    return <div className="variable-input">{label}<input type="text" id={id} value={value || ''} placeholder={config.oletus || ''} onChange={handleChange} /></div>;
};

// Apukomponentti yhdelle fraasivaihtoehdolle
const PhraseOption = ({ phrase, section, isSelected, onSelect, onUpdateVariable, isRecommended }) => {
    const { id: sectionId, monivalinta } = section;
    const { avainsana } = phrase;

    // Näytetään koko teksti ilman lyhennyksiä
    const displayText = phrase.teksti.replace(/\[LOPPUTEKSTI\]/g, '...');
    
    const optionClasses = `
        phrase-option
        ${isSelected ? 'selected' : ''}
        ${isRecommended ? 'recommended' : ''}
    `;

    return (
        <div>
            <div onClick={() => onSelect(sectionId, avainsana, monivalinta)} className={optionClasses}>
                {isRecommended && <div className="recommendation-badge">Suositus</div>}
                <p style={{ whiteSpace: 'pre-line' }}>{displayText}</p>
            </div>
            {isSelected && phrase.muuttujat && (
                <div className="variables-container">
                    {Object.entries(phrase.muuttujat).map(([key, config]) => 
                        <VariableInput 
                            key={key} 
                            sectionId={sectionId} 
                            phrase={phrase} 
                            config={config} 
                            variableKey={key} 
                            value={isSelected.muuttujat?.[key]} 
                            onUpdate={onUpdateVariable} 
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// Pääkomponentti, joka renderöi yhden osion käyttöliittymän
export const SectionRenderer = ({ section, state, actions, recommendedKeyword }) => {
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    // Ei enää suodatusta tässä, pääkomponentti hoitaa sen
    const phrases = section.fraasit || [];
    
    return (
        <div className="section-container-content">
            <div className="options-container">
                {phrases.map(phrase => {
                    const isSelected = section.monivalinta 
                        ? state[section.id]?.[phrase.avainsana] 
                        : state[section.id]?.avainsana === phrase.avainsana ? state[section.id] : null;
                    
                    const isRecommended = phrase.avainsana === recommendedKeyword;

                    return (
                        <PhraseOption 
                            key={phrase.avainsana} 
                            phrase={phrase} 
                            section={section} 
                            isSelected={isSelected} 
                            onSelect={onSelect} 
                            onUpdateVariable={onUpdateVariable}
                            isRecommended={isRecommended}
                        />
                    );
                })}
            </div>
            <div className="custom-text-container">
                <label htmlFor={`custom-text-${section.id}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-${section.id}`} 
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-${section.id}`] || ''} 
                    onChange={(e) => onUpdateCustomText(section.id, e.target.value)} 
                />
            </div>
        </div>
    );
};
