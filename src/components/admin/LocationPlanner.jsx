// --- src/components/admin/LocationPlanner.jsx ---
import React, { useMemo } from 'react';
import Card from '../common/Card';
import { Info, Home, Building, Check } from 'lucide-react';

const LocationPlanner = ({ currentWeekStart, dailyLocations, exceptions }) => {
    
    // Apufunktio päivämäärän muuntamiseen ISO-merkkijonoksi (YYYY-MM-DD)
    const formatDateStr = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    // Lasketaan 4 viikon seurantajakson tilastot kahdessa 2 viikon syklissä
    const cyclesStats = useMemo(() => {
        const stats = {
            cycle1: { label: 'Sykli A (Viikot 1-2)', office: 0, remote: 0, totalWorkingDays: 0, percent: 0 },
            cycle2: { label: 'Sykli B (Viikot 3-4)', office: 0, remote: 0, totalWorkingDays: 0, percent: 0 }
        };

        // Luodaan taulukko kaikista seurantajakson 20 työpäivästä (4 viikkoa, ma-pe)
        for (let w = 0; w < 4; w++) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(weekStart.getDate() + (w * 7));
            const targetCycle = w < 2 ? 'cycle1' : 'cycle2';

            for (let d = 0; d < 5; d++) {
                const currentDay = new Date(weekStart);
                currentDay.setDate(weekStart.getDate() + d);
                const dStr = formatDateStr(currentDay);

                // Tarkistetaan onko päivä merkitty kokonaan estetyksi/lomaksi (00:00:00)
                const isBlockedDay = exceptions.some(e => 
                    e.is_blocked && 
                    e.meeting_type === 'estetty' && 
                    e.start_time.substring(0, 10) === dStr
                );

                // Jos ei ole loma/vapaapäivä, lasketaan se mukaan aktiivisiin työpäiviin
                if (!isBlockedDay) {
                    stats[targetCycle].totalWorkingDays += 1;

                    const loc = dailyLocations.find(l => l.date === dStr);
                    if (loc?.location_type === 'lahityo') {
                        stats[targetCycle].office += 1;
                    } else if (loc?.location_type === 'eta') {
                        stats[targetCycle].remote += 1;
                    }
                }
            }
        }

        // Lasketaan prosentit
        if (stats.cycle1.totalWorkingDays > 0) {
            stats.cycle1.percent = Math.round((stats.cycle1.office / stats.cycle1.totalWorkingDays) * 100);
        }
        if (stats.cycle2.totalWorkingDays > 0) {
            stats.cycle2.percent = Math.round((stats.cycle2.office / stats.cycle2.totalWorkingDays) * 100);
        }

        return stats;
    }, [currentWeekStart, dailyLocations, exceptions]);

    return (
        <Card title="Etä- ja lähityön seurantajakso (4 viikkoa / Tavoite 50%)" icon={Info} variant="bordered">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {Object.values(cyclesStats).map((cycle, idx) => (
                    <div key={idx} style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span className="fw-bold text-sm text-primary">{cycle.label}</span>
                            <span className="font-mono text-xs fw-semibold" style={{ 
                                color: cycle.percent >= 50 ? 'var(--color-success)' : 'var(--color-primary)',
                                backgroundColor: cycle.percent >= 50 ? 'rgba(30,154,90,0.1)' : 'rgba(255,107,0,0.1)',
                                padding: '2px 6px', borderRadius: '4px'
                            }}>
                                {cycle.percent}% lähityötä
                            </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                            <div style={{ 
                                width: `${Math.min(100, (cycle.percent / 50) * 100)}%`, 
                                height: '100%', 
                                backgroundColor: cycle.percent >= 50 ? 'var(--color-success)' : 'var(--color-primary)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Building size={14} /> <span>Lähityö: {cycle.office} pv</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Home size={14} /> <span>Etätyö: {cycle.remote} pv</span>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.8 }}>
                                Aktiiviset päivät: {cycle.totalWorkingDays} pv
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-secondary mt-3 m-0" style={{ lineHeight: 1.4 }}>
                * Järjestelmä vähentää koko päivän poissaolot ja lomat automaattisesti työpäivien kokonaismäärästä, jolloin 50% kiintiövaatimus mukautuu dynaamisesti ja pysyy aina oikeana.
            </p>
        </Card>
    );
};

export default LocationPlanner;