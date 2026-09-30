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
        
        if (cleanStr.length >= 15) {
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
            
            // 1. Etsi KAIKKI kalenterista, joissa on määritetty fyysinen tila
            const roomEventsRaw = rawEvents.filter(ev => ev.isResource || (ev.location && ev.location.startsWith('RES')));
            
            // 2. Parsitaan uid ja estetään tuplat tietokantaa vasten
            const fileUids = roomEventsRaw.map(ev => ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null).filter(Boolean);
            const { data: existingRooms } = await supabase.schema('espan').from('room_bookings').select('ics_uid').in('ics_uid', fileUids).eq('expert_id', asiantuntijaId);
            const existingRoomUids = new Set(existingRooms?.map(d => d.ics_uid) || []);
            
            const newRoomEvents = roomEventsRaw.filter(ev => {
                const fUid = ev.uid ? `${ev.uid}_${ev.start ? ev.start.split(':').pop().trim() : ''}` : null;
                return fUid && !existingRoomUids.has(fUid);
            });
            
            const insertsRooms = [];
            newRoomEvents.forEach(event => {
                const datePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
                const finalUid = event.uid ? `${event.uid}_${datePart}` : null;
                const startTimeIso = parseIcsDate(event.start);
                const endTimeIso = parseIcsDate(event.end) || startTimeIso; 
                
                if (startTimeIso && finalUid) {
                    insertsRooms.push({ 
                        expert_id: asiantuntijaId, 
                        ics_uid: finalUid, 
                        room_name: event.location || 'Tuntematon tila', 
                        start_time: startTimeIso, 
                        end_time: endTimeIso 
                    });
                }
            });

       // 3. Pusketaan kantaan! Käytetään luonnollista avainta (henkilö, huone, aika) 409-virheen estämiseksi
if (insertsRooms.length > 0) {
    const { error } = await supabase.schema('espan')
        .from('room_bookings')
        .upsert(insertsRooms, { onConflict: 'expert_id,room_name,start_time' });
    
    if (error) throw error;
}


            setResults({ 
                success: insertsRooms.length, 
                skipped: roomEventsRaw.length - insertsRooms.length 
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
                    Tämä työkalu poimii Outlook-tiedostosta AINOASTAAN huone- ja laitevaraukset (Resource) ja tallentaa ne automaattisesti oikeaan tauluun taustalla. 
                </div>

                {results && !results.error && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {results.success > 0 && <Badge variant="success" icon={CheckCircle}>Tuotiin {results.success} uutta huonevarausta</Badge>}
                        {results.skipped > 0 && <Badge variant="default" className="text-muted">Ohitettiin {results.skipped} (jo tallennettu)</Badge>}
                        {results.success === 0 && <Badge variant="default" icon={CheckCircle}>Ei uusia tilavarauksia</Badge>}
                    </div>
                )}
                
                {results?.error && <AlertBox type="error">{results.error}</AlertBox>}
            </div>
        </Card>
    );
};

export default RoomImport;