import React, { useState } from 'react';
import { Bus, CalendarCheck, Moon, Sun, History, CheckCircle, RefreshCw, PiggyBank, Sparkles, TrendingDown } from 'lucide-react';

import { useLocalTransportStats } from '../../hooks/useLocalTransportStats';
import Card from '../common/Card';
import Checkbox from '../common/Checkbox';
import AlertBox from '../common/AlertBox';
import MetricBox from '../common/MetricBox';
import SummaryRow from '../common/SummaryRow';
import TransportIcon from '../common/TransportIcon';

import LongDistancePanel from './journey/LongDistancePanel';

const LocalTransportPanel = ({ 
    currentWeekStart, 
    dailyLocations, 
    exceptions, 
    nationalHolidays, 
    settings,
    longDistanceJourneys
}) => {
    
    const [arriveDayBefore, setArriveDayBefore] = useState(false);

    const { forecast, optimization, historicalData } = useLocalTransportStats({
        currentWeekStart,
        dailyLocations,
        exceptions,
        nationalHolidays,
        settings,
        arriveDayBefore
    });

    const transportStats = forecast || {
        officeDaysCount: 0, localTickets: 0, localCost: 0, tulo: 0, vali: 0, lahto: 0, ticketPrice: 8.06
    };

    const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}> 
            
            <LongDistancePanel journeys={longDistanceJourneys} expertId={EXPERT_ID} />

            <Card title="Paikallisliikenne (Klaukkala)" icon={Bus}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}> 
                    
                    <MetricBox 
                        title="Kuluvan viikon tarve" 
                        icon={CalendarCheck} 
                        variant="dashed"
                        headerAction={
                            <div className="custom-checkbox-row" style={{ padding: '0', margin: '0' }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={arriveDayBefore} 
                                        onChange={(e) => setArriveDayBefore(e.target.checked)} 
                                    />
                                    Saavun edellisiltana
                                </label>
                            </div>
                        }
                    >
                        {transportStats.localTickets === 0 ? (
                            <AlertBox type="info">Ei lähityöpäiviä tällä viikolla (0 lippua).</AlertBox>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <SummaryRow 
                                    icon={Moon} 
                                    iconColor="var(--color-primary)" 
                                    label={arriveDayBefore ? (transportStats.officeDaysCount === 1 ? 'Tulo (vain aamu)' : 'Tulo (aamu + ilta)') : 'Tulo (ilta)'}
                                    value={`${transportStats.tulo} kpl (${(transportStats.tulo * transportStats.ticketPrice).toFixed(2)} €)`}
                                    borderTop={false} 
                                />
                                
                                {transportStats.vali > 0 && (
                                    <SummaryRow 
                                        icon={RefreshCw} 
                                        iconColor="var(--color-info-text)" 
                                        label="Välipäivät"
                                        value={`${transportStats.vali} kpl (${(transportStats.vali * transportStats.ticketPrice).toFixed(2)} €)`}
                                    />
                                )}
                                
                                {transportStats.lahto > 0 && (
                                    <SummaryRow 
                                        icon={Sun} 
                                        iconColor="var(--color-warning)" 
                                        label="Lähtö (aamu)"
                                        value={`${transportStats.lahto} kpl (${(transportStats.lahto * transportStats.ticketPrice).toFixed(2)} €)`}
                                    />
                                )}
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', borderTop: '2px solid var(--color-border)', paddingTop: '1rem', marginTop: '1rem' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Yhteensä ({transportStats.officeDaysCount} tpv):</span>
                                    <span style={{ fontWeight: '800', color: 'var(--color-primary)' }}>{transportStats.localTickets} lippua ({(transportStats.localCost).toFixed(2)} €)</span>
                                </div>
                            </div>
                        )}
                    </MetricBox>

                    <MetricBox title="Edellisen viikon toteuma" icon={History} variant="solid">
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <TransportIcon type="bussi" containerSize={36} iconSize={18} />
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>Hyväksytyt kuitit (Korsisaari)</span>
                                <CheckCircle size={18} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
                            </div>
                            
                            {historicalData?.loading ? (
                                <AlertBox type="info">Ladataan kuitteja...</AlertBox>
                            ) : (
                                <div style={{ marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                                        <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-primary)', lineHeight: 1 }}>
                                            {historicalData?.totalCost?.toFixed(2) || '0.00'} €
                                        </span>
                                        <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                                            {historicalData?.ticketCount || 0} kpl
                                        </span>
                                    </div>
                                    
                                    {historicalData?.priceTrendInfo && (
                                        <AlertBox type="info" customStyle={{ padding: '0.75rem' }}>
                                            <span style={{ fontSize: '0.8rem' }}>{historicalData.priceTrendInfo}</span>
                                        </AlertBox>
                                    )}
                                </div>
                            )}
                        </div>
                    </MetricBox>
                </div>

                {optimization && optimization.total28DayTrips > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <MetricBox 
                            title="Lippuoptimointi: Seuraavat 4 viikkoa" 
                            icon={Sparkles} 
                            variant={optimization.savings > 0 ? 'highlight' : 'solid'}
                            headerAction={
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                                    {optimization.total28DayTrips} tulevaa matkaa
                                </span>
                            }
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                    <div>Kustannus yksittäin: <strong style={{ color: 'var(--color-text-primary)' }}>{optimization.singleTicketsCost.toFixed(2)} €</strong></div>
                                    <div style={{ color: optimization.savings > 0 ? 'var(--color-success)' : 'var(--color-text-primary)', fontWeight: '700', marginTop: '4px' }}>
                                        Suositus: Osta {optimization.recommended.name} ({optimization.recommended.price.toFixed(2)} €)
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    {optimization.savings > 0 ? (
                                        <>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Potentiaalinen säästö
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '1.75rem', fontWeight: '800' }}>
                                                <TrendingDown size={24} />
                                                {optimization.savings.toFixed(2)} €
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                                            <PiggyBank size={20} /> Yksittäisliput ovat halvin vaihtoehto.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </MetricBox>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default LocalTransportPanel;