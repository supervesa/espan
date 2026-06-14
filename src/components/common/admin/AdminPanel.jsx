import React from 'react';

const AdminPanel = ({ children, title, icon, variant = 'default', className = '' }) => {
    // variant 'bordered' antaa sen tyylikkään paksun reunan vasemmalle
    const baseClass = variant === 'bordered' ? 'side-bordered-panel' : 'card-inner';
    
    return (
        <div className={`${baseClass} ${className}`}>
            {title && (
                <h3 className="icon-heading">
                    {icon && <span>{icon}</span>}
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
};

export default AdminPanel;