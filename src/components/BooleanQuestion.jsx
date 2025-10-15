import React from 'react';

const BooleanQuestion = ({ label, value, onChange }) => (
    <div>
        <label>{label}</label>
        <div className="boolean-buttons">
            <button
                onClick={() => onChange(true)}
                className={value === true ? 'selected' : ''}
            >
                Kyllä
            </button>
            <button
                onClick={() => onChange(false)}
                className={value === false ? 'selected' : ''}
            >
                Ei
            </button>
        </div>
    </div>
);

export default BooleanQuestion;