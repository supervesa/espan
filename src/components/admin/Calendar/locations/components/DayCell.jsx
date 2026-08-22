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
    
    // UUSI: Etsitään päivältä todelliset, vahvistetut matkat
    const actualJourneysToday = data.actualJourneys?.filter(j => getSafeLocalDayString(j.departure_time) === dStr) || [];
    const hasActualJourney = actualJourneysToday.length > 0;

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

    const renderIcon = () => {
        if (isHoliday) return <Flag size={24} color="#ef4444" />;
        if (isBlocked) return <Palmtree size={24} color="#f97316" />;
        
        if (!loc) return null;
        if (loc.location_type === 'eta') return <Home size={24} color="#2563eb" />;
        if (loc.location_type === 'eta_pankki') return <Landmark size={24} color="var(--color-success)" />;
        
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
            minHeight: '85px', display: 'flex', flexDirection: 'column'
        }}>
            {/* YLÄRIVI: Päivämäärä ja Matka-ikonit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: isCurrentMonth ? 'bold' : 'normal', color: isLocked ? '#e34a4a' : 'var(--color-text-secondary)' }}>
                        {date.getDate()}
                    </span>
                    {/* VIHREÄ BUSSI (Vahvistettu matka) */}
                    {hasActualJourney && (
                        <div title="Matka varattu (kuitit löytyy)" style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                            <Bus size={14} />
                        </div>
                    )}
                </div>

                {/* LILA JUNA (Suunnitelma, näytetään vain jos matkaa EI ole vielä kuitattu) */}
                {plan && !hasActualJourney && (
                    <div title="Matkasuunnitelma kalenterissa" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '2px', borderRadius: '4px', color: '#7c3aed', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        <Train size={14} />
                    </div>
                )}
            </div>

            {/* KESKUSIKONI */}
            <div 
                onClick={handleCellClick}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isLocked ? 'not-allowed' : 'pointer', borderRadius: '8px', transition: 'background 0.2s', backgroundColor: activePopover === dStr ? 'rgba(0,0,0,0.05)' : 'transparent', marginTop: '4px', marginBottom: '4px' }}
            >
                {renderIcon()}
            </div>

            {/* ALARIVI: Asiakasvaraukset tekstinä */}
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