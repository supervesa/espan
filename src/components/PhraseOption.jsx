import React from 'react';

const VariableInput = ({ sectionId, avainsana, config, variableKey, value, onUpdate }) => {
    const handleChange = (e) => onUpdate(sectionId, avainsana, variableKey, e.target.value);
    const id = `${sectionId}-${avainsana}-${variableKey}`;
    const label = <label htmlFor={id}>{variableKey}</label>;
    if (config.tyyppi === 'numero') return <div className="variable-input">{label}<input type="number" id={id} value={value ?? (config.oletus || '')} onChange={handleChange} /></div>;
    if (config.tyyppi === 'valinta') return <div className="variable-input">{label}<select id={id} value={value || config.oletus} onChange={handleChange}>{config.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>;
    return <div className="variable-input">{label}<input type="text" id={id} value={value || ''} placeholder={config.oletus || ''} onChange={handleChange} /></div>;
};

export const PhraseOption = ({ phrase, section, isSelected, onSelect, onUpdateVariable }) => {
    const { id: sectionId, monivalinta } = section;
    const { avainsana } = phrase;

    return (
        <div>
            <div 
                onClick={() => onSelect(sectionId, avainsana, monivalinta)} 
                className={`phrase-option ${isSelected ? 'selected' : ''}`}
            >
                <p style={{ whiteSpace: 'pre-line' }}>{phrase.teksti}</p>
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
                            value={isSelected.muuttujat?.[key]} 
                            onUpdate={onUpdateVariable} 
                        />
                    )}
                </div>
            )}
        </div>
    );
};
