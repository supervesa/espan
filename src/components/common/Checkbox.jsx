import React from 'react';

const Checkbox = ({ label, checked, onChange }) => {
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

export default Checkbox;