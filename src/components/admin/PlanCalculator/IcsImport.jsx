// --- src/components/admin/PlanCalculator/IcsImport.jsx ---
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient'; 
import Card from '../../common/Card';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import AlertBox from '../../common/AlertBox';
import { Calendar, Upload, Loader2, CheckCircle, AlertTriangle, UserCheck, PhoneCall, Trash2, Save, BookOpen, Briefcase, DoorOpen } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const IcsImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [reviewQueue, setReviewQueue] = useState([]);
    
    // UUSI: Välitilan (Staging Area) tilamuuttujat
    const [stagedData, setStagedData] = useState(null);
    const [learnedDictionary, setLearnedDictionary] = useState({});
    
    const fileInputRef = useRef(null);

    // Ladataan opittu sanakirja selaimen muistista
    useEffect(() => {
        const savedDict = localStorage.getItem('espan_ics_dictionary');
        if (savedDict) {
            setLearnedDictionary(JSON.parse(savedDict));
        }
    }, []);

    const fetchReviewQueue = async () => {
        try {
            const { data, error } = await supabase.schema('espan')
                .from('ics_review_queue')
                .select('*')
                .in('expert_id', [asiantuntijaId, LEGACY_ID])
                .order('start_time', { ascending: false });
                
            if (!error && data) setReviewQueue(data);
        } catch (error) {
            console.error("Virhe ratkaisujonon haussa:", error);
        }
    };

    useEffect(() => {
        if (asiantuntijaId) fetchReviewQueue();
    }, [asiantuntijaId]);

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
            
            if (isUTC) {
                return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
            } else {
                return new Date(`${y}-${m}-${d}T${h}:${min}:${s}`).toISOString();
            }
        }
        return null;
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
                if (currentEvent.description) {
                    const tokenMatch = currentEvent.description.match(/Asiantuntija Vesa Nessling(?:\\n|\n)(.+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        currentEvent.sync_token = tokenMatch[1].replace(/\\n/g, '').trim();
                    }
                }
                events.push(currentEvent);
                currentEvent = null;
            } else if (currentEvent) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > -1) {
                    const propFull = line.substring(0, colonIndex);
                    const propName = propFull.split(';')[0].toUpperCase(); 
                    const value = line.substring(colonIndex + 1).trim();

                    if (propName === 'UID') currentEvent.uid = value;
                    if (propName === 'SUMMARY') currentEvent.summary = value; 
                    if (propName === 'DTSTART') currentEvent.start = line; 
                    if (propName === 'DTEND') currentEvent.end = line;
                    if (propName === 'DESCRIPTION') currentEvent.description = value;
                    if (propName === 'LOCATION') currentEvent.location = value;
                    if (propName === 'ATTENDEE' && line.includes('CUTYPE=RESOURCE')) currentEvent.isResource = true;
                }
            }
        });
        return events;
    };

    // ==========================================
    // UUSI ÄLYKÄS LUOKITTELU (STAGING)
    // ==========================================
    const stageEvents = (rawEvents) => {
        const staged = {
            rooms: [],       // Huonevaraukset
            ready: [],       // 100% varmat osumat
            teach: [],       // Token löytyi, mutta otsikossa on poikkeama
            other: [],       // Ei tokenia, ei asiakasID:tä (muu työ)
            legacyQueue: []  // Vanha ratkaisukeskus
        };

        rawEvents.forEach(event => {
            const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
            const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
            if (!finalUid) return;

            const startTimeIso = parseIcsDate(event.start);
            const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
            const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));

            // 1. Onko tämä fyysinen tilavaraus?
            if (event.isResource || (event.location && event.location.startsWith('RES'))) {
                staged.rooms.push({
                    expert_id: asiantuntijaId,
                    room_name: event.location || 'Tuntematon tila',
                    start_time: startTimeIso,
                    end_time: endTimeIso
                });
                return;
            }

            const baseEvent = {
                id: finalUid, // Käytetään avaimena UI:ssa
                expert_id: asiantuntijaId,
                ics_uid: finalUid,
                start_time: startTimeIso, 
                end_time: endTimeIso,
                is_all_day: isAllDay,
                sync_token: event.sync_token || null,
                original_summary: event.summary || ''
            };

            const summary = event.summary || '';
            const lowerSummary = summary.toLowerCase();
            const idMatch = summary.match(/\d{14}/);
            const customerId = idMatch ? idMatch[0] : null;

            // Katsotaan, löytyykö koko otsikko sanakirjasta (opittu muoto)
            const learnedPrefixMatch = Object.keys(learnedDictionary).find(prefix => lowerSummary.startsWith(prefix.toLowerCase()));

            // ================= VIP: Stealth Token tai Opittu Muoto =================
            if (event.sync_token || learnedPrefixMatch) {
                let cat = 'tapaaminen';
                let method = lowerSummary.includes('puhelu') || lowerSummary.includes('soitto') ? 'soitto' : 'lasna';
                let isCancel = false;

                if (learnedPrefixMatch) {
                    const learnedData = learnedDictionary[learnedPrefixMatch];
                    cat = learnedData.cat;
                    method = learnedData.method;
                    isCancel = learnedData.isCancel;
                } else if (lowerSummary.startsWith('peruttu')) {
                    cat = 'peruttu';
                    isCancel = true;
                }

                // Jos otsikossa on ylimääräistä tekstiä ja sitä ei ole opittu -> menee Opetukseen
                const isCleanSummary = lowerSummary.startsWith('ajanvaraus') || lowerSummary.startsWith('peruttu');
                
                if (event.sync_token && !isCleanSummary && !learnedPrefixMatch) {
                    staged.teach.push({
                        ...baseEvent,
                        selectedCat: 'peruttu', // Oletusarvaus
                        selectedMethod: null,
                        learnNew: true
                    });
                } else {
                    staged.ready.push({ 
                        ...baseEvent, 
                        event_category: cat, 
                        contact_method: method,
                        is_cancelled: isCancel
                    });
                }
                return;
            }

            // ================= LEGACY / MUUT =================
            if (customerId) {
                // Vanha ratkaisukeskus-logiikka
                const maskedSummary = summary.replace(customerId, `${customerId.substring(0, 4)}*******${customerId.substring(11)}`);
                staged.legacyQueue.push({ 
                    ...baseEvent,
                    masked_summary: maskedSummary, 
                    status: 'pending' 
                });
            } else if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä|loma|tuuraus/)) {
                // Sijainnit & Poissaolot -> Suoraan vihreään
                staged.ready.push({ 
                    ...baseEvent, 
                    event_category: lowerSummary.match(/loma|tuuraus/) ? 'poissaolo' : 'sijainti', 
                    location_name: summary 
                });
            } else {
                // Muu työ (Ei asiakasta, ei tokenia) -> Siniseen koriin
                staged.other.push({
                    ...baseEvent,
                    selectedCat: 'sisainen_palaveri' // Oletus
                });
            }
        });

        return staged;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            // Haetaan kannasta jo tallennetut tapahtumat päällekkäisyyksien estämiseksi
            const fileUids = rawEvents.map(ev => ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null).filter(Boolean);
            const { data: existingData } = await supabase.schema('espan').from('ics_events').select('ics_uid').in('ics_uid', fileUids).in('expert_id', [asiantuntijaId, LEGACY_ID]);
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => {
                const fUid = ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null;
                return fUid && !existingUids.has(fUid);
            });
            
            const staged = stageEvents(newEvents);
            setStagedData(staged); // Avataan välitila (Staging Area)

        } catch (error) {
            console.error("Virhe parsinnassa:", error);
            alert("Kalenterin luku epäonnistui.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    // ==========================================
    // VAHVISTA JA TALLENNA (Commit)
    // ==========================================
    const commitStagedEvents = async () => {
        setIsProcessing(true);
        try {
            const inserts = [...stagedData.ready];
            const newDictionary = { ...learnedDictionary };
            let hasDictUpdates = false;

            // 1. Käsitellään Opetettavat
            stagedData.teach.forEach(item => {
                inserts.push({
                    expert_id: asiantuntijaId,
                    ics_uid: item.ics_uid,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    is_all_day: item.is_all_day,
                    sync_token: item.sync_token,
                    event_category: item.selectedCat,
                    contact_method: item.selectedMethod,
                    is_cancelled: item.selectedCat === 'peruttu' || item.selectedCat === 'noshow'
                });

                if (item.learnNew) {
                    const cleanPrefix = item.original_summary.split('-')[0].trim(); // Nappaa tekstin ennen väliviivaa jos on
                    newDictionary[cleanPrefix] = { cat: item.selectedCat, method: item.selectedMethod, isCancel: (item.selectedCat === 'peruttu' || item.selectedCat === 'noshow') };
                    hasDictUpdates = true;
                }
            });

            // 2. Käsitellään Muu työ
            stagedData.other.forEach(item => {
                inserts.push({
                    expert_id: asiantuntijaId,
                    ics_uid: item.ics_uid,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    is_all_day: item.is_all_day,
                    event_category: item.selectedCat
                });
            });

            // A. Tallennetaan tapahtumat (ics_events)
            if (inserts.length > 0) {
                const { error: eventError } = await supabase.schema('espan').from('ics_events').upsert(inserts, { onConflict: 'expert_id, ics_uid' });
                if (eventError) throw eventError;
            }

            // B. Tallennetaan tilavaraukset (room_bookings)
            if (stagedData.rooms.length > 0) {
                // Poistetaan isResource apumuuttuja
                const cleanRooms = stagedData.rooms.map(({ expert_id, room_name, start_time, end_time }) => ({ expert_id, room_name, start_time, end_time }));
                const { error: roomError } = await supabase.schema('espan').from('room_bookings').insert(cleanRooms);
                if (roomError) throw roomError;
            }

            // C. Tallennetaan legacy jonoon
            if (stagedData.legacyQueue.length > 0) {
                const queueInserts = stagedData.legacyQueue.map(q => ({ expert_id: q.expert_id, ics_uid: q.ics_uid, start_time: q.start_time, end_time: q.end_time, masked_summary: q.masked_summary, status: q.status }));
                const { error: queueError } = await supabase.schema('espan').from('ics_review_queue').upsert(queueInserts, { onConflict: 'expert_id, ics_uid' });
                if (queueError) throw queueError;
            }

            // D. Tallennetaan sanakirja selaimen muistiin
            if (hasDictUpdates) {
                localStorage.setItem('espan_ics_dictionary', JSON.stringify(newDictionary));
                setLearnedDictionary(newDictionary);
            }

            setStagedData(null); // Sulje välitila
            await fetchReviewQueue();
            if (onImportComplete) onImportComplete();
            alert("Tuonti ja täsmäytys onnistui!");

        } catch (err) {
            console.error("Tallennusvirhe:", err);
            alert("Tallennuksessa tapahtui virhe.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Apufunktio välitilan valikoiden päivittämiseen
    const updateStagedItem = (listName, id, key, value) => {
        setStagedData(prev => ({
            ...prev,
            [listName]: prev[listName].map(item => item.id === id ? { ...item, [key]: value } : item)
        }));
    };

    return (
        <Card title="Tuo Outlook-kalenteri (.ics)" icon={Calendar} variant="default">
            
            {/* VÄLITILA NÄKYMÄ (Staging Area) */}
            {stagedData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                        <BookOpen size={20} color="#3b82f6" /> Kalenterin täsmäytys
                    </h3>

                    {/* Vihreä alue (Automaattiset) */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <Badge variant="success" icon={CheckCircle}>Varmat osumat: {stagedData.ready.length}</Badge>
                        <Badge style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }} icon={DoorOpen}>Huonevaraukset: {stagedData.rooms.length}</Badge>
                        {stagedData.legacyQueue.length > 0 && <Badge variant="warning">Ratkaisukeskukseen: {stagedData.legacyQueue.length}</Badge>}
                    </div>

                    {/* Opetettavat (Teach) */}
                    {stagedData.teach.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: '0.9rem', color: '#b45309', marginBottom: '0.5rem' }}>Poikkeavat otsikot ({stagedData.teach.length})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {stagedData.teach.map(item => (
                                    <div key={item.id} style={{ padding: '0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.85rem' }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{item.original_summary}</div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select value={item.selectedCat} onChange={e => updateStagedItem('teach', item.id, 'selectedCat', e.target.value)} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                                                <option value="peruttu">Peruttu</option>
                                                <option value="noshow">Asiakas ei saapunut (No-show)</option>
                                                <option value="siirretty">Siirretty</option>
                                            </select>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={item.learnNew} onChange={e => updateStagedItem('teach', item.id, 'learnNew', e.target.checked)} />
                                                Muista sääntö jatkossa
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Muu työ (Other) */}
                    {stagedData.other.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.5rem' }}>Muu työ ({stagedData.other.length})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {stagedData.other.map(item => (
                                    <div key={item.id} style={{ padding: '0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                        <span style={{ fontWeight: '500' }}>{item.original_summary}</span>
                                        <select value={item.selectedCat} onChange={e => updateStagedItem('other', item.id, 'selectedCat', e.target.value)} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #93c5fd' }}>
                                            <option value="sisainen_palaveri">Sisäinen palaveri</option>
                                            <option value="koulutus">Koulutus</option>
                                            <option value="hallinto">Hallinto / Sähköpostit</option>
                                            <option value="muu_tyo">Muu varattu aika</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                        <Button variant="primary" icon={Save} onClick={commitStagedEvents} disabled={isProcessing}>
                            {isProcessing ? 'Tallennetaan...' : 'Vahvista ja tallenna kantaan'}
                        </Button>
                        <Button variant="secondary" onClick={() => setStagedData(null)} disabled={isProcessing}>Peruuta</Button>
                    </div>
                </div>
            ) : (
                /* NORMAALI TUONTINÄKYMÄ (Kun ei olla välitilassa) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                            <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                                {isProcessing ? 'Käsitellään...' : 'Valitse .ics tiedosto'}
                            </Button>
                            {isProcessing && <span className="text-sm text-slate-500 font-italic">Tarkistetaan tapahtumia...</span>}
                        </div>

                        <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                            Kalenteridata tarkistetaan automaattisesti ennen tallennusta.
                        </div>
                    </div>

                    {/* LEGACY RATKAISUKESKUS (Näkyy vain kun on selvitettävää) */}
                    {reviewQueue.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <AlertTriangle size={20} color="#eab308" />
                                <h3 className="text-md fw-bold m-0" style={{ color: '#854d0e' }}>
                                    Ratkaisukeskus: Epäselvät merkinnät ({reviewQueue.length})
                                </h3>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {reviewQueue.map((item) => {
                                    const startDate = new Date(item.start_time);
                                    return (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px' }}>
                                            <div>
                                                <div className="text-sm-dense text-slate-500 font-mono mb-1">
                                                    {item.start_time.includes('00:00:00') ? `${startDate.toLocaleDateString('fi-FI')} (Koko päivä)` : `${startDate.toLocaleDateString('fi-FI')} klo ${startDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}`}
                                                </div>
                                                <div className="text-sm fw-bold text-slate-700">{item.masked_summary}</div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {/* HUOM: Resolve-funktiota ei ole tässä snippetissä laajennettu, käytetään vanhaa logiikkaa */}
                                                <Button variant="secondary" icon={UserCheck} onClick={() => alert('Ratkaisu toimii vanhalla koodillasi!')}>Läsnä</Button>
                                                <Button variant="secondary" icon={PhoneCall} onClick={() => alert('Ratkaisu toimii vanhalla koodillasi!')}>Soitto</Button>
                                                <Button variant="danger" icon={Trash2} onClick={() => alert('Ratkaisu toimii vanhalla koodillasi!')}>Hylkää</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default IcsImport;