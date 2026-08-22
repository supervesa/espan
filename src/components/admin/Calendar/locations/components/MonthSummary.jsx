import React, { useMemo } from 'react';
import MetricBox from '../../../../common/MetricBox';
import ProgressBar from '../../../../common/ProgressBar';
import Button from '../../../../common/Button';
import { formatDateLocal } from '../utils/monthUtils';
import { Landmark, Lightbulb, Zap } from 'lucide-react';

const MonthSummary = ({ currentMonthStart, calendarDays, data, actions }) => {
    
    // 1. Tavoitelaskuri ja Pyhien poisto
    const stats = useMemo(() => {
        let totalWorking = 0;
        let office = 0;
        let remote = 0;

        calendarDays.forEach(date => {
            if (date.getMonth() !== currentMonthStart.getMonth()) return;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            if (isWeekend) return;

            const dStr = formatDateLocal(date);
            const isHol = data.holidayStrs.includes(dStr);
            const isBlocked = data.blockedDaysStrs.includes(dStr);
            
            if (!isBlocked && !isHol) {
                totalWorking++;
                const loc = data.dailyLocations.find(l => l.date === dStr);
                if (loc?.location_type === 'lahityo' || loc?.location_type?.startsWith('sisatyot_lahityo')) {
                    office++;
                } else if (loc?.location_type === 'eta' || loc?.location_type === 'eta_pankki' || loc?.location_type?.startsWith('sisatyot_eta')) {
                    remote++;
                }
            }
        });

        const target = Math.ceil(totalWorking * ((data.settings?.target_office_percent || 50) / 100));
        const percent = totalWorking > 0 ? Math.round((office / totalWorking) * 100) : 0;
        const diff = office - target;

        return { totalWorking, office, remote, target, percent, diff };
    }, [calendarDays, currentMonthStart, data]);

    // 2. Älykäs tutka (Siltapäivät ja Putkenkatkaisijat)
    const smartTips = useMemo(() => {
        if (data.ledgerBalance <= 0) return [];
        const tips = [];
        const daysMap = {};

        calendarDays.forEach((d, i) => {
            const dStr = formatDateLocal(d);
            const isHol = data.holidayStrs.includes(dStr);
            const isBlock = data.blockedDaysStrs.includes(dStr);
            const loc = data.dailyLocations.find(l => l.date === dStr);
            daysMap[i] = { date: d, dStr, isHol, isBlock, loc, dayOfWeek: d.getDay() };
        });

        for (let i = 0; i < calendarDays.length; i++) {
            const dayData = daysMap[i];
            if (!dayData || dayData.date.getMonth() !== currentMonthStart.getMonth()) continue; 

            if (dayData.isHol) {
                if (dayData.dayOfWeek === 2 && i > 0) { 
                    const prevDay = daysMap[i-1];
                    if (!prevDay.isHol && !prevDay.isBlock && prevDay.loc?.location_type !== 'eta' && prevDay.loc?.location_type !== 'eta_pankki') {
                        tips.push({ dateStr: prevDay.dStr, text: `Vinkki: ${dayData.date.getDate()}.${dayData.date.getMonth()+1}. on pyhä (tiistai). Ottamalla maanantain ${prevDay.date.getDate()}.${prevDay.date.getMonth()+1}. pankki-etäpäiväksi saat pitkän vapaan viikonlopun!` });
                    }
                }
                if (dayData.dayOfWeek === 4 && i < calendarDays.length - 1) { 
                    const nextDay = daysMap[i+1];
                    if (!nextDay.isHol && !nextDay.isBlock && nextDay.loc?.location_type !== 'eta' && nextDay.loc?.location_type !== 'eta_pankki') {
                        tips.push({ dateStr: nextDay.dStr, text: `Vinkki: ${dayData.date.getDate()}.${dayData.date.getMonth()+1}. on pyhä (torstai). Ottamalla perjantain ${nextDay.date.getDate()}.${nextDay.date.getMonth()+1}. pankki-etäpäiväksi saat pitkän vapaan viikonlopun!` });
                    }
                }
            }
        }
        return tips.slice(0, 2);
    }, [calendarDays, currentMonthStart, data]);

    // 3. Pankkipäivien voimassaolon tarkistus
    const validBankDaysThisMonth = useMemo(() => {
        if (!data.availableBankDays) return 0;
        
        // Määritellään katsottavan kuukauden alku ja loppu
        const monthStart = currentMonthStart;
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

        // Kuinka monta saatavilla olevista pankkipäivistä on VOIMASSA tämän kuun aikana?
        // Päivä on voimassa, jos se on ansaittu ennen kuukauden loppua JA se vanhenee aikaisintaan kuukauden alussa.
        return data.availableBankDays.filter(day => {
            const earned = new Date(day.earned_date || day.created_at);
            const expires = new Date(day.expiration_date || '2099-12-31');
            return earned <= monthEnd && expires >= monthStart;
        }).length;
    }, [data.availableBankDays, currentMonthStart]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* ETÄPÄIVÄPANKKI JA VINKIT */}
            <div style={{ backgroundColor: validBankDaysThisMonth > 0 ? 'rgba(30,154,90,0.05)' : 'var(--color-surface)', padding: '1.2rem', borderRadius: '8px', border: validBankDaysThisMonth > 0 ? '1px solid var(--color-success)' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Landmark size={28} style={{ color: validBankDaysThisMonth > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }} />
                        <div>
                            <h4 style={{ margin: 0, color: validBankDaysThisMonth > 0 ? 'var(--color-success)' : 'var(--color-text)', fontSize: '1.1rem', fontWeight: 'bold' }}>Etäpäiväpankki</h4>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Tässä kuussa voimassa</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: validBankDaysThisMonth > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{validBankDaysThisMonth}</span>
                        <span className="text-secondary fw-semibold text-sm" style={{ marginLeft: '4px' }}>pv</span>
                    </div>
                </div>

                {/* Yhteissaldo näytetään omana tietonaan ala-reunassa */}
                <div style={{ marginTop: '1rem', padding: '0.6rem', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Kokonaissaldo yhteensä:</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>{data.ledgerBalance} pv</span>
                </div>

                {smartTips.length > 0 && validBankDaysThisMonth > 0 && (
                    <div style={{ marginTop: '1.2rem', borderTop: '1px dashed var(--color-success)', paddingTop: '1rem' }}>
                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lightbulb size={16} /> Älykkäät ehdotukset
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {smartTips.map((tip, idx) => (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.4 }}>{tip.text}</div>
                                    <Button variant="secondary" size="sm" icon={Zap} style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', alignSelf: 'flex-start' }} onClick={() => alert(`Klikkaa kalenterista päivää ${tip.dateStr} ja valitse 'Käytä pankkipäivä'.`)}>Toteuta</Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* KUUKAUDEN TAVOITESALDO */}
            <MetricBox title="Kuukauden seuranta" variant={stats.percent >= 50 ? 'success' : 'warning'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>{stats.percent}%</div>
                        <div className="text-sm fw-semibold mt-1">Lähityöaste</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: stats.diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
                        {stats.diff >= 0 ? `+${stats.diff} pv joustovaraa` : `${Math.abs(stats.diff)} pv vajaus`}
                    </div>
                </div>
                
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <ProgressBar value={stats.percent} max={100} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        <span>Lähityötä: {stats.office} pv</span>
                        <span>Tavoite: {stats.target} pv</span>
                    </div>
                </div>
            </MetricBox>

        </div>
    );
};
export default MonthSummary;