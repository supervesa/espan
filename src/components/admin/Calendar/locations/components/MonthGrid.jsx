import React, { useState } from 'react';
import DayCell from './DayCell';

const MonthGrid = ({ calendarDays, currentMonthStart, data, actions }) => {
    const [activePopover, setActivePopover] = useState(null);

    return (
        // KORJAUS: Poistettiin overflow: 'hidden', jotta Popover pääsee kalenterin reunojen yli
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-surface)' }}>
            
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-border)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'].map(day => (
                    <div key={day} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(80px, auto)' }}>
                {calendarDays.map((date, idx) => (
                    <DayCell 
                        key={idx} 
                        date={date} 
                        currentMonthStart={currentMonthStart}
                        data={data}
                        actions={actions}
                        activePopover={activePopover}
                        setActivePopover={setActivePopover}
                        isRightEdge={(idx + 1) % 7 === 0}
                    />
                ))}
            </div>
        </div>
    );
};
export default MonthGrid;