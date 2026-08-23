import React from 'react';
import { Home, Building, Landmark, Lock, Palmtree, Flag, Train, Bus } from 'lucide-react';
import { formatDateLocal, getSafeLocalDayString } from '../utils/monthUtils';
import QuickActionMenu from './QuickActionMenu';

const DayCell = ({ date, currentMonthStart, data, actions, activePopover, setActivePopover, isRightEdge }) => {
    const dStr = formatDateLocal(date);
    const isCurrentMonth = date.getMonth() === currentMonthStart.getMonth();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    const isHoliday = data.holidayStrs.includes(dStr);
    const isBlocked = data.blockedDaysStrs.includes(dStr);
    
    const dayAppointments = data.exceptions.filter(e => 
        String(e.meeting_type).trim().toLowerCase() !== 'estetty' && 
        getSafeLocalDayString(e.start_time) === dStr
    );
    const apptCount = dayAppointments.length;
    
    const loc = data.dailyLocations.find(l => l.date === dStr);
    const plan = data.journeyPlans.find(p => p.date === dStr);
    
    const actualJourneysToday = data.actualJourneys?.filter(j => 
        getSafeLocalDayString(j.departure_time) === dStr &&
        !String(j.route_info).toLowerCase().includes('paikallisliikenne')
    ) || [];
    const hasActualJourney = actualJourneysToday.length > 0;
    
    const journeyTooltip = hasActualJourney 
        ? `Kaukoliikenne varattu: ${actualJourneysToday.map(j => j.route_info).join(', ')}`
        : 'Matka varattu';

    const isInternalWork = loc?.location_type?.startsWith('sisatyot_');

    let bgColor = isWeekend ? '#f1f5f9' : '#ffffff';
    let bgImage = 'none';

    if (isHoliday || isBlocked) {
        bgColor = '#fef2f2'; 
    } else if (!isCurrentMonth) {
        bgColor = '#f8fafc'; 
    } else if (isInternalWork) {
        bgImage = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 10px, transparent 10px, transparent 20px)';
    }

    const opacity = isCurrentMonth ? 1 : 0.4;
    const isLocked = isHoliday || isBlocked; 

    // TÄSSÄ SE KORJAUS: Nyt Kevennys-päivät (eta_kevennys) ymmärretään aidosti siniseksi etämökiksi!
    const renderIcon = () => {
        if (isHoliday) return <Flag size={24} color="#ef4444" />;
        if (isBlocked) return <Palmtree size={24} color="#f97316" />;
        
        if (!loc) return null;
        if (loc.location_type === 'eta') return <Home size={24} color="#2563eb" />;
        if (loc.location_type === 'eta_pankki') return <Landmark size={24} color="var(--color-success)" />;
        
        if (loc.location_type === 'eta_kevennys') {
            return (
                <div style={{ position: 'relative' }} title="Tekoälyn asettama tasapainottava etäpäivä">
                    <Home size={24} color="#2563eb" />
                    <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#fff', borderRadius: '50%', padding: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px' }}>⚖️</span>
                    </div>
                </div>
            );
        }

        if (loc.location_type === 'sisatyot_eta') {
            return (
                <div style={{ position: 'relative' }}>
                    <Home size={24} color="#64748b" />
                    <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#fff', borderRadius: '50%', padding: '1px' }}><Lock size={10} color="#475569" /></div>
                </div>
            );
        }
        if (loc.location_type === 'sisatyot_lahityo') {
            return (
                <div style={{ position: 'relative' }}>
                    <Building size={24} color="#64748b" />
                    <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#fff', borderRadius: '50%', padding: '1px' }}><Lock size={10} color="#475569" /></div>
                </div>
            );
        }
        return <Building size={24} color="var(--color-primary)" />;
    };

    const handleCellClick = () => {
        if (isLocked) return; 
        setActivePopover(activePopover === dStr ? null : dStr);
    };

    return (
        <div style={{ 
            position: 'relative', borderBottom: '1px solid var(--color-border)', 
            borderRight: isRightEdge ? 'none' : '1px solid var(--color-border)', 
            backgroundColor: bgColor, backgroundImage: bgImage, padding: '0.4rem', opacity,
            minHeight: '85px', display: 'flex', flexDirection: 'column',
            zIndex: activePopover === dStr ? 50 : 1
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: isCurrentMonth ? 'bold' : 'normal', color: isLocked ? '#e34a4a' : 'var(--color-text-secondary)' }}>
                        {date.getDate()}
                    </span>
                    {hasActualJourney && (
                        <div title={journeyTooltip} style={{ color: '#16a34a', display: 'flex', alignItems: 'center', cursor: 'help' }}>
                            <Bus size={14} />
                        </div>
                    )}
                </div>

                {plan && !hasActualJourney && (
                    <div title="Matkasuunnitelma kalenterissa" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '2px', borderRadius: '4px', color: '#7c3aed', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        <Train size={14} />
                    </div>
                )}
            </div>

            <div 
                onClick={handleCellClick}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isLocked ? 'not-allowed' : 'pointer', borderRadius: '8px', transition: 'background 0.2s', backgroundColor: activePopover === dStr ? 'rgba(0,0,0,0.05)' : 'transparent', marginTop: '4px', marginBottom: '4px' }}
            >
                {renderIcon()}
            </div>

            <div style={{ height: '14px', textAlign: 'center', cursor: 'default' }}>
                {apptCount > 0 && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569' }}>
                        {apptCount} {apptCount === 1 ? 'varaus' : 'varausta'}
                    </span>
                )}
            </div>

            {activePopover === dStr && !isLocked && (
                <QuickActionMenu 
                    dateStr={dStr} loc={loc} plan={plan} apptCount={apptCount} hasActualJourney={hasActualJourney} data={data} actions={actions}
                    onClose={() => setActivePopover(null)}
                />
            )}
        </div>
    );
};
export default DayCell;