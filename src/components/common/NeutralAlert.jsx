import React from 'react';
import { Info } from 'lucide-react';

const NeutralAlert = ({ icon: Icon = Info, title, children, className = '' }) => {
    return (
        <div 
            className={`alert-box ${className}`} 
            style={{ 
                backgroundColor: 'var(--color-info-bg)', 
                borderColor: 'var(--color-info-border)', 
                color: 'var(--color-info-dark)',
                borderWidth: '1px',
                borderStyle: 'solid'
            }}
        >
            <div className="alert-box-content">
                <Icon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-info-text)' }} />
                <div className="text-sm lh-tight">
                    {title && (
                        <span className="fw-bold" style={{ display: 'block', marginBottom: '0.25rem' }}>
                            {title}
                        </span>
                    )}
                    <span>{children}</span>
                </div>
            </div>
        </div>
    );
};

export default NeutralAlert;