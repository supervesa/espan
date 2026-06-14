import React from 'react';

const SmartInput = ({ label, icon, type = 'text', value, onChange, disabled, placeholder, options, mono, className = '', addon }) => {
    const inputClass = `form-input ${mono ? 'text-mono' : ''}`;

    return (
        <div className={className} style={{ marginBottom: '1rem' }}>
            {label && (
                <label className="icon-label">
                    {icon && <span>{icon}</span>}
                    {label}
                </label>
            )}
            
            {type === 'select' ? (
                <select className="modern-select" value={value} onChange={onChange} disabled={disabled}>
                    {options && options.map((opt, i) => (
                        <option key={i} value={typeof opt === 'object' ? opt.value : opt}>
                            {typeof opt === 'object' ? opt.label : opt}
                        </option>
                    ))}
                </select>
            ) : type === 'textarea' ? (
                <textarea className={inputClass} rows="4" value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} />
            ) : (
                <input type={type} className={inputClass} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} />
            )}

            {addon && <div style={{ marginTop: '0.25rem' }}>{addon}</div>}
        </div>
    );
};

export default SmartInput;