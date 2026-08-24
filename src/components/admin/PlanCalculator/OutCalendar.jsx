// --- src/components/admin/PlanCalculator/OutCalendar.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Card from '../../common/Card';
import MetricBox from '../../common/MetricBox';
import Badge from '../../common/Badge';
import Button from '../../common/Button';
import { Map, MapPin, Home, Phone, Users, XCircle, Activity, CalendarDays } from 'lucide-react';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const OutCalendar = ({ asiantuntijaId }) => {
    const getMonthButtons = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const monthsFi = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä', 'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu'];
        
        const buttons = [{ id: 'full_year', label: 'Koko vuosi' }];
        for (let i = 0; i <= currentMonth; i++) {
            buttons.push({ id: `month_${i}`, label: monthsFi[i] });
        }
        return buttons;
    };

    const timeframes = getMonthButtons();
    const currentMonthId = `month_${new Date().getMonth()}`;
    const [timeframe, setTimeframe] = useState(currentMonthId); 
    
    // YTD-datan muisti
    const [ytdEvents, setYtdEvents] = useState([]);
    const [ytdLocations, setYtdLocations] = useState([]);
    const [ytdHolidays, setYtdHolidays] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState(null);
    const [ytdMetrics, setYtdMetrics] = useState(null);

    const getDateRange = (frameId) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        let start, end;

        if (frameId === 'full_year') {
            start = new Date(currentYear, 0, 1);
            end = now; 
        } else if (frameId.startsWith('month_')) {
            const m = parseInt(frameId.split('_')[1], 10);
            start = new Date(currentYear, m, 1);
            if (m === now.getMonth()) {
                end = now;
            } else {
                end = new Date(currentYear, m + 1, 0, 23, 59, 59);
            }
        }
        return { start: start.toISOString(), end: end.toISOString() };
    };

    // 1. Haetaan YTD (Koko vuoden data) KERRAN
    useEffect(() => {
        if (!asiantuntijaId) return;

        const fetchYtdData = async () => {
            setLoading(true);
            const ytdRange = getDateRange('full_year');
            const startDay = ytdRange.start.split('T')[0];
            const endDay = ytdRange.end.split('T')[0];
            
            // Haetaan joustavasti asiantuntijalta + varalta legacyllä
            const queryIds = [asiantuntijaId, LEGACY_ID];

            try {
                const [eventsRes, locRes, holRes] = await Promise.all([
                    supabase.schema('espan').from('ics_events').select('*')
                        .in('expert_id', queryIds)
                        .gte('start_time', ytdRange.start)
                        .lte('start_time', ytdRange.end),
                    supabase.schema('espan').from('expert_daily_locations').select('*')
                        .in('expert_id', queryIds)
                        .gte('date', startDay)
                        .lte('date', endDay),
                    supabase.schema('espan').from('national_holidays_cache').select('date')
                        .gte('date', startDay)
                        .lte('date', endDay)
                ]);

                if (eventsRes.error) throw eventsRes.error;
                
                setYtdEvents(eventsRes.data || []);
                setYtdLocations(locRes.data || []);
                setYtdHolidays(holRes.data || []);
            } catch (err) {
                console.error('Virhe historiatietojen haussa:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchYtdData();
    }, [asiantuntijaId]);

    // 2. Apufunktio: Laskee tehokkuuden, keskiarvot, lokaatiot ja poissaolot
    const calculateMetrics = (evts, locs, holsList, startDateIso, endDateIso) => {
        let res = { 
            remoteDays: 0, 
            officeDays: 0, 
            absentDays: 0, // Täysi poissaolo (loma, este)
            nonCustomerDays: 0, // Tuuraus tai sisätyöt (Vähennetään kokouska:sta)
            totalMeetings: 0, 
            meetings: { lasna: 0, soitto: 0, kylma: 0, peruttu: 0 }
        };
        const holidaySet = new Set(holsList.map(h => h.date));
        const hasLocationsDb = locs.length > 0;

        // Tapahtumien läpikäynti
        evts.forEach(e => {
            // Sijaintien varalaskenta, jos DB on tyhjä
            if (e.event_category === 'sijainti' || e.event_category === 'poissaolo') {
                if (hasLocationsDb) return; 
                
                if (e.is_all_day) {
                    const s = new Date(e.start_time);
                    const endObj = new Date(e.end_time);
                    
                    for (let d = new Date(s); d < endObj; d.setUTCDate(d.getUTCDate() + 1)) {
                        const dayOfWeek = d.getUTCDay();
                        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
                        
                        const dStr = d.toISOString().split('T')[0];
                        if (holidaySet.has(dStr)) continue;

                        const locName = (e.location_name || '').toLowerCase();
                        if (e.event_category === 'poissaolo' || locName.includes('este') || locName.includes('loma')) {
                            res.absentDays++;
                        } else {
                            if (locName.includes('ei asiakas') || locName.includes('tuuraus') || locName.includes('sisätyö')) {
                                res.nonCustomerDays++;
                            }
                            if (locName.includes('etä') || locName.includes('eta')) {
                                res.remoteDays++;
                            } else {
                                res.officeDays++;
                            }
                        }
                    }
                } else {
                    const dStr = e.start_time.split('T')[0];
                    const dObj = new Date(e.start_time);
                    
                    if (dObj.getUTCDay() !== 0 && dObj.getUTCDay() !== 6 && !holidaySet.has(dStr)) {
                        const locName = (e.location_name || '').toLowerCase();
                        if (e.event_category === 'poissaolo' || locName.includes('este') || locName.includes('loma')) {
                            res.absentDays++;
                        } else {
                            if (locName.includes('ei asiakas') || locName.includes('tuuraus') || locName.includes('sisätyö')) {
                                res.nonCustomerDays++;
                            }
                            if (locName.includes('etä') || locName.includes('eta')) {
                                res.remoteDays++;
                            } else {
                                res.officeDays++;
                            }
                        }
                    }
                }
            } 
            else if (e.event_category === 'tapaaminen') {
                res.totalMeetings++;
                if (e.contact_method === 'lasna') res.meetings.lasna++;
                if (e.contact_method === 'soitto') res.meetings.soitto++;
            } else if (e.event_category === 'kylmasoitto') {
                res.meetings.kylma++;
            } else if (e.event_category === 'peruttu') {
                res.meetings.peruttu++;
            }
        });

        // 3. Lokaatiot DB:stä (Prioriteetti 1)
        if (hasLocationsDb) {
            locs.forEach(loc => {
                const dateObj = new Date(loc.date + 'T12:00:00Z'); 
                const dayOfWeek = dateObj.getUTCDay();
                
                if (dayOfWeek === 0 || dayOfWeek === 6 || holidaySet.has(loc.date)) return;

                const lType = loc.location_type || '';
                const lName = (loc.location_name || '').toLowerCase();
                
                // Loma ja este -> Puhdas poissaolo
                if (lType === 'loma' || lName.includes('este') || lName.includes('loma')) {
                    res.absentDays++;
                } else {
                    // Tunnistetaan työasiat, joissa EI KUITENKAAN ole asiantuntijakohtaamisia
                    if (lType.includes('sisatyot') || lName.includes('ei asiakas') || lName.includes('tuuraus')) {
                        res.nonCustomerDays++;
                    }
                    
                    // Sijaintikirjanpito
                    if (lType.includes('eta') || lName.includes('etä')) {
                        res.remoteDays++;
                    } else {
                        res.officeDays++;
                    }
                }
            });
        }

        // PUHDAS KALENTERIMATEMATIIKKA (Työpäivien määrän generointi)
        let workdays = 0;
        const s = new Date(startDateIso);
        const eObj = new Date(endDateIso);
        s.setHours(0,0,0,0);
        eObj.setHours(23,59,59,999);

        for (let d = new Date(s); d <= eObj; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (holidaySet.has(dStr)) continue;
            
            workdays++;
        }

        // Tehokkuus = Peruspäivät miinus Loma miinus Ei-asiakastyöpäivät
        const activeDays = Math.max(0, workdays - res.absentDays - res.nonCustomerDays);
        const activeWeeks = activeDays / 5;
        const weeklyAvg = activeWeeks > 0 ? (res.totalMeetings / activeWeeks).toFixed(1) : '0.0';

        return { ...res, workdays, activeDays, activeWeeks, weeklyAvg };
    };

    // Filtteröinti kun valintaa vaihdetaan
    useEffect(() => {
        if (ytdEvents.length === 0 && !loading && !ytdMetrics) return;

        const ytdRange = getDateRange('full_year');
        if (!ytdMetrics) {
            setYtdMetrics(calculateMetrics(ytdEvents, ytdLocations, ytdHolidays, ytdRange.start, ytdRange.end));
        }

        const tfRange = getDateRange(timeframe);
        const tfStartDay = tfRange.start.split('T')[0];
        const tfEndDay = tfRange.end.split('T')[0];

        const filteredEvents = ytdEvents.filter(e => e.start_time >= tfRange.start && e.start_time <= tfRange.end);
        const filteredLocs = ytdLocations.filter(loc => loc.date >= tfStartDay && loc.date <= tfEndDay);

        const currentM = calculateMetrics(filteredEvents, filteredLocs, ytdHolidays, tfRange.start, tfRange.end);
        setSelectedMetrics(currentM);

    }, [timeframe, ytdEvents, ytdLocations, ytdHolidays]);


    if (!selectedMetrics) return null;

    const totalLocationDays = selectedMetrics.remoteDays + selectedMetrics.officeDays;
    const remotePercent = totalLocationDays > 0 ? Math.round((selectedMetrics.remoteDays / totalLocationDays) * 100) : 0;
    const officePercent = totalLocationDays > 0 ? Math.round((selectedMetrics.officeDays / totalLocationDays) * 100) : 0;
    
    const cancelRate = (selectedMetrics.totalMeetings + selectedMetrics.meetings.peruttu) > 0 
        ? Math.round((selectedMetrics.meetings.peruttu / (selectedMetrics.totalMeetings + selectedMetrics.meetings.peruttu)) * 100) 
        : 0;

    const hasAnyAbsence = selectedMetrics.absentDays > 0 || selectedMetrics.nonCustomerDays > 0;

    return (
        <Card title="Toteutunut asiantuntijatyö (Kalenterianalytiikka)" icon={CalendarDays} variant="default">
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {timeframes.map(tf => (
                    <Button 
                        key={tf.id} 
                        variant={timeframe === tf.id ? 'primary' : 'secondary'} 
                        onClick={() => setTimeframe(tf.id)}
                    >
                        {tf.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-slate-500 py-4">Ladataan vuosidataa...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    
                    {/* 1. TYÖSKENTELYPAIKAT */}
                    <MetricBox title="Työskentely-ympäristö" icon={Map} variant="default">
                        {totalLocationDays > 0 ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="fw-bold text-primary">
                                            <MapPin size={16} /> Toimisto: {officePercent}%
                                        </div>
                                        <div className="text-xs text-slate-500">{selectedMetrics.officeDays} päivää</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="fw-bold text-slate-700">
                                            <Home size={16} /> Etä: {remotePercent}%
                                        </div>
                                        <div className="text-xs text-slate-500">{selectedMetrics.remoteDays} päivää</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                                    <div style={{ width: `${officePercent}%`, backgroundColor: '#3b82f6' }}></div>
                                    <div style={{ width: `${remotePercent}%`, backgroundColor: '#94a3b8' }}></div>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-slate-500 mt-2">Ei työpäivämerkintöjä tälle jaksolle.</div>
                        )}
                        
                        {hasAnyAbsence && (
                            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                <Badge variant="warning">
                                    Huomio: Keskiarvosta poistettu 
                                    {selectedMetrics.absentDays > 0 ? ` ${selectedMetrics.absentDays} pv lomaa/estettä` : ''}
                                    {(selectedMetrics.absentDays > 0 && selectedMetrics.nonCustomerDays > 0) ? ' ja ' : ''}
                                    {selectedMetrics.nonCustomerDays > 0 ? ` ${selectedMetrics.nonCustomerDays} pv sisätyötä/tuurausta` : ''}.
                                </Badge>
                            </div>
                        )}
                    </MetricBox>

                    {/* 2. KOHTAAMISET, LAATU & KESKIARVOT */}
                    <MetricBox title="Kohtaamiset & Tahti" icon={Users} variant="default">
                        <div className="text-2xl fw-bold mb-2">
                            {selectedMetrics.totalMeetings} <span className="text-sm text-slate-500 fw-normal">toteutunutta asiakastapaamista</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                    <span className="fw-bold text-slate-700" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12}/> Läsnätapaamiset</span>
                                    <span className="text-slate-600 font-mono">{selectedMetrics.meetings.lasna} kpl</span>
                                </div>
                                <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                    <div style={{ width: `${selectedMetrics.totalMeetings > 0 ? (selectedMetrics.meetings.lasna / selectedMetrics.totalMeetings)*100 : 0}%`, backgroundColor: '#10b981', height: '100%', borderRadius: '4px' }} />
                                </div>
                            </div>
                            
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                    <span className="fw-bold text-slate-700" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12}/> Puhelu/Etä</span>
                                    <span className="text-slate-600 font-mono">{selectedMetrics.meetings.soitto} kpl</span>
                                </div>
                                <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                    <div style={{ width: `${selectedMetrics.totalMeetings > 0 ? (selectedMetrics.meetings.soitto / selectedMetrics.totalMeetings)*100 : 0}%`, backgroundColor: '#f59e0b', height: '100%', borderRadius: '4px' }} />
                                </div>
                            </div>
                        </div>

                        {/* VIIKKO KOHTAISET KESKIARVOT */}
                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <div title={`Laskettu aktiivisista työpäivistä: ${selectedMetrics.activeDays} pv (${selectedMetrics.workdays} peruspv - ${selectedMetrics.absentDays} lomaa - ${selectedMetrics.nonCustomerDays} tuurausta/sisätyötä)`}>
                                <div className="text-xs text-slate-500">Jakson tehokkuus</div>
                                <div className="text-base fw-bold text-primary font-mono">{selectedMetrics.weeklyAvg} <span className="text-sm fw-normal">tapaamista / vk</span></div>
                            </div>
                            <div style={{ textAlign: 'right' }} title={`Koko vuoden YTD tehokkuus (aktiiviset päivät: ${ytdMetrics?.activeDays} pv)`}>
                                <div className="text-xs text-slate-500">Koko vuosi (YTD)</div>
                                <div className="text-base fw-bold text-slate-700 font-mono">{ytdMetrics?.weeklyAvg} <span className="text-sm fw-normal">tapaamista / vk</span></div>
                            </div>
                        </div>
                    </MetricBox>

                    {/* 3. PROSPEKTOINTI JA HÄVIKKI */}
                    <MetricBox title="Aktiviteetti & Hävikki" icon={Activity} variant="default">
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <div className="text-sm fw-bold text-slate-700" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <XCircle size={16} className="text-danger" /> Peruuntumisaste
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{selectedMetrics.meetings.peruttu} peruttua tapahtumaa</div>
                            </div>
                            <div className={`text-xl fw-bold ${cancelRate > 20 ? 'text-danger' : 'text-slate-700'}`}>
                                {cancelRate} %
                            </div>
                        </div>
                        
                        <div style={{ borderTop: '1px solid #e2e8f0', margin: '12px 0' }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div className="text-sm fw-bold text-slate-700" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Phone size={16} className="text-primary" /> Kylmäsoitot
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Prospektointiyritykset</div>
                            </div>
                            <div className="text-xl fw-bold text-primary font-mono">
                                {selectedMetrics.meetings.kylma}
                            </div>
                        </div>

                    </MetricBox>
                </div>
            )}
        </Card>
    );
};

export default OutCalendar;