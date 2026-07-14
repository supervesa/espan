// --- src/components/admin/PlanCalculator/ProjectionChart.jsx ---
import React from 'react';
import { useProjection } from './useProjection';
import Card from '../../common/Card';
import { Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

const ProjectionChart = ({ asiantuntijaId }) => {
    const { projectionData, projectionLoading } = useProjection(asiantuntijaId);

    const projWeek = projectionData?.find(r => r.tietotyyppi === 'Projektio');
    const assumedPace = projWeek ? parseFloat(projWeek.pitkan_ajan_tahti) : 0; // Hakee vain raakatahdin tekstia varten
    
    // Suurin mahdollinen arvo grafiikan skaalaamiseen kauniisti
    const highestBarValue = projectionData?.reduce((max, row) => {
        const val = parseFloat(row.laskennallinen_toteuma) || 0;
        return val > max ? val : max;
    }, 25);

    // KORJAUS: 3kk ankkuripiste
    const anchorWeek = projectionData?.find(row => row.horisontti_viikko === 13) || projectionData?.[projectionData.length - 1];

    return (
        <Card title="Suunnitelmat: 16 viikon seuranta" icon={Clock} variant="default">
            {projectionLoading ? (
                <div className="p-4 text-center text-slate-500">Ladataan 16 viikon projektioaikaa...</div>
            ) : projectionData?.length === 0 ? (
                <div className="p-4 text-center text-slate-500">Ei tarpeeksi dataa ennusteen luomiseen.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* --- YKSITTÄINEN KOONTIMUOTOINEN 3 KK ANKKURIBANNERI --- */}
                    {anchorWeek && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: anchorWeek.ennustettu_prosentti >= anchorWeek.tavoite_prosentti ? '#f0fdf4' : '#fff1f2',
                            border: `1px solid ${anchorWeek.ennustettu_prosentti >= anchorWeek.tavoite_prosentti ? '#bbf7d0' : '#fecdd3'}`,
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {anchorWeek.ennustettu_prosentti >= anchorWeek.tavoite_prosentti 
                                    ? <CheckCircle size={24} className="text-success" />
                                    : <AlertTriangle size={24} className="text-danger" />
                                }
                                <div>
                                    <div className="text-sm fw-bold text-slate-700">Tarkennettu ennuste: 3 kk ankkuripiste (Viikko {anchorWeek.viikko})</div>
                                    <div className="text-xs text-slate-500">Hyödyntää suorana kalenterin varaukset ja täydentää tahdilla ({assumedPace} kpl/vk).</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'flex-end' }}>
                                    <span className={`text-2xl fw-bold ${anchorWeek.ennustettu_prosentti >= anchorWeek.tavoite_prosentti ? 'text-success' : 'text-danger'}`}>
                                        {anchorWeek.ennustettu_prosentti} %
                                    </span>
                                </div>
                                <div className="text-xs fw-semibold text-slate-500">
                                    Tavoite: {anchorWeek.tavoite_prosentti} %
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Selite (Legend) */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.25rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '3px' }}></div> 
                            Historian tai ka-tahti
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#1e3a8a', borderRadius: '3px' }}></div> 
                            Varattu asiakas (lukittu kalenteriin)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#eff6ff', border: '1px dashed #3b82f6', borderRadius: '3px' }}></div> 
                            Projektiovara (yli 3kk)
                        </span>
                    </div>
                    
                    {/* Palkkikaavio kalenterilämpömittareilla */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(16, 1fr)', 
                        gap: '6px', 
                        alignItems: 'end', 
                        minHeight: '160px', 
                        borderBottom: '2px solid #e2e8f0', 
                        paddingBottom: '8px',
                        marginTop: '0.5rem'
                    }}>
                        {projectionData?.map((row) => {
                            const isProj = row.tietotyyppi === 'Projektio';
                            
                            // Täysi arvo, johon salkun ennuste on yhdistelmänä asettunut
                            const displayVal = parseFloat(row.laskennallinen_toteuma) || 0;
                            // Se osuus siitä, mikä todella on jo lyöty lukkoon
                            const calendarVal = parseFloat(row.kalenteri_varattu) || 0;
                            
                            // Visualisoinnin skaalaus (vähintään 2% reunan näyttämiseksi nollilla)
                            const totalHeightPct = Math.max(Math.min((displayVal / highestBarValue) * 100, 100), 2); 
                            
                            // Lasketaan tummansinisen osan prosentti KOKO palkin sisältä 
                            // (esim. jos varattu 2 ja tilaa 5 -> palkin ylärajasta 40% värittyy umpeen)
                            const solidFillPct = displayVal > 0 ? (calendarVal / displayVal) * 100 : 0;

                            return (
                                <div 
                                    key={row.horisontti_viikko} 
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}
                                    title={`Viikko ${row.viikko} (${row.tietotyyppi})\n\nVahvistettu kalenterissa: ${calendarVal} kpl\nOdotettu yhteismäärä viikolla: ${displayVal} kpl\n\nErääntyy täksi viikoksi: -${row.eraantyvat_suunnitelmat} kpl\nKumulatiivinen saldo-osa: ${row.ennustettu_prosentti} %`}
                                >
                                    <div className="text-xs font-mono fw-bold" style={{ color: isProj ? '#94a3b8' : '#475569', marginBottom: '4px' }}>
                                        {displayVal}
                                    </div>
                                    
                                    {/* Varsinainen pystypalkkikontti (Korkeus asetettu SQL-lopulliseen korjattuun summaan) */}
                                    <div style={{ 
                                        position: 'relative',
                                        width: '100%', 
                                        height: `${totalHeightPct}%`,
                                        backgroundColor: isProj ? '#eff6ff' : '#3b82f6',
                                        border: isProj ? '1px dashed #3b82f6' : '1px solid #2563eb',
                                        borderRadius: '4px 4px 0 0',
                                        opacity: row.horisontti_viikko === 13 ? 1 : 0.85,
                                        overflow: 'hidden' // Leikkaa yli menevän
                                    }}>
                                        {/* Varattujen asioiden nestepinta, nousee alhaalta ylöspäin */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0, left: 0, right: 0,
                                            height: `${Math.min(solidFillPct, 100)}%`,
                                            backgroundColor: '#1e3a8a', 
                                            transition: 'height 0.5s ease-out'
                                        }} />
                                    </div>
                                    
                                    <div className="text-xs fw-bold mt-1" style={{ color: row.horisontti_viikko === 13 ? '#0f172a' : '#64748b' }}>
                                        {row.horisontti_viikko === 13 ? `Ankkuri v${row.viikko}` : `v${row.viikko}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="text-sm text-slate-500 text-center mt-2 fw-semibold" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <TrendingUp size={16} />
                        Laskennallista tahtia suoristetaan täysin kalenteriin sidottujen ("normi" ja "aktivointi") aikojen perusteella (tumma alue).
                    </div>
                </div>
            )}
        </Card>
    );
};

export default ProjectionChart;