// --- src/components/admin/PlanCalculator/IcsImport/icsParser.js ---

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

export const parseICS = (icsText, validTokens = []) => {
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
                const propFull = line.substring(0, colonIndex);
                const propName = propFull.split(';')[0].toUpperCase(); 
                const value = line.substring(colonIndex + 1).trim();

                if (propName === 'UID') currentEvent.uid = value;
                if (propName === 'SUMMARY') currentEvent.summary = value; 
                if (propName === 'DTSTART') currentEvent.start = line; 
                if (propName === 'DTEND') currentEvent.end = line;
                if (propName === 'LOCATION') currentEvent.location = value;
                if (propName === 'RRULE') currentEvent.rrule = value;
                if (propName === 'ATTENDEE' && line.includes('CUTYPE=RESOURCE')) currentEvent.isResource = true;
                
                // --- KAKSIVAIHEINEN TOKEN-TUTKA ---
                if (propName === 'DESCRIPTION') {
                    currentEvent.description = value;
                    let foundToken = null;

                    // 1. Uusi Tutka (Etsitään lunttilapulta uutta toivotusta)
                    for (const token of validTokens) {
                        if (token && value.includes(token)) {
                            foundToken = token;
                            break;
                        }
                    }

                    if (foundToken) {
                        currentEvent.sync_token = foundToken;
                    } else {
                        // 2. Vanha Fallback-tutka (Asiantuntija Vesa Nessling)
                        const tokenMatch = value.match(/Asiantuntija Vesa Nessling(?:\\n|\n)(.+)/);
                        if (tokenMatch && tokenMatch[1]) {
                            currentEvent.sync_token = tokenMatch[1].replace(/\\n/g, '').trim();
                        }
                    }
                }
            }
        }
    });
    return expandRRule(events);
};