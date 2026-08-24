// --- src/components/admin/PlanCalculator/IcsImport.jsx ---
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
    // 1. HAKU (Ratkaisukeskus & Pehmeä migraatio)
    // ==========================================
    const fetchReviewQueue = async () => {
        try {
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
    // 2. PARSINTA JA AIKALEIMAT
    // ==========================================
    const parseIcsDate = (dateStr) => {
        if (!dateStr) return null;
        // Napataan varsinainen arvo riippumatta ICS-parametreista (esim VALUE=DATE tai TZID)
        const cleanStr = dateStr.includes(':') ? dateStr.split(':').pop().trim() : dateStr.trim();
        
        if (cleanStr.length === 8) {
            // Koko päivän tapahtuma. Lukitaan neutraaliin klo 00:00:00Z UTC, jotta päivä ei vaihdu
            const y = cleanStr.substring(0, 4);
            const m = cleanStr.substring(4, 6);
            const d = cleanStr.substring(6, 8);
            return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
        } else if (cleanStr.length >= 15) {
            // Normaali kellonajallinen tapahtuma
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
        
        // 1. Rivitaittojen (line folding) ehjäys - Korjaa pitkät UID-katkeamiset
        const unfoldedText = icsText.replace(/\r?\n[ \t]/g, '');
        const lines = unfoldedText.split(/\r?\n/);
        
        let currentEvent = null;

        lines.forEach(line => {
            if (line.startsWith('BEGIN:VEVENT')) {
                currentEvent = {};
            } else if (line.startsWith('END:VEVENT') && currentEvent) {
                
                // VIP / Stealth-token: Etsitään salainen tunniste järjestelmän omista varauksista
                if (currentEvent.description) {
                    const tokenMatch = currentEvent.description.match(/Asiantuntija Vesa Nessling(?:\\n|\n)(.+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        currentEvent.sync_token = tokenMatch[1].replace(/\\n/g, '').trim();
                    }
                }

                events.push(currentEvent);
                currentEvent = null;
            } else if (currentEvent) {
                // Joustava kenttien lukija (Ohittaa koodit kuten LANGUAGE=fi)
                const colonIndex = line.indexOf(':');
                if (colonIndex > -1) {
                    const propFull = line.substring(0, colonIndex);
                    // Poimitaan vain perusominaisuus ennen puolipistettä (esim. SUMMARY;LANGUAGE=fi -> SUMMARY)
                    const propName = propFull.split(';')[0].toUpperCase(); 
                    const value = line.substring(colonIndex + 1).trim();

                    if (propName === 'UID') currentEvent.uid = value;
                    if (propName === 'SUMMARY') currentEvent.summary = value; // Nappaa ehjänä, vaikka sisältäisi 2. kaksoispisteen
                    if (propName === 'DTSTART') currentEvent.start = line; 
                    if (propName === 'DTEND') currentEvent.end = line;
                    if (propName === 'DESCRIPTION') currentEvent.description = value;
                }
            }
        });
        return events;
    };

    // ==========================================
    // 3. PÄÄTTELYKONE (Categorization)
    // ==========================================
    const processEvents = (rawEvents) => {
        const cleanEvents = [];
        const queueEvents = [];

        rawEvents.forEach(event => {
            // Parsitaan pvm-tunniste (yhdistetään UID:iin, jotta toistuvat tapahtumat tallentuvat uniikkeina!)
            const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
            const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
            if (!finalUid) return;

            const startTimeIso = parseIcsDate(event.start);
            const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
            const isAllDay = datePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));

            const baseEvent = {
                expert_id: asiantuntijaId,
                ics_uid: finalUid,
                start_time: startTimeIso, 
                end_time: endTimeIso,
                is_all_day: isAllDay,
                sync_token: event.sync_token || null 
            };

            // OHITUSKAISTA (VIP): Oman järjestelmän synkronoimat tapahtumat
            if (event.sync_token) {
                cleanEvents.push({ 
                    ...baseEvent, 
                    event_category: 'tapaaminen', 
                    contact_method: event.summary?.toLowerCase().includes('puhelu') || event.summary?.toLowerCase().includes('soitto') ? 'soitto' : 'lasna' 
                });
                return; 
            }

            // NORMAALI TARKISTUS
            const summary = event.summary || '';
            const lowerSummary = summary.toLowerCase();
            
            // Haetaan joustavasti mikä tahansa 14-numeroinen putki (sallii klo/teksti-päättymiset)
            const idMatch = summary.match(/\d{14}/);
            const customerId = idMatch ? idMatch[0] : null;

            // Poissulkeminen VASTA kun ei numeroa ja yhtään oikeaa avainsanaa
            if (!customerId && !lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä|loma|tuuraus/)) {
                return; 
            }

            if (customerId) {
                if (lowerSummary.includes('peruttu')) {
                    cleanEvents.push({ ...baseEvent, event_category: 'peruttu', is_cancelled: true });
                } 
                else if (lowerSummary.includes('soitto') || lowerSummary.includes('puhelu')) {
                    cleanEvents.push({ ...baseEvent, event_category: 'tapaaminen', contact_method: 'soitto' });
                } 
                else {
                    // Päättely, onko merkinnässä pelkkä asiakasnumero
                    const summaryWithoutId = summary.replace(customerId, '').trim();
                    const isOnlyId = summaryWithoutId.length === 0 || /^[\W_]*$/.test(summaryWithoutId); 
                    
                    if (isOnlyId || lowerSummary.includes('läsnä') || lowerSummary.includes('lasna') || lowerSummary.includes('ajanvaraus') || lowerSummary.includes('sovittu') || lowerSummary.includes('varattu')) {
                        // Täydellinen läsnävaraus tai "pelkkä numero" -> suoraan tapaamisiin
                        cleanEvents.push({ ...baseEvent, event_category: 'tapaaminen', contact_method: 'lasna' });
                    } else {
                        // Asiakasnumero löytyi, mutta otsikon tarkoitus ei selvinnyt. Siirretään ratkaisujonoon!
                        const maskedSummary = summary.replace(customerId, `${customerId.substring(0, 4)}*******${customerId.substring(11)}`);
                        // KORJAUS 400 ERROR: Työnnetään VAIN taulusta löytyvät arvot jonoon (ei baseEventin kenttiä is_all_day tai sync_token)
                        queueEvents.push({ 
                            expert_id: asiantuntijaId,
                            ics_uid: finalUid,
                            start_time: startTimeIso,
                            end_time: endTimeIso,
                            masked_summary: maskedSummary, 
                            status: 'pending' 
                        });
                    }
                }
            } 
            else if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä/)) {
                // Sijainnit
                cleanEvents.push({ ...baseEvent, event_category: 'sijainti', location_name: summary });
            } 
            else if (lowerSummary.match(/loma|tuuraus/)) {
                // Poissaolot
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
            
            // Kerätään kaikki unikaaliset kustomoidut UID:t 
            const fileUids = rawEvents.map(ev => {
                const dp = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim() : ev.start.trim()) : '';
                return ev.uid ? `${ev.uid}_${dp}` : null;
            }).filter(Boolean);
            
            // Katsotaan kannasta kaikki tuonut
            const queryIds = [asiantuntijaId, LEGACY_ID];
            const { data: existingData } = await supabase.schema('espan')
                .from('ics_events')
                .select('ics_uid')
                .in('ics_uid', fileUids)
                .in('expert_id', queryIds);
                
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            // Jätetään käsittelyyn vain aidosti uudet
            const newEvents = rawEvents.filter(ev => {
                const dp = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim() : ev.start.trim()) : '';
                const fUid = ev.uid ? `${ev.uid}_${dp}` : null;
                return fUid && !existingUids.has(fUid);
            });
            
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
    // 4. RATKAISUTOIMINNOT (Käyttöliittymä)
    // ==========================================
    const resolveItem = async (item, actionCategory, actionMethod) => {
        try {
            const finalCategory = actionCategory === 'hylkaa' ? 'hylatty' : actionCategory;
            
            // KORJAUS 400 ERROR: Koska is_all_day jäi pois ratkaisujonotaulusta, selvitetään se luotettavasti tässä!
            const isAllDay = item.start_time.includes('00:00:00');
            
            const newEvent = {
                expert_id: asiantuntijaId, 
                ics_uid: item.ics_uid, 
                start_time: item.start_time,
                end_time: item.end_time,
                is_all_day: isAllDay, 
                event_category: finalCategory,
                contact_method: actionMethod || null,
                sync_token: null 
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
                        
                        {isProcessing && <span className="text-sm text-slate-500 font-italic">Tarkistetaan tapahtumia...</span>}
                    </div>

                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Kaikki kalenteridata käsitellään ja anonymisoidaan turvallisesti suoraan selaimessasi. 
                        Asiakasnumeroita tai henkilötietoja ei koskaan lähetetä palvelimelle tunnistamattomina.
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
                            Seuraavista kalenterimerkinnöistä löytyi asiakasnumero, mutta automatiikka ei tunnistanut 100% varmuudella asiakastapahtuman tyyppiä.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {reviewQueue.map((item) => {
                                const startDate = new Date(item.start_time);
                                // KORJAUS 400 ERROR: Selvitetään oliko kyseessä koko päivän (klo 00:00:00) ilmiö ja printataan asiallisesti UI:hin
                                const isAllDayItem = item.start_time.includes('00:00:00');
                                
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
                                                {isAllDayItem 
                                                    ? `${startDate.toLocaleDateString('fi-FI')} (Koko päivä)`
                                                    : `${startDate.toLocaleDateString('fi-FI')} klo ${startDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}`
                                                }
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