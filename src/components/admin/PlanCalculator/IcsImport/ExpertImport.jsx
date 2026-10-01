// --- src/components/admin/PlanCalculator/IcsImport/ExpertImport.jsx ---
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient'; 
import Card from '../../../common/Card';
import Button from '../../../common/Button';
import { Calendar, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { parseICS } from './icsParser';
import StagingArea from './StagingArea';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const ExpertImport = ({ asiantuntijaId, onImportComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    
    const [learnedDictionary, setLearnedDictionary] = useState({});
    const [validTokens, setValidTokens] = useState([]);
    const [legacyQueue, setLegacyQueue] = useState([]);
    
    const [isStaging, setIsStaging] = useState(false);
    const [stagingStats, setStagingStats] = useState({ lunches: 0, autoSkipped: 0, newWords: 0 });
    const [autoQueue, setAutoQueue] = useState([]);
    const [teachQueue, setTeachQueue] = useState([]);
    const [manualQueue, setManualQueue] = useState([]);
    const [initialAutoSkips, setInitialAutoSkips] = useState(new Set());

    const fileInputRef = useRef(null);

    const fetchDictionary = async () => {
        try {
            const { data, error } = await supabase.schema('espan').from('ics_dictionary').select('*');
            if (!error && data) {
                const dictObj = {};
                data.forEach(item => {
                    const cleanWord = item.opittu_sana.toLowerCase().replace(/:$/, '').trim();
                    dictObj[cleanWord] = { cat: item.kategoria, method: item.metodi, isCancel: item.is_cancelled };
                });
                setLearnedDictionary(dictObj);
            }
        } catch (error) {
            console.error("Virhe sanakirjan latauksessa:", error);
        }
    };

    const fetchValidTokens = async () => {
        try {
            const { data, error } = await supabase.schema('espan')
                .from('availability')
                .select('sync_token')
                .eq('expert_id', asiantuntijaId)
                .not('sync_token', 'is', null);
                
            if (!error && data) {
                const tokens = data.map(d => d.sync_token).filter(Boolean);
                setValidTokens(tokens);
            }
        } catch (err) {
            console.error("Virhe tokenien latauksessa:", err);
        }
    };

    const fetchReviewQueue = async () => {
        try {
            const { data, error } = await supabase.schema('espan')
                .from('ics_review_queue')
                .select('*')
                .in('expert_id', [asiantuntijaId, LEGACY_ID])
                .order('start_time', { ascending: false });
                
            if (!error && data) {
                const mappedLegacy = data.map(item => ({ ...item, isLegacy: true, summaryDisplay: item.masked_summary }));
                setLegacyQueue(mappedLegacy);
            }
        } catch (error) {
            console.error("Virhe ratkaisujonon haussa:", error);
        }
    };

    useEffect(() => {
        fetchDictionary();
        if (asiantuntijaId) {
            fetchValidTokens();
            fetchReviewQueue();
        }
    }, [asiantuntijaId]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setIsStaging(false);

        try {
            const text = await file.text();
            const rawEvents = parseICS(text, validTokens);
            
            const fileUids = rawEvents.map(ev => {
                if (!ev.uid) return null;
                const rawDate = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim() : ev.start.trim()) : '';
                return `${ev.uid}_${rawDate.substring(0,8)}`;
            }).filter(Boolean);

            const { data: existingData } = await supabase.schema('espan').from('ics_events').select('ics_uid').in('ics_uid', fileUids).in('expert_id', [asiantuntijaId, LEGACY_ID]);
            const existingUids = new Set(existingData?.map(d => d.ics_uid) || []);
            
            const newEvents = rawEvents.filter(ev => {
                const rawDate = ev.start ? (ev.start.includes(':') ? ev.start.split(':').pop().trim() : ev.start.trim()) : '';
                const fUid = ev.uid ? `${ev.uid}_${rawDate.substring(0,8)}` : null;
                return fUid && !existingUids.has(fUid);
            });

            const tAuto = []; const tTeach = []; const tManual = [...legacyQueue];
            const tempAutoSkips = new Set();
            let droppedLunchCount = 0;
            let dictionarySkippedCount = 0;

            newEvents.forEach(event => {
                const rawDatePart = event.start ? (event.start.includes(':') ? event.start.split(':').pop().trim() : event.start.trim()) : '';
                const isAllDay = rawDatePart.length === 8 || (event.start && event.start.includes('VALUE=DATE'));

                const datePart8 = rawDatePart.substring(0, 8);
                const finalUid = event.uid ? `${event.uid}_${datePart8}` : null;
                if (!finalUid) return;

                const extractIso = (icsDateStr) => {
                    const cleanStr = icsDateStr.includes(':') ? icsDateStr.split(':').pop().trim() : icsDateStr.trim();
                    if (cleanStr.length === 8) {
                        return new Date(`${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}T00:00:00Z`).toISOString();
                    } else if (cleanStr.length >= 15) {
                        const isUTC = cleanStr.endsWith('Z');
                        const isoBase = `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}T${cleanStr.substring(9, 11)}:${cleanStr.substring(11, 13)}:${cleanStr.substring(13, 15)}`;
                        return isUTC ? new Date(`${isoBase}Z`).toISOString() : new Date(isoBase).toISOString();
                    }
                    return null;
                };

                const realStartIso = extractIso(event.start);
                const realEndIso = extractIso(event.end || event.start);

                let originalSummary = event.summary || '';
                let displaySummary = originalSummary;
                let lowerSummary = displaySummary.toLowerCase();

                // 🛑 1. KOVAKOODATTU HARMAA LISTA (Lounaat)
                if (lowerSummary.includes('lounas') || lowerSummary.includes('lunch') || lowerSummary.includes('ruokatauko')) {
                    droppedLunchCount++;
                    return;
                }

                // ✂️ 2. SAKSET JA TÄHDET (Ajanvaraukset ja numerot)
                let hasScissorCut = false;
                let hasNumberMask = false; 
                const scissorMatch = displaySummary.match(/^(.*?ajanvaraus.*?)\s+(\d{5,})/i); 
                
                if (scissorMatch) {
                    const prefixTxt = scissorMatch[1].trim(); 
                    const num = scissorMatch[2];
                    const maskedNum = `${num.substring(0, 4)}` + '***'; 
                    displaySummary = `${prefixTxt} ${maskedNum}`; 
                    lowerSummary = displaySummary.toLowerCase();
                    hasScissorCut = true;
                    hasNumberMask = true;
                } else {
                    const numMatch = displaySummary.match(/\d{5,}/);
                    if (numMatch) {
                        const num = numMatch[0];
                        const maskedNum = `${num.substring(0, 4)}` + '***';
                        displaySummary = displaySummary.replace(num, maskedNum);
                        lowerSummary = displaySummary.toLowerCase();
                        hasNumberMask = true;
                    }
                }

                // 🛑 2.5. TYHJÄT VARAUSKUORET (Ajanvaraus ilman numeroa tai tokenia)
                if (lowerSummary.includes('ajanvaraus') && !hasNumberMask && !event.sync_token) {
                    droppedLunchCount++;
                    return; // Heitetään roskiin!
                }

                const baseEvent = { id: finalUid, expert_id: asiantuntijaId, ics_uid: finalUid, start_time: realStartIso, end_time: realEndIso, is_all_day: isAllDay, summaryDisplay: displaySummary, original_summary: originalSummary, sync_token: event.sync_token || null };

                // 🔍 3. SANAKIRJA JA HARMAA LISTA
                let dictHit = learnedDictionary[lowerSummary];
                let prefix = lowerSummary;
                let hasDash = false;

                if (!dictHit) {
                    const dashMatch = displaySummary.match(/^(.*?)\s*(?:--?|:)\s*(.*)$/);
                    if (dashMatch) {
                        hasDash = true;
                        prefix = dashMatch[1].trim();
                        dictHit = learnedDictionary[prefix.toLowerCase()];
                    }
                }

                if (dictHit) {
                    if (dictHit.cat === 'piilotettu') {
                        dictionarySkippedCount++; 
                    } else if (dictHit.cat === 'hylatty') {
                        tAuto.push({ ...baseEvent, category: 'hylatty', method: null, is_cancelled: false });
                        tempAutoSkips.add(finalUid);
                    } else {
                        tAuto.push({ ...baseEvent, category: dictHit.cat, method: dictHit.method, is_cancelled: dictHit.isCancel });
                    }
                    return;
                }

                if (hasDash && !hasScissorCut) {
                    tTeach.push({ ...baseEvent, prefix });
                    return;
                }

                // 🎯 4. ELEGANTTI TUTKA (Tokenit, Leikatut ajanvaraukset, Kylmäsoitot)
                if (event.sync_token || hasScissorCut || hasNumberMask || lowerSummary.startsWith('peruttu')) {
                    let cat = 'tapaaminen';
                    let method = 'lasna';
                    let isCancel = false;

                    if (lowerSummary.includes('puhelu') || lowerSummary.includes('soitto')) {
                        method = 'soitto';
                    }
                    
                    if (hasNumberMask && !lowerSummary.includes('läsnä') && !lowerSummary.includes('lasna') && !lowerSummary.includes('ajanvaraus')) {
                        method = 'soitto'; 
                    }

                    if (lowerSummary.startsWith('peruttu')) {
                        cat = 'peruttu';
                        method = null;
                        isCancel = true;
                    }

                    tAuto.push({ ...baseEvent, category: cat, method: method, is_cancelled: isCancel });
                    return;
                }

                // 🌍 5. SIJAINNIT JA LOMAT
                if (lowerSummary.match(/malminkatu|viipurinkatu|itäkeskus|etä/)) {
                    tAuto.push({ ...baseEvent, category: 'sijainti', method: null, is_cancelled: false, location_name: displaySummary });
                    return;
                } else if (lowerSummary.match(/loma|tuuraus/)) {
                    tAuto.push({ ...baseEvent, category: 'poissaolo', method: null, is_cancelled: false });
                    return;
                }

                // 🤷‍♂️ 6. TUNNISTAMATON (Manuaalijono)
                tManual.push({ ...baseEvent, isLegacy: false });
            });

            const groupedTeach = {};
            tTeach.forEach(ev => {
                if (!groupedTeach[ev.prefix]) groupedTeach[ev.prefix] = [];
                groupedTeach[ev.prefix].push(ev);
            });

            setInitialAutoSkips(tempAutoSkips);
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

    const handleStartManualReview = () => {
        setAutoQueue([]); setTeachQueue([]); setManualQueue([...legacyQueue]);
        setInitialAutoSkips(new Set());
        setStagingStats({ lunches: 0, autoSkipped: 0, newWords: 0 });
        setIsStaging(true);
    };

    // --- LOPULLINEN TALLENNUS ---
    const handleCommit = async (autoSkips, teachConfigs, manualConfigs) => {
        setIsCommitting(true);
        try {
            const rawInsertsEvents = [];
            const insertsDict = [];
            const legacyDeletes = [];

            autoQueue.forEach(ev => {
                if (!autoSkips.has(ev.ics_uid)) {
                    rawInsertsEvents.push({
                        expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                        event_category: ev.category, contact_method: ev.method, is_cancelled: ev.is_cancelled, location_name: ev.location_name || null, sync_token: ev.sync_token
                    });
                }
            });

            teachQueue.forEach(group => {
                const conf = teachConfigs[group.prefix];
                if (!conf || !conf.category) return;

                const finalCat = conf.category === 'vapaa' ? (conf.custom || 'muu_tyo') : conf.category;
                const isCanceled = finalCat === 'peruttu' || finalCat === 'noshow';

                if (finalCat !== 'hylatty' && finalCat !== 'piilotettu') {
                    group.events.forEach(ev => {
                        rawInsertsEvents.push({
                            expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                            event_category: finalCat, contact_method: conf.method || null, is_cancelled: isCanceled, location_name: null, sync_token: ev.sync_token
                        });
                    });
                }

                if (conf.save) {
                    insertsDict.push({ opittu_sana: group.prefix, kategoria: finalCat, metodi: conf.method || null, is_cancelled: isCanceled });
                }
            });

            manualQueue.forEach(ev => {
                const conf = manualConfigs[ev.id];
                if (conf && conf.category) {
                    if (conf.category !== 'hylatty') {
                        const isCanceled = conf.category === 'peruttu' || conf.category === 'noshow';
                        rawInsertsEvents.push({
                            expert_id: ev.expert_id, ics_uid: ev.ics_uid, start_time: ev.start_time, end_time: ev.end_time, is_all_day: ev.is_all_day,
                            event_category: conf.category, contact_method: conf.method || null, is_cancelled: isCanceled, location_name: ev.location_name || null, sync_token: ev.sync_token
                        });
                    }

                    if (ev.isLegacy) {
                        legacyDeletes.push(ev.id);
                    }
                }
            });

            const uniqueEventsMap = new Map();
            rawInsertsEvents.forEach(ev => {
                uniqueEventsMap.set(`${ev.expert_id}_${ev.ics_uid}`, ev);
            });
            const insertsEvents = Array.from(uniqueEventsMap.values());

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
            
            {!isStaging ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="file" accept=".ics" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} icon={isProcessing ? Loader2 : Upload} variant="primary">
                            {isProcessing ? 'Analysoidaan tiedostoa...' : 'Valitse kalenteri (.ics)'}
                        </Button>
                    </div>
                    
                    <div className="text-xs text-slate-500 font-italic lh-tight" style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '8px' }}>
                        Älykäs esikatselu näyttää kaikki työtehtävät ennen tallennusta. Lounaat, tyhjät varauskuoret ja opetetut roskat ohitetaan automaattisesti taustalla.
                    </div>

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
            ) : (
                <StagingArea 
                    stagingStats={stagingStats}
                    autoQueue={autoQueue}
                    teachQueue={teachQueue}
                    manualQueue={manualQueue}
                    initialAutoSkips={initialAutoSkips}
                    onCancel={() => setIsStaging(false)}
                    onCommit={handleCommit}
                    isCommitting={isCommitting}
                />
            )}
        </Card>
    );
};

export default ExpertImport;