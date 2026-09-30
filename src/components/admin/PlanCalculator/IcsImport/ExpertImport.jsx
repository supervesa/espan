// --- src/components/admin/PlanCalculator/IcsImport/ExpertImport.jsx ---
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient'; 
import Card from '../../../common/Card';
import Button from '../../../common/Button';
import Badge from '../../../common/Badge';
import AlertBox from '../../../common/AlertBox';
import { Calendar, Upload, Loader2, CheckCircle, AlertTriangle, UserCheck, PhoneCall, Trash2 } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const ExpertImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const [reviewQueue, setReviewQueue] = useState([]);
    const [localQueue, setLocalQueue] = useState([]); 
    const [learnedDictionary, setLearnedDictionary] = useState({});
    const [learnChecks, setLearnChecks] = useState({});

    const fileInputRef = useRef(null);

    useEffect(() => {
        const savedDict = localStorage.getItem('espan_ics_dictionary');
        if (savedDict) setLearnedDictionary(JSON.parse(savedDict));
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
            return isUTC ? new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString() : new Date(`${y}-${m}-${d}T${h}:${min}:${s}`).toISOString();
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
                    const propName = line.substring(0, colonIndex).split(';')[0].toUpperCase(); 
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

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setResults(null);

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            const fileUids = rawEvents.map(ev => ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null).filter(Boolean);
            const { data: existingData } = await supabase.schema('espan').from('ics_events').select('ics_uid').in('ics_uid', fileUids).in('expert_id', [asiantuntijaId, LEGACY_ID]);
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => {
                const fUid = ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null;
                // Pudotetaan kokonaan pois huonevaraukset (Koska niillä on nyt oma tuontinsa!)
                const isRoomEvent = ev.isResource || (ev.location && ev.location.startsWith('RES'));
                return fUid && !existingUids.has(fUid) && !isRoomEvent;
            });
            
            const insertsReady = [];
            const insertsLegacy = [];
            const newLocalQueue = [];
            let droppedLunchCount = 0;

            newEvents.forEach(event => {
                const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
                const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
                if (!finalUid) return;

                const startTimeIso = parseIcsDate(event.start);
                const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
                const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));
                const summary = event.summary || '';
                const lowerSummary = summary.toLowerCase();

                // 🛑 OHITETAAN LOUNAAT JA TAUKOMERKINNÄT TÄYSIN
                if (lowerSummary.includes('lounas') || lowerSummary.includes('lunch') || lowerSummary.includes('ruokatauko')) {
                    droppedLunchCount++;
                    return;
                }

                const baseEvent = { expert_id: asiantuntijaId, ics_uid: finalUid, start_time: startTimeIso, end_time: endTimeIso, is_all_day: isAllDay, sync_token: event.sync_token || null };
                const learnedPrefix = Object.keys(learnedDictionary).find(p => lowerSummary.startsWith(p.toLowerCase()));
                const idMatch = summary.match(/\d{14}/);

                // Token tai opittu (VIP)
                if (event.sync_token || learnedPrefix) {
                    let cat = 'tapaaminen';
                    let method = lowerSummary.includes('puhelu') || lowerSummary.includes('soitto') ? 'soitto' : 'lasna';
                    let isCancel = false;

                    if (learnedPrefix) {
                        const learnedData = learnedDictionary[learnedPrefix];
                        cat = learnedData.cat;
                        method = learnedData.method;
                        isCancel = learnedData.isCancel;
                    } else if (lowerSummary.startsWith('peruttu')) {
                        cat = 'peruttu';
                        isCancel = true;
                    }

                    const isClean = lowerSummary.startsWith('ajanvaraus') || lowerSummary.startsWith('peruttu');
                    
                    if (event.sync_token && !isClean && !learnedPrefix) {
                        newLocalQueue.push({ ...baseEvent, id: finalUid, original_summary: summary, queueType: 'teach' });
                    } else {
                        insertsReady.push({ ...baseEvent, event_category: cat, contact_method: method, is_cancelled: isCancel });
                    }
                    return;
                }

                // Vanha ID tai Muu Työ
                if (idMatch) {
                    const maskedSummary = summary.replace(idMatch[0], `${idMatch[0].substring(0, 4)}*******${idMatch[0].substring(11)}`);
                    insertsLegacy.push({ expert_id: asiantuntijaId, ics_uid: finalUid, start_time: startTimeIso, end_time: endTimeIso, masked_summary: maskedSummary, status: 'pending' });
                } else if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä/)) {
                    insertsReady.push({ ...baseEvent, event_category: 'sijainti', location_name: summary });
                } else if (lowerSummary.match(/loma|tuuraus/)) {
                    insertsReady.push({ ...baseEvent, event_category: 'poissaolo' });
                } else {
                    newLocalQueue.push({ ...baseEvent, id: finalUid, original_summary: summary, queueType: 'other' });
                }
            });

            if (insertsReady.length > 0) {
                const { error } = await supabase.schema('espan').from('ics_events').upsert(insertsReady, { onConflict: 'expert_id, ics_uid' });
                if (error) throw error;
            }
            if (insertsLegacy.length > 0) {
                const { error } = await supabase.schema('espan').from('ics_review_queue').upsert(insertsLegacy, { onConflict: 'expert_id, ics_uid' });
                if (error) throw error;
            }

            setLocalQueue(newLocalQueue);
            setResults({ 
                success: insertsReady.length, 
                review: insertsLegacy.length + newLocalQueue.length, 
                lunches: droppedLunchCount 
            });
            await fetchReviewQueue();
            if (insertsReady.length > 0 && onImportComplete) onImportComplete();

        } catch (error) {
            console.error("Virhe tuonnissa:", error);
            setResults({ error: "Kalenterin luku tai tallennus epäonnistui." });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    const resolveLocalItem = async (item, cat, method) => {
        try {
            const dbEvent = {
                expert_id: item.expert_id, ics_uid: item.ics_uid, start_time: item.start_time, end_time: item.end_time,
                is_all_day: item.is_all_day, sync_token: item.sync_token, event_category: cat, contact_method: method || null,
                is_cancelled: cat === 'peruttu' || cat === 'noshow'
            };

            const { error } = await supabase.schema('espan').from('ics_events').upsert(dbEvent, { onConflict: 'expert_id, ics_uid' });
            if (error) throw error;

            if (item.queueType === 'teach' && learnChecks[item.id]) {
                const cleanPrefix = item.original_summary.split('-')[0].trim();
                const newDict = { ...learnedDictionary, [cleanPrefix]: { cat, method, isCancel: dbEvent.is_cancelled } };
                localStorage.setItem('espan_ics_dictionary', JSON.stringify(newDict));
                setLearnedDictionary(newDict);
            }

            setLocalQueue(prev => prev.filter(q => q.id !== item.id));
            if (onImportComplete) onImportComplete();
        } catch (err) {
            alert("Tallennus epäonnistui.");
        }
    };

    const discardLocalItem = (id) => {
        setLocalQueue(prev => prev.filter(q => q.id !== id));
    };

    const resolveLegacyItem = async (item, cat, method) => {
        try {
            const finalCategory = cat === 'hylkaa' ? 'hylatty' : cat;
            const dbEvent = { expert_id: asiantuntijaId, ics_uid: item.ics_uid, start_time: item.start_time, end_time: item.end_time, is_all_day: item.start_time.includes('00:00:00'), event_category: finalCategory, contact_method: method || null };
            
            const { error: insErr } = await supabase.schema('espan').from('ics_events').upsert(dbEvent, { onConflict: 'expert_id, ics_uid' });
            if (insErr) throw insErr;

            const { error: delErr } = await supabase.schema('espan').from('ics_review_queue').delete().eq('id', item.id);
            if (delErr) throw delErr;

            setReviewQueue(prev => prev.filter(r => r.id !== item.id));
            if (onImportComplete) onImportComplete();
        } catch (error) {
            alert("Tapahtuman siirto epäonnistui.");
        }
    };

    return (
        <Card title="Asiantuntijan tapahtumat" icon={Calendar} variant="default">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                            {isProcessing ? 'Käsitellään...' : 'Valitse kalenteri (.ics)'}
                        </Button>
                        {isProcessing && <span className="text-sm text-slate-500 font-italic">Tarkistetaan tapahtumia...</span>}
                    </div>

                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Poimii automaattisesti työtehtävät ja sivuuttaa lounaat. Epäselvät siirtyvät alle ratkaistaviksi.
                    </div>

                    {results && !results.error && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {results.success > 0 && <Badge variant="success" icon={CheckCircle}>Tuotu {results.success} uutta</Badge>}
                            {results.review > 0 && <Badge variant="warning">{results.review} vaatii huomiota</Badge>}
                            {results.lunches > 0 && <Badge variant="default" className="text-muted">Siivottiin {results.lunches} lounasta</Badge>}
                        </div>
                    )}
                    {results?.error && <AlertBox type="error">{results.error}</AlertBox>}
                </div>

                {(reviewQueue.length > 0 || localQueue.length > 0) && (
                    <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                            <AlertTriangle size={20} color="#eab308" />
                            <h3 className="text-md fw-bold m-0" style={{ color: '#854d0e' }}>
                                Ratkaisukeskus: Epäselvät merkinnät ({reviewQueue.length + localQueue.length})
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {localQueue.map((item) => {
                                const startDate = new Date(item.start_time);
                                return (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px' }}>
                                        <div>
                                            <div className="text-sm-dense text-slate-500 font-mono mb-1">
                                                {item.is_all_day ? `${startDate.toLocaleDateString('fi-FI')} (Koko päivä)` : `${startDate.toLocaleDateString('fi-FI')} klo ${startDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}`}
                                            </div>
                                            <div className="text-sm fw-bold text-slate-700">{item.original_summary}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {item.queueType === 'teach' ? (
                                                <>
                                                    <Button variant="secondary" onClick={() => resolveLocalItem(item, 'peruttu', null)}>Peruttu</Button>
                                                    <Button variant="secondary" onClick={() => resolveLocalItem(item, 'noshow', null)}>No-show</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="secondary" onClick={() => resolveLocalItem(item, 'sisainen_palaveri', null)}>Sis. pal.</Button>
                                                    <Button variant="secondary" onClick={() => resolveLocalItem(item, 'koulutus', null)}>Koulutus</Button>
                                                    <Button variant="secondary" onClick={() => resolveLocalItem(item, 'muu_tyo', null)}>Muu työ</Button>
                                                </>
                                            )}
                                            <div style={{ width: '1px', backgroundColor: '#fde047', margin: '0 4px' }}></div>
                                            {/* TÄSSÄ HYLKÄÄ / OHITA NAPPI */}
                                            <Button variant="danger" icon={Trash2} onClick={() => discardLocalItem(item.id)}>Hylkää / Ohita</Button>
                                        </div>
                                    </div>
                                );
                            })}

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
                                            <Button variant="secondary" icon={UserCheck} onClick={() => resolveLegacyItem(item, 'tapaaminen', 'lasna')}>Läsnä</Button>
                                            <Button variant="secondary" icon={PhoneCall} onClick={() => resolveLegacyItem(item, 'tapaaminen', 'soitto')}>Soitto</Button>
                                            <div style={{ width: '1px', backgroundColor: '#fde047', margin: '0 4px' }}></div>
                                            <Button variant="danger" icon={Trash2} onClick={() => resolveLegacyItem(item, 'hylkaa', null)}>Hylkää / Ohita</Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ExpertImport;