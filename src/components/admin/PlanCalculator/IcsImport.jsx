// --- src/components/admin/PlanCalculator/IcsImport.jsx ---
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient'; 
import Card from '../../common/Card';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import AlertBox from '../../common/AlertBox';
import { Calendar, Upload, Loader2, CheckCircle, AlertTriangle, BookOpen, UserCheck, PhoneCall, Trash2, DoorOpen, Save, Info } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const IcsImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    
    // Yhteinen sanakirja tietokannasta
    const [dictionary, setDictionary] = useState([]);
    
    // Pre-flight Check -jonot
    const [isStaging, setIsStaging] = useState(false);
    const [autoQueue, setAutoQueue] = useState([]);      // 🟢 Automaattiset
    const [roomQueue, setRoomQueue] = useState([]);      // 🟢 Huonevaraukset
    const [teachQueue, setTeachQueue] = useState([]);    // 🟡 Opetettavat
    const [manualQueue, setManualQueue] = useState([]);  // 🟠 Manuaaliset (ilman viivaa)
    
    // Asiantuntijan tekemät valinnat esikatselussa
    const [teachConfigs, setTeachConfigs] = useState({}); 
    const [manualConfigs, setManualConfigs] = useState({});
    
    const [skippedCount, setSkippedCount] = useState(0);
    const fileInputRef = useRef(null);

    // 1. Ladataan tiimin yhteinen sanakirja tietokannasta
    const fetchDictionary = async () => {
        try {
            const { data, error } = await supabase.schema('espan').from('ics_dictionary').select('*');
            if (!error && data) {
                setDictionary(data);
            }
        } catch (error) {
            console.error("Virhe sanakirjan latauksessa:", error);
        }
    };

    useEffect(() => {
        fetchDictionary();
    }, []);

    // --- Apu- ja purkufunktiot ---
    const parseIcsDate = (dateStr) => {
        if (!dateStr) return null;
        const cleanStr = dateStr.includes(':') ? dateStr.split(':').pop().trim() : dateStr.trim();
        
        if (cleanStr.length === 8) {
            const y = cleanStr.substring(0, 4);
            const m = cleanStr.substring(4, 6);
            const d = cleanStr.substring(6, 8);
            return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
        } else if (cleanStr.length >= 15) {
            const y = cleanStr.substring(0, 4);
            const m = cleanStr.substring(4, 6);
            const d = cleanStr.substring(6, 8);
            const h = cleanStr.substring(9, 11);
            const min = cleanStr.substring(11, 13);
            const s = cleanStr.substring(13, 15);
            const isUTC = cleanStr.endsWith('Z');
            return isUTC ? new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString() : new Date(`${y}-${m}-${d}T${h}:${min}:${s}`).toISOString();
        }
        return null;
    };

    const expandRRule = (events) => {
        const expanded = [];
        events.forEach(ev => {
            if (!ev.rrule || !ev.start) {
                expanded.push(ev);
                return;
            }
            const rules = {};
            ev.rrule.split(';').forEach(p => {
                const [k, v] = p.split('=');
                if (k && v) rules[k] = v;
            });

            if (rules.FREQ !== 'WEEKLY' && rules.FREQ !== 'DAILY') {
                expanded.push(ev);
                return;
            }

            const startIso = parseIcsDate(ev.start);
            const endIso = parseIcsDate(ev.end) || startIso;
            if (!startIso) return;

            const startDate = new Date(startIso);
            const endDate = new Date(endIso);
            const durationMs = endDate.getTime() - startDate.getTime();

            const maxCount = parseInt(rules.COUNT) || 50; 
            const untilDate = rules.UNTIL ? new Date(parseIcsDate(rules.UNTIL)).getTime() : null;
            const validDays = rules.BYDAY ? rules.BYDAY.split(',') : null;
            const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

            let occurrences = 0;
            let loopDate = new Date(startDate);
            let safety = 0;

            // Korjattu kellonajan irrotus, joka hylkää timezone-tekstit
            const extractTime = (rawIcsStr) => {
                if (!rawIcsStr) return '';
                const cleanStr = rawIcsStr.includes(':') ? rawIcsStr.split(':').pop().trim() : rawIcsStr.trim();
                const parts = cleanStr.split('T');
                return parts.length > 1 ? parts[1] : ''; 
            };
            
            const timePart = extractTime(ev.start);
            const eTimePart = extractTime(ev.end);

            while (occurrences < maxCount && safety < 365) {
                safety++;
                const currentDayStr = dayMap[loopDate.getDay()];
                if (untilDate && loopDate.getTime() > untilDate) break;

                if (!validDays || validDays.includes(currentDayStr)) {
                    const y = loopDate.getFullYear();
                    const m = String(loopDate.getMonth() + 1).padStart(2, '0');
                    const d = String(loopDate.getDate()).padStart(2, '0');
                    
                    const newStartStr = timePart ? `${y}${m}${d}T${timePart}` : `${y}${m}${d}`;
                    
                    const loopEnd = new Date(loopDate.getTime() + durationMs);
                    const ey = loopEnd.getFullYear();
                    const em = String(loopEnd.getMonth() + 1).padStart(2, '0');
                    const ed = String(loopEnd.getDate()).padStart(2, '0');
                    
                    const newEndStr = eTimePart ? `${ey}${em}${ed}T${eTimePart}` : `${ey}${em}${ed}`;

                    expanded.push({ ...ev, start: `DTSTART:${newStartStr}`, end: `DTEND:${newEndStr}` });
                    occurrences++;
                }

                if (rules.FREQ === 'DAILY') loopDate.setDate(loopDate.getDate() + (parseInt(rules.INTERVAL) || 1));
                else if (rules.FREQ === 'WEEKLY') loopDate.setDate(loopDate.getDate() + 1); 
            }
        });
        return expanded;
    };

    const parseICS = (icsText) => {
        const events = [];
        const unfoldedText = icsText.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        let currentEvent = null;

        lines.forEach(line => {
            if (line.startsWith('BEGIN:VEVENT')) {
                currentEvent = {};
            } else if (line.startsWith('END:VEVENT') && currentEvent) {
                events.push(currentEvent);
                currentEvent = null;
            } else if (currentEvent) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > -1) {
                    const propName = line.substring(0, colonIndex).split(';')[0].toUpperCase(); 
                    const value = line.substring(colonIndex + 1).trim();

                    if (propName === 'UID') currentEvent.uid = value;
                    if (propName === 'SUMMARY') currentEvent.summary = value; 
                    if (propName === 'DTSTART') currentEvent.start = line; 
                    if (propName === 'DTEND') currentEvent.end = line;
                    if (propName === 'LOCATION') currentEvent.location = value;
                    if (propName === 'RRULE') currentEvent.rrule = value;
                    if (propName === 'ATTENDEE' && line.includes('CUTYPE=RESOURCE')) currentEvent.isResource = true;
                }
            }
        });
        
        return expandRRule(events);
    };

    // --- 2. PRE-FLIGHT LUKU ---
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setIsStaging(false);
        
        // Nollataan aiemmat tilat
        setAutoQueue([]); setRoomQueue([]); setTeachQueue([]); setManualQueue([]);
        setTeachConfigs({}); setManualConfigs({});

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            // Haetaan olemassa olevat tuplien varalta
            const fileUids = rawEvents.map(ev => ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim().substring(0,8) : ''}` : null).filter(Boolean);
            const { data: existingData } = await supabase.schema('espan').from('ics_events').select('ics_uid').in('ics_uid', fileUids).in('expert_id', [asiantuntijaId, LEGACY_ID]);
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            const { data: existingRooms } = await supabase.schema('espan').from('room_bookings').select('ics_uid').in('ics_uid', fileUids).eq('expert_id', asiantuntijaId);
            const existingRoomUids = new Set(existingRooms?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => {
                const datePart = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim().substring(0,8) : ev.start.trim().substring(0,8)) : '';
                const fUid = ev.uid ? `${ev.uid}_${datePart}` : null;
                const isRoomEvent = ev.isResource || (ev.location && ev.location.startsWith('RES'));
                return fUid && (isRoomEvent ? !existingRoomUids.has(fUid) : !existingUids.has(fUid));
            });
            
            setSkippedCount(rawEvents.length - newEvents.length);

            // Laatikot väliaikaiseen lajitteluun
            const tAuto = []; const tRoom = []; const tTeach = []; const tManual = [];

            newEvents.forEach(event => {
                const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim().substring(0,8) : event.start.trim().substring(0,8)) : '';
                const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
                if (!finalUid) return;

                const startTimeIso = parseIcsDate(event.start);
                const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
                const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));
                const summary = event.summary || '';
                const lowerSummary = summary.toLowerCase();

                // 1. Huonevaraukset -> 🟢
                if (event.isResource || (event.location && event.location.startsWith('RES'))) {
                    tRoom.push({ 
                        expert_id: asiantuntijaId, ics_uid: finalUid, room_name: event.location || 'Tuntematon tila', 
                        start_time: startTimeIso, end_time: endTimeIso 
                    });
                    return;
                }

                const baseEvent = { expert_id: asiantuntijaId, ics_uid: finalUid, start_time: startTimeIso, end_time: endTimeIso, is_all_day: isAllDay, original_summary: summary };

                // Etsi viivaerotinta (- tai --)
                const dashMatch = summary.match(/^(.*?)\s*--?\s*(.*)$/);
                
                if (dashMatch) {
                    const prefix = dashMatch[1].trim();
                    const dictHit = dictionary.find(d => d.opittu_sana.toLowerCase() === prefix.toLowerCase());

                    if (dictHit) {
                        // Löytyi sanakirjasta -> 🟢
                        tAuto.push({ ...baseEvent, event_category: dictHit.kategoria, contact_method: dictHit.metodi, is_cancelled: dictHit.is_cancelled, kuvaus: dictHit.kuvaus, match_type: 'Sanakirja' });
                    } else {
                        // Uusi etuliite -> 🟡
                        tTeach.push({ ...baseEvent, prefix });
                    }
                    return;
                }

                // 3. Vanha Legacy tai Kovakoodattu -> 🟠 / 🟢
                const idMatch = summary.match(/\d{14}/);
                if (idMatch) {
                    const masked = summary.replace(idMatch[0], `${idMatch[0].substring(0, 4)}*******${idMatch[0].substring(11)}`);
                    tManual.push({ ...baseEvent, masked_summary: masked, reason: 'Legacy ID' });
                } else if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä/)) {
                    tAuto.push({ ...baseEvent, event_category: 'sijainti', location_name: summary, match_type: 'Sijainti' });
                } else if (lowerSummary.match(/loma|tuuraus/)) {
                    tAuto.push({ ...baseEvent, event_category: 'poissaolo', match_type: 'Poissaolo' });
                } else {
                    tManual.push({ ...baseEvent, reason: 'Tuntematon' });
                }
            });

            // Ryhmitellään Teach-lista etuliitteiden mukaan, jotta samaa sanaa ei tarvitse opettaa monesti
            const groupedTeach = {};
            tTeach.forEach(ev => {
                if (!groupedTeach[ev.prefix]) groupedTeach[ev.prefix] = [];
                groupedTeach[ev.prefix].push(ev);
            });

            setAutoQueue(tAuto);
            setRoomQueue(tRoom);
            setTeachQueue(Object.entries(groupedTeach).map(([prefix, events]) => ({ prefix, events })));
            setManualQueue(tManual);
            
            if (tAuto.length > 0 || tRoom.length > 0 || tTeach.length > 0 || tManual.length > 0) {
                setIsStaging(true);
            }

        } catch (error) {
            console.error("Virhe tuonnissa:", error);
            alert("Tiedoston luku epäonnistui.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    // --- 3. LOPULLINEN TALLENNUS (Commit) ---
    const handleCommit = async () => {
        setIsCommitting(true);
        try {
            const insertsEvents = [];
            const insertsRooms = [...roomQueue];
            const insertsDict = [];

            // 1. Automaattiset
            autoQueue.forEach(ev => {
                insertsEvents.push({
                    expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                    event_category: ev.event_category, contact_method: ev.contact_method, is_cancelled: ev.is_cancelled || false, location_name: ev.location_name
                });
            });

            // 2. Opetetut sanat
            teachQueue.forEach(group => {
                const conf = teachConfigs[group.prefix];
                if (!conf || !conf.kategoria) return; // Jos asiantuntija ei valinnut mitään, ohitetaan? Tai perutaan.
                
                // Tallennetaan uusi sääntö sanakirjaan!
                insertsDict.push({ opittu_sana: group.prefix, kategoria: conf.kategoria, metodi: conf.metodi || null, kuvaus: conf.kuvaus || null, is_cancelled: conf.is_cancelled || false });

                // Tallennetaan itse tapahtumat uusilla säännöillä
                group.events.forEach(ev => {
                    insertsEvents.push({
                        expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                        event_category: conf.kategoria, contact_method: conf.metodi || null, is_cancelled: conf.is_cancelled || false
                    });
                });
            });

            // 3. Manuaalisesti asetetut (Muu työ / Hylätty)
            manualQueue.forEach(ev => {
                const conf = manualConfigs[ev.ics_uid];
                if (!conf || conf.kategoria === 'hylatty') return; // Jos hylätty tai tyhjä, ei tallenneta kantaan
                insertsEvents.push({
                    expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                    event_category: conf.kategoria, contact_method: conf.metodi || null
                });
            });

            // --- KANNAN PÄIVITYS (Pakotetaan lukkojen nimet onConflict -ehtoon 400-virheen välttämiseksi) ---
            if (insertsDict.length > 0) {
                await supabase.schema('espan').from('ics_dictionary').upsert(insertsDict, { onConflict: 'ics_dictionary_opittu_sana_key' });
                await fetchDictionary(); // Päivitetään muistiin
            }

            if (insertsEvents.length > 0) {
                const { error } = await supabase.schema('espan').from('ics_events').upsert(insertsEvents, { onConflict: 'ics_events_expert_uid_key' });
                if (error) throw error;
            }

            if (insertsRooms.length > 0) {
                const { error } = await supabase.schema('espan').from('room_bookings').upsert(insertsRooms, { onConflict: 'room_bookings_expert_uid_key' });
                if (error) throw error;
            }

            alert(`Tuonti onnistui! Tallennettiin ${insertsEvents.length} tapahtumaa ja ${insertsRooms.length} huonevarausta.`);
            setIsStaging(false);
            if (onImportComplete) onImportComplete();

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            alert("Virhe tietojen tallennuksessa kantaan.");
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <Card title="Tuo Outlook-kalenteri (.ics)" icon={Calendar} variant="default">
            
            {/* LATAUSPAINIKKEET (Näkyy vain, jos ei olla esikatselussa) */}
            {!isStaging && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                            {isProcessing ? 'Analysoidaan tiedostoa...' : 'Valitse .ics tiedosto'}
                        </Button>
                    </div>
                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Järjestelmä suorittaa läpinäkyvän "Pre-flight" -tarkistuksen. Näet mitä tapahtuu, ennen kuin yhtäkään merkintää tallennetaan kantaan.
                    </div>
                </div>
            )}

            {/* PRE-FLIGHT ESIKATSELU */}
            {isStaging && (
                <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* 🟢 LAATIKKO 1: AUTOMAATTISET */}
                    {(autoQueue.length > 0 || roomQueue.length > 0) && (
                        <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={20} color="#16a34a" />
                                <h3 className="m-0 text-md fw-bold text-success">Automaattisesti tunnistetut ({autoQueue.length + roomQueue.length})</h3>
                            </div>
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                                {roomQueue.map((r, i) => (
                                    <div key={'r'+i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px dashed #e2e8f0' }}>
                                        <div className="text-sm fw-semibold">{r.room_name}</div>
                                        <Badge style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }} icon={DoorOpen}>Tilavaraus</Badge>
                                    </div>
                                ))}
                                {autoQueue.map((a, i) => (
                                    <div key={'a'+i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px dashed #e2e8f0' }}>
                                        <div>
                                            <div className="text-sm fw-semibold">{a.original_summary}</div>
                                            {a.kuvaus && <div className="text-xs text-muted" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><Info size={12}/> {a.kuvaus}</div>}
                                        </div>
                                        <div>
                                            <Badge variant={a.is_cancelled ? 'danger' : 'success'} icon={a.is_cancelled ? Trash2 : CheckCircle}>
                                                {a.event_category} {a.contact_method && `(${a.contact_method})`}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 🟡 LAATIKKO 2: OPETETTAVAT SANAT */}
                    {teachQueue.length > 0 && (
                        <div style={{ border: '1px solid #fef08a', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#fefce8', padding: '1rem', borderBottom: '1px solid #fef08a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen size={20} color="#ca8a04" />
                                <h3 className="m-0 text-md fw-bold text-warning">Opetettavat uudet sanat ({teachQueue.length} sääntöä)</h3>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p className="text-sm text-slate-700 m-0">Nämä etuliitteet ovat järjestelmälle uusia. Määritä säännöt, niin ne tallentuvat koko tiimin yhteiseen sanakirjaan tulevaisuutta varten!</p>
                                
                                {teachQueue.map(group => {
                                    const conf = teachConfigs[group.prefix] || { kategoria: '', metodi: '', kuvaus: '', is_cancelled: false };
                                    const updateConf = (updates) => setTeachConfigs(prev => ({ ...prev, [group.prefix]: { ...conf, ...updates } }));

                                    return (
                                        <div key={group.prefix} style={{ padding: '1rem', backgroundColor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <div>
                                                    <span className="text-lg fw-bold text-primary">"{group.prefix}"</span>
                                                    <span className="text-xs text-muted ml-2">(Koskee {group.events.length} tapahtumaa tässä tuonnissa)</span>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem' }}>
                                                <div>
                                                    <label className="text-xs fw-bold">Tapahtuman tyyppi</label>
                                                    <select className="modern-select" value={conf.kategoria} onChange={(e) => updateConf({ kategoria: e.target.value })}>
                                                        <option value="">-- Valitse --</option>
                                                        <option value="tapaaminen">Asiakastapaaminen</option>
                                                        <option value="muu_tyo">Muu työ</option>
                                                        <option value="sisainen_palaveri">Sisäinen palaveri</option>
                                                        <option value="koulutus">Koulutus / Kehitys</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs fw-bold">Toteutustapa</label>
                                                    <select className="modern-select" value={conf.metodi} onChange={(e) => updateConf({ metodi: e.target.value })} disabled={!['tapaaminen'].includes(conf.kategoria)}>
                                                        <option value="">-</option>
                                                        <option value="lasna">Läsnä</option>
                                                        <option value="soitto">Puhelu / Etä</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs fw-bold">Selite tiimille (Kuvaus)</label>
                                                    <input type="text" className="form-input" placeholder="Mitä tämä sana tarkoittaa?" value={conf.kuvaus} onChange={(e) => updateConf({ kuvaus: e.target.value })} style={{ padding: '0.45rem', fontSize: '0.85rem' }} />
                                                </div>
                                            </div>
                                            
                                            <div style={{ marginTop: '1rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                    <input type="checkbox" checked={conf.is_cancelled} onChange={(e) => updateConf({ is_cancelled: e.target.checked })} />
                                                    Tämä sana tarkoittaa PERUTTUA tapahtumaa (esim. Sairas tai No-show)
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 🟠 LAATIKKO 3: MANUAALINEN JONO */}
                    {manualQueue.length > 0 && (
                        <div style={{ border: '1px solid #fed7aa', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#ffedd5', padding: '1rem', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={20} color="#ea580c" />
                                <h3 className="m-0 text-md fw-bold" style={{ color: '#9a3412' }}>Manuaalinen reititys ({manualQueue.length})</h3>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                <p className="text-sm text-slate-700 m-0 mb-2">Näistä puuttuu selkeä etuliite. Reititä ne oikeisiin kategorioihin tai hylkää tarpeettomat.</p>
                                
                                {manualQueue.map(ev => {
                                    const conf = manualConfigs[ev.ics_uid] || { kategoria: '', metodi: '' };
                                    const updateConf = (k, m) => setManualConfigs(prev => ({ ...prev, [ev.ics_uid]: { kategoria: k, metodi: m } }));

                                    return (
                                        <div key={ev.ics_uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div className="text-sm fw-semibold">{ev.masked_summary || ev.original_summary}</div>
                                            
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <Button variant={conf.kategoria === 'tapaaminen' ? 'primary' : 'secondary'} size="small" onClick={() => updateConf('tapaaminen', 'lasna')}>Läsnä</Button>
                                                <Button variant={conf.kategoria === 'muu_tyo' ? 'primary' : 'secondary'} size="small" onClick={() => updateConf('muu_tyo', null)}>Muu</Button>
                                                <Button variant={conf.kategoria === 'hylatty' ? 'danger' : 'secondary'} size="small" onClick={() => updateConf('hylatty', null)} icon={Trash2}>Hylkää</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VAHVISTUS-ALUE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                        <div>
                            <Button variant="secondary" onClick={() => setIsStaging(false)}>Peruuta tuonti</Button>
                        </div>
                        <div>
                            <Button variant="primary" icon={Save} disabled={isCommitting} onClick={handleCommit}>
                                {isCommitting ? 'Tallennetaan...' : 'Vahvista ja tallenna tiedot'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default IcsImport;