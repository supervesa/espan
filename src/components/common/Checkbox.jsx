// --- src/components/common/Checkbox.jsx ---
import React from 'react';

// --- UUSI VERSIO (Espan-teemaan sidottu) ---
const Checkbox = ({ label, checked, onChange }) => {
    // Yksilöllinen id saavutettavuutta varten
    const checkboxId = `checkbox-${label.replace(/\s+/g, '-')}`;

    return (
        // Käytetään espan2.css:n valmista custom-checkbox-row -luokkaa ja kääritään input labelin sisään
        <label className="custom-checkbox-row" htmlFor={checkboxId}>
            <input
                type="checkbox"
                id={checkboxId}
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            {label}
        </label>
    );
};

export default Checkbox;

/*
=========================================
VARMUUSKOPIO VANHASTA VERSIOSTA (Alkuperäinen)
=========================================

const Checkbox_OLD = ({ label, checked, onChange }) => {
    // Yksilöllinen id saavutettavuutta varten
    const checkboxId = `checkbox-${label.replace(/\s+/g, '-')}`;

    return (
        <div className="checkbox-container">
            <input
                type="checkbox"
                id={checkboxId}
                checked={!!checked} // Varmistetaan, että arvo on aina boolean
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={checkboxId}>{label}</label>
        </div>
    );
};
*/