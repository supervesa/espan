// --- src/components/admin/journey/LongDistancePanel.jsx ---
import React from 'react';
import { Train, CalendarClock, ArrowRight, Clock, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';
import Card from '../../common/Card';
import AlertBox from '../../common/AlertBox';
import Badge from '../../common/Badge';
import TransportIcon from '../../common/TransportIcon';
import Accordion from '../../common/Accordion'; // Tuodaan valmis haitari-komponentti

import { useLongDistancePredictions } from '../../../hooks/useLongDistancePredictions';

const LongDistancePanel = ({ expertId }) => {
    const { predictions, loading } = useLongDistancePredictions(expertId);

    // Yhteinen renderöintifunktio yhdelle matkalle, jotta koodia ei tarvitse toistaa
    const renderTripRow = (trip, index) => {
        const isUrgent = trip.toimintasuositus.includes('OSTA NYT');
        const isToday = trip.toimintasuositus.includes('OSTA TÄNÄÄN');
        const isWait = trip.toimintasuositus.includes('ODOTA');

        let badgeVariant = 'default';
        let StatusIcon = Clock;
        let statusText = 'ODOTA';
        
        if (isUrgent) {
            badgeVariant = 'danger'; 
            StatusIcon = AlertCircle;
            statusText = 'OSTA NYT';
        } else if (isToday) {
            badgeVariant = 'success'; 
            StatusIcon = CheckCircle2;
            statusText = 'OSTA TÄNÄÄN';
        }

        const travelDate = new Date(trip.tuleva_matkapaeiva).toLocaleDateString('fi-FI');
        const buyDate = new Date(trip.suositeltu_ostopaiva).toLocaleDateString('fi-FI');
        
        const transportType = trip.ennustettu_reitti.toLowerCase().includes('bussi') ? 'kaukobussi' : 'kaukojuna';

        return (
            <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                borderRadius: '6px', 
                border: `1px solid ${isWait ? 'var(--color-border)' : (isUrgent ? '#fca5a5' : '#6ee7b7')}`, 
                backgroundColor: isWait ? 'transparent' : (isUrgent ? '#fef2f2' : '#ecfdf5')
            }}>
                {/* VASEN: Ikoni ja Matkatiedot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <TransportIcon type={transportType} containerSize={42} iconSize={20} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text)' }}>
                            <CalendarClock size={16} color="var(--color-primary, #6366f1)" />
                            {travelDate}
                            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'normal', fontSize: '0.85rem' }}>
                                ({trip.kohde_sijainti})
                            </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ArrowRight size={14} /> Reitti: {trip.ennustettu_reitti}
                        </div>
                    </div>
                </div>

                {/* OIKEA: Motivaatio, Osto-ohje ja Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Motivaatioteksti - Säästöprosentti näkyy vain jos on syytä toimia */}
                        {!isWait && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#16a34a', fontWeight: 'bold' }}>
                                <TrendingDown size={14} /> Jopa {trip.saasto_prosentti} % säästö
                            </div>
                        )}
                        <Badge variant={badgeVariant} icon={StatusIcon}>
                            {statusText}
                        </Badge>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: isWait ? 'normal' : '600' }}>
                        {isWait ? `Optimaalinen ostopäivä: ${buyDate}` : `Hintataso nousee nopeasti`}
                    </div>
                </div>
            </div>
        );
    };

    // Jaetaan lista näkyviin (max 3) ja piilotettuihin
    const visibleTrips = predictions ? predictions.slice(0, 3) : [];
    const hiddenTrips = predictions ? predictions.slice(3) : [];

    return (
        <Card title="Kaukoliikenteen osto-ohjuri" icon={Train}>
            {loading ? (
                <AlertBox type="info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} className="animate-spin" /> 
                        <span>Ladataan hintaennusteita ja kalenteridataa...</span>
                    </div>
                </AlertBox>
            ) : predictions && predictions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    
                    {/* Näytetään 3 ensimmäistä matkaa suoraan */}
                    {visibleTrips.map((trip, index) => renderTripRow(trip, index))}

                    {/* Laitetaan loput haitariin, jos niitä on */}
                    {hiddenTrips.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <Accordion title={`Näytä myöhemmät matkat (${hiddenTrips.length})`} defaultOpen={false}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    {hiddenTrips.map((trip, index) => renderTripRow(trip, index + 3))}
                                </div>
                            </Accordion>
                        </div>
                    )}

                </div>
            ) : (
                <AlertBox type="info">
                    Kaikki kunnossa! Lähiviikoille ei ole tiedossa kaukoliikennettä vaativia toimistopäiviä.
                </AlertBox>
            )}
        </Card>
    );
};

export default LongDistancePanel;