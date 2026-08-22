import React from 'react';
import { Plus, CalendarOff, Landmark, Lock, Home, Building, Send, Hourglass, ExternalLink } from 'lucide-react';
import { formatDateLocal } from '../utils/calendarUtils';

const DayHeader = ({ 
    date, 
    index, 
    data, 
    popover, 
    actions 
}) => {
    const dStr = formatDateLocal(date);
    const isBlocked = data.blockedDaysStrs.includes(dStr);
    const isHoliday = data.holidayStrs.includes(dStr);
    const loc = data.dailyLocations.find(l => l.date === dStr);
    const sugg = data.smartSuggestions[dStr];

    const isUserLocked = loc && !loc.is_auto_generated;
    const isBankDay = loc?.location_type === 'eta_pankki';
    const isInternalWork = loc?.location_type?.startsWith('sisatyot_');

    // Haetaan koko päivän ICS tapahtumat
    const dayIcsAllDay = data.filters.ics ? data.icsEvents.filter(e => {
        const isAllDay = e.is_all_day || e.start_time.includes('00:00:00');
        return isAllDay && e.start_time.startsWith(dStr);
    }) : [];

    return (
        <div style={{ backgroundColor: isBlocked ? '#fef2f2' : (isHoliday ? '#fdf4ff' : 'transparent'), width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="text-sm fw-semibold text-primary">{['Ma', 'Ti', 'Ke', 'To', 'Pe'][index]}</div>
            <div className="text-xs text-secondary mb-1">{date.getDate()}.{date.getMonth()+1}.</div>
            
            {/* Sijaintinappi ja Toiminnot */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '4px' }}>
                <button 
                    onClick={() => popover.setActiveLocationPopover(popover.activeLocationPopover === dStr ? null : dStr)}
                    style={{
                        border: isUserLocked ? (isBankDay ? '1px solid var(--color-success)' : (isInternalWork ? '1px solid #64748b' : '1px solid var(--color-primary)')) : 'none', 
                        background: loc ? (isBankDay ? 'rgba(30,154,90,0.1)' : (isInternalWork ? '#f1f5f9' : 'var(--color-background)')) : 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                        color: loc ? (isBankDay ? 'var(--color-success)' : (isInternalWork ? '#475569' : (loc.location_type === 'eta' ? '#2563eb' : 'var(--color-primary)'))) : 'var(--color-text-secondary)',
                        fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px'
                    }}
                >
                    {loc ? (
                        <>
                            {isBankDay ? <Landmark size={12} /> : (isInternalWork ? <Lock size={12} /> : (loc.location_type === 'eta' ? <Home size={12} /> : <Building size={12} />))}
                            <span>{loc.location_name}</span>
                            {isUserLocked && !isInternalWork && <Lock size={10} style={{ marginLeft: '2px' }}/>}
                        </>
                    ) : sugg ? (
                        <span style={{ opacity: 0.6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Hourglass size={10} />
                            {sugg.type === 'eta' ? <Home size={12} /> : <Building size={12} />}
                            {sugg.name}
                        </span>
                    ) : <Plus size={12} />}
                </button>

                {/* Popover */}
                {popover.activeLocationPopover === dStr && (
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div className="text-xs fw-bold text-secondary text-left mb-1">Muuta sijaintia:</div>
                        
                        {data.ledgerBalance > 0 && !isBankDay && (
                            <button onClick={() => actions.handleSaveLocation(dStr, 'eta_pankki', 'Pankki-etäpäivä')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: '1px solid var(--color-success)', color: 'var(--color-success)', background: 'rgba(30,154,90,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', fontWeight: 'bold' }}>
                                <Landmark size={14} /> Käytä pankkipäivä
                            </button>
                        )}
                        <button onClick={() => actions.handleSaveLocation(dStr, 'eta', 'Etätyö')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><Home size={14} /> Etätyö</button>
                        <button onClick={() => actions.handleSaveLocation(dStr, 'lahityo', 'Malminkatu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><Building size={14} /> Malminkatu</button>
                        
                        <div style={{ margin: '4px 0', borderTop: '1px solid var(--color-border)' }}></div>
                        <button onClick={() => actions.handleSaveLocation(dStr, 'sisatyot_eta', 'Ei asiakasaikoja (Etä)')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', color: '#475569' }}><Lock size={14} /> Ei asiakasaikoja (Etä)</button>
                        <button onClick={() => actions.handleSaveLocation(dStr, 'sisatyot_lahityo', 'Ei asiakasaikoja (Toimisto)')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', color: '#475569' }}><Lock size={14} /> Ei asiakasaikoja (Toimisto)</button>

                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px', borderTop: '1px dashed var(--color-border)', paddingTop: '6px' }}>
                            <input type="text" placeholder="Muu paikka..." value={popover.customLocationText} onChange={e => popover.setCustomLocationText(e.target.value)} style={{ width: '100%', fontSize: '0.75rem', padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: '4px' }} />
                            <button onClick={() => actions.handleSaveLocation(dStr, 'lahityo', null)} style={{ border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '4px', padding: '2px 6px' }}><Send size={12} /></button>
                        </div>
                        {loc && <button onClick={() => actions.handleRemoveLocation(dStr)} style={{ marginTop: '4px', color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Vapauta automaatille</button>}
                    </div>
                )}
                {!isBlocked && <button onClick={() => actions.setQuickModal({ isOpen: true, startDate: dStr, endDate: dStr })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', opacity: 0.4 }}><CalendarOff size={14} /></button>}
            </div>

            {/* Koko päivän ICS tapahtumat */}
            {dayIcsAllDay.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', width: '90%' }}>
                    {dayIcsAllDay.map(exc => (
                        <div 
                            key={exc.id} 
                            onClick={() => actions.setSelectedBlock({ data: exc, actionType: 'ics_info', title: `Ulkoinen: ${exc.event_category}`, timeInfo: `Koko päivän tapahtuma`, contact_method: exc.contact_method })}
                            style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid #c4b5fd', borderRadius: '4px', color: '#6d28d9', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                        >
                            <ExternalLink size={10}/> {exc.location_name || exc.event_category}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DayHeader;