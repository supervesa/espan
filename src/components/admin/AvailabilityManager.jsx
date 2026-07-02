// --- src/components/admin/AvailabilityManager.jsx ---
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import LocationPlanner from './LocationPlanner'; 
import AvailabilityForms from './AvailabilityForms'; 
import JourneyManager from './journey/JourneyManager';
import { 
    Calendar, Plus, Trash2, ChevronLeft, ChevronRight, 
    CalendarOff, Palmtree, MapPin, Phone, Info, X, UserX,
    Home, Building, Link, Copy, Send,
    Landmark, Lock, Flag, Hourglass, Ticket
} from 'lucide-react';

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const formatDateLocal = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

const parseDBDateLocal = (dbString) => {
    if (!dbString) return { datePart: '', timeStr: '', isWholeDay: false };
    if (dbString.includes('00:00:00')) return { datePart: dbString.substring(0, 10), timeStr: '00:00', isWholeDay: true };
    const d = new Date(dbString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { datePart: `${year}-${month}-${day}`, timeStr: `${hours}:${minutes}`, isWholeDay: false };
};

const AvailabilityManager = () => {
    const [activeView, setActiveView] = useState('locations'); // 'locations' | 'journeys'

    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    const [rules, setRules] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [dailyLocations, setDailyLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false); 

    const [ledgerBalance, setLedgerBalance] = useState(0);
    const [nationalHolidays, setNationalHolidays] = useState([]);

    const [settings, setSettings] = useState({
        target_office_percent: 50,
        thursday_office_rate: 100,
        monday_always_remote: true,
        friday_max_presence_per_month: 1,
        primary_office_name: 'Malminkatu',
        thursday_office_name: 'Viipurinkatu'
    });

    const [quickModal, setQuickModal] = useState({ isOpen: false, startDate: '', endDate: '' });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeLocationPopover, setActiveLocationPopover] = useState(null);
    const [customLocationText, setCustomLocationText] = useState('');

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
    }, [quickModal.isOpen, selectedBlock, activeLocationPopover]);

    useEffect(() => { fetchData(); }, [currentWeekStart]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const queryStart = formatDateLocal(addDays(currentWeekStart, -7)); 
            const queryEnd = formatDateLocal(addDays(currentWeekStart, 21));
            const todayStr = formatDateLocal(new Date());

            const [rulesRes, excRes, locRes, setRes, ledgerRes, holidayRes] = await Promise.all([
                supabase.schema('espan').from('expert_availability_rules').select('*').eq('expert_id', EXPERT_ID).order('day_of_week').order('start_time'),
                supabase.schema('espan').from('availability').select('*').eq('expert_id', EXPERT_ID).gte('start_time', `${queryStart} 00:00:00`).lte('start_time', `${queryEnd} 23:59:59`).order('start_time'),
                supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', EXPERT_ID).gte('date', queryStart).lte('date', queryEnd),
                supabase.schema('espan').from('expert_location_settings').select('*').eq('expert_id', EXPERT_ID).maybeSingle(),
                supabase.schema('espan').from('expert_remote_bank_ledger').select('transaction_type').eq('expert_id', EXPERT_ID).gt('expiration_date', todayStr),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', queryStart).lte('date', queryEnd)
            ]);

            setRules(rulesRes.data || []);
            setExceptions(excRes.data || []);
            setDailyLocations(locRes.data || []);
            if (setRes.data) setSettings(setRes.data);
            setNationalHolidays(holidayRes.data || []);

            if (ledgerRes.data) {
                const balance = ledgerRes.data.reduce((sum, row) => sum + row.transaction_type, 0);
                setLedgerBalance(balance);
            }
        } catch (error) { console.error("Virhe tiedonhaussa:", error); } finally { setLoading(false); }
    };

    const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => addDays(currentWeekStart, i)), [currentWeekStart]);
    const webCalUrl = `webcal://espan-api.netlify.app/functions/webcal?expert_id=${EXPERT_ID}`;

    const smartSuggestions = useMemo(() => {
        const suggestions = {};
        const dayAvailability = weekDays.map((d, idx) => {
            const dStr = formatDateLocal(d);
            const isBlockedDay = exceptions.some(e => e.is_blocked && e.meeting_type === 'estetty' && parseDBDateLocal(e.start_time).datePart === dStr);
            const isHolidayDay = nationalHolidays.some(h => h.date === dStr);
            const hasAppointments = exceptions.some(e => !e.is_blocked && parseDBDateLocal(e.start_time).datePart === dStr);
            const userLoc = dailyLocations.find(l => l.date === dStr);
            return { dateStr: dStr, dayIndex: idx + 1, isBlockedDay: isBlockedDay || isHolidayDay, hasAppointments, userLoc };
        });

        let presenceIndices = [];
        const isThursdayIncluded = settings.thursday_office_rate > 0; 
        if (isThursdayIncluded && !dayAvailability[3].isBlockedDay) presenceIndices.push(4); 
        if (presenceIndices.includes(4) && !dayAvailability[2].isBlockedDay && presenceIndices.length < 2) presenceIndices.push(3); 
        if (!dayAvailability[1].isBlockedDay && presenceIndices.length < 2) presenceIndices.push(2); 

        presenceIndices.sort();

        dayAvailability.forEach((day, idx) => {
            const currentDayNum = idx + 1;
            if (day.isBlockedDay) return;

            if (presenceIndices.includes(currentDayNum)) {
                const isFirstPresenceDay = presenceIndices[0] === currentDayNum;
                if (isFirstPresenceDay) suggestions[day.dateStr] = { type: 'lahityo', name: settings.primary_office_name, label: `Matkapäivä: ${settings.primary_office_name}` };
                else if (currentDayNum === 4) suggestions[day.dateStr] = { type: 'lahityo', name: settings.thursday_office_name, label: `Kokous: ${settings.thursday_office_name}` };
                else suggestions[day.dateStr] = { type: 'lahityo', name: settings.primary_office_name, label: 'Lähityö' };
            } else {
                suggestions[day.dateStr] = { type: 'eta', name: 'Etätyö', label: 'Ehdotus: Etätyö' };
            }
        });
        return suggestions;
    }, [weekDays, dailyLocations, exceptions, settings, nationalHolidays]);

    const meetingTypes = [
        { id: 'normi', label: 'Normaali', color: 'var(--color-primary)', bg: 'rgba(255, 107, 0, 0.05)' },
        { id: 'aktivointi', label: 'Aktivointi', color: 'var(--color-success)', bg: 'rgba(30, 154, 90, 0.05)' },
        { id: 'taydentava', label: 'Täydentävä', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.05)' }
    ];

    const getMeetingStyle = (typeId, isBlocked = false) => {
        const typeConfig = meetingTypes.find(t => t.id === typeId) || meetingTypes[0];
        if (isBlocked && typeId === 'estetty') return { backgroundColor: '#fef2f2', border: '1px dashed #e34a4a', color: '#e34a4a' };
        if (isBlocked && typeId !== 'estetty') return { backgroundColor: 'var(--color-surface)', border: `1px dashed ${typeConfig.color}`, color: typeConfig.color, opacity: 0.65 };
        return { backgroundColor: typeConfig.bg, border: `1px dashed ${typeConfig.color}`, color: typeConfig.color };
    };

    const getMeetingLabel = (typeId) => meetingTypes.find(t => t.id === typeId)?.label || typeId;
    const renderContactIcon = (method, size = 14) => method === 'puhelu' ? <Phone size={size} /> : <MapPin size={size} />;

    const timeToRow = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        if (h < 7) return 2; 
        if (h > 19 || (h === 19 && m > 0)) return 50; 
        return (h - 7) * 4 + (Math.round(m / 15)) + 2;
    };

    const getGridPlacement = (dayIndex, startTime, endTime) => {
        const startRow = timeToRow(startTime);
        const endRow = endTime ? timeToRow(endTime) : startRow + 4; 
        return { gridColumn: dayIndex + 2, gridRow: `${startRow} / ${Math.min(50, endRow)}` };
    };

    const handleSettingsChange = async (field, value) => {
        const updatedSettings = { ...settings, [field]: value };
        setSettings(updatedSettings);
        try {
            await supabase.schema('espan').from('expert_location_settings').update({ [field]: value, updated_at: new Date().toISOString() }).eq('expert_id', EXPERT_ID);
        } catch (e) { console.error(e); }
    };

    const handleSaveLocation = async (dateStr, type, name) => {
        const finalName = name || customLocationText;
        if (!finalName.trim()) return alert("Kirjoita tai valitse toimipiste!");

        const existingLoc = dailyLocations.find(l => l.date === dateStr);
        const isCurrentlyRemote = existingLoc?.location_type === 'eta' || (!existingLoc && smartSuggestions[dateStr]?.type === 'eta');

        try {
            if (type === 'eta_pankki') {
                await supabase.schema('espan').from('expert_remote_bank_ledger').insert([{ expert_id: EXPERT_ID, transaction_type: -1, used_date: dateStr, expiration_date: '2099-12-31', description: 'Käytetty pankkipäivä' }]);
                type = 'eta_pankki'; 
            } else if (type.includes('lahityo') && isCurrentlyRemote) {
                const wantToBank = window.confirm("Muutit sääntömääräisen etäpäivän lähityöksi. Haluatko tallettaa tämän uhratun etäpäivän pankkiin myöhempää käyttöä varten?");
                if (wantToBank) {
                    const expDate = addDays(new Date(), 28);
                    await supabase.schema('espan').from('expert_remote_bank_ledger').insert([{ expert_id: EXPERT_ID, transaction_type: 1, earned_date: dateStr, expiration_date: formatDateLocal(expDate), description: `Uhrattu etäpäivä (${finalName})` }]);
                }
            }

            await supabase.schema('espan').from('expert_daily_locations').upsert({ expert_id: EXPERT_ID, date: dateStr, location_type: type, location_name: finalName.trim(), is_auto_generated: false }, { onConflict: 'expert_id, date' });
            setCustomLocationText('');
            setActiveLocationPopover(null);
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleRemoveLocation = async (dateStr) => {
        try { await supabase.schema('espan').from('expert_daily_locations').delete().eq('expert_id', EXPERT_ID).eq('date', dateStr); setActiveLocationPopover(null); fetchData(); } catch (e) { console.error(e); }
    };

    const handleOptimizeCalendar = async () => {
        setSaving(true);
        try {
            const response = await fetch('/.netlify/functions/optimize-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expert_id: EXPERT_ID }) });
            if (!response.ok) throw new Error('Palvelin palautti virheen.');
            alert("Automaatti suoritettu onnistuneesti!");
            fetchData(); 
        } catch (e) { console.error(e); alert("Optimointi epäonnistui. Tarkista konsoli."); } finally { setSaving(false); }
    };

    const handleLockCurrentWeek = async () => {
        try {
            const updates = weekDays.map(async (d) => {
                const dStr = formatDateLocal(d);
                const loc = dailyLocations.find(l => l.date === dStr);
                if (loc && loc.is_auto_generated) return supabase.schema('espan').from('expert_daily_locations').update({ is_auto_generated: false }).eq('id', loc.id);
                return Promise.resolve();
            });
            await Promise.all(updates);
            alert("Tämän viikon ehdotukset lukittu virallisiksi työskentelypaikoiksi.");
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleResetSuggestions = async () => {
        if (!window.confirm("Haluatko varmasti pyyhkiä kaikki automaattisesti luodut haamuehdotukset?")) return;
        try { await supabase.schema('espan').from('expert_daily_locations').delete().eq('expert_id', EXPERT_ID).eq('is_auto_generated', true); fetchData(); } catch (e) { console.error(e); }
    };

    const executeBlockSave = async (startDate, endDate) => {
        let currentD = new Date(startDate);
        const endD = new Date(endDate || startDate);
        while (currentD <= endD) {
            const dayOfWeek = currentD.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dStr = formatDateLocal(currentD);
                const startOfDay = `${dStr} 00:00:00`;
                await supabase.schema('espan').from('availability').delete().eq('expert_id', EXPERT_ID).gte('start_time', startOfDay).lte('start_time', `${dStr} 23:59:59`);
                await supabase.schema('espan').from('availability').insert([{ expert_id: EXPERT_ID, start_time: startOfDay, meeting_type: 'estetty', is_blocked: true, contact_method: 'kaynti' }]);
            }
            currentD.setDate(currentD.getDate() + 1);
        }
    };

    const handleSaveQuickModal = async () => {
        setSaving(true);
        try { await executeBlockSave(quickModal.startDate, quickModal.endDate); setQuickModal({ isOpen: false, startDate: '', endDate: '' }); fetchData(); } catch (error) { console.error(error); } finally { setSaving(false); }
    };

    const handleProcessBlockAction = async () => {
        if (!selectedBlock) return;
        setSaving(true);
        try {
            if (selectedBlock.actionType === 'delete_rule') { await supabase.schema('espan').from('expert_availability_rules').delete().eq('id', selectedBlock.data.id); } else if (selectedBlock.actionType === 'delete_exception') { await supabase.schema('espan').from('availability').delete().eq('id', selectedBlock.data.id); } else if (selectedBlock.actionType === 'cancel_booking') { await supabase.schema('espan').from('availability').update({ is_blocked: false }).eq('id', selectedBlock.data.id); }
            setSelectedBlock(null); fetchData();
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    const blockedDaysStrs = useMemo(() => exceptions.filter(e => e.is_blocked && parseDBDateLocal(e.start_time).timeStr === '00:00').map(e => parseDBDateLocal(e.start_time).datePart), [exceptions]);
    const holidayStrs = useMemo(() => nationalHolidays.map(h => h.date), [nationalHolidays]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
            
            {/* ================= PÄÄKYTKIN (CONTEXT SWITCH) ================= */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-0.5rem' }}>
                <div style={{ 
                    display: 'flex', 
                    backgroundColor: 'rgba(0,0,0,0.04)', 
                    padding: '4px', 
                    borderRadius: '24px', 
                    border: '1px solid var(--color-border)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <button
                        onClick={() => setActiveView('locations')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: 'bold', transition: 'all 0.3s ease',
                            backgroundColor: activeView === 'locations' ? '#fff' : 'transparent',
                            color: activeView === 'locations' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            boxShadow: activeView === 'locations' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Calendar size={18} /> Kalenteri & Sijainnit
                    </button>
                    <button
                        onClick={() => setActiveView('journeys')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: 'bold', transition: 'all 0.3s ease',
                            backgroundColor: activeView === 'journeys' ? '#fff' : 'transparent',
                            color: activeView === 'journeys' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            boxShadow: activeView === 'journeys' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Ticket size={18} /> Matkat & Kuitit
                    </button>
                </div>
            </div>

            {/* ================= NÄKYMÄ 1: KALENTERI & SIJAINNIT ================= */}
            {activeView === 'locations' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-in-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                            <Link size={20} />
                            <span className="text-sm fw-bold">Tietoturvallinen WebCAL-syöte ulkoiseen kalenteriisi:</span>
                        </div>
                        <input type="text" readOnly value={webCalUrl} className="font-mono text-xs text-secondary" style={{ flex: 1, background: 'var(--color-background)', border: '1px solid var(--color-border)', padding: '0.4rem', borderRadius: '4px' }} />
                        <Button variant="secondary" size="sm" icon={Copy} onClick={() => { navigator.clipboard.writeText(webCalUrl); alert('Kalenterilinkki kopioitu!'); }}>Kopioi linkki</Button>
                    </div>

                    <LocationPlanner 
                        currentWeekStart={currentWeekStart}
                        dailyLocations={dailyLocations}
                        exceptions={exceptions}
                        nationalHolidays={nationalHolidays}
                        settings={settings}
                        ledgerBalance={ledgerBalance}
                        onSettingsChange={handleSettingsChange}
                        onOptimize={handleOptimizeCalendar}
                        onLockWeek={handleLockCurrentWeek}
                        onResetSuggestions={handleResetSuggestions}
                    />

                    {quickModal.isOpen && (
                        <div onClick={() => setQuickModal({ isOpen: false, startDate: '', endDate: '' })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '420px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--color-danger)' }}>
                                    <Palmtree size={28} /><h3 className="text-xl fw-bold m-0">Aseta loma tai esto</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <label className="text-sm fw-semibold text-primary">Mistä (Alkaen)</label>
                                        <input type="date" className="modern-input mt-1" value={quickModal.startDate} onChange={e => setQuickModal({...quickModal, startDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm fw-semibold text-primary">Mihin (Päättyen)</label>
                                        <input type="date" className="modern-input mt-1" value={quickModal.endDate} onChange={e => setQuickModal({...quickModal, endDate: e.target.value})} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Button variant="danger" onClick={handleSaveQuickModal} disabled={saving} fullWidth>Aseta esto(t)</Button>
                                    <Button variant="secondary" onClick={() => setQuickModal({ isOpen: false, startDate: '', endDate: '' })} fullWidth>Peruuta</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedBlock && (
                        <div onClick={() => setSelectedBlock(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '380px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                                        <Info size={24} /><h3 className="text-lg fw-bold m-0">Merkinnän tiedot</h3>
                                    </div>
                                    <button onClick={() => setSelectedBlock(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={20} /></button>
                                </div>
                                <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
                                    <div className="fw-bold mb-1" style={{ fontSize: '1.1rem' }}>{selectedBlock.title}</div>
                                    <div className="text-secondary font-mono text-sm mb-2">{selectedBlock.timeInfo}</div>
                                    {selectedBlock.contact_method && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                            {renderContactIcon(selectedBlock.contact_method, 16)}
                                            <span>{selectedBlock.contact_method === 'puhelu' ? 'Etä/Puhelu' : 'Lähitapaaminen'}</span>
                                        </div>
                                    )}
                                </div>
                                {selectedBlock.actionType === 'cancel_booking' ? (
                                    <Button variant="warning" icon={UserX} onClick={handleProcessBlockAction} disabled={saving} fullWidth>Peruuta varaus (Vapauta aika)</Button>
                                ) : (
                                    <Button variant="danger" icon={Trash2} onClick={handleProcessBlockAction} disabled={saving} fullWidth>Poista kalenterista pysyvästi</Button>
                                )}
                            </div>
                        </div>
                    )}

                    <Card 
                        title="Asiantuntijan kalenteriruudukko (Liukumat 07:00 - 19:00)" 
                        icon={Calendar}
                        headerAction={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-background)', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} />
                                <Button variant="secondary" size="sm" onClick={() => setCurrentWeekStart(getMonday(new Date()))} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>Tämä viikko</Button>
                                <span className="text-sm fw-semibold font-mono" style={{ minWidth: '140px', textAlign: 'center' }}>
                                    {formatDateLocal(weekDays[0]).split('-').reverse().join('.')} – {formatDateLocal(weekDays[4]).split('-').reverse().join('.')}
                                </span>
                                <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} />
                            </div>
                        }
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(48, minmax(26px, 1fr))', gap: '1px', backgroundColor: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: '4px', position: 'relative' }}>
                            
                            <div style={{ backgroundColor: 'var(--color-surface)' }}></div>
                            {weekDays.map((d, index) => {
                                const dStr = formatDateLocal(d);
                                const isBlocked = blockedDaysStrs.includes(dStr);
                                const isHoliday = holidayStrs.includes(dStr);
                                const loc = dailyLocations.find(l => l.date === dStr);
                                const sugg = smartSuggestions[dStr];

                                const isUserLocked = loc && !loc.is_auto_generated;
                                const isBankDay = loc?.location_type === 'eta_pankki';
                                const isInternalWork = loc?.location_type.startsWith('sisatyot_');

                                return (
                                    <div key={index} className="text-center" style={{ backgroundColor: isBlocked ? '#fef2f2' : (isHoliday ? '#fdf4ff' : 'var(--color-surface)'), padding: '0.5rem 0', position: 'relative', borderBottom: '1px solid var(--color-border)' }}>
                                        <div className="text-sm fw-semibold text-primary">{['Ma', 'Ti', 'Ke', 'To', 'Pe'][index]}</div>
                                        <div className="text-xs text-secondary mb-1">{d.getDate()}.{d.getMonth()+1}.</div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '4px' }}>
                                            <button 
                                                onClick={() => setActiveLocationPopover(activeLocationPopover === dStr ? null : dStr)}
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

                                            {activeLocationPopover === dStr && (
                                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <div className="text-xs fw-bold text-secondary text-left mb-1">Muuta sijaintia:</div>
                                                    
                                                    {ledgerBalance > 0 && !isBankDay && (
                                                        <button onClick={() => handleSaveLocation(dStr, 'eta_pankki', 'Pankki-etäpäivä')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: '1px solid var(--color-success)', color: 'var(--color-success)', background: 'rgba(30,154,90,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', fontWeight: 'bold' }}>
                                                            <Landmark size={14} /> Käytä pankkipäivä
                                                        </button>
                                                    )}

                                                    <button onClick={() => handleSaveLocation(dStr, 'eta', 'Etätyö')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><Home size={14} /> Etätyö</button>
                                                    <button onClick={() => handleSaveLocation(dStr, 'lahityo', 'Malminkatu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><Building size={14} /> Malminkatu</button>
                                                    <button onClick={() => handleSaveLocation(dStr, 'lahityo', 'Viipurinkatu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><Building size={14} /> Viipurinkatu</button>
                                                    
                                                    <div style={{ margin: '4px 0', borderTop: '1px solid var(--color-border)' }}></div>
                                                    
                                                    {/* UUDET: Sisäisen työn vaihtoehdot (Ei asiakasaikoja) */}
                                                    <button onClick={() => handleSaveLocation(dStr, 'sisatyot_eta', 'Ei asiakasaikoja (Etä)')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', color: '#475569' }}><Lock size={14} /> Ei asiakasaikoja (Etä)</button>
                                                    <button onClick={() => handleSaveLocation(dStr, 'sisatyot_lahityo', 'Ei asiakasaikoja (Toimisto)')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', color: '#475569' }}><Lock size={14} /> Ei asiakasaikoja (Toimisto)</button>

                                                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px', borderTop: '1px dashed var(--color-border)', paddingTop: '6px' }}>
                                                        <input type="text" placeholder="Muu paikka..." value={customLocationText} onChange={e => setCustomLocationText(e.target.value)} style={{ width: '100%', fontSize: '0.75rem', padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: '4px' }} />
                                                        <button onClick={() => handleSaveLocation(dStr, 'lahityo', null)} style={{ border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '4px', padding: '2px 6px' }}><Send size={12} /></button>
                                                    </div>
                                                    {loc && (
                                                        <button onClick={() => handleRemoveLocation(dStr)} style={{ marginTop: '4px', color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Vapauta automaatille</button>
                                                    )}
                                                </div>
                                            )}

                                            {!isBlocked && (
                                                <button onClick={() => setQuickModal({ isOpen: true, startDate: dStr, endDate: dStr })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', opacity: 0.4 }}><CalendarOff size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {Array.from({ length: 48 }).map((_, rowIndex) => {
                                const actualRow = rowIndex + 2;
                                const isFullHour = rowIndex % 4 === 0;
                                const hour = 7 + Math.floor(rowIndex / 4);
                                const isCoreOfficeHour = hour >= 9 && hour < 15;

                                return (
                                    <React.Fragment key={rowIndex}>
                                        {isFullHour ? (
                                            <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)', position: 'relative' }}>
                                                <span className="text-xs text-secondary fw-medium" style={{ position: 'absolute', right: '8px', top: '-8px' }}>{hour.toString().padStart(2, '0')}:00</span>
                                            </div>
                                        ) : (
                                            <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)' }} />
                                        )}
                                        {weekDays.map((_, colIndex) => (
                                            <div 
                                                key={colIndex} 
                                                style={{ 
                                                    gridColumn: colIndex + 2, 
                                                    gridRow: actualRow, 
                                                    backgroundColor: isCoreOfficeHour ? '#ffffff' : 'var(--color-background)', 
                                                    borderBottom: isFullHour ? '1px solid var(--color-border)' : '1px dashed rgba(0,0,0,0.03)' 
                                                }} 
                                            />
                                        ))}
                                    </React.Fragment>
                                );
                            })}

                            {weekDays.map((d, dayIndex) => {
                                const dStr = formatDateLocal(d);
                                const holiday = nationalHolidays.find(h => h.date === dStr);

                                if (holiday) {
                                    return (
                                        <div key={`holiday-bg-${dStr}`} style={{ gridColumn: dayIndex + 2, gridRow: '2 / 50', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(45deg, #fdf4ff, #fdf4ff 10px, #fae8ff 10px, #fae8ff 20px)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #d946ef', color: '#c026d3', fontWeight: 'bold', transform: 'rotate(-90deg)' }}>
                                                <Flag size={14} /> PYHÄ: {holiday.name.toUpperCase()}
                                            </div>
                                        </div>
                                    );
                                }

                                if (blockedDaysStrs.includes(dStr)) {
                                    return (
                                        <div key={`blocked-bg-${dStr}`} style={{ gridColumn: dayIndex + 2, gridRow: '2 / 50', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(45deg, #fef2f2, #fef2f2 10px, #fee2e2 10px, #fee2e2 20px)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #fca5a5', color: '#ef4444', fontWeight: 'bold', transform: 'rotate(-90deg)' }}>
                                                <Palmtree size={14} /> LOMA / SULJETTU
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}

                            {/* ================= 1. RUNKOSÄÄNNÖT (KEHYS / ASTIA) ================= */}
                            {rules.filter(r => {
                                const dStr = formatDateLocal(weekDays[r.day_of_week - 1]);
                                if (blockedDaysStrs.includes(dStr)) return false;
                                if (r.valid_until && dStr > r.valid_until.substring(0, 10)) return false; 
                                return true;
                            }).map(rule => {
                                const dStr = formatDateLocal(weekDays[rule.day_of_week - 1]);
                                const dayLoc = dailyLocations.find(l => l.date === dStr);
                                
                                // HAISTELLAAN TULKKIMUUTOKSET REAALIAJASSA
                                const isTranslatedToRemote = dayLoc && !dayLoc.is_auto_generated && dayLoc.location_type === 'eta' && rule.contact_method === 'kaynti';
                                const isTranslatedToOffice = dayLoc && !dayLoc.is_auto_generated && dayLoc.location_type === 'lahityo' && rule.contact_method === 'puhelu';
                                const isTranslated = isTranslatedToRemote || isTranslatedToOffice;
                                const isInternalWork = dayLoc && dayLoc.location_type.startsWith('sisatyot_'); // UUSI: Onko päivä sisäistä työtä
                                const effectiveMethod = isTranslatedToRemote ? 'puhelu' : (isTranslatedToOffice ? 'kaynti' : rule.contact_method);

                                const baseStyle = getMeetingStyle(rule.meeting_type, false);

                                return (
                                    <div 
                                        key={`rule-${rule.id}`} 
                                        onClick={() => setSelectedBlock({ data: rule, actionType: 'delete_rule', title: `Runkosääntö: ${getMeetingLabel(rule.meeting_type)}`, timeInfo: `${['Ma','Ti','Ke','To','Pe'][rule.day_of_week - 1]} klo ${rule.start_time.substring(0,5)}`, contact_method: rule.contact_method })}
                                        style={{ 
                                            ...getGridPlacement(rule.day_of_week - 1, rule.start_time, rule.end_time), 
                                            ...baseStyle,
                                            backgroundColor: isInternalWork ? 'rgba(241, 245, 249, 0.6)' : 'rgba(248, 250, 252, 0.4)', // Sisäisessä työssä harmaa tausta
                                            border: isInternalWork ? '1px dashed #94a3b8' : `1px dashed ${baseStyle.color}`,       
                                            color: isInternalWork ? '#64748b' : baseStyle.color, // Harmaa teksti sisäisessä työssä
                                            margin: '2px', 
                                            borderRadius: '4px', 
                                            padding: '0.25rem 0.5rem', 
                                            zIndex: 4, 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            overflow: 'hidden', 
                                            cursor: 'pointer' 
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span className="text-xs fw-semibold" style={{ lineHeight: 1.1 }}>
                                                {getMeetingLabel(rule.meeting_type)}
                                                {isTranslatedToRemote && ' (Etänä)'}
                                                {isTranslatedToOffice && ' (Lähityönä)'}
                                            </span>
                                            
                                            {/* UUSI: VISUAALINEN ILMOITUS TULKKIMUUTOKSESTA TAI ESTOSTA */}
                                            {isInternalWork ? (
                                                <Lock size={12} color="#94a3b8" />
                                            ) : isTranslated ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'var(--color-surface)', padding: '1px 4px', borderRadius: '3px', border: `1px solid ${baseStyle.color}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                    {renderContactIcon(effectiveMethod, 10)}
                                                    <span style={{ fontSize: '0.55rem', fontWeight: '800', color: baseStyle.color }}>⚡Sopeutettu</span>
                                                </div>
                                            ) : (
                                                renderContactIcon(rule.contact_method, 12)
                                            )}
                                        </div>
                                        <span className="text-xs font-mono" style={{ opacity: 0.8, marginTop: 'auto' }}>{rule.start_time.substring(0,5)}</span>
                                    </div>
                                );
                            })}

                            {/* ================= 2. VARATUT AJAT (SISÄLTÖ) ================= */}
                            {exceptions.filter(e => parseDBDateLocal(e.start_time).timeStr !== '00:00').map(exc => {
                                const { datePart, timeStr } = parseDBDateLocal(exc.start_time);
                                const dayIndex = weekDays.findIndex(d => formatDateLocal(d) === datePart);
                                if (dayIndex === -1 || blockedDaysStrs.includes(datePart)) return null;

                                const isBooked = exc.is_blocked && exc.meeting_type !== 'estetty';
                                const actionType = isBooked ? 'cancel_booking' : 'delete_exception';
                                
                                const typeConfig = meetingTypes.find(t => t.id === exc.meeting_type) || meetingTypes[0];

                                // MUOTOILLAAN VARATUT AJAT ISTUMAAN NÄTISTI KEHYKSEN SISÄÄN (VIBRANT LOOK)
                                const excStyle = isBooked ? {
                                    backgroundColor: typeConfig.color, // Täysin solid, voimakas taustaväri
                                    color: '#ffffff',                  // Valkoinen kontrastiteksti
                                    border: 'none',
                                    width: 'calc(100% - 12px)',        // Sisäänvedetty marginaali (Loksahdus-efekti)
                                    margin: '2px auto',
                                    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.16)',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    zIndex: 10, // Aina kehyksen päällä
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    cursor: 'pointer'
                                } : {
                                    ...getMeetingStyle(exc.meeting_type, exc.is_blocked),
                                    margin: '2px 4px',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    cursor: 'pointer'
                                };

                                return (
                                    <div 
                                        key={`exc-${exc.id}`} 
                                        onClick={() => setSelectedBlock({ data: exc, actionType: actionType, title: isBooked ? `Varattu: ${getMeetingLabel(exc.meeting_type)}` : `Avoin poikkeusaika: ${getMeetingLabel(exc.meeting_type)}`, timeInfo: `${datePart.split('-').reverse().join('.')} klo ${timeStr}`, contact_method: exc.contact_method })}
                                        style={{ ...getGridPlacement(dayIndex, timeStr, null), ...excStyle }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span className="text-xs fw-bold" style={{ lineHeight: 1.1 }}>
                                                {isBooked ? `VARATTU: ${getMeetingLabel(exc.meeting_type)}` : `Avoin: ${getMeetingLabel(exc.meeting_type)}`}
                                            </span>
                                            {renderContactIcon(exc.contact_method, 12)}
                                        </div>
                                        <span className="text-xs font-mono" style={{ marginTop: 'auto', opacity: isBooked ? 0.9 : 0.9 }}>{timeStr}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <AvailabilityForms 
                        expertId={EXPERT_ID} 
                        rules={rules} 
                        exceptions={exceptions} 
                        fetchData={fetchData} 
                    />

                </div>
            ) : (
            /* ================= NÄKYMÄ 2: MATKAT & KUITIT ================= */
                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                    <JourneyManager />
                </div>
            )}

        </div>
    );
};

export default AvailabilityManager;