import React from 'react';
import Button from './Button';

/**
 * Numeerinen valitsin, joka hyödyntää olemassa olevaa Button-komponenttia.
 * Sopii erityisen hyvin sivupalkkiin, koska asettelee napit joustavasti.
 */
const NumericSelector = ({ 
    label, 
    options = [0, 1, 2, 3, 5], 
    value, 
    onChange, 
    className = '' 
}) => {
    
    return (
        <div className={`numeric-selector-container ${className}`} style={{ marginBottom: '1rem' }}>
            {label && (
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {label}
                </label>
            )}
            
            <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem' 
            }}>
                {options.map((option) => (
                    <Button
                        key={option}
                        size="sm"
                        // Jos arvo on valittu, käytetään primary (gradient), muuten secondary
                        variant={value === option ? 'primary' : 'secondary'}
                        onClick={() => onChange(option)}
                        style={{ minWidth: '40px' }} // Varmistetaan riittävä klikkausalue
                    >
                        {option}
                    </Button>
                ))}
            </div>
        </div>
    );
};

export default NumericSelector;