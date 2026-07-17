// --- src/components/sections/TyollistymisenEdellytykset/PalveluhistoriaNosto.jsx ---
import React from 'react';
import AlertBox from '../../common/AlertBox';
import Badge from '../../common/Badge';
import Button from '../../common/Button';
import { useSmartText } from './useSmartText';
import { Plus, Activity, Layers } from 'lucide-react';

const PalveluhistoriaNosto = ({ services = [], onInject }) => {
    const { buildPalveluHistoriaText, buildKokoPalveluhistoriaText } = useSmartText();

    if (!services || services.length === 0) return null;

    // Generoidaan älykäs, yhtenäinen pötkö kaikista palveluista
    const koontiTeksti = buildKokoPalveluhistoriaText(services);

    return (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            
            {/* KOONTINAPPI: Näytetään vain jos listalla on useampi kuin 1 palvelu */}
            {services.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        icon={Layers} 
                        onClick={() => onInject(koontiTeksti)}
                    >
                        Koosta kaikki yhtenäiseksi tekstiksi
                    </Button>
                </div>
            )}

            {services.map(service => {
                const isNegative = ['ei soveltuva', 'peruuntunut', 'keskeytynyt'].includes(service.tila?.toLowerCase());
                const alertType = isNegative ? 'warning' : 'info';
                const badgeVariant = isNegative ? 'danger' : (['alkanut', 'suoritettu'].includes(service.tila?.toLowerCase()) ? 'success' : 'primary');
                
                // Yksittäisen napin teksti (jos asiantuntija haluaa syystä tai toisesta lisätä vain yhden)
                const textToInject = buildPalveluHistoriaText(service);

                return (
                    <AlertBox key={service.id} type={alertType}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                    <strong><Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Palveluhistoria:</strong>
                                    <span>{service.title}</span>
                                    <Badge variant={badgeVariant}>{service.tila || 'Ohjattu'}</Badge>
                                </div>
                                {service.lisatieto && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                                        {isNegative ? 'Perustelu: ' : 'Lisätieto: '}{service.lisatieto}
                                    </div>
                                )}
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                icon={Plus} 
                                onClick={() => onInject(textToInject)}
                                style={{ flexShrink: 0 }}
                                title="Lisää vain tämä"
                            >
                                Lisää
                            </Button>
                        </div>
                    </AlertBox>
                );
            })}
        </div>
    );
};

export default PalveluhistoriaNosto;