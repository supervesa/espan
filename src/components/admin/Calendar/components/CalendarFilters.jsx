import React from 'react';
import { Filter } from 'lucide-react';

const FilterChip = ({ label, active, onClick, color, activeBg }) => (
    <button 
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '16px', border: `1px solid ${active ? color : 'var(--color-border)'}`,
            backgroundColor: active ? activeBg : 'var(--color-surface)',
            color: active ? color : 'var(--color-text-secondary)',
            fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s ease'
        }}
    >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: active ? color : 'var(--color-border)' }} />
        {label}
    </button>
);

const CalendarFilters = ({ filters, setFilters }) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-background)', padding: '4px 8px', borderRadius: '24px', border: '1px solid var(--color-border)' }}>
            <Filter size={14} color="var(--color-text-secondary)" style={{ marginLeft: '4px' }} />
            <FilterChip 
                label="Säännöt" active={filters.rules} 
                onClick={() => setFilters(f => ({...f, rules: !f.rules}))} 
                color="var(--color-primary)" activeBg="rgba(255,107,0,0.08)" 
            />
            <FilterChip 
                label="Varaukset" active={filters.exceptions} 
                onClick={() => setFilters(f => ({...f, exceptions: !f.exceptions}))} 
                color="var(--color-success)" activeBg="rgba(30,154,90,0.08)" 
            />
            <FilterChip 
                label="ICS (Outlook)" active={filters.ics} 
                onClick={() => setFilters(f => ({...f, ics: !f.ics}))} 
                color="#8b5cf6" activeBg="rgba(139,92,246,0.08)" 
            />
        </div>
    );
};

export default CalendarFilters;