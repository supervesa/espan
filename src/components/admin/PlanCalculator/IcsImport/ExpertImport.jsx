// --- src/components/admin/PlanCalculator/IcsImport/ExpertImport.jsx ---
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient'; 
import Card from '../../../common/Card';
import Button from '../../../common/Button';
import Badge from '../../../common/Badge';
import AlertBox from '../../../common/AlertBox';
import { Calendar, Upload, Loader2, CheckCircle, AlertTriangle, BookOpen, Trash2, Save, XCircle, CheckSquare } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const ExpertImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    
    // Tietokannat ja jonot
    const [learnedDictionary, setLearnedDictionary] = useState({});
    const [legacyQueue, setLegacyQueue] = useState([]);
    
    // Pre-flight vaiheen laatikot
    const [isStaging, setIsStaging] = useState(false);
    const [stagingStats, setStagingStats] = useState({ lunches: 0, autoSkipped: 0, newWords: 0 });
    
    const [autoQueue, setAutoQueue] = useState([]);
    const [teachQueue, setTeachQueue] = useState([]);
    const [manualQueue, setManualQueue] = useState([]);

    // Käyttäjän valinnat esikatselussa
    const [autoSkips, setAutoSkips] = useState(new Set()); // Vihreästä laatikosta hylätyt
    const [teachConfigs, setTeachConfigs] = useState({});  // Uudet sanat ja kategoriat
    const [manualConfigs, setManualConfigs] = useState({}); // Manuaalisesti klikkaillut

    const fileInputRef = useRef(null);

    // 1. LATAA TIIMIN YHTEINEN SANAKIRJA
    const fetchDictionary = async () => {
        try {
            const { data, error } = await supabase.schema('espan').from('ics_dictionary').select('*');
            if (!error && data) {
                const dictObj = {};
                data.forEach(item => {
                    dictObj[item.opittu_sana.toLowerCase()] = {
                        cat: item.kategoria,
                        method: item.metodi,
                        isCancel: item.is_cancelled
                    };
                });
                setLearnedDictionary(dictObj);
            }
        } catch (error) {
            console.error("Virhe sanakirjan latauksessa:", error);
        }
    };

    // 2. LATAA VANHAT SELVITTÄMÄTTÖMÄT (LEGACY JONO)
    const fetchReviewQueue = async () => {
        try {
            const { data, error } = await supabase.schema('espan')
                .from('ics_review_queue')
                .select('*')
                .in('expert_id', [asiantuntijaId, LEGACY_ID])
                .order('start_time', { ascending: false });
                
            if (!error && data) {
                // Merkitään legacy-tunnisteella
                const mappedLegacy = data.map(item => ({ ...item, isLegacy: true, summaryDisplay: item.masked_summary }));
                setLegacyQueue(mappedLegacy);
            }
        } catch (error) {
            console.error("Virhe ratkaisujonon haussa:", error);
        }
    };

    useEffect(() => {
        fetchDictionary();
        if (asiantuntijaId) fetchReviewQueue();
    }, [asiantuntijaId]);

    const parseIcsDate = (dateStr) => {
        if (!dateStr) return null;
        const cleanStr = dateStr.includes(':') ? dateStr.split(':').pop().trim() : dateStr.trim();
        if (cleanStr.length === 8) {
            return new Date(`${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}T00:00:00Z`).toISOString();
        } else if (cleanStr.length >= 15) {
            const isUTC = cleanStr.endsWith('Z');
            const isoBase = `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}T${cleanStr.substring(9, 11)}:${cleanStr.substring(11, 13)}:${cleanStr.substring(13, 15)}`;
            return isUTC ? new Date(`${isoBase}Z`).toISOString() : new Date(isoBase).toISOString();
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
                    const newEndStr = eTimePart ? `${loopEnd.getFullYear()}${String(loopEnd.getMonth() + 1).padStart(2, '0')}${String(loopEnd.getDate()).padStart(2, '0')}T${eTimePart}` : `${loopEnd.getFullYear()}${String(loopEnd.getMonth() + 1).padStart(2, '0')}${String(loopEnd.getDate()).padStart(2, '0')}`;

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

    // --- PRE-FLIGHT LUKU ---
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setIsStaging(false);
        
        setAutoQueue([]); setTeachQueue([]); setManualQueue([]);
        setAutoSkips(new Set()); setTeachConfigs({}); setManualConfigs({});

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            const fileUids = rawEvents.map(ev => ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim().substring(0,8) : ''}` : null).filter(Boolean);
            const { data: existingData } = await supabase.schema('espan').from('ics_events').select('ics_uid').in('ics_uid', fileUids).in('expert_id', [asiantuntijaId, LEGACY_ID]);
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => {
                const datePart = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim().substring(0,8) : ev.start.trim().substring(0,8)) : '';
                const fUid = ev.uid ? `${ev.uid}_${datePart}` : null;
                const isRoomEvent = ev.isResource || (ev.location && ev.location.startsWith('RES'));
                return fUid && !existingUids.has(fUid) && !isRoomEvent;
            });

            const tAuto = []; const tTeach = []; const tManual = [...legacyQueue];
            let droppedLunchCount = 0;
            let dictionarySkippedCount = 0;

            newEvents.forEach(event => {
                const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim().substring(0,8) : event.start.trim().substring(0,8)) : '';
                const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
                if (!finalUid) return;

                const startTimeIso = parseIcsDate(event.start);
                const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
                const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));
                const summary = event.summary || '';
                const lowerSummary = summary.toLowerCase();

                // 🛑 Automaattinen Lounas / Tauko Suodatin
                if (lowerSummary.includes('lounas') || lowerSummary.includes('lunch') || lowerSummary.includes('ruokatauko')) {
                    droppedLunchCount++;
                    return;
                }

                const baseEvent = { id: finalUid, expert_id: asiantuntijaId, ics_uid: finalUid, start_time: startTimeIso, end_time: endTimeIso, is_all_day: isAllDay, summaryDisplay: summary, original_summary: summary };
                const dashMatch = summary.match(/^(.*?)\s*--?\s*(.*)$/);

                // 1. LÖYTYY EROTIN (--)
                if (dashMatch) {
                    const prefix = dashMatch[1].trim();
                    const dictHit = learnedDictionary[prefix.toLowerCase()];

                    if (dictHit) {
                        // Löytyi sanakirjasta
                        if (dictHit.cat === 'hylatty') {
                            dictionarySkippedCount++; // Roskasuodatin teki työnsä!
                        } else {
                            tAuto.push({ ...baseEvent, category: dictHit.cat, method: dictHit.method, is_cancelled: dictHit.isCancel });
                        }
                    } else {
                        // Uusi sana
                        tTeach.push({ ...baseEvent, prefix });
                    }
                    return;
                }

                // 2. Legacy numerokoodit tai peruttu
                const idMatch = summary.match(/\d{14}/);
                if (idMatch) {
                    const masked = summary.replace(idMatch[0], `${idMatch[0].substring(0, 4)}*******${idMatch[0].substring(11)}`);
                    tManual.push({ ...baseEvent, summaryDisplay: masked, isLegacy: false });
                } else if (lowerSummary.startsWith('peruttu')) {
                    tAuto.push({ ...baseEvent, category: 'peruttu', method: null, is_cancelled: true });
                } else {
                    tManual.push({ ...baseEvent, isLegacy: false });
                }
            });

            // Ryhmitellään uudet sanat
            const groupedTeach = {};
            tTeach.forEach(ev => {
                if (!groupedTeach[ev.prefix]) groupedTeach[ev.prefix] = [];
                groupedTeach[ev.prefix].push(ev);
            });

            setAutoQueue(tAuto);
            setTeachQueue(Object.entries(groupedTeach).map(([prefix, events]) => ({ prefix, events })));
            setManualQueue(tManual);
            
            setStagingStats({ lunches: droppedLunchCount, autoSkipped: dictionarySkippedCount, newWords: Object.keys(groupedTeach).length });
            setIsStaging(true);

        } catch (error) {
            console.error("Virhe tuonnissa:", error);
            alert("Tiedoston luku epäonnistui.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    // Aloita Staging pelkällä legacy jonolla ilman ICS tiedostoa
    const handleStartManualReview = () => {
        setAutoQueue([]); setTeachQueue([]); setManualQueue([...legacyQueue]);
        setAutoSkips(new Set()); setTeachConfigs({}); setManualConfigs({});
        setIsStaging(true);
    };

    // UI tilan päivittäjät
    const toggleAutoSkip = (uid) => {
        setAutoSkips(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const updateManual = (id, category, method) => {
        setManualConfigs(prev => ({ ...prev, [id]: { category, method } }));
    };

    // --- LOPULLINEN TALLENNUS ---
    const handleCommit = async () => {
        setIsCommitting(true);
        try {
            const insertsEvents = [];
            const insertsDict = [];
            const legacyDeletes = [];

            // 1. Vihreä Laatikko (Automaattiset)
            autoQueue.forEach(ev => {
                if (!autoSkips.has(ev.ics_uid)) {
                    insertsEvents.push({
                        expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                        event_category: ev.category, contact_method: ev.method, is_cancelled: ev.is_cancelled
                    });
                }
            });

            // 2. Keltainen Laatikko (Opetettavat)
            teachQueue.forEach(group => {
                const conf = teachConfigs[group.prefix];
                if (!conf || !conf.category) return; // Ohitetaan jos asiantuntija ei valinnut kategoriaa

                const finalCat = conf.category === 'vapaa' ? (conf.custom || 'muu_tyo') : conf.category;
                const isCanceled = finalCat === 'peruttu' || finalCat === 'noshow';

                // Tallennetaan tapahtumat jos EI hylätty
                if (finalCat !== 'hylatty') {
                    group.events.forEach(ev => {
                        insertsEvents.push({
                            expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                            event_category: finalCat, contact_method: conf.method || null, is_cancelled: isCanceled
                        });
                    });
                }

                // Tallennetaan yhteiseen sanakirjaan jos pyydetty
                if (conf.save) {
                    insertsDict.push({ opittu_sana: group.prefix, kategoria: finalCat, metodi: conf.method || null, is_cancelled: isCanceled });
                }
            });

            // 3. Oranssi Laatikko (Manuaaliset + Legacy)
            manualQueue.forEach(ev => {
                const conf = manualConfigs[ev.id];
                if (conf && conf.category) {
                    // Jos Hylättiin, merkitään legacy poistettavaksi, ICS unohdetaan
                    if (conf.category !== 'hylatty') {
                        const isCanceled = conf.category === 'peruttu' || conf.category === 'noshow';
                        insertsEvents.push({
                            expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                            event_category: conf.category, contact_method: conf.method || null, is_cancelled: isCanceled
                        });
                    }

                    if (ev.isLegacy) {
                        legacyDeletes.push(ev.id); // Hoidettu
                    }
                }
            });

            // --- KANNAN PÄIVITYS (TURVALLINEN UPSERT ILMAN VÄLILYÖNTEJÄ ONCONFLICTISSA) ---
            if (insertsDict.length > 0) {
                const { error: dictError } = await supabase.schema('espan').from('ics_dictionary').upsert(insertsDict, { onConflict: 'opittu_sana' });
                if (dictError) throw dictError;
            }

            if (insertsEvents.length > 0) {
                const { error: evError } = await supabase.schema('espan').from('ics_events').upsert(insertsEvents, { onConflict: 'expert_id,ics_uid' });
                if (evError) throw evError;
            }

            if (legacyDeletes.length > 0) {
                const { error: delError } = await supabase.schema('espan').from('ics_review_queue').delete().in('id', legacyDeletes);
                if (delError) throw delError;
            }

            setIsStaging(false);
            alert(`Tallennettu onnistuneesti! (${insertsEvents.length} uutta tapahtumaa)`);
            
            // Ladataan kaikki uudestaan ja suljetaan näkymä
            await fetchDictionary();
            await fetchReviewQueue();
            if (onImportComplete) onImportComplete();

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            alert(`Virhe tietojen tallennuksessa kantaan: ${error.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <Card title="Asiantuntijan tapahtumat" icon={Calendar} variant="default">
            
            {/* OLETUSNÄKYMÄ (Latauspainikkeet ja tiedotteet) */}
            {!isStaging && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                            {isProcessing ? 'Analysoidaan tiedostoa...' : 'Valitse kalenteri (.ics)'}
                        </Button>
                    </div>
                    
                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Älykäs esikatselu näyttää kaikki työtehtävät ennen tallennusta. Lounaat siivotaan automaattisesti roskiin.
                    </div>

                    {/* Varoitus selvittämättömästä legacy-jonosta */}
                    {legacyQueue.length > 0 && (
                        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e' }}>
                                <AlertTriangle size={18} />
                                <span className="text-sm fw-bold">Sinulla on {legacyQueue.length} vanhaa, selvittämätöntä merkintää tietokannassa.</span>
                            </div>
                            <Button size="small" variant="secondary" onClick={handleStartManualReview}>Käsittele jono nyt</Button>
                        </div>
                    )}
                </div>
            )}

            {/* PRE-FLIGHT ESIKATSELU */}
            {isStaging && (
                <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* INFO HEADER */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                        <div className="text-sm">Siivottu roskikseen suoraan:</div>
                        {stagingStats.lunches > 0 && <Badge variant="default">Lounaat ({stagingStats.lunches})</Badge>}
                        {stagingStats.autoSkipped > 0 && <Badge variant="danger">Opetettu Roskasuodatin ({stagingStats.autoSkipped})</Badge>}
                        {stagingStats.lunches === 0 && stagingStats.autoSkipped === 0 && <Badge variant="default" className="text-muted">Ei automaattista siivousta</Badge>}
                    </div>

                    {/* 🟢 LAATIKKO 1: AUTOMAATTISET */}
                    {autoQueue.length > 0 && (
                        <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={20} color="#16a34a" />
                                <h3 className="m-0 text-md fw-bold text-success">Automaattisesti tunnistetut ({autoQueue.length})</h3>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                                {autoQueue.map((ev, i) => {
                                    const isSkipped = autoSkips.has(ev.ics_uid);
                                    return (
                                        <div key={ev.ics_uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #e2e8f0', opacity: isSkipped ? 0.4 : 1 }}>
                                            <div style={{ textDecoration: isSkipped ? 'line-through' : 'none' }}>
                                                <div className="text-sm fw-semibold">{ev.summaryDisplay}</div>
                                                <div className="text-xs text-muted">➔ {ev.category} {ev.method ? `(${ev.method})` : ''}</div>
                                            </div>
                                            <Button 
                                                variant={isSkipped ? "secondary" : "danger"} 
                                                size="small" 
                                                icon={isSkipped ? CheckSquare : XCircle} 
                                                onClick={() => toggleAutoSkip(ev.ics_uid)}
                                                style={{ padding: '4px 8px' }}
                                            >
                                                {isSkipped ? 'Palauta' : 'Hylkää'}
                                            </Button>
                                        </div>
                                    );
                                })}
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
                                <p className="text-sm text-slate-700 m-0">Nämä etuliitteet ovat järjestelmälle uusia. Määritä säännöt, niin ne tallentuvat koko tiimin yhteiseen sanakirjaan!</p>
                                
                                {teachQueue.map(group => {
                                    const conf = teachConfigs[group.prefix] || { category: '', custom: '', method: '', save: false };
                                    const updateConf = (updates) => setTeachConfigs(prev => ({ ...prev, [group.prefix]: { ...conf, ...updates } }));

                                    return (
                                        <div key={group.prefix} style={{ padding: '1rem', backgroundColor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <span className="text-lg fw-bold text-primary">"{group.prefix}"</span>
                                                <span className="text-xs text-muted ml-2">({group.events.length} tapahtumaa tässä tuonnissa)</span>
                                            </div>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <label className="text-xs fw-bold">Miten tämä luokitellaan?</label>
                                                    <select className="modern-select" value={conf.category} onChange={(e) => updateConf({ category: e.target.value })}>
                                                        <option value="">-- Valitse --</option>
                                                        <option value="tapaaminen">Asiakastapaaminen</option>
                                                        <option value="muu_tyo">Muu työ</option>
                                                        <option value="sisainen_palaveri">Sisäinen palaveri</option>
                                                        <option value="koulutus">Koulutus / Kehitys</option>
                                                        <option value="peruttu">Peruttu (Tapahtuma peruttu)</option>
                                                        <option value="noshow">No-show (Asiakas ei saapunut)</option>
                                                        <option value="hylatty">❌ Hylkää / Ohita aina</option>
                                                        <option value="vapaa">✏️ Muu (Vapaa sana) ➔</option>
                                                    </select>
                                                    {conf.category === 'vapaa' && (
                                                        <input type="text" className="form-input" placeholder="Kirjoita oma kategoria..." value={conf.custom} onChange={(e) => updateConf({ custom: e.target.value })} style={{ padding: '0.45rem', fontSize: '0.85rem' }} />
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-xs fw-bold">Toteutustapa</label>
                                                    <select className="modern-select" value={conf.method} onChange={(e) => updateConf({ method: e.target.value })} disabled={conf.category !== 'tapaaminen'}>
                                                        <option value="">-</option>
                                                        <option value="lasna">Läsnä</option>
                                                        <option value="soitto">Puhelu / Etä</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                    <input type="checkbox" checked={conf.save} onChange={(e) => updateConf({ save: e.target.checked })} />
                                                    <span style={{ color: '#0369a1', fontWeight: 'bold' }}>Tallenna tämä sääntö koko tiimin yhteiseen sanakirjaan!</span>
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
                                <h3 className="m-0 text-md fw-bold" style={{ color: '#9a3412' }}>Manuaalinen ratkaisukeskus ({manualQueue.length})</h3>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                <p className="text-sm text-slate-700 m-0 mb-2">Näistä puuttuu viivaerotin, tai ne ovat vanhoja merkintöjä. Valitse kategoria yksitellen.</p>
                                
                                {manualQueue.map(ev => {
                                    const conf = manualConfigs[ev.id] || { category: '', method: '' };
                                    
                                    return (
                                        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: conf.category === 'hylatty' ? '#f1f5f9' : '#fff' }}>
                                            <div className="text-sm fw-semibold" style={{ textDecoration: conf.category === 'hylatty' ? 'line-through' : 'none', color: conf.category === 'hylatty' ? '#94a3b8' : '#0f172a' }}>
                                                {ev.summaryDisplay}
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <Button variant={conf.category === 'tapaaminen' && conf.method === 'lasna' ? 'primary' : 'secondary'} size="small" onClick={() => updateManual(ev.id, 'tapaaminen', 'lasna')}>Läsnä</Button>
                                                <Button variant={conf.category === 'tapaaminen' && conf.method === 'soitto' ? 'primary' : 'secondary'} size="small" onClick={() => updateManual(ev.id, 'tapaaminen', 'soitto')}>Soitto</Button>
                                                <Button variant={conf.category === 'muu_tyo' ? 'primary' : 'secondary'} size="small" onClick={() => updateManual(ev.id, 'muu_tyo', null)}>Muu työ</Button>
                                                <div style={{ width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>
                                                <Button variant={conf.category === 'hylatty' ? 'danger' : 'secondary'} size="small" onClick={() => updateManual(ev.id, 'hylatty', null)} icon={Trash2}>Hylkää</Button>
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
                            <Button variant="secondary" onClick={() => setIsStaging(false)}>Peruuta ja tyhjennä näkymä</Button>
                        </div>
                        <div>
                            <Button variant="primary" icon={Save} disabled={isCommitting} onClick={handleCommit}>
                                {isCommitting ? 'Tallennetaan...' : 'Vahvista ja tallenna valinnat'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default ExpertImport;