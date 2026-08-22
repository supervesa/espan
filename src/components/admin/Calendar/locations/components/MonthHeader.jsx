import React from 'react';
import Button from '../../../../common/Button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const MonthHeader = ({ currentMonthStart, onNext, onPrev, onToday }) => {
    const monthNames = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];
    const monthName = monthNames[currentMonthStart.getMonth()];
    const year = currentMonthStart.getFullYear();

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Button variant="ghost" icon={ChevronLeft} onClick={onPrev} style={{ padding: '6px' }} />
                <div style={{ minWidth: '150px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                    {monthName} {year}
                </div>
                <Button variant="ghost" icon={ChevronRight} onClick={onNext} style={{ padding: '6px' }} />
            </div>
            <Button variant="secondary" icon={CalendarDays} onClick={onToday} size="sm">
                Kuluva kuukausi
            </Button>
        </div>
    );
};
export default MonthHeader;