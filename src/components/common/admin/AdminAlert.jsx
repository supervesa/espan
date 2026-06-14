import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

const AdminAlert = ({ children, type = 'info', className = '' }) => {
    let typeClass = 'alert-box';
    let defaultIcon = <Info size={18} />;

    if (type === 'warning') {
        typeClass = 'alert-box alert-box--warning';
        defaultIcon = <AlertCircle size={18} />;
    } else if (type === 'danger') {
        typeClass = 'alert-box alert-box--danger';
        defaultIcon = <AlertCircle size={18} />;
    } else if (type === 'ai') {
        typeClass = 'alert-box alert-box--ai';
        defaultIcon = <Sparkles size={18} color="var(--color-ai)" />;
    }

    return (
        <div className={`${typeClass} ${className}`}>
            <div className="alert-box-content">
                <div className="alert-box-icon">{defaultIcon}</div>
                <div className="alert-box-text" style={{ width: '100%' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AdminAlert;