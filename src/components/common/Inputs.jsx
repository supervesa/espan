import React from 'react';

// Geneerinen syöttökenttä muuttujille
export const VariableInput = ({ sectionId, avainsana, config, variableKey, value, onUpdate }) => {
    const handleChange = (e) => onUpdate(sectionId, avainsana, variableKey, e.target.value);
    const id = `${sectionId}-${avainsana}-${variableKey}`;

    if (config.tyyppi === 'numero') {
        return (
            <div>
                <label htmlFor={id}>{variableKey}</label>
                <input type="number" id={id} value={value ?? (config.oletus || '')} onChange={handleChange} />
            </div>
        );
    }
    if (config.tyyppi === 'valinta') {
        return (
            <div>
                <label htmlFor={id}>{variableKey}</label>
                <select id={id} value={value || config.oletus} onChange={handleChange}>
                    {config.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        );
    }
    return (
        <div>
            <label htmlFor={id}>{variableKey}</label>
            <input type="text" id={id} value={value || ''} placeholder={config.oletus || ''} onChange={handleChange} />
        </div>
    );
};
