// --- src/components/admin/AvailabilityManager/AvailabilityHeader.jsx ---
import React from 'react';
import Button from '../../common/Button';
import { Calendar as CalendarIcon, Ticket, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import './AvailabilityManager.css';

const AvailabilityHeader = ({ 
    activeView, 
    onViewChange, 
    currentWeekStart, 
    onPreviousWeek, 
    onNextWeek,
    onResetToCurrentWeek
}) => {
    
    // Apufunktiot päivämäärien ja viikkonumeron muotoiluun
    const getWeekRangeText = () => {
        if (!currentWeekStart) return '';
        const start = new Date(currentWeekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 4); // Näytetään kalenterin mukaisesti Ma-Pe
        
        const formatStr = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
        return `${formatStr(start)} – ${formatStr(end)}`;
    };

    // ISO 8601 Viikkonumeron laskenta
    const getWeekNumber = () => {
        if (!currentWeekStart) return '';
        const d = new Date(currentWeekStart);
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    return (
        <div className="availability-header">
            
            {/* VASEN: NÄKYMÄN VAIHTAJA (TOGGLE) */}
            <div className="availability-header__toggle">
                <Button 
                    variant={activeView === 'locations' ? 'primary' : 'secondary'} 
                    icon={CalendarIcon}
                    onClick={() => onViewChange('locations')}
                    style={{ border: 'none', boxShadow: activeView === 'locations' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >
                    Kalenteri & Sijainnit
                </Button>
                <Button 
                    variant={activeView === 'journeys' ? 'primary' : 'secondary'} 
                    icon={Ticket}
                    onClick={() => onViewChange('journeys')}
                    style={{ border: 'none', boxShadow: activeView === 'journeys' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >
                    Matkat & Kuitit
                </Button>
            </div>

            {/* OIKEA: VIIKKOVIERITIN (SYNKRONOITU) */}
            <div className="availability-header__scroller">
                <Button 
                    variant="ghost" 
                    icon={ChevronLeft} 
                    onClick={onPreviousWeek} 
                    style={{ padding: '6px' }}
                    title="Edellinen viikko"
                />
                
                <div 
                    className="availability-header__week-info" 
                    onClick={onResetToCurrentWeek}
                    title="Palaa kuluvaan viikkoon"
                >
                    <span className="availability-header__week-number">
                        Viikko {getWeekNumber()}
                    </span>
                    <span className="availability-header__week-dates">
                        {getWeekRangeText()}
                    </span>
                </div>

                <Button 
                    variant="ghost" 
                    icon={ChevronRight} 
                    onClick={onNextWeek} 
                    style={{ padding: '6px' }}
                    title="Seuraava viikko"
                />
                
                {/* Koti-ikoni: Paluu nykyhetkeen */}
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '0.5rem', marginLeft: '0.25rem' }}>
                    <Button 
                        variant="secondary" 
                        size="sm"
                        icon={CalendarDays} 
                        onClick={onResetToCurrentWeek}
                        style={{ padding: '0.4rem 0.75rem', color: 'var(--color-primary)', borderColor: 'transparent', fontSize: '0.8rem' }}
                    >
                        Tämä viikko
                    </Button>
                </div>
            </div>

        </div>
    );
};

export default AvailabilityHeader;