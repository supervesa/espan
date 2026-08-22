import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Button from '../../common/Button';
import CalendarLayout from './layout/CalendarLayout';
import CalendarHeader from './layout/CalendarHeader';
import WeekGrid from './layout/WeekGrid';

import CalendarFilters from './components/CalendarFilters';
import DayHeader from './components/DayHeader';
import { 
    getMonday, addDays, formatDateLocal, parseDBDateLocal, 
    getMeetingStyle, getMeetingLabel, renderContactIcon, getGridPlacement 
} from './utils/calendarUtils.jsx';

import { Calendar as CalendarIcon, Palmtree, Info, X, UserX, Trash2, ExternalLink, Flag, Lock } from 'lucide-react';

const Calendar = ({
    expertId,
    queryExpertIds = [], // Vastaanotetaan lista ID:istä (Uusi + Legacy) poistoja varten
    initialDate = new Date(),
    dailyLocations = [],
    exceptions = [],
    rules = [],
    nationalHolidays = [],
    settings = {},
    ledgerBalance = 0,
    availableBankDays = [],
    icsEvents = [],
    onDateChange,
    fetchData
}) => {
    const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(initialDate));
    const [filters, setFilters] = useState({ rules: true, exceptions: true, ics: true });
    
    const [saving, setSaving] = useState(false); 
    const [quickModal, setQuickModal] = useState({ isOpen: false, startDate: '', endDate: '' });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeLocationPopover, setActiveLocationPopover] = useState(null);
    const [customLocationText, setCustomLocationText] = useState('');

    useEffect(() => { if (onDateChange) onDateChange(currentWeekStart); }, [currentWeekStart, onDateChange]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (quickModal.isOpen) setQuickModal({ isOpen: false, startDate: '', endDate: '' });
                if (selectedBlock) setSelectedBlock(null);
                if (activeLocationPopover) setActiveLocationPopover(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickModal, selectedBlock, activeLocationPopover]);

    const handleNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7));
    const handlePrevWeek = () => setCurrentWeekStart(prev => addDays(prev, -7));
    const handleToday = () => setCurrentWeekStart(getMonday(new Date()));

    const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => addDays(currentWeekStart, i)), [currentWeekStart]);
    const blockedDaysStrs = useMemo(() => exceptions.filter(e => e.is_blocked && parseDBDateLocal(e.start_time).timeStr === '00:00').map(e => parseDBDateLocal(e.start_time).datePart), [exceptions]);
    const holidayStrs = useMemo(() => nationalHolidays.map(h => h.date), [nationalHolidays]);

    const dynamicTimeRange = useMemo(() => {
        let minTime = 19;
        let maxTime = 7;

        const checkTime = (timeStr, isEnd = false) => {
            if (!timeStr) return;
            const [h, m] = timeStr.split(':').map(Number);
            const decimalTime = h + (m / 60);
            if (decimalTime < minTime) minTime = decimalTime;
            const effectiveEnd = isEnd ? decimalTime : decimalTime + 1;
            if (effectiveEnd > maxTime) maxTime = effectiveEnd;
        };

        if (filters.rules) {
            rules.forEach(r => { 
                checkTime(r.start_time.substring(0,5)); 
                checkTime(r.end_time.substring(0,5), true); 
            });
        }
        if (filters.exceptions) {
            exceptions.forEach(e => {
                if (e.is_blocked && e.meeting_type === 'estetty') return; 
                const { timeStr } = parseDBDateLocal(e.start_time);
                if (timeStr !== '00:00') checkTime(timeStr);
            });
        }
        if (filters.ics) {
            icsEvents.forEach(e => {
                if (e.is_all_day || e.start_time.includes('00:00:00')) return;
                checkTime(parseDBDateLocal(e.start_time).timeStr);
                checkTime(parseDBDateLocal(e.end_time).timeStr, true);
            });
        }

        if (minTime > maxTime) return { minHour: 8, maxHour: 16 };

        const calculatedMin = Math.max(7, Math.floor(minTime) - 1);
        const calculatedMax = Math.min(19, Math.ceil(maxTime) + 1);

        return { minHour: calculatedMin, maxHour: calculatedMax };
    }, [rules, exceptions, icsEvents, filters]);

    const smartSuggestions = useMemo(() => {
        const suggestions = {};
        const dayAvailability = weekDays.map((d, idx) => {
            const dStr = formatDateLocal(d);
            const isBlockedDay = exceptions.some(e => e.is_blocked && e.meeting_type === 'estetty' && parseDBDateLocal(e.start_time).datePart === dStr);
            const isHolidayDay = nationalHolidays.some(h => h.date === dStr);
            return { dateStr: dStr, dayIndex: idx + 1, isBlockedDay: isBlockedDay || isHolidayDay };
        });

        let presenceIndices = [];
        const isThursdayIncluded = settings?.thursday_office_rate > 0; 
        if (isThursdayIncluded && !dayAvailability[3].isBlockedDay) presenceIndices.push(4); 
        if (presenceIndices.includes(4) && !dayAvailability[2].isBlockedDay && presenceIndices.length < 2) presenceIndices.push(3); 
        if (!dayAvailability[1].isBlockedDay && presenceIndices.length < 2) presenceIndices.push(2); 
        presenceIndices.sort();

        dayAvailability.forEach((day, idx) => {
            const currentDayNum = idx + 1;
            if (day.isBlockedDay) return;
            if (presenceIndices.includes(currentDayNum)) {
                if (presenceIndices[0] === currentDayNum) suggestions[day.dateStr] = { type: 'lahityo', name: settings.primary_office_name || 'Toimisto', label: `Matkapäivä: ${settings.primary_office_name}` };
                else if (currentDayNum === 4) suggestions[day.dateStr] = { type: 'lahityo', name: settings.thursday_office_name || 'Toimisto', label: `Kokous: ${settings.thursday_office_name}` };
                else suggestions[day.dateStr] = { type: 'lahityo', name: settings.primary_office_name || 'Toimisto', label: 'Lähityö' };
            } else {
                suggestions[day.dateStr] = { type: 'eta', name: 'Etätyö', label: 'Ehdotus: Etätyö' };
            }
        });
        return suggestions;
    }, [weekDays, exceptions, settings, nationalHolidays]);

    // MUUTETTU: Käsittelee myös Legacy ID:n siivoamisen
    const handleSaveLocation = async (dateStr, type, name) => {
        const finalName = name || customLocationText;
        if (!finalName.trim()) return alert("Kirjoita tai valitse toimipiste!");
        
        const existingLoc = dailyLocations.find(l => l.date === dateStr);
        const isCurrentlyRemote = existingLoc?.location_type === 'eta' || (!existingLoc && smartSuggestions[dateStr]?.type === 'eta');
        
        try {
            // Jos päivällä on jo sijainti (oli se sitten uusi tai vanha ID), tuhotaan se ensin,
            // jotta ei synny kahta päällekkäistä sijaintia tietokantaan.
            if (existingLoc) {
                await supabase.schema('espan').from('expert_daily_locations').delete().eq('id', existingLoc.id);
            }

            if (type === 'eta_pankki') {
                const oldestAvailable = availableBankDays[0];
                if (!oldestAvailable) return alert("Virhe: Ei vapaita ansaittuja päiviä pankissa!");
                await supabase.schema('espan').from('expert_remote_bank_ledger').insert([{ expert_id: expertId, transaction_type: -1, used_date: dateStr, expiration_date: '2099-12-31', description: `Käytetty pankkipäivä (Korvaa ansion: ${oldestAvailable.earned_date})`, linked_earned_id: oldestAvailable.id }]);
            } else if (type.includes('lahityo') && isCurrentlyRemote) {
                if (window.confirm("Muutit sääntömääräisen etäpäivän lähityöksi. Haluatko tallettaa tämän uhratun etäpäivän pankkiin?")) {
                    await supabase.schema('espan').from('expert_remote_bank_ledger').insert([{ expert_id: expertId, transaction_type: 1, earned_date: dateStr, expiration_date: formatDateLocal(addDays(new Date(), 28)), description: `Uhrattu etäpäivä (${finalName})` }]);
                }
            }
            
            // Tallennetaan uusi aina OIKEALLA (uudella) expertId:llä
            await supabase.schema('espan').from('expert_daily_locations').insert({ expert_id: expertId, date: dateStr, location_type: type, location_name: finalName.trim(), is_auto_generated: false });
            
            setCustomLocationText('');
            setActiveLocationPopover(null);
            if (fetchData) fetchData(currentWeekStart);
        } catch (e) { console.error(e); }
    };

    const handleRemoveLocation = async (dateStr) => {
        try { 
            const existingLoc = dailyLocations.find(l => l.date === dateStr);
            if (existingLoc) {
                if (existingLoc.location_type === 'eta_pankki') {
                    await supabase.schema('espan').from('expert_remote_bank_ledger').delete().eq('expert_id', existingLoc.expert_id).eq('used_date', dateStr);
                }
                await supabase.schema('espan').from('expert_daily_locations').delete().eq('id', existingLoc.id); 
            }
            setActiveLocationPopover(null); 
            if (fetchData) fetchData(currentWeekStart); 
        } catch (e) { console.error(e); }
    };

    const handleSaveQuickModal = async () => {
        setSaving(true);
        try {
            let currentD = new Date(quickModal.startDate);
            const endD = new Date(quickModal.endDate || quickModal.startDate);
            while (currentD <= endD) {
                const dayOfWeek = currentD.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const dStr = formatDateLocal(currentD);
                    // Poistetaan edelliset estot MOLEMMILTA ID:iltä jotta kalenteri tyhjenee varmasti
                    await supabase.schema('espan').from('availability').delete().in('expert_id', queryExpertIds).gte('start_time', `${dStr} 00:00:00`).lte('start_time', `${dStr} 23:59:59`);
                    
                    // Lisätään uusi esto uudelle ID:lle
                    await supabase.schema('espan').from('availability').insert([{ expert_id: expertId, start_time: `${dStr} 00:00:00`, meeting_type: 'estetty', is_blocked: true, contact_method: 'kaynti' }]);
                }
                currentD.setDate(currentD.getDate() + 1);
            }
            setQuickModal({ isOpen: false, startDate: '', endDate: '' });
            if (fetchData) fetchData(currentWeekStart);
        } catch (error) { console.error(error); } finally { setSaving(false); }
    };

    const handleProcessBlockAction = async () => {
        if (!selectedBlock) return;
        setSaving(true);
        try {
            // Kohdistetaan toimenpiteet suoraan kyseisen rivin ID:hen (välittämättä onko se uuden vai vanhan omistajan)
            if (selectedBlock.actionType === 'delete_rule') await supabase.schema('espan').from('expert_availability_rules').delete().eq('id', selectedBlock.data.id);
            else if (selectedBlock.actionType === 'delete_exception') await supabase.schema('espan').from('availability').delete().eq('id', selectedBlock.data.id);
            else if (selectedBlock.actionType === 'cancel_booking') await supabase.schema('espan').from('availability').update({ is_blocked: false }).eq('id', selectedBlock.data.id);
            
            setSelectedBlock(null);
            if (fetchData) fetchData(currentWeekStart);
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    return (
        <CalendarLayout 
            title="Asiantuntijan kalenteri (Liukumat 07:00 - 19:00)" 
            icon={CalendarIcon}
            header={
                <CalendarHeader 
                    currentDate={currentWeekStart}
                    onNextWeek={handleNextWeek}
                    onPreviousWeek={handlePrevWeek}
                    onResetToCurrentWeek={handleToday}
                    rightContent={<CalendarFilters filters={filters} setFilters={setFilters} />}
                />
            }
        >
            {/* Modaalien renderöinti */}
            {quickModal.isOpen && (
                <div onClick={() => setQuickModal({ isOpen: false, startDate: '', endDate: '' })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '420px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--color-danger)' }}><Palmtree size={28} /><h3 className="text-xl fw-bold m-0">Aseta loma tai esto</h3></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div><label className="text-sm fw-semibold text-primary">Mistä (Alkaen)</label><input type="date" className="modern-input mt-1" value={quickModal.startDate} onChange={e => setQuickModal({...quickModal, startDate: e.target.value})} /></div>
                            <div><label className="text-sm fw-semibold text-primary">Mihin (Päättyen)</label><input type="date" className="modern-input mt-1" value={quickModal.endDate} onChange={e => setQuickModal({...quickModal, endDate: e.target.value})} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button variant="danger" onClick={handleSaveQuickModal} disabled={saving} fullWidth>Aseta esto</Button>
                            <Button variant="secondary" onClick={() => setQuickModal({ isOpen: false, startDate: '', endDate: '' })} fullWidth>Peruuta</Button>
                        </div>
                    </div>
                </div>
            )}

            {selectedBlock && (
                <div onClick={() => setSelectedBlock(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '380px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}><Info size={24} /><h3 className="text-lg fw-bold m-0">Merkinnän tiedot</h3></div>
                            <button onClick={() => setSelectedBlock(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={20} /></button>
                        </div>
                        <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
                            <div className="fw-bold mb-1" style={{ fontSize: '1.1rem' }}>{selectedBlock.title}</div>
                            <div className="text-secondary font-mono text-sm mb-2">{selectedBlock.timeInfo}</div>
                            {selectedBlock.contact_method && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>{renderContactIcon(selectedBlock.contact_method, 16)}<span>{selectedBlock.contact_method === 'puhelu' ? 'Etä/Puhelu' : 'Lähitapaaminen'}</span></div>}
                        </div>
                        {selectedBlock.actionType === 'ics_info' ? <Button variant="secondary" onClick={() => setSelectedBlock(null)} fullWidth>Sulje (Synkronoitu tieto)</Button> : selectedBlock.actionType === 'cancel_booking' ? <Button variant="warning" icon={UserX} onClick={handleProcessBlockAction} disabled={saving} fullWidth>Peruuta varaus</Button> : <Button variant="danger" icon={Trash2} onClick={handleProcessBlockAction} disabled={saving} fullWidth>Poista kalenterista</Button>}
                    </div>
                </div>
            )}

            <WeekGrid 
                weekDays={weekDays} 
                minHour={dynamicTimeRange.minHour}
                maxHour={dynamicTimeRange.maxHour}
                renderDayHeader={(date, index) => (
                    <DayHeader 
                        date={date} index={index} 
                        data={{ blockedDaysStrs, holidayStrs, dailyLocations, smartSuggestions, filters, icsEvents, ledgerBalance }} 
                        popover={{ activeLocationPopover, setActiveLocationPopover, customLocationText, setCustomLocationText }} 
                        actions={{ handleSaveLocation, handleRemoveLocation, setQuickModal, setSelectedBlock }} 
                    />
                )}
            >
                {/* Lomat */}
                {weekDays.map((d, dayIndex) => {
                    const dStr = formatDateLocal(d);
                    const holiday = nationalHolidays.find(h => h.date === dStr);
                    if (holiday) return <div key={`holiday-${dStr}`} style={{ gridColumn: dayIndex + 2, gridRow: '2 / 50', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(45deg, #fdf4ff, #fdf4ff 10px, #fae8ff 10px, #fae8ff 20px)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #d946ef', color: '#c026d3', fontWeight: 'bold', transform: 'rotate(-90deg)' }}><Flag size={14} /> PYHÄ: {holiday.name.toUpperCase()}</div></div>;
                    if (blockedDaysStrs.includes(dStr)) return <div key={`blocked-${dStr}`} style={{ gridColumn: dayIndex + 2, gridRow: '2 / 50', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(45deg, #fef2f2, #fef2f2 10px, #fee2e2 10px, #fee2e2 20px)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #fca5a5', color: '#ef4444', fontWeight: 'bold', transform: 'rotate(-90deg)' }}><Palmtree size={14} /> LOMA / SULJETTU</div></div>;
                    return null;
                })}

                {/* Säännöt */}
                {filters.rules && rules.filter(r => !blockedDaysStrs.includes(formatDateLocal(weekDays[r.day_of_week - 1])) && (!r.valid_until || formatDateLocal(weekDays[r.day_of_week - 1]) <= r.valid_until.substring(0, 10))).map(rule => {
                    const dStr = formatDateLocal(weekDays[rule.day_of_week - 1]);
                    const dayLoc = dailyLocations.find(l => l.date === dStr);
                    const isTranslated = dayLoc && !dayLoc.is_auto_generated && ((dayLoc.location_type === 'eta' && rule.contact_method === 'kaynti') || (dayLoc.location_type === 'lahityo' && rule.contact_method === 'puhelu'));
                    const isInternalWork = dayLoc?.location_type?.startsWith('sisatyot_');
                    const baseStyle = getMeetingStyle(rule.meeting_type);

                    return (
                        <div key={`rule-${rule.id}`} onClick={() => setSelectedBlock({ data: rule, actionType: 'delete_rule', title: `Runkosääntö: ${getMeetingLabel(rule.meeting_type)}`, timeInfo: `${['Ma','Ti','Ke','To','Pe'][rule.day_of_week - 1]} klo ${rule.start_time.substring(0,5)}`, contact_method: rule.contact_method })} style={{ ...getGridPlacement(rule.day_of_week - 1, rule.start_time, rule.end_time), ...baseStyle, backgroundColor: isInternalWork ? 'rgba(241, 245, 249, 0.6)' : 'rgba(248, 250, 252, 0.4)', border: isInternalWork ? '1px dashed #94a3b8' : `1px dashed ${baseStyle.color}`, color: isInternalWork ? '#64748b' : baseStyle.color, margin: '2px', borderRadius: '4px', padding: '0.25rem 0.5rem', zIndex: 4, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="text-xs fw-semibold" style={{ lineHeight: 1.1 }}>{getMeetingLabel(rule.meeting_type)}</span>{isInternalWork ? <Lock size={12} color="#94a3b8" /> : isTranslated ? <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'var(--color-surface)', padding: '1px 4px', borderRadius: '3px', border: `1px solid ${baseStyle.color}` }}><span style={{ fontSize: '0.55rem', fontWeight: '800', color: baseStyle.color }}>⚡Sopeutettu</span></div> : renderContactIcon(rule.contact_method, 12)}</div>
                            <span className="text-xs font-mono" style={{ opacity: 0.8, marginTop: 'auto' }}>{rule.start_time.substring(0,5)}</span>
                        </div>
                    );
                })}

                {/* Varaukset ja Avoimet poikkeukset */}
                {filters.exceptions && exceptions.filter(e => parseDBDateLocal(e.start_time).timeStr !== '00:00').map(exc => {
                    const { datePart, timeStr } = parseDBDateLocal(exc.start_time);
                    const dayIndex = weekDays.findIndex(d => formatDateLocal(d) === datePart);
                    if (dayIndex === -1 || blockedDaysStrs.includes(datePart)) return null;

                    const isBooked = exc.is_blocked && exc.meeting_type !== 'estetty';
                    const excStyle = isBooked ? { backgroundColor: getMeetingStyle(exc.meeting_type).color, color: '#ffffff', width: 'calc(100% - 12px)', margin: '2px auto', boxShadow: '0 3px 6px rgba(0, 0, 0, 0.16)', border: 'none' } : { ...getMeetingStyle(exc.meeting_type, exc.is_blocked), margin: '2px 4px' };

                    return (
                        <div key={`exc-${exc.id}`} onClick={() => setSelectedBlock({ data: exc, actionType: isBooked ? 'cancel_booking' : 'delete_exception', title: isBooked ? `VARATTU: ${getMeetingLabel(exc.meeting_type)}` : `Avoin: ${getMeetingLabel(exc.meeting_type)}`, timeInfo: `${datePart.split('-').reverse().join('.')} klo ${timeStr}`, contact_method: exc.contact_method })} style={{ ...getGridPlacement(dayIndex, timeStr, null), ...excStyle, borderRadius: '4px', padding: '0.25rem 0.5rem', zIndex: 10, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="text-xs fw-bold" style={{ lineHeight: 1.1 }}>{isBooked ? `VARATTU: ${getMeetingLabel(exc.meeting_type)}` : `Avoin: ${getMeetingLabel(exc.meeting_type)}`}</span>{renderContactIcon(exc.contact_method, 12)}</div>
                            <span className="text-xs font-mono" style={{ marginTop: 'auto', opacity: 0.9 }}>{timeStr}</span>
                        </div>
                    );
                })}

                {/* Kellotetut ICS-tapahtumat */}
                {filters.ics && icsEvents.filter(e => !(e.is_all_day || e.start_time.includes('00:00:00'))).map(exc => {
                    const startInfo = parseDBDateLocal(exc.start_time);
                    const endInfo = parseDBDateLocal(exc.end_time);
                    const dayIndex = weekDays.findIndex(d => formatDateLocal(d) === startInfo.datePart);
                    if (dayIndex === -1 || blockedDaysStrs.includes(startInfo.datePart)) return null;

                    return (
                        <div key={`ics-${exc.id}`} onClick={() => setSelectedBlock({ data: exc, actionType: 'ics_info', title: `Ulkoinen: ${exc.event_category}`, timeInfo: `${startInfo.datePart.split('-').reverse().join('.')} klo ${startInfo.timeStr} - ${endInfo.timeStr}`, contact_method: exc.contact_method })} style={{ ...getGridPlacement(dayIndex, startInfo.timeStr, endInfo.timeStr), backgroundColor: '#f5f3ff', border: '1px solid #c4b5fd', color: '#6d28d9', margin: '2px 8px', borderRadius: '4px', padding: '0.25rem 0.5rem', zIndex: 11, display: 'flex', flexDirection: 'column', cursor: 'pointer', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="text-xs fw-bold" style={{ lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '4px' }}><ExternalLink size={10} /> {exc.location_name || exc.event_category}</span></div>
                            <span className="text-xs font-mono" style={{ marginTop: 'auto', opacity: 0.9 }}>{startInfo.timeStr} - {endInfo.timeStr}</span>
                        </div>
                    );
                })}
            </WeekGrid>
        </CalendarLayout>
    );
};

export default Calendar;