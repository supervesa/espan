// --- src/components/common/SummaryRow.jsx ---
import React from 'react';

const SummaryRow = ({ icon: Icon, iconColor = 'var(--color-text-secondary)', label, value, borderTop = true }) => {
    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontSize: '0.85rem', 
            borderTop: borderTop ? '1px dashed var(--color-border)' : 'none', 
            paddingTop: borderTop ? '0.75rem' : '0',
            marginTop: borderTop ? '0.75rem' : '0'
        }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
                {Icon && <Icon size={16} color={iconColor} />} 
                {label}
            </span>
            <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{value}</span>
        </div>
    );
};

export default SummaryRow;