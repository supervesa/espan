// --- src/components/admin/LocalTransportPanel.jsx ---
import React, { useState } from 'react';
import { Bus, CalendarCheck, Moon, Sun, History, CheckCircle, RefreshCw, PiggyBank, Sparkles, TrendingDown, XCircle } from 'lucide-react';

import { useLocalTransportStats } from '../../hooks/useLocalTransportStats';
import Card from '../common/Card';
import AlertBox from '../common/AlertBox';
import MetricBox from '../common/MetricBox';
import SummaryRow from '../common/SummaryRow';
import TransportIcon from '../common/TransportIcon';
import Accordion from '../common/Accordion';
import Checkbox from '../common/Checkbox';

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
    const [useSalaryPeriod, setUseSalaryPeriod] = useState(false);

    const { forecast, optimization, historicalData } = useLocalTransportStats({
        currentWeekStart,
        dailyLocations,
        exceptions,
        nationalHolidays,
        settings,
        arriveDayBefore,
        useSalaryPeriod
    });

    const transportStats = forecast || {
        officeDaysCount: 0, localTickets: 0, localCost: 0, tulo: 0, vali: 0, lahto: 0, ticketPrice: 8.06
    };

    const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}> 
            
            {/* Kaukoliikenteen erillinen paneeli (Hyödyntää samaa dataa) */}
            <LongDistancePanel journeys={longDistanceJourneys} expertId={EXPERT_ID} />

            <Card title="Paikallisliikenne (Klaukkala)" icon={Bus}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}> 
                    
                    {/* TULEVAISUUS: KULUVA VIIKKO */}
                    <MetricBox 
                        title="Kuluvan viikon tarve" 
                        icon={CalendarCheck} 
                        variant="dashed"
                        headerAction={
                            <div style={{ padding: '0', margin: '0' }}>
                                <Checkbox 
                                    label="Saavun edellisiltana"
                                    checked={arriveDayBefore} 
                                    onChange={setArriveDayBefore} 
                                />
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
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--color-border)', paddingTop: '1rem', marginTop: '1rem' }}>
                                    <span className="text-md fw-semibold text-slate-700">Yhteensä ({transportStats.officeDaysCount} tpv):</span>
                                    <span className="text-md fw-bold text-primary">{transportStats.localTickets} lippua ({(transportStats.localCost).toFixed(2)} €)</span>
                                </div>
                            </div>
                        )}
                    </MetricBox>

                    {/* MENNEISYYS: EDELLISEN VIIKON TOTEUMA */}
                    <MetricBox title="Edellisen viikon toteuma" icon={History} variant="solid">
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <TransportIcon type="bussi" containerSize={36} iconSize={18} />
                                <span className="text-md fw-semibold text-slate-700">Hyväksytyt kuitit (Korsisaari)</span>
                                <CheckCircle size={18} className="text-success" style={{ marginLeft: 'auto' }} />
                            </div>
                            
                            {historicalData?.loading ? (
                                <AlertBox type="info">Ladataan kuitteja...</AlertBox>
                            ) : (
                                <div style={{ marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                                        <span className="fw-bold lh-tight" style={{ fontSize: '1.75rem', color: 'var(--color-text-primary)' }}>
                                            {historicalData?.totalCost?.toFixed(2) || '0.00'} €
                                        </span>
                                        <span className="text-base text-secondary fw-semibold">
                                            {historicalData?.ticketCount || 0} kpl
                                        </span>
                                    </div>
                                    
                                    {historicalData?.priceTrendInfo && (
                                        <AlertBox type="info" customStyle={{ padding: '0.75rem' }}>
                                            <span className="text-sm-dense">{historicalData.priceTrendInfo}</span>
                                        </AlertBox>
                                    )}
                                </div>
                            )}
                        </div>
                    </MetricBox>
                </div>

                {/* SÄÄSTÖTUTKA JA KNAPSACK-OPTIMOINTI */}
                {optimization && optimization.total28DayTrips > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <MetricBox 
                            title={`Lippuoptimointi: ${optimization.periodLabel} (${optimization.periodStartStr} - ${optimization.periodEndStr})`}
                            icon={Sparkles} 
                            variant={optimization.savings > 0 ? 'highlight' : 'solid'}
                            headerAction={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span className="text-sm fw-semibold text-secondary text-truncate">
                                        {optimization.total28DayTrips} matkaa
                                    </span>
                                    <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1rem', display: 'flex', alignItems: 'center' }}>
                                        <Checkbox 
                                            label="Palkkakausi (14. pv)"
                                            checked={useSalaryPeriod} 
                                            onChange={setUseSalaryPeriod} 
                                        />
                                    </div>
                                </div>
                            }
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center', marginTop: '0.5rem', marginBottom: '1rem' }}>
                                
                                <div className="text-md text-secondary lh-tight">
                                    <div style={{ marginBottom: '4px' }}>Kustannus yksittäin: <strong className="text-slate-700">{optimization.singleTicketsCost.toFixed(2)} €</strong></div>
                                    <div className={`fw-bold ${optimization.savings > 0 ? 'text-success' : 'text-slate-700'}`}>
                                        Suositus: Osta {optimization.recommended.description} ({optimization.recommended.cost.toFixed(2)} €)
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    {optimization.savings > 0 ? (
                                        <>
                                            <span className="text-xs fw-bold text-success text-uppercase">
                                                Potentiaalinen säästö
                                            </span>
                                            <div className="text-success fw-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.75rem' }}>
                                                <TrendingDown size={24} />
                                                {optimization.savings.toFixed(2)} €
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-md text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <PiggyBank size={20} /> Yksittäisliput ovat halvin.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* HAITARI VERTAILULASKELMILLE */}
                            {optimization.allBaskets && optimization.allBaskets.length > 1 && (
                                <Accordion title="Näytä vertailulaskelmat" defaultOpen={false}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {optimization.allBaskets.slice(0, 5).map((basket, idx) => {
                                            const isWinner = idx === 0;
                                            return (
                                                <div key={basket.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: isWinner ? '#f0fdf4' : 'var(--color-surface)', border: `1px solid ${isWinner ? '#bbf7d0' : 'var(--color-border)'}`, borderRadius: '6px' }}>
                                                    <div className={isWinner ? 'text-success' : 'text-secondary'} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {isWinner ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                                        <span className={`text-sm ${isWinner ? 'fw-bold' : 'fw-medium'}`}>
                                                            {basket.description}
                                                        </span>
                                                    </div>
                                                    <span className={`text-md fw-bold ${isWinner ? 'text-success' : 'text-slate-700'}`}>
                                                        {basket.cost.toFixed(2)} €
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Accordion>
                            )}
                        </MetricBox>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default LocalTransportPanel;