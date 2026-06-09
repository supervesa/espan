import React from 'react';

const OptionGroup = ({ options, selectedValue, onChange }) => {
    return (
        <div className="options-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {options.map(opt => {
                const isSelected = selectedValue === opt.id;
                return (
                    <div 
                        key={opt.id} 
                        onClick={() => onChange(opt)} 
                        className={`phrase-option ${isSelected ? 'selected' : ''}`}
                        style={{ cursor: 'pointer' }}
                    >
                        {opt.label}
                    </div>
                );
            })}
        </div>
    );
};

export default OptionGroup;