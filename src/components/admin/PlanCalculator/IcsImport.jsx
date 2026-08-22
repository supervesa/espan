import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient'; 
import Card from '../../common/Card';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import AlertBox from '../../common/AlertBox';
import { Calendar, Upload, Loader2, CheckCircle, AlertTriangle, UserCheck, PhoneCall, Trash2 } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const IcsImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const [reviewQueue, setReviewQueue] = useState([]);
    const fileInputRef = useRef(null);

    // ==========================================
    // 1. HAKU (Ratkaisukeskus)
    // ==========================================
    const fetchReviewQueue = async () => {
        try {
            // Haetaan jono pehmeän migraation mukaisesti (Uusi + Legacy)
            const { data, error } = await supabase.schema('espan')
                .from('ics_review_queue')
                .select('*')
                .in('expert_id', [asiantuntijaId, LEGACY_ID])
                .order('start_time', { ascending: false });
                
            if (!error && data) {
                setReviewQueue(data);
            }
        } catch (error) {
            console.error("Virhe ratkaisujonon haussa:", error);
        }
    };

    useEffect(() => {
        if (asiantuntijaId) fetchReviewQueue();
    }, [asiantuntijaId]);

    // ==========================================
    // 2. PARSINTA 
    // ==========================================
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
        
        // 1. Puretaan ICS:n omituiset rivitaitot (line folding)
        // ICS tiedostot katkaisevat pitkät rivit laittamalla CRLF ja välilyönnin perään. Poistetaan ne!
        const unfoldedText = icsText.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        
        let currentEvent = null;

        lines.forEach(line => {
            if (line.startsWith('BEGIN:VEVENT')) {
                currentEvent = {};
            } else if (line.startsWith('END:VEVENT') && currentEvent) {
                
                // Kun tapahtuman kaikki tiedot on luettu, eristetään meidän STEALTH-TOKEN!
                if (currentEvent.description) {
                    // Etsitään "Asiantuntija Vesa Nessling" ja napataan sen perässä oleva rivi / toivotus.
                    // ICS käyttää monesti literaaleja \n tai oikeita rivinvaihtoja tekstin seassa.
                    const tokenMatch = currentEvent.description.match(/Asiantuntija Vesa Nessling(?:\\n|\n)(.+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        // Löytyi! Talletetaan se puhtaana objektin tietoihin
                        currentEvent.sync_token = tokenMatch[1].replace(/\\n/g, '').trim();
                    }
                }

                events.push(currentEvent);
                currentEvent = null;
            } else if (currentEvent) {
                if (line.startsWith('UID:')) currentEvent.uid = line.substring(4).trim();
                if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8).trim();
                if (line.startsWith('DTSTART')) currentEvent.start = line; 
                if (line.startsWith('DTEND')) currentEvent.end = line;
                if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12).trim();
            }
        });
        return events;
    };

    const processEvents = (rawEvents) => {
        const cleanEvents = [];
        const queueEvents = [];

        rawEvents.forEach(event => {
            const startTimeIso = parseIcsDate(event.start);
            const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
            
            const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
            const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));

            // Pohjaobjekti, johon liitämme uuden sync_token sarakkeen!
            const baseEvent = {
                expert_id: asiantuntijaId, // Kaikki tuotavat tallentuvat nyt aitoon ID:seen
                ics_uid: event.uid,
                start_time: startTimeIso, 
                end_time: endTimeIso,
                is_all_day: isAllDay,
                sync_token: event.sync_token || null // UUSI SARAKE!
            };

            // ==========================================
            // OHITUSKAISTA: Tämä on meidän oman kalenterin varaus!
            // ==========================================
            if (event.sync_token) {
                // Tapahtuma tunnistettu -> tallennetaan suoraan hyväksyttynä. 
                // Ei etsitä asiakasnumeroita tai heitetä ratkaisujonoon.
                cleanEvents.push({ 
                    ...baseEvent, 
                    event_category: 'tapaaminen', 
                    contact_method: event.summary?.toLowerCase().includes('puhelu') || event.summary?.toLowerCase().includes('soitto') ? 'soitto' : 'lasna' 
                });
                return; // Siirrytään seuraavaan tapahtumaan!
            }

            // ==========================================
            // NORMAALI TARKISTUSKAISTA (Aidoille Outlook-tapahtumille)
            // ==========================================
            const summary = event.summary || '';
            const idMatch = summary.match(/\b\d{14}\b/);
            const customerId = idMatch ? idMatch[0] : null;
            const lowerSummary = summary.toLowerCase();

            // POISSULKEMINEN
            if (!customerId && !lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä|loma|tuuraus/)) {
                return; 
            }

            if (customerId) {
                if (lowerSummary.includes('peruttu')) {
                    cleanEvents.push({ ...baseEvent, event_category: 'peruttu', is_cancelled: true });
                } else if (lowerSummary.includes('ajanvaraus') || lowerSummary.includes('sovittu') || lowerSummary.includes('varattu')) {
                    const method = lowerSummary.includes('soitto') || lowerSummary.includes('puhelu') ? 'soitto' : 'lasna';
                    cleanEvents.push({ ...baseEvent, event_category: 'tapaaminen', contact_method: method });
                } else if (summary.trim() === customerId) {
                    cleanEvents.push({ ...baseEvent, event_category: 'kylmasoitto', contact_method: 'soitto' });
                } else {
                    const maskedSummary = summary.replace(customerId, `${customerId.substring(0, 4)}*******${customerId.substring(11)}`);
                    queueEvents.push({ 
                        ...baseEvent,
                        masked_summary: maskedSummary, 
                        status: 'pending' 
                    });
                }
            } 
            else if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä/)) {
                cleanEvents.push({ ...baseEvent, event_category: 'sijainti', location_name: summary });
            } else if (lowerSummary.match(/loma|tuuraus/)) {
                cleanEvents.push({ ...baseEvent, event_category: 'poissaolo' });
            }
        });

        return { cleanEvents, queueEvents };
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setResults(null);

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            const fileUids = rawEvents.map(ev => ev.uid).filter(Boolean);
            
            // Kysytään kannasta duplikaatit MOLEMMILLA asiantuntija ID:illä (Uusi + Legacy)
            const queryIds = [asiantuntijaId, LEGACY_ID];
            const { data: existingData } = await supabase.schema('espan')
                .from('ics_events')
                .select('ics_uid')
                .in('ics_uid', fileUids)
                .in('expert_id', queryIds);
                
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => !existingUids.has(ev.uid));
            const skippedCount = rawEvents.length - newEvents.length;

            const { cleanEvents, queueEvents } = processEvents(newEvents);

            if (cleanEvents.length > 0) {
                const { error: eventError } = await supabase.schema('espan').from('ics_events').upsert(cleanEvents, { onConflict: 'expert_id, ics_uid' });
                if (eventError) throw eventError;
            }

            if (queueEvents.length > 0) {
                const { error: queueError } = await supabase.schema('espan').from('ics_review_queue').upsert(queueEvents, { onConflict: 'expert_id, ics_uid' });
                if (queueError) throw queueError;
            }

            setResults({
                success: cleanEvents.length,
                review: queueEvents.length,
                skipped: skippedCount
            });

            await fetchReviewQueue();
            if (onImportComplete) onImportComplete();

        } catch (error) {
            console.error("Virhe tuonnissa:", error);
            setResults({ error: "Kalenterin luku epäonnistui." });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    // ==========================================
    // 3. RATKAISUTOIMINNOT (Review Actions)
    // ==========================================
    const resolveItem = async (item, actionCategory, actionMethod) => {
        try {
            const finalCategory = actionCategory === 'hylkaa' ? 'hylatty' : actionCategory;
            
            // Tallennetaan pakottamalla aito ja oikea asiantuntijaId (Siivoaa mahdollisen Legacyn pois ratkaisujonosta)
            const newEvent = {
                expert_id: asiantuntijaId, 
                ics_uid: item.ics_uid,
                start_time: item.start_time,
                end_time: item.end_time,
                is_all_day: false,
                event_category: finalCategory,
                contact_method: actionMethod || null,
                sync_token: null // Ratkaisukeskukseen joutuneet ovat aina aitoja ulkoisia tapahtumia
            };
            
            const { error: insertErr } = await supabase.schema('espan')
                .from('ics_events')
                .upsert(newEvent, { onConflict: 'expert_id, ics_uid' });
                
            if (insertErr) throw insertErr;

            const { error: delErr } = await supabase.schema('espan').from('ics_review_queue').delete().eq('id', item.id);
            if (delErr) throw delErr;

            setReviewQueue(prev => prev.filter(r => r.id !== item.id));

        } catch (error) {
            console.error("Virhe tapahtuman ratkaisussa:", error);
            alert("Tapahtuman siirto epäonnistui. Yritä uudelleen.");
        }
    };

    return (
        <Card title="Tuo Outlook-kalenteri (.ics)" icon={Calendar} variant="default">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* TUONTIALUE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                            type="file" 
                            accept=".ics" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileChange} 
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isProcessing} 
                            icon={isProcessing ? Loader2 : Upload}
                            variant="primary"
                        >
                            {isProcessing ? 'Käsitellään...' : 'Valitse .ics tiedosto'}
                        </Button>
                        
                        {isProcessing && <span className="text-sm text-slate-500 font-italic">Tarkistetaan aikaisempia tuonteja...</span>}
                    </div>

                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Kaikki kalenteridata käsitellään ja anonymisoidaan turvallisesti suoraan selaimessasi. 
                        Asiakasnumeroita tai henkilötietoja ei koskaan lähetetä palvelimelle.
                    </div>

                    {results && !results.error && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {results.success > 0 && (
                                <Badge variant="success" icon={CheckCircle}>Tuotu {results.success} uutta</Badge>
                            )}
                            {results.skipped > 0 && (
                                <Badge variant="default" className="text-muted">
                                    Ohitettu {results.skipped} (jo tallennettu)
                                </Badge>
                            )}
                            {results.review > 0 && (
                                <Badge variant="warning">
                                    {results.review} siirretty ratkaisukeskukseen
                                </Badge>
                            )}
                            {results.success === 0 && results.review === 0 && (
                                <Badge variant="default" icon={CheckCircle}>Ei uusia tapahtumia</Badge>
                            )}
                        </div>
                    )}

                    {results?.error && (
                        <AlertBox type="error">{results.error}</AlertBox>
                    )}
                </div>

                {/* RATKAISUKESKUS */}
                {reviewQueue.length > 0 && (
                    <div style={{ 
                        marginTop: '1rem', 
                        paddingTop: '1.5rem', 
                        borderTop: '1px solid #e2e8f0' 
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                            <AlertTriangle size={20} color="#eab308" />
                            <h3 className="text-md fw-bold m-0" style={{ color: '#854d0e' }}>
                                Ratkaisukeskus: Epäselvät merkinnät ({reviewQueue.length})
                            </h3>
                        </div>
                        
                        <div className="text-sm text-slate-600 mb-4">
                            Seuraavista kalenterimerkinnöistä löytyi asiakasnumero, mutta automatiikka ei tunnistanut, onko kyseessä läsnätapaaminen vai kylmäsoitto.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {reviewQueue.map((item) => {
                                const startDate = new Date(item.start_time);
                                return (
                                    <div key={item.id} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        padding: '12px', 
                                        backgroundColor: '#fefce8', 
                                        border: '1px solid #fef08a', 
                                        borderRadius: '6px' 
                                    }}>
                                        <div>
                                            <div className="text-sm-dense text-slate-500 font-mono mb-1">
                                                {startDate.toLocaleDateString('fi-FI')} klo {startDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-sm fw-bold text-slate-700">
                                                {item.masked_summary}
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Button variant="secondary" icon={UserCheck} onClick={() => resolveItem(item, 'tapaaminen', 'lasna')}>Läsnä</Button>
                                            <Button variant="secondary" icon={PhoneCall} onClick={() => resolveItem(item, 'tapaaminen', 'soitto')}>Soitto</Button>
                                            <Button variant="secondary" icon={PhoneCall} onClick={() => resolveItem(item, 'kylmasoitto', 'soitto')}>Kylmäsoitto</Button>
                                            <div style={{ width: '1px', backgroundColor: '#fde047', margin: '0 4px' }}></div>
                                            <Button variant="danger" icon={Trash2} onClick={() => resolveItem(item, 'hylkaa', null)}>Hylkää</Button>
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

export default IcsImport;