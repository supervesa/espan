// --- src/components/admin/AvailabilityManager.jsx ---
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import DataTable from '../common/DataTable';
import LocationPlanner from './LocationPlanner'; // UUSI alikomponentti
import { 
    Calendar, Clock, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, 
    CalendarPlus, CalendarOff, Palmtree, MapPin, Phone, Info, X, UserX,
    Home, Building, Link, Copy, Check, Send
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

// KORJATTU: Älykäs aikavyöhyketulkinta UTC -> Suomen paikallinen aika
const parseDBDateLocal = (dbString) => {
    if (!dbString) return { datePart: '', timeStr: '', isWholeDay: false };
    
    // Jos kyseessä on koko päivän esto (00:00:00 UTC)
    if (dbString.includes('00:00:00')) {
        return {
            datePart: dbString.substring(0, 10),
            timeStr: '00:00',
            isWholeDay: true
        };
    }
    
    // Normaali varaus dynaamisesti Suomen paikalliseen aikaan (+2h / +3h)
    const d = new Date(dbString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return {
        datePart: `${year}-${month}-${day}`,
        timeStr: `${hours}:${minutes}`,
        isWholeDay: false
    };
};

const AvailabilityManager = () => {
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    const [rules, setRules] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [dailyLocations, setDailyLocations] = useState([]); // UUSI: Toimipaikka/etätiedot kannasta
    const [loading, setLoading] = useState(true);

    const [newRule, setNewRule] = useState({ 
        day_of_week: 1, meeting_type: 'normi', start_time: '09:00', end_time: '10:00', 
        useBatch: false, duration: 60, pause: 15, valid_until: '',
        contact_method: 'kaynti'
    });
    
    const [newException, setNewException] = useState({ 
        startDate: '', endDate: '', time: '09:00', meeting_type: 'aktivointi', is_blocked: false,
        contact_method: 'kaynti'
    });
    
    const [isFullDayBlock, setIsFullDayBlock] = useState(false);
    const [saving, setSaving] = useState(false);
    const [quickModal, setQuickModal] = useState({ isOpen: false, startDate: '', endDate: '' });
    const [selectedBlock, setSelectedBlock] = useState(null);
    
    // UUDET: Tilat toimipistevalinnoille ja vapaalle tekstille
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

    useEffect(() => {
        fetchData();
    }, [currentWeekStart]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: rulesData, error: rulesError } = await supabase
                .schema('espan')
                .from('expert_availability_rules')
                .select('*')
                .eq('expert_id', EXPERT_ID)
                .order('day_of_week')
                .order('start_time');
            if (rulesError) throw rulesError;

            // Laajennetaan aikaväli hakuun 4 viikon seurantajaksoa varten (-7pv ... +21pv)
            const queryStart = formatDateLocal(addDays(currentWeekStart, -7)); 
            const queryEnd = formatDateLocal(addDays(currentWeekStart, 21));
            
            const { data: exceptionsData, error: expError } = await supabase
                .schema('espan')
                .from('availability')
                .select('*')
                .eq('expert_id', EXPERT_ID)
                .gte('start_time', `${queryStart} 00:00:00`)
                .lte('start_time', `${queryEnd} 23:59:59`)
                .order('start_time');
            if (expError) throw expError;

            // Haetaan päiväkohtaiset toimipaikat/etämerkinnät kannasta laajalta väliltä
            const { data: locData, error: locError } = await supabase
                .schema('espan')
                .from('expert_daily_locations')
                .select('*')
                .eq('expert_id', EXPERT_ID)
                .gte('date', queryStart)
                .lte('date', queryEnd);
            if (locError) throw locError;

            setRules(rulesData || []);
            setExceptions(exceptionsData || []);
            setDailyLocations(locData || []);
        } catch (error) {
            console.error("Virhe tiedonhaussa:", error);
        } finally {
            setLoading(false);
        }
    };

    const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => addDays(currentWeekStart, i)), [currentWeekStart]);
    
    // Dynaaminen WebCAL-osoite pelkille etä/toimistopäiville (tietoturvallinen)
    const webCalUrl = useMemo(() => {
        return `webcal://espan-api.netlify.app/functions/webcal?expert_id=${EXPERT_ID}`;
    }, []);

    // UUSI: Älykkäät ehdotukset perustuen torstain painovoimaan ja poikkeuksiin
    const smartSuggestions = useMemo(() => {
        const suggestions = {};
        weekDays.forEach(d => {
            const dStr = formatDateLocal(d);
            const dayOfWeek = d.getDay(); // 1=Ma, 2=Ti, 3=Ke, 4=To, 5=Pe

            // Tarkistetaan onko päivä kokonaan estetty/loma
            const isBlockedDay = exceptions.some(e => 
                e.is_blocked && e.meeting_type === 'estetty' && parseDBDateLocal(e.start_time).datePart === dStr
            );
            if (isBlockedDay) return;

            if (dayOfWeek === 4) {
                // Torstai on kiinteä kokouspäivä toimistolla
                suggestions[dStr] = { type: 'lahityo', name: 'Malminkatu', label: 'Ehdotus: Malminkatu (Kokouspäivä)' };
            } else if (dayOfWeek === 3) {
                // Keskiviikko on matkapäivä VAIN JOS torstaina on lähityöpäivä toimistolla
                const thuDateStr = formatDateLocal(addDays(d, 1));
                const thuLoc = dailyLocations.find(l => l.date === thuDateStr);
                const thuBlocked = exceptions.some(e => 
                    e.is_blocked && e.meeting_type === 'estetty' && parseDBDateLocal(e.start_time).datePart === thuDateStr
                );

                // Jos torstaina ollaan toimistolla (tai torstailla on voimassa oletusehdotus eikä sitä ole peruttu/estetty)
                if (!thuBlocked && (thuLoc?.location_type === 'lahityo' || (!thuLoc && true))) {
                    suggestions[dStr] = { type: 'lahityo', name: 'Malminkatu', label: 'Ehdotus: Malminkatu (Matkapäivä)' };
                } else {
                    suggestions[dStr] = { type: 'eta', name: 'Etätyö', label: 'Ehdotus: Etätyö' };
                }
            } else {
                // Muut päivät oletuksena etätyötä tavoitteen saavuttamiseksi
                suggestions[dStr] = { type: 'eta', name: 'Etätyö', label: 'Ehdotus: Etätyö' };
            }
        });
        return suggestions;
    }, [weekDays, dailyLocations, exceptions]);

    const meetingTypes = [
        { id: 'normi', label: 'Normaali', color: 'var(--color-primary)', bg: 'rgba(255, 107, 0, 0.1)' },
        { id: 'aktivointi', label: 'Aktivointi', color: 'var(--color-success)', bg: 'rgba(30, 154, 90, 0.1)' },
        { id: 'taydentava', label: 'Täydentävä', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' }
    ];

    const getMeetingStyle = (typeId, isBlocked = false) => {
        const typeConfig = meetingTypes.find(t => t.id === typeId) || meetingTypes[0];
        
        if (isBlocked && typeId === 'estetty') {
            return { backgroundColor: '#fef2f2', border: '1px dashed #e34a4a', color: '#e34a4a' };
        }
        if (isBlocked && typeId !== 'estetty') {
            return { 
                backgroundColor: 'var(--color-surface)', border: `1px dashed ${typeConfig.color}`, 
                color: typeConfig.color, opacity: 0.65 
            };
        }
        return { 
            backgroundColor: typeConfig.bg, border: `2px solid ${typeConfig.color}`, 
            color: typeConfig.color 
        };
    };

    const getMeetingLabel = (typeId) => meetingTypes.find(t => t.id === typeId)?.label || typeId;
    const renderContactIcon = (method, size = 14) => method === 'puhelu' ? <Phone size={size} /> : <MapPin size={size} />;

    // KORJATTU: Liukuva aikarajaus 07:00 - 19:00 (Yhteensä 48 pystyriviä gridissä)
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

    const addMinutes = (timeStr, minsToAdd) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + minsToAdd, 0);
        return date.toTimeString().substring(0, 5);
    };

    const timeToMins = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const handleStartTimeChange = (val) => {
        setNewRule(prev => ({
            ...prev,
            start_time: val,
            end_time: prev.useBatch ? prev.end_time : addMinutes(val, 60)
        }));
    };

    // UUSI: Sijaintitiedon tallennus (Määrätyt paikat ja vapaa teksti)
    const handleSaveLocation = async (dateStr, type, name) => {
        const finalName = name || customLocationText;
        if (!finalName.trim()) return alert("Kirjoita tai valitse toimipiste!");

        try {
            const { error } = await supabase.schema('espan').from('expert_daily_locations').upsert({
                expert_id: EXPERT_ID,
                date: dateStr,
                location_type: type,
                location_name: finalName.trim()
            }, { onConflict: 'expert_id, date' });

            if (error) throw error;
            setCustomLocationText('');
            setActiveLocationPopover(null);
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleRemoveLocation = async (dateStr) => {
        try {
            await supabase.schema('espan').from('expert_daily_locations').delete().eq('expert_id', EXPERT_ID).eq('date', dateStr);
            setActiveLocationPopover(null);
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const executeBlockSave = async (startDate, endDate) => {
        let currentD = new Date(startDate);
        const endD = new Date(endDate || startDate);
        
        while (currentD <= endD) {
            const dayOfWeek = currentD.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dStr = formatDateLocal(currentD);
                const startOfDay = `${dStr} 00:00:00`;
                const endOfDay = `${dStr} 23:59:59`;

                await supabase.schema('espan').from('availability')
                    .delete()
                    .eq('expert_id', EXPERT_ID)
                    .gte('start_time', startOfDay)
                    .lte('start_time', endOfDay);

                const { error } = await supabase.schema('espan').from('availability').insert([{
                    expert_id: EXPERT_ID, start_time: startOfDay,
                    meeting_type: 'estetty', is_blocked: true, contact_method: 'kaynti'
                }]);
                if (error) throw error;
            }
            currentD.setDate(currentD.getDate() + 1);
        }
    };

    const handleSaveQuickModal = async () => {
        setSaving(true);
        try {
            await executeBlockSave(quickModal.startDate, quickModal.endDate);
            setQuickModal({ isOpen: false, startDate: '', endDate: '' });
            fetchData();
        } catch (error) { console.error(error); alert("Tallennus epäonnistui."); } finally { setSaving(false); }
    };

    const handleAddSingleOrException = async () => {
        if (!newException.startDate) return alert("Aseta päivä!");
        if (!isFullDayBlock && !newException.time) return alert("Aseta aika!");

        setSaving(true);
        try {
            if (newException.is_blocked && isFullDayBlock) {
                await executeBlockSave(newException.startDate, newException.endDate);
            } else {
                const timestamp = `${newException.startDate} ${newException.time}:00`;
                const { error } = await supabase.schema('espan').from('availability').upsert([{
                    expert_id: EXPERT_ID, start_time: timestamp,
                    meeting_type: newException.meeting_type, is_blocked: newException.is_blocked,
                    contact_method: newException.contact_method
                }], { onConflict: 'expert_id, start_time' }); 
                if (error) throw error;
            }
            setNewException(prev => ({ ...prev, startDate: '', endDate: '' }));
            setIsFullDayBlock(false);
            fetchData();
        } catch (error) { console.error(error); alert("Tallennus epäonnistui."); } finally { setSaving(false); }
    };

    const handleAddRule = async () => {
        if (!newRule.start_time || !newRule.end_time) return alert("Aseta ajat!");
        if (newRule.start_time >= newRule.end_time) return alert("Loppuajan pitää olla alkuajan jälkeen.");

        setSaving(true);
        try {
            const inserts = [];
            if (newRule.useBatch) {
                let currentStart = newRule.start_time;
                const endLimitMins = timeToMins(newRule.end_time);

                while (true) {
                    const currentEnd = addMinutes(currentStart, newRule.duration);
                    if (timeToMins(currentEnd) > endLimitMins) break;
                    inserts.push({
                        expert_id: EXPERT_ID, day_of_week: parseInt(newRule.day_of_week),
                        meeting_type: newRule.meeting_type, start_time: currentStart + ':00',
                        end_time: currentEnd + ':00', is_active: true, valid_until: newRule.valid_until || null,
                        contact_method: newRule.contact_method
                    });
                    currentStart = addMinutes(currentEnd, newRule.pause);
                    if (timeToMins(currentStart) >= endLimitMins) break;
                }
            } else {
                inserts.push({
                    expert_id: EXPERT_ID, day_of_week: parseInt(newRule.day_of_week),
                    meeting_type: newRule.meeting_type, start_time: newRule.start_time + ':00',
                    end_time: newRule.end_time + ':00', is_active: true, valid_until: newRule.valid_until || null,
                    contact_method: newRule.contact_method
                });
            }
            if (inserts.length === 0) { alert("Aikaväliin ei mahtunut yhtään tapaamista!"); setSaving(false); return; }

            const { error } = await supabase.schema('espan').from('expert_availability_rules').insert(inserts);
            if (error) throw error;
            fetchData();
        } catch (error) { console.error(error); } finally { setSaving(false); }
    };

    const handleDeleteRecord = async (table, id) => {
        if (!window.confirm("Haluatko varmasti poistaa tämän merkinnän?")) return;
        try {
            await supabase.schema('espan').from(table).delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleProcessBlockAction = async () => {
        if (!selectedBlock) return;
        setSaving(true);
        try {
            if (selectedBlock.actionType === 'delete_rule') {
                await supabase.schema('espan').from('expert_availability_rules').delete().eq('id', selectedBlock.data.id);
            } else if (selectedBlock.actionType === 'delete_exception') {
                await supabase.schema('espan').from('availability').delete().eq('id', selectedBlock.data.id);
            } else if (selectedBlock.actionType === 'cancel_booking') {
                await supabase.schema('espan').from('availability').update({ is_blocked: false }).eq('id', selectedBlock.data.id);
            }
            setSelectedBlock(null);
            fetchData();
        } catch (e) { console.error(e); alert("Toimenpide epäonnistui."); } finally { setSaving(false); }
    };

    const blockedDaysStrs = useMemo(() => {
        return exceptions
            .filter(e => e.is_blocked && parseDBDateLocal(e.start_time).timeStr === '00:00')
            .map(e => parseDBDateLocal(e.start_time).datePart);
    }, [exceptions]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
            
            {/* WEBCAL ETÄTILAUSLINKKI */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                    <Link size={20} />
                    <span className="text-sm fw-bold">Päivien WebCAL-etätilaus puhelimeen:</span>
                </div>
                <input type="text" readOnly value={webCalUrl} className="font-mono text-xs text-secondary" style={{ flex: 1, background: 'var(--color-background)', border: '1px solid var(--color-border)', padding: '0.4rem', borderRadius: '4px' }} />
                <Button variant="secondary" size="sm" icon={Copy} onClick={() => { navigator.clipboard.writeText(webCalUrl); alert('Linkki kopioitu leikepöydälle!'); }}>Kopioi syöte</Button>
            </div>

            {/* UUSI: ERISTETTY LASKURIKOMPONENTTI INTEGRATION */}
            <LocationPlanner 
                currentWeekStart={currentWeekStart}
                dailyLocations={dailyLocations}
                exceptions={exceptions}
            />

            {/* PIKAMODAALI LOMILLE / ESTOILLE */}
            {quickModal.isOpen && (
                <div onClick={() => setQuickModal({ isOpen: false, startDate: '', endDate: '' })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
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

            {/* INTERAKTIIVINEN MERKINNÄN HALLINTAMODAALI */}
            {selectedBlock && (
                <div onClick={() => setSelectedBlock(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
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

            {/* 1. KALENTERI (07:00 - 19:00) */}
            <Card 
                title="Asiantuntijan kalenteri (Liukuma 07:00 - 19:00)" 
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
                        const loc = dailyLocations.find(l => l.date === dStr);
                        const sugg = smartSuggestions[dStr];

                        return (
                            <div key={index} className="text-center" style={{ backgroundColor: isBlocked ? '#fef2f2' : 'var(--color-surface)', padding: '0.5rem 0', position: 'relative', borderBottom: '1px solid var(--color-border)' }}>
                                <div className="text-sm fw-semibold text-primary">{['Ma', 'Ti', 'Ke', 'To', 'Pe'][index]}</div>
                                <div className="text-xs text-secondary mb-1">{d.getDate()}.{d.getMonth()+1}.</div>
                                
                                {/* TOIMIPAIKKASELEKTORI (INTERAKTIIVINEN POPOVER) */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '4px' }}>
                                    <button 
                                        onClick={() => setActiveLocationPopover(activeLocationPopover === dStr ? null : dStr)}
                                        style={{
                                            border: 'none', background: loc ? 'var(--color-background)' : 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                                            color: loc ? (loc.location_type === 'eta' ? '#2563eb' : 'var(--color-primary)') : 'var(--color-text-secondary)',
                                            fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px'
                                        }}
                                    >
                                        {loc ? (
                                            <>
                                                {loc.location_type === 'eta' ? <Home size={12} /> : <Building size={12} />}
                                                <span>{loc.location_name}</span>
                                            </>
                                        ) : sugg ? (
                                            // Haamuehdotus, jos käyttäjä ei ole itse asettanut paikkaa
                                            <span style={{ opacity: 0.4, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                {sugg.type === 'eta' ? <Home size={12} /> : <Building size={12} />}
                                                {sugg.name}
                                            </span>
                                        ) : <Plus size={12} />}
                                    </button>

                                    {/* PIKAPOPOVER PAREMMILLA VALINNOILLA JA VAPAALLA TEKSTILLÄ */}
                                    {activeLocationPopover === dStr && (
                                        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div className="text-xs fw-bold text-secondary text-left mb-1">Valitse tai kirjoita sijainti:</div>
                                            <button onClick={() => handleSaveLocation(dStr, 'eta', 'Etätyö')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }} className="hover-bg"><Home size={14} /> Etätyö</button>
                                            <button onClick={() => handleSaveLocation(dStr, 'lahityo', 'Malminkatu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }} className="hover-bg"><Building size={14} /> Malminkatu</button>
                                            <button onClick={() => handleSaveLocation(dStr, 'lahityo', 'Viipurinkatu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }} className="hover-bg"><Building size={14} /> Viipurinkatu</button>
                                            
                                            <div style={{ display: 'flex', gap: '2px', marginTop: '4px', borderTop: '1px dashed var(--color-border)', paddingTop: '6px' }}>
                                                <input type="text" placeholder="Muu paikka..." value={customLocationText} onChange={e => setCustomLocationText(e.target.value)} style={{ width: '100%', fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                                                <button onClick={() => handleSaveLocation(dStr, 'lahityo', null)} style={{ border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}><Send size={12} /></button>
                                            </div>

                                            {loc && (
                                                <button onClick={() => handleRemoveLocation(dStr)} style={{ marginTop: '4px', color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', width: '100%' }}>Pyyhi merkintä</button>
                                            )}
                                        </div>
                                    )}

                                    {!isBlocked && (
                                        <button onClick={() => setQuickModal({ isOpen: true, startDate: dStr, endDate: dStr })} title="Aseta loma/esto" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', opacity: 0.4 }}><CalendarOff size={14} /></button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* LIUKUVA AIKAASTEIKKO JA YDINALUEEN (09:00 - 15:00) ERIVÄRINEN VALAISTUS */}
                    {Array.from({ length: 48 }).map((_, rowIndex) => {
                        const actualRow = rowIndex + 2;
                        const isFullHour = rowIndex % 4 === 0;
                        const hour = 7 + Math.floor(rowIndex / 4);
                        
                        // Korostetaan ydintoimistoajat 09:00 - 15:00 valkoisella, reuna-ajat harmahtavalla
                        const isCoreHour = hour >= 9 && hour < 15;

                        return (
                            <React.Fragment key={rowIndex}>
                                {isFullHour ? (
                                    <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)', position: 'relative' }}>
                                        <span className="text-xs text-secondary fw-medium" style={{ position: 'absolute', right: '8px', top: '-8px' }}>{hour.toString().padStart(2, '0')}:00</span>
                                    </div>
                                ) : (
                                    <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)' }}></div>
                                )}
                                {weekDays.map((_, colIndex) => (
                                    <div 
                                        key={colIndex} 
                                        style={{ 
                                            gridColumn: colIndex + 2, 
                                            gridRow: actualRow, 
                                            backgroundColor: isCoreHour ? '#ffffff' : 'var(--color-background)', // UUSI: Valaistusero
                                            borderBottom: isFullHour ? '1px solid var(--color-border)' : '1px dashed rgba(0,0,0,0.03)' 
                                        }} 
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}

                    {/* SULJETUT PÄIVÄT LAAJENNETTUNA KOKO VUOROKAUDEKSI */}
                    {weekDays.map((d, dayIndex) => {
                        const dStr = formatDateLocal(d);
                        if (!blockedDaysStrs.includes(dStr)) return null;
                        return (
                            <div key={`blocked-bg-${dStr}`} style={{
                                gridColumn: dayIndex + 2, gridRow: '2 / 50', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'repeating-linear-gradient(45deg, #fef2f2, #fef2f2 10px, #fee2e2 10px, #fee2e2 20px)'
                            }}>
                                <div style={{ backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #fca5a5', color: '#ef4444', fontWeight: 'bold', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>LOMA / SULJETTU</div>
                            </div>
                        );
                    })}

                    {/* TOISTUVAT RUNKOSÄÄNNÖT GRIDISSÄ */}
                    {rules.filter(r => {
                        const dStr = formatDateLocal(weekDays[r.day_of_week - 1]);
                        if (blockedDaysStrs.includes(dStr)) return false;
                        if (r.valid_until && dStr > r.valid_until.substring(0, 10)) return false; 
                        return true;
                    }).map(rule => (
                        <div 
                            key={`rule-${rule.id}`} 
                            onClick={() => setSelectedBlock({
                                data: rule, actionType: 'delete_rule', title: `Runkosääntö: ${getMeetingLabel(rule.meeting_type)}`,
                                timeInfo: `${['Ma','Ti','Ke','To','Pe'][rule.day_of_week - 1]} klo ${rule.start_time.substring(0,5)}`, contact_method: rule.contact_method
                            })}
                            style={{
                                ...getGridPlacement(rule.day_of_week - 1, rule.start_time, rule.end_time), ...getMeetingStyle(rule.meeting_type, false),
                                margin: '2px', borderRadius: '4px', padding: '0.25rem 0.5rem', zIndex: 5, display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span className="text-xs fw-semibold" style={{ lineHeight: 1.1 }}>{getMeetingLabel(rule.meeting_type)}</span>
                                {renderContactIcon(rule.contact_method, 12)}
                            </div>
                            <span className="text-xs font-mono" style={{ opacity: 0.8, marginTop: 'auto' }}>{rule.start_time.substring(0,5)}</span>
                        </div>
                    ))}

                    {/* YKSITTÄISET POIKKEUKSET JA KORJATUT REAALIAIKAISET VARAUKSET */}
                    {exceptions.filter(e => parseDBDateLocal(e.start_time).timeStr !== '00:00').map(exc => {
                        const { datePart, timeStr } = parseDBDateLocal(exc.start_time);
                        const dayIndex = weekDays.findIndex(d => formatDateLocal(d) === datePart);
                        if (dayIndex === -1 || blockedDaysStrs.includes(datePart)) return null;

                        const isBooked = exc.is_blocked && exc.meeting_type !== 'estetty';
                        const actionType = isBooked ? 'cancel_booking' : 'delete_exception';

                        return (
                            <div 
                                key={`exc-${exc.id}`} 
                                onClick={() => setSelectedBlock({
                                    data: exc, actionType: actionType, title: isBooked ? `Varattu: ${getMeetingLabel(exc.meeting_type)}` : `Avoin: ${getMeetingLabel(exc.meeting_type)}`,
                                    timeInfo: `${datePart.split('-').reverse().join('.')} klo ${timeStr}`, contact_method: exc.contact_method
                                })}
                                style={{
                                    ...getGridPlacement(dayIndex, timeStr, null), ...getMeetingStyle(exc.meeting_type, exc.is_blocked),
                                    margin: '2px 4px', borderRadius: '4px', padding: '0.25rem 0.5rem', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span className="text-xs fw-bold" style={{ lineHeight: 1.1 }}>
                                        {isBooked ? `VARATTU: ${getMeetingLabel(exc.meeting_type)}` : `Avoin: ${getMeetingLabel(exc.meeting_type)}`}
                                    </span>
                                    {renderContactIcon(exc.contact_method, 12)}
                                </div>
                                <span className="text-xs font-mono" style={{ marginTop: 'auto', opacity: 0.9 }}>{timeStr}</span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* 2. LOMAKKEET ALHAALLA TÄYSIN ENNALLEEN JÄTETTYNÄ */}
            <div className="grid-cols-2">
                <div className="flex-col-gap">
                    <Card title="Toistuvat viikkosäännöt (Runkosuunnitelma)" icon={Clock} variant="bordered">
                        <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Päivä</label>
                                    <select className="modern-select mt-2" value={newRule.day_of_week} onChange={e => setNewRule({...newRule, day_of_week: e.target.value})}>
                                        {['Ma', 'Ti', 'Ke', 'To', 'Pe'].map((name, i) => <option key={i} value={i+1}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Tyyppi</label>
                                    <select className="modern-select mt-2" value={newRule.meeting_type} onChange={e => setNewRule({...newRule, meeting_type: e.target.value})}>
                                        {meetingTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Alkaa klo</label>
                                    <input type="time" className="modern-input mt-2" value={newRule.start_time} onChange={e => handleStartTimeChange(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Päättyy klo</label>
                                    <input type="time" className="modern-input mt-2" value={newRule.end_time} onChange={e => setNewRule({...newRule, end_time: e.target.value})} />
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.5rem' }}>Oletustoteutustapa säännölle</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" onClick={() => setNewRule({...newRule, contact_method: 'kaynti'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newRule.contact_method === 'kaynti' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newRule.contact_method === 'kaynti' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newRule.contact_method === 'kaynti' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><MapPin size={16} /><span className="fw-semibold text-sm">Lähitapaaminen</span></button>
                                    <button type="button" onClick={() => setNewRule({...newRule, contact_method: 'puhelu'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newRule.contact_method === 'puhelu' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newRule.contact_method === 'puhelu' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newRule.contact_method === 'puhelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><Phone size={16} /><span className="fw-semibold text-sm">Puhelu/Etä</span></button>
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary">Sääntö voimassa asti (Valinnainen)</label>
                                <input type="date" className="modern-input mt-2" value={newRule.valid_until} onChange={e => setNewRule({...newRule, valid_until: e.target.value})} style={{ width: '100%' }} />
                            </div>
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-border)' }}>
                                <label className="modern-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input type="checkbox" className="modern-checkbox" checked={newRule.useBatch} onChange={e => setNewRule({...newRule, useBatch: e.target.checked})} />
                                    <span className="fw-semibold">Paloittele aikaväli (Batch-eräajo)</span>
                                </label>
                            </div>
                            <Button variant="primary" icon={Plus} disabled={saving} onClick={handleAddRule} fullWidth>Tallenna runkoaika</Button>
                        </div>
                        <DataTable 
                            data={rules} 
                            emptyMessage="Ei asetettuja runkoaikoja."
                            columns={[
                                { label: 'Ajankohta', render: (row) => `${['Ma', 'Ti', 'Ke', 'To', 'Pe'][row.day_of_week - 1]} klo ${row.start_time.substring(0,5)} - ${row.end_time.substring(0,5)}` },
                                { label: 'Tapa', render: (row) => (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                        {renderContactIcon(row.contact_method, 14)} {row.contact_method === 'puhelu' ? 'Puhelu' : 'Käynti'}
                                    </div>
                                )},
                                { label: 'Elinkaari', render: (row) => row.valid_until ? <span className="text-xs text-secondary">Asti: {row.valid_until.substring(0,10)}</span> : <span className="text-xs text-secondary">Toistaiseksi</span> },
                                { label: '', render: (row) => <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDeleteRecord('expert_availability_rules', row.id)} className="text-danger" /> }
                            ]}
                        />
                    </Card>
                </div>

                <div className="flex-col-gap">
                    <Card title="Yksittäiset päivät, lomat ja poikkeukset" icon={Palmtree} variant="bordered">
                        <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Valitse päivä</label>
                                    <input type="date" className="modern-input mt-2" value={newException.startDate} onChange={e => setNewException({...newException, startDate: e.target.value, endDate: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-sm fw-semibold text-primary">Aika</label>
                                    <input type="time" className="modern-input mt-2" value={newException.time} onChange={e => setNewException({...newException, time: e.target.value})} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-sm text-secondary">Toteutustapa poikkeukselle</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" onClick={() => setNewException({...newException, contact_method: 'kaynti'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newException.contact_method === 'kaynti' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newException.contact_method === 'kaynti' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newException.contact_method === 'kaynti' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><MapPin size={16} /><span className="fw-semibold text-sm">Lähitapaaminen</span></button>
                                    <button type="button" onClick={() => setNewException({...newException, contact_method: 'puhelu'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newException.contact_method === 'puhelu' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newException.contact_method === 'puhelu' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newException.contact_method === 'puhelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><Phone size={16} /><span className="fw-semibold text-sm">Puhelu/Etä</span></button>
                                </div>
                            </div>
                            <Button variant="primary" icon={Plus} disabled={saving} onClick={handleAddSingleOrException} fullWidth>Luo yksittäinen palveluaika</Button>
                        </div>
                        <DataTable 
                            data={exceptions} 
                            emptyMessage="Ei erillisiä aikamerkintöjä tälle viikolle."
                            columns={[
                                { label: 'Päivä & Klo', render: (row) => {
                                    const { datePart, timeStr } = parseDBDateLocal(row.start_time);
                                    const [y, m, d] = datePart.split('-');
                                    return `${parseInt(d)}.${parseInt(m)}. ${timeStr === '00:00' ? '(Koko pv)' : 'klo '+timeStr}`;
                                }},
                                { label: 'Tyyppi', render: (row) => {
                                    const isBooked = row.is_blocked && row.meeting_type !== 'estetty';
                                    return (
                                        <Badge variant={isBooked ? 'warning' : (row.is_blocked ? 'danger' : 'success')}>
                                            {isBooked ? `VARATTU: ${getMeetingLabel(row.meeting_type)}` : (row.is_blocked ? 'LOMA/ESTO' : `Avoin: ${getMeetingLabel(row.meeting_type)}`)}
                                        </Badge>
                                    );
                                }},
                                { label: 'Tapa', render: (row) => {
                                    if (row.meeting_type === 'estetty') return '-';
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                            {renderContactIcon(row.contact_method, 14)} {row.contact_method === 'puhelu' ? 'Puhelu' : 'Käynti'}
                                        </div>
                                    );
                                }},
                                { label: '', render: (row) => <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDeleteRecord('availability', row.id)} className="text-danger" /> }
                            ]}
                        />
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityManager;