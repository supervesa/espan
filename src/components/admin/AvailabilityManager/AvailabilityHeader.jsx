// --- src/components/admin/AvailabilityManager/AvailabilityHeader.jsx ---
import React from 'react';
import Button from '../../common/Button';
import { Calendar as CalendarIcon, Ticket, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import './AvailabilityHeader.css'; // Varmista että import on oikein!

const AvailabilityHeader = ({ 
    activeView, 
    onViewChange, 
    currentWeekStart, 
    onPreviousWeek, 
    onNextWeek,
    onResetToCurrentWeek,
    pendingReceiptsCount = 0 
}) => {
    
    const getWeekRangeText = () => {
        if (!currentWeekStart) return '';
        const start = new Date(currentWeekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 4); 
        
        const formatStr = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
        return `${formatStr(start)} – ${formatStr(end)}`;
    };

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
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Matkat & Kuitit
                        {pendingReceiptsCount > 0 && (
                            <span style={{
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                padding: '2px 6px',
                                borderRadius: '12px',
                                lineHeight: 1,
                                marginLeft: '2px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                                {pendingReceiptsCount}
                            </span>
                        )}
                    </span>
                </Button>
            </div>

            {/* OIKEA: OHJAIMET */}
            <div className="availability-header__controls">
                
                {/* Viikkovieritin on nyt oma laatikonsa */}
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
                </div>
                
                {/* "Tämä viikko" -nappi on nyt irrotettu omaksi elementikseen! */}
                <Button 
                    variant="secondary" 
                    icon={CalendarDays} 
                    onClick={onResetToCurrentWeek}
                    style={{ backgroundColor: '#fff' }}
                >
                    Tämä viikko
                </Button>

            </div>

        </div>
    );
};

export default AvailabilityHeader;