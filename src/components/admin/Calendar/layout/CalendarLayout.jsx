import React from 'react';
import Card from '../../../common/Card';
import { Calendar as CalendarIcon } from 'lucide-react';

const CalendarLayout = ({ header, children, title = "Kalenteri", icon = CalendarIcon }) => {
    return (
        <div className="calendar-layout-container" style={{ position: 'relative' }}>
            {/* Header / Navigointi */}
            <div className="calendar-layout-header">
                {header}
            </div>
            
            {/* Varsinainen kalenterikortti */}
            <Card title={title} icon={icon}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {children}
                </div>
            </Card>
        </div>
    );
};

export default CalendarLayout;