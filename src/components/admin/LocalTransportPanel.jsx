// --- src/components/admin/LocalTransportPanel.jsx ---
import React from 'react';
import { Bus, CalendarCheck, Moon, Sun, History, CheckCircle, Info, RefreshCw, PiggyBank, Sparkles, TrendingDown } from 'lucide-react';
import { useLocalTransportStats } from '../../hooks/useLocalTransportStats';

const LocalTransportPanel = ({ 
    currentWeekStart, 
    dailyLocations, 
    exceptions, 
    nationalHolidays, 
    settings 
}) => {
    
    // Noudetaan hookista laskurit (Viikko, 28pv ja Historia)
    const { forecast, optimization, historicalData } = useLocalTransportStats({
        currentWeekStart,
        dailyLocations,
        exceptions,
        nationalHolidays,
        settings
    });

    // Varmistetaan oletusarvot kuluvalle viikolle jos lataus kesken
    const transportStats = forecast || {
        officeDaysCount: 0, localTickets: 0, localCost: 0, tulo: 0, vali: 0, lahto: 0, ticketPrice: 8.06
    };

    return (
        <div style={{ backgroundColor: 'var(--color-surface)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginTop: '-0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* OTSIKKORIVI */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', padding: '8px', borderRadius: '8px', color: '#2563eb' }}>
                    <Bus size={24} />
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-text)' }}>
                        Paikallisliikenne (Klaukkala)
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        Kuluvan viikon ennuste ja 4 viikon säästöoptimointi
                    </p>
                </div>
            </div>

            {/* YLÄRIVI: ENNUSTE JA HISTORIA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* TULEVAISUUS (KULUVA VIIKKO) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CalendarCheck size={16} /> Kuluvan viikon tarve
                    </div>
                    
                    {transportStats.officeDaysCount <= 1 ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: '1rem 0' }}>
                            {transportStats.officeDaysCount === 1 
                                ? "Vain 1 lähityöpäivä. Ei majoittumistarvetta Klaukkalassa (0 lippua)." 
                                : "Ei lähityöpäiviä tällä viikolla (0 lippua)."}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '600' }}>
                                    <Moon size={14} color="#6366f1" /> Tulo (ilta)
                                </span>
                                <span>{transportStats.tulo} kpl ({(transportStats.tulo * transportStats.ticketPrice).toFixed(2)} €)</span>
                            </div>
                            
                            {transportStats.vali > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '600' }}>
                                        <RefreshCw size={14} color="#0284c7" /> Välipäivät
                                    </span>
                                    <span>{transportStats.vali} kpl ({(transportStats.vali * transportStats.ticketPrice).toFixed(2)} €)</span>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '600' }}>
                                    <Sun size={14} color="#eab308" /> Lähtö (aamu)
                                </span>
                                <span>{transportStats.lahto} kpl ({(transportStats.lahto * transportStats.ticketPrice).toFixed(2)} €)</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>Yhteensä ({transportStats.officeDaysCount} tpv):</span>
                                <span style={{ fontWeight: '800', color: 'var(--color-primary)' }}>{transportStats.localTickets} lippua ({(transportStats.localCost).toFixed(2)} €)</span>
                            </div>
                        </>
                    )}
                </div>

                {/* MENNEISYYS (EDELLINEN VIIKKO) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <History size={16} /> Edellisen viikon toteuma
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
                            <CheckCircle size={16} color="var(--color-success)" />
                            <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '600' }}>Hyväksytyt kuitit (Korsisaari)</span>
                        </div>
                        
                        {historicalData?.loading ? (
                            <div style={{ margin: 'auto 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={14} className="animate-spin" /> Ladataan kuitteja...
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)', lineHeight: 1 }}>
                                        {historicalData?.totalCost?.toFixed(2) || '0.00'} €
                                    </span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                                        {historicalData?.ticketCount || 0} kpl
                                    </span>
                                </div>
                                
                                {historicalData?.priceTrendInfo && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', backgroundColor: '#e2e8f0', padding: '6px 8px', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.3 }}>
                                        <Info size={14} style={{ flexShrink: 0 }} /> 
                                        Järjestelmän havainto: {historicalData.priceTrendInfo}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ALARIVI: ÄLYKÄS SÄÄSTÖSUOSITUS (4 VIIKKOA) */}
            {optimization && optimization.total28DayTrips > 0 && (
                <div style={{ 
                    backgroundColor: optimization.savings > 0 ? '#f0fdf4' : '#f8fafc', 
                    border: `1px solid ${optimization.savings > 0 ? '#bbf7d0' : '#cbd5e1'}`, 
                    borderRadius: '6px', padding: '1rem', marginTop: '0.5rem' 
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', color: optimization.savings > 0 ? '#166534' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={16} /> 
                            Lippuoptimointi: Seuraavat 4 viikkoa
                        </h5>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                            {optimization.total28DayTrips} tulevaa matkaa
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                        
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            <div>Kustannus yksittäin ostettuna: <strong>{optimization.singleTicketsCost.toFixed(2)} €</strong></div>
                            <div style={{ color: optimization.savings > 0 ? '#15803d' : 'var(--color-text)', fontWeight: '700', marginTop: '4px' }}>
                                Suositus: Osta {optimization.recommended.name} ({optimization.recommended.price.toFixed(2)} €)
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                            {optimization.savings > 0 ? (
                                <>
                                    <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Potentiaalinen säästö
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '1.5rem', fontWeight: '800' }}>
                                        <TrendingDown size={20} />
                                        {optimization.savings.toFixed(2)} €
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                    <PiggyBank size={18} /> Yksittäisliput ovat halvin vaihtoehto.
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default LocalTransportPanel;