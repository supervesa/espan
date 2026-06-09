import React from 'react';

const RangeSlider = ({ min = 0, max = 10, value, onChange, defaultValue = 5 }) => {
    const displayValue = value !== undefined ? value : defaultValue;
    
    return (
        <div className="slider-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginBottom: '1rem' }}>
            <span style={{ 
                fontWeight: 'bold', fontSize: '1.2rem', minWidth: '2.5rem', textAlign: 'center', 
                backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)',
                padding: '0.25rem', borderRadius: '4px'
            }}>
                {displayValue}
            </span>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={displayValue} 
                onChange={(e) => onChange(e.target.value)}
                style={{ flexGrow: 1, cursor: 'pointer' }}
            />
        </div>
    );
};

export default RangeSlider;