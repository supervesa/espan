// --- src/components/admin/LocationPlanner.jsx ---
import React, { useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { Info, Sliders, CalendarCheck, RotateCcw, Landmark, Printer, Flag, Lightbulb, Zap } from 'lucide-react';
import ReportModal from './ReportModal'; 
import LocalTransportPanel from './LocalTransportPanel';

const LocationPlanner = ({ 
    currentWeekStart, 
    dailyLocations, 
    exceptions,
    nationalHolidays = [], 
    ledgerBalance = 0,     
    settings, 
    onSettingsChange, 
    onOptimize, 
    onLockWeek, 
    onResetSuggestions 
}) => {

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const formatDateStr = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    const formatRangeText = (start, dayOffsetStart, dayOffsetEnd) => {
        const s = new Date(start);
        s.setDate(s.getDate() + dayOffsetStart);
        const e = new Date(start);
        e.setDate(e.getDate() + dayOffsetEnd);
        return `${s.getDate()}.${s.getMonth() + 1}. – ${e.getDate()}.${e.getMonth() + 1}.`;
    };

    // UUSI FUNKTIO: Pyhäpäivien synkronointi (Taustapalvelu)
    const handleSyncHolidays = async () => {
        try {
            alert('Synkronoidaan Suomen pyhäpäiviä tietokantaan. Odota hetki...');
            const response = await fetch('/.netlify/functions/sync-holidays', {
                method: 'POST'
            });
            
            const result = await response.json();
            if (response.ok) {
                alert(`Onnistui! ${result.message}\nVoit joutua päivittämään sivun nähdäksesi uudet pyhät kalenterissa.`);
            } else {
                throw new Error(result.error || 'Synkronointi epäonnistui.');
            }
        } catch (error) {
            console.error(error);
            alert('Virhe pyhäpäivien päivityksessä. Tarkista konsoli.');
        }
    };

    const stats = React.useMemo(() => {
        const data = {
            total: { label: '4 viikon kokonaissaldo', office: 0, remote: 0, totalWorkingDays: 0, percent: 0, targetDays: 0 },
            cycle1: { label: `Meneillään oleva jakso (${formatRangeText(currentWeekStart, 0, 11)})`, office: 0, remote: 0, totalWorkingDays: 0, percent: 0, targetDays: 0 },
            cycle2: { label: `Seuraava seurantajakso (${formatRangeText(currentWeekStart, 14, 25)})`, office: 0, remote: 0, totalWorkingDays: 0, percent: 0, targetDays: 0 }
        };

        for (let w = 0; w < 4; w++) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(weekStart.getDate() + (w * 7));
            const targetCycle = w < 2 ? 'cycle1' : 'cycle2';

            for (let d = 0; d < 5; d++) {
                const currentDay = new Date(weekStart);
                currentDay.setDate(weekStart.getDate() + d);
                const dStr = formatDateStr(currentDay);

                const isBlockedDay = exceptions.some(e => 
                    e.is_blocked && e.meeting_type === 'estetty' && e.start_time.substring(0, 10) === dStr
                );
                
                const isHolidayDay = nationalHolidays.some(h => h.date === dStr);

                if (!isBlockedDay && !isHolidayDay) {
                    data[targetCycle].totalWorkingDays += 1;
                    data.total.totalWorkingDays += 1;

                    const loc = dailyLocations.find(l => l.date === dStr);
                    if (loc?.location_type === 'lahityo') {
                        data[targetCycle].office += 1;
                        data.total.office += 1;
                    } else if (loc?.location_type === 'eta' || loc?.location_type === 'eta_pankki') {
                        data[targetCycle].remote += 1;
                        data.total.remote += 1;
                    }
                }
            }
        }

        ['total', 'cycle1', 'cycle2'].forEach(key => {
            if (data[key].totalWorkingDays > 0) {
                data[key].percent = Math.round((data[key].office / data[key].totalWorkingDays) * 100);
                data[key].targetDays = Math.ceil(data[key].totalWorkingDays * (settings.target_office_percent / 100));
            }
        });

        return data;
    }, [currentWeekStart, dailyLocations, exceptions, nationalHolidays, settings.target_office_percent]);

    // UUSI TUTKA: Älykäs Siltapäivä- ja Putkikatkaisija -algoritmi
    const smartTips = React.useMemo(() => {
        if (ledgerBalance <= 0) return [];
        const tips = [];
        
        // Rakennetaan nopea välimuisti tulevan 4 viikon päivistä
        const daysMap = {};
        for (let i = 0; i < 28; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            const dStr = formatDateStr(d);
            const isHol = nationalHolidays.some(h => h.date === dStr);
            const isBlock = exceptions.some(e => e.is_blocked && e.meeting_type === 'estetty' && e.start_time.startsWith(dStr));
            const loc = dailyLocations.find(l => l.date === dStr);
            daysMap[dStr] = { date: d, dStr, isHol, isBlock, loc, dayOfWeek: d.getDay() };
        }

        const dateKeys = Object.keys(daysMap);
        
        // 1. SILTAPÄIVÄTUTKA
        for (let i = 0; i < dateKeys.length; i++) {
            const dayData = daysMap[dateKeys[i]];
            if (dayData.isHol) {
                // Tiistai-pyhä -> Ehdotetaan Maanantaita
                if (dayData.dayOfWeek === 2 && i > 0) {
                    const prevDay = daysMap[dateKeys[i-1]];
                    if (!prevDay.isHol && !prevDay.isBlock && prevDay.loc?.location_type !== 'eta' && prevDay.loc?.location_type !== 'eta_pankki') {
                        tips.push({
                            dateStr: prevDay.dStr,
                            type: 'bridge',
                            text: `Vinkki: ${dayData.date.getDate()}.${dayData.date.getMonth()+1}. on pyhä (tiistai). Ottamalla maanantain ${prevDay.date.getDate()}.${prevDay.date.getMonth()+1}. pankki-etäpäiväksi saat pitkän vapaan viikonlopun!`
                        });
                    }
                }
                // Torstai-pyhä -> Ehdotetaan Perjantaita
                if (dayData.dayOfWeek === 4 && i < dateKeys.length - 1) {
                    const nextDay = daysMap[dateKeys[i+1]];
                    if (!nextDay.isHol && !nextDay.isBlock && nextDay.loc?.location_type !== 'eta' && nextDay.loc?.location_type !== 'eta_pankki') {
                        tips.push({
                            dateStr: nextDay.dStr,
                            type: 'bridge',
                            text: `Vinkki: ${dayData.date.getDate()}.${dayData.date.getMonth()+1}. on pyhä (torstai). Ottamalla perjantain ${nextDay.date.getDate()}.${nextDay.date.getMonth()+1}. pankki-etäpäiväksi saat pitkän vapaan viikonlopun!`
                        });
                    }
                }
            }
        }

        // 2. PUTKIKATKAISIJA (Vain jos siltapäiviä ei löytynyt)
        if (tips.length === 0) {
            for (let w = 0; w < 4; w++) {
                const weekDays = [];
                for (let d = 0; d < 5; d++) {
                    const date = new Date(currentWeekStart);
                    date.setDate(date.getDate() + (w * 7) + d);
                    weekDays.push(daysMap[formatDateStr(date)]);
                }
                
                const officeDays = weekDays.filter(day => day && !day.isHol && !day.isBlock && day.loc?.location_type === 'lahityo');
                
                if (officeDays.length >= 4) {
                    // Yritetään keventää keskiviikkoa tai perjantaita (Torstai suojattu ankkurina)
                    const candidate = officeDays.find(d => d.dayOfWeek === 3) || officeDays.find(d => d.dayOfWeek === 5);
                    if (candidate) {
                        tips.push({
                            dateStr: candidate.dStr,
                            type: 'streak',
                            text: `Vinkki: Viikolla on raskas ${officeDays.length} päivän lähityöputki. Haluatko käyttää pankkipäivän ${['','Maanantaina','Tiistaina','Keskiviikkona','Torstaina','Perjantaina'][candidate.dayOfWeek]} ${candidate.date.getDate()}.${candidate.date.getMonth()+1}. putken katkaisemiseksi?`
                        });
                        break; 
                    }
                }
            }
        }

        return tips.slice(0, 2); 
    }, [currentWeekStart, nationalHolidays, exceptions, dailyLocations, ledgerBalance]);

    const renderActionGuidance = (item) => {
        const diff = item.office - item.targetDays;
        
        if (diff < 0) {
            return {
                text: `Vaatii vielä ${Math.abs(diff)} lähityöpäivää saavuttaakseen 50% minimitason.`,
                isShort: true,
                color: 'var(--color-primary)'
            };
        } else if (diff === 0) {
            return {
                text: 'Minimitavoite saavutettu. Kalenteri on täydellisessä tasapainossa.',
                isShort: false,
                color: 'var(--color-success)'
            };
        } else {
            return {
                text: `Minimitavoite saavutettu (+${diff} päivää joustovaraa etätyöhön).`,
                isShort: false,
                color: 'var(--color-success)'
            };
        }
    };

    const totalGuidance = renderActionGuidance(stats.total);
    const isOverallDeficit = stats.total.percent < 50;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* ================= PANKKIPANEELI & ÄLYKKÄÄT VINKIT ================= */}
            <div style={{ backgroundColor: ledgerBalance > 0 ? 'rgba(30,154,90,0.05)' : 'var(--color-surface)', padding: '1.2rem', borderRadius: '8px', border: ledgerBalance > 0 ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Landmark size={28} style={{ color: ledgerBalance > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }} />
                        <div>
                            <h4 style={{ margin: 0, color: ledgerBalance > 0 ? 'var(--color-success)' : 'var(--color-text)', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                Etäpäiväpankki (Ledger)
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                {ledgerBalance > 0 
                                    ? `Sinulla on ${ledgerBalance} ansaittua etäpäivää käytettävissä. Voit ylittää viikon etäpäiväsäännöt sijoittamalla saldon mihin tahansa kalenteripäivään.` 
                                    : 'Ei kertyneitä saldoja. Voit ansaita ylimääräisiä etäpäiviä tekemällä lähityötä silloin kun automaatti ehdottaa etätyötä.'}
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: ledgerBalance > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                            {ledgerBalance}
                        </span>
                        <span className="text-secondary fw-semibold text-sm" style={{ marginLeft: '4px' }}>pv</span>
                    </div>
                </div>

                {/* VINKKILUETTELO */}
                {smartTips.length > 0 && (
                    <div style={{ marginTop: '1.2rem', borderTop: '1px dashed var(--color-success)', paddingTop: '1rem' }}>
                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lightbulb size={16} /> Älykkäät ehdotukset
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {smartTips.map((tip, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#166534', flex: 1, lineHeight: 1.4 }}>
                                        {tip.text}
                                    </div>
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        icon={Zap} 
                                        style={{ marginLeft: '1rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }} 
                                        onClick={() => alert(`Siirry kalenteriruudukkoon päivän ${tip.dateStr} kohdalle, klikkaa sijaintia ja valitse listasta 'Käytä pankkipäivä'.`)}
                                    >
                                        Miten toimin?
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ================= LIPPULASKURI (ERIYTETTY KOMPONENTTI) ================= */}
            <LocalTransportPanel 
                currentWeekStart={currentWeekStart}
                dailyLocations={dailyLocations}
                exceptions={exceptions}
                nationalHolidays={nationalHolidays}
                settings={settings}
            />

            {/* ================= 1. 4 VIIKON KOKONAISSALDO (MASTER PANEL) ================= */}
            <Card title="Yhteenveto: 4 viikon kokonaistilanne" icon={Info} variant={isOverallDeficit ? 'warning' : 'default'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)' }}>
                                {stats.total.label}
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: totalGuidance.color, fontWeight: '600' }}>
                                {totalGuidance.text}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: totalGuidance.color }}>
                                {stats.total.percent}%
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                                lähityöaste
                            </span>
                        </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%', height: '16px', backgroundColor: 'var(--color-border)', borderRadius: '8px', overflow: 'visible', marginTop: '4px' }}>
                        <div style={{ position: 'absolute', left: '50%', top: '-4px', bottom: '-4px', width: '2px', backgroundColor: 'var(--color-text)', zIndex: 10 }} />
                        <div style={{ position: 'absolute', left: '50%', top: '-20px', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-secondary)' }}>
                            TAVOITE 50%
                        </div>
                        <div style={{ 
                            width: `${Math.min(100, stats.total.percent)}%`, 
                            height: '100%', 
                            backgroundColor: stats.total.percent >= 50 ? 'var(--color-success)' : 'var(--color-primary)',
                            borderRadius: '8px',
                            transition: 'width 0.4s ease'
                        }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)', backgroundColor: 'rgba(0,0,0,0.01)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                        <div>Toteuma: <strong>{stats.total.office} pv</strong> lähityötä / <strong>{stats.total.remote} pv</strong> etätyötä</div>
                        <div>Aktiiviset työpäivät (lomat/pyhät poistettu): <strong>{stats.total.totalWorkingDays} pv</strong></div>
                        <div>Vaatimus: <strong>{stats.total.targetDays} pv</strong> toimistolla</div>
                    </div>
                </div>
            </Card>

            {/* ================= 2. KAKSIALUEISET ALASYKLIT (GRID) ================= */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {['cycle1', 'cycle2'].map((key) => {
                    const item = stats[key];
                    const guidance = renderActionGuidance(item);
                    
                    return (
                        <div key={key} style={{ backgroundColor: 'var(--color-surface)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="fw-bold text-sm text-primary" style={{ maxWidth: '75%' }}>{item.label}</span>
                                <span className="font-mono text-xs fw-bold" style={{ 
                                    color: item.percent >= 50 ? 'var(--color-success)' : 'var(--color-primary)',
                                    backgroundColor: item.percent >= 50 ? 'rgba(30,154,90,0.1)' : 'rgba(255,107,0,0.1)',
                                    padding: '3px 8px', borderRadius: '4px'
                                }}>
                                    {item.percent}% Lähityö
                                </span>
                            </div>
                            
                            <div style={{ position: 'relative', width: '100%', height: '10px', backgroundColor: 'var(--color-border)', borderRadius: '5px', overflow: 'visible', marginTop: '12px', marginBottom: '4px' }}>
                                <div style={{ position: 'absolute', left: '50%', top: '-3px', bottom: '-3px', width: '2px', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 10 }} />
                                <div style={{ 
                                    width: `${Math.min(100, item.percent)}%`, 
                                    height: '100%', 
                                    backgroundColor: item.percent >= 50 ? 'var(--color-success)' : 'var(--color-primary)',
                                    borderRadius: '5px',
                                    transition: 'width 0.4s ease'
                                }} />
                            </div>

                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                {guidance.text}
                            </p>

                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem', marginTop: 'auto' }}>
                                <span>Lähityö: <strong>{item.office} / {item.totalWorkingDays} pv</strong></span>
                                <span style={{ marginLeft: 'auto' }}>Minimitavoite: <strong>{item.targetDays} pv</strong></span>
                            </div>

                            {/* UUSI: ENNUSTE-VAROITUS SEURAAVALLE JAKSOLLE */}
                            {key === 'cycle2' && (
                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                    <Info size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                                    Huom: Tämä on vasta ennuste. Luvut elävät reaaliajassa tekemiesi kalenterimuutosten myötä.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ================= 3. AUTOMAATION SÄÄNNÖT JA LIUKURIT ================= */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
                <Card title="Automaation runkosäännöt ja oletukset (Default)" icon={Sliders} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                <label className="text-sm fw-semibold text-primary">Torstain kokouspäivän läsnäoloaste (Kuukausitaso)</label>
                                <span className="text-sm fw-bold font-mono text-primary">{settings.thursday_office_rate}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="25"
                                value={settings.thursday_office_rate} 
                                onChange={(e) => onSettingsChange('thursday_office_rate', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                <span>0% (Aina etänä)</span>
                                <span>50% (Joka toinen to)</span>
                                <span>100% (Aina Viipurinkatu)</span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px dashed var(--color-border)', paddingTop: '1rem' }}>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Perjantain maksimilähityö</label>
                                <select 
                                    className="modern-select mt-1" 
                                    value={settings.friday_max_presence_per_month}
                                    onChange={(e) => onSettingsChange('friday_max_presence_per_month', parseInt(e.target.value))}
                                >
                                    <option value={0}>0 krt / kuukausi (Aina etä)</option>
                                    <option value={1}>1 krt / kuukausi (Joustovara)</option>
                                    <option value={2}>2 krt / kuukausi</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Viikon 1. läsnäolotoimipiste</label>
                                <select 
                                    className="modern-select mt-1" 
                                    value={settings.primary_office_name}
                                    onChange={(e) => onSettingsChange('primary_office_name', e.target.value)}
                                >
                                    <option value="Malminkatu">Malminkatu (Oletus matkapäivälle)</option>
                                    <option value="Viipurinkatu">Viipurinkatu</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.6rem', borderRadius: '4px' }}>
                            <strong>Nollavelka-automatiikka aktiivinen:</strong> Maanantait ovat aina lukittuja etäpäiviksi. Läsnäolopäivät ryhmitellään peräkkäisiksi blokeiksi, ja lomat sekä pyhät vähentävät jakson kokonaistavoitetta luomatta kurontavelkaa tuleville viikoille.
                        </div>
                    </div>
                </Card>

                {/* ================= 4. MANUAALISET PAINIKKEET ================= */}
                <Card title="Manuaaliset ohitukset" icon={CalendarCheck} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', justifyContent: 'center' }}>
                        
                        <Button variant="secondary" icon={Printer} onClick={() => setIsReportModalOpen(true)} fullWidth>
                            Lataa seurantaraportti
                        </Button>
                        <hr style={{ border: 'none', borderTop: '1px dashed var(--color-border)', margin: '0.5rem 0' }} />
                        
                        {/* UUSI PYHÄ-NAPPI */}
                        <Button variant="secondary" icon={Flag} onClick={handleSyncHolidays} fullWidth>
                            Hae & Päivitä Suomen pyhäpäivät
                        </Button>

                        <Button variant="primary" icon={Sliders} onClick={onOptimize} fullWidth>
                            Optimoi kalenteri (Aja CRON nyt)
                        </Button>
                        <Button variant="secondary" icon={CalendarCheck} onClick={onLockWeek} fullWidth>
                            Lukitse tämän viikon valinnat
                        </Button>
                        <Button variant="danger" icon={RotateCcw} onClick={onResetSuggestions} fullWidth>
                            Nollaa automaattiset ehdotukset
                        </Button>
                        <p className="text-center text-secondary m-0" style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                            * Päivät, joilla on jo kasvokkaisia asiakasvarauksia tai jotka asiantuntija on itse käsin lukinnut, suojataan ylikirjoitukselta.
                        </p>
                    </div>
                </Card>
            </div>
            
            <ReportModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                expertId="00000000-0000-0000-0000-000000000000"
            />
        </div>
    );
};

export default LocationPlanner;