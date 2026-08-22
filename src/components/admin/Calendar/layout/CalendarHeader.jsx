import React from 'react';
import Button from '../../../common/Button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const CalendarHeader = ({ 
    currentDate, // Date-objekti
    onPreviousWeek, 
    onNextWeek,
    onResetToCurrentWeek,
    rightContent // Esim. pudotusvalikko asiantuntijoiden valintaan
}) => {
    
    const getWeekRangeText = () => {
        if (!currentDate) return '';
        // Etsitään aina viikon maanantai
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const start = new Date(d.setDate(diff));
        
        const end = new Date(start);
        end.setDate(end.getDate() + 4); // Perjantai
        
        const formatStr = (date) => `${date.getDate()}.${date.getMonth() + 1}.`;
        return `${formatStr(start)} – ${formatStr(end)}`;
    };

    const getWeekNumber = () => {
        if (!currentDate) return '';
        const d = new Date(currentDate);
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            {/* Vasen/Keski: Ohjaimet */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    backgroundColor: 'var(--color-surface)', 
                    borderRadius: '8px', 
                    padding: '4px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                }}>
                    <Button variant="ghost" icon={ChevronLeft} onClick={onPreviousWeek} style={{ padding: '6px' }} title="Edellinen viikko" />
                    
                    <div 
                        onClick={onResetToCurrentWeek}
                        style={{ cursor: 'pointer', padding: '0 12px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}
                        title="Palaa kuluvaan viikkoon"
                    >
                        <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Viikko {getWeekNumber()}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{getWeekRangeText()}</span>
                    </div>

                    <Button variant="ghost" icon={ChevronRight} onClick={onNextWeek} style={{ padding: '6px' }} title="Seuraava viikko" />
                </div>
                
                <Button variant="secondary" icon={CalendarDays} onClick={onResetToCurrentWeek} style={{ backgroundColor: '#fff' }}>
                    Tämä viikko
                </Button>
            </div>

            {/* Oikea laita: Vapaasti täytettävä tila (esim. asetukset, filtterit) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {rightContent}
            </div>
        </div>
    );
};

export default CalendarHeader;