// --- src/components/admin/PlanCalculator/IcsImport/RoomImport.jsx ---
import React, { useState, useRef } from 'react';
import { supabase } from '../../../../utils/supabaseClient'; 
import Card from '../../../common/Card';
import Button from '../../../common/Button';
import Badge from '../../../common/Badge';
import AlertBox from '../../../common/AlertBox';
import { DoorOpen, Upload, Loader2, CheckCircle } from 'lucide-react';

const RoomImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const fileInputRef = useRef(null);

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

    // TUOTU TAKAISIN: Toistuvuuksien purkaja!
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
                    if (propName === 'DTSTART') currentEvent.start = line; 
                    if (propName === 'DTEND') currentEvent.end = line;
                    if (propName === 'LOCATION') currentEvent.location = value;
                    if (propName === 'RRULE') currentEvent.rrule = value; // Lisätty: kerätään toistuvuus
                    if (propName === 'ATTENDEE' && line.includes('CUTYPE=RESOURCE')) currentEvent.isResource = true;
                }
            }
        });
        
        // Ajetaan events toistuvuuksien purkajan läpi ennen palautusta!
        return expandRRule(events);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setResults(null);

        try {
            const text = await file.text();
            const rawEvents = parseICS(text);
            
            const roomEventsRaw = rawEvents.filter(ev => ev.isResource || (ev.location && ev.location.startsWith('RES')));
            
            const { data: existingRooms, error: fetchError } = await supabase.schema('espan')
                .from('room_bookings')
                .select('ics_uid, room_name, start_time')
                .eq('expert_id', asiantuntijaId);
            
            if (fetchError) throw fetchError;

            const existingUids = new Set(existingRooms?.map(d => d.ics_uid).filter(Boolean));
            const existingTimeRooms = new Set(existingRooms?.map(d => `${d.room_name}_${new Date(d.start_time).getTime()}`));
            
            const insertsRooms = [];
            let actualSkippedRooms = 0;

            roomEventsRaw.forEach(event => {
                const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
                const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
                const startTimeIso = parseIcsDate(event.start);
                const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
                const roomName = event.location || 'Tuntematon tila';
                
                if (startTimeIso && finalUid) {
                    const timeRoomKey = `${roomName}_${new Date(startTimeIso).getTime()}`;
                    
                    if (existingUids.has(finalUid) || existingTimeRooms.has(timeRoomKey)) {
                        actualSkippedRooms++;
                    } else {
                        insertsRooms.push({ 
                            expert_id: asiantuntijaId, 
                            ics_uid: finalUid, 
                            room_name: roomName, 
                            start_time: startTimeIso, 
                            end_time: endTimeIso 
                        });
                        
                        existingUids.add(finalUid);
                        existingTimeRooms.add(timeRoomKey);
                    }
                }
            });

            if (insertsRooms.length > 0) {
                const { error: insertError } = await supabase.schema('espan')
                    .from('room_bookings')
                    .insert(insertsRooms);
                
                if (insertError) throw insertError;
            }

            setResults({ 
                success: insertsRooms.length, 
                skipped: actualSkippedRooms 
            });

            if (insertsRooms.length > 0 && onImportComplete) onImportComplete();

        } catch (error) {
            console.error("Virhe huoneiden tuonnissa:", error);
            setResults({ error: "Huonevarausten luku tai tallennus epäonnistui." });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    return (
        <Card title="Tuo vain tilavaraukset" icon={DoorOpen} variant="default">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                        {isProcessing ? 'Tallennetaan tiloja...' : 'Valitse kalenteri (.ics)'}
                    </Button>
                </div>

                <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                    Tämä työkalu poimii Outlook-tiedostosta AINOASTAAN huone- ja laitevaraukset (Resource). Tuplat ja samalle ajalle tehdyt varaukset ohitetaan suoraan.
                </div>

                {results && !results.error && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {results.success > 0 && <Badge variant="success" icon={CheckCircle}>Tuotiin {results.success} uutta huonevarausta</Badge>}
                        {results.skipped > 0 && <Badge variant="default" className="text-muted">Ohitettiin {results.skipped} päällekkäistä varausta</Badge>}
                        {results.success === 0 && <Badge variant="default" icon={CheckCircle}>Ei uusia tilavarauksia</Badge>}
                    </div>
                )}
                
                {results?.error && <AlertBox type="error">{results.error}</AlertBox>}
            </div>
        </Card>
    );
};

export default RoomImport;