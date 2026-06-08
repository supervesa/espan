import React from 'react';
import { AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';

const AlertBox = ({ type = 'info', children, customStyle = {} }) => {
    let Icon = Info;
    let typeClass = '';

    switch (type) {
        case 'danger':
            Icon = AlertCircle;
            typeClass = 'alert-box--danger';
            break;
        case 'success':
            Icon = CheckCircle;
            typeClass = 'alert-box--success'; 
            break;
        case 'warning':
            Icon = AlertTriangle;
            typeClass = 'alert-box--warning';
            break;
        default:
            Icon = Info;
            // Oletus info-boksi
            typeClass = '';
            break;
    }

    return (
        <div className={`alert-box ${typeClass}`} style={customStyle}>
            <div className="alert-box-content">
                <Icon size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="alert-box-text">{children}</span>
            </div>
        </div>
    );
};

export default AlertBox;