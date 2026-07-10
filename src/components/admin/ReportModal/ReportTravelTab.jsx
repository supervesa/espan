// --- src/components/admin/ReportModal/ReportTravelTab.jsx ---
import React from 'react';
import SummaryRow from '../../common/SummaryRow';
import { Navigation, MapPin, CalendarDays, Compass } from 'lucide-react';

const ReportTravelTab = ({ travelData }) => {
    const { journeys, receipts } = travelData;

    // 1. Reittien frekvenssi
    const routeCounts = {};
    journeys.forEach(j => {
        const route = j.route_info || 'Muu reitti';
        routeCounts[route] = (routeCounts[route] || 0) + 1;
    });
    const sortedRoutes = Object.entries(routeCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    const maxRouteCount = sortedRoutes.length > 0 ? sortedRoutes[0].count : 1;

    // 2. Ennakointi-indeksi
    let totalLeadTime = 0;
    let leadTimeCount = 0;
    receipts.forEach(r => {
        if (r.ai_metadata) {
            try {
                const meta = typeof r.ai_metadata === 'string' ? JSON.parse(r.ai_metadata) : r.ai_metadata;
                if (meta.leadTimeHours !== undefined && meta.leadTimeHours !== null) {
                    totalLeadTime += meta.leadTimeHours;
                    leadTimeCount++;
                }
            } catch (e) { /* ignore */ }
        }
    });
    const avgLeadTimeDays = leadTimeCount > 0 ? (totalLeadTime / leadTimeCount / 24).toFixed(1) : 0;
    const isGoodLeadTime = avgLeadTimeDays >= 7;

    // 3. Lämpökartta: Viikonpäivät (1 = Ma, 5 = Pe)
    const dayCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    journeys.forEach(j => {
        if (j.departure_time) {
            const d = new Date(j.departure_time).getDay();
            if (d >= 1 && d <= 5) dayCounts[d]++;
        }
    });
    const maxDayCount = Math.max(...Object.values(dayCounts), 1);

    if (journeys.length === 0 && receipts.length === 0) {
        return (
            <div className="admin-empty-state" style={{ padding: '3rem 0' }}>
                <Navigation size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                Ei tallennettua logistiikkadataa tai matkoja tälle jaksolle.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}><MapPin size={18}/> Reittianalyysi</h4>
                    {sortedRoutes.length > 0 ? sortedRoutes.map(r => (
                        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div className="text-sm fw-medium text-slate-700 text-truncate" style={{ width: '120px' }}>{r.name}</div>
                            <div style={{ flexGrow: 1, height: '8px', backgroundColor: 'var(--color-background)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${(r.count / maxRouteCount) * 100}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                            </div>
                            <div className="text-sm font-mono text-secondary">{r.count} kpl</div>
                        </div>
                    )) : <p className="text-secondary text-sm">Ei reittidataa.</p>}
                </div>

                <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}><Compass size={18}/> Ennakointi-indeksi</h4>
                    <SummaryRow label="Tallennettuja lippukuitteja" value={`${leadTimeCount} kpl`} borderTop={false} />
                    <SummaryRow 
                        label="Keskimääräinen ostoaika ennen matkaa" 
                        value={`${avgLeadTimeDays} vuorokautta`} 
                        iconColor={isGoodLeadTime ? "var(--color-success)" : "var(--color-warning)"} 
                    />
                    <div className="text-xs text-secondary font-italic mt-3" style={{ lineHeight: 1.5 }}>
                        Hyvä ennakointi (yli 7 vrk) kertoo suunnitelmallisesta kalenterinhallinnasta ja vähentää matkustuksen aiheuttamaa stressiä.
                    </div>
                </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}><CalendarDays size={18}/> Kaukoliikenteen painopisteet (ma-pe)</h4>
                <div style={{ display: 'flex', gap: '4px', height: '60px' }}>
                    {['Ma', 'Ti', 'Ke', 'To', 'Pe'].map((dayName, idx) => {
                        const count = dayCounts[idx + 1];
                        const intensity = count > 0 ? 0.1 + ((count / maxDayCount) * 0.9) : 0.02; 
                        
                        return (
                            <div key={dayName} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ 
                                    flexGrow: 1, 
                                    backgroundColor: count > 0 ? `rgba(255, 107, 0, ${intensity})` : 'var(--color-background)',
                                    borderRadius: '4px',
                                    border: count > 0 ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: count > 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                }}>
                                    {count > 0 ? count : ''}
                                </div>
                                <div className="text-xs text-center text-secondary fw-semibold">{dayName}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default ReportTravelTab;