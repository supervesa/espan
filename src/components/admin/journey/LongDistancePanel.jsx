// --- src/components/admin/journey/LongDistancePanel.jsx ---
import React, { useState } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import AlertBox from '../../common/AlertBox';
import { 
    Train, 
    Clock, 
    AlertCircle, 
    AlertTriangle, 
    CheckCircle2, 
    Sunrise, 
    Sun, 
    Sunset, 
    Moon, 
    TrendingDown,
    ArrowRight,
    Info,
    ChevronDown,
    ChevronUp,
    PiggyBank
} from 'lucide-react';

const LongDistancePanel = ({ journeys = [] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showBudget, setShowBudget] = useState(false);
    
    // 7 PÄIVÄN SIIVOUSSÄÄNTÖ OSTETUILLE
    const isRecentlyBought = (boughtAt) => {
        if (!boughtAt) return false;
        const boughtDate = new Date(boughtAt);
        const now = new Date();
        const diffDays = (now - boughtDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
    };

    // KEVEÄ PYHÄ- JA VIIKONLOPPUSTABILOITU PALKKAPÄIVÄLASKURI
    const getNextPayday = () => {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        
        let payday = new Date(year, month, 14);
        if (payday.getDay() === 6) payday.setDate(13);      // Lauantai -> Perjantai
        else if (payday.getDay() === 0) payday.setDate(12); // Sunnuntai -> Perjantai
        
        if (payday < now) {
            month += 1;
            payday = new Date(year, month, 14);
            if (payday.getDay() === 6) payday.setDate(13);
            else if (payday.getDay() === 0) payday.setDate(12);
        }
        return payday;
    };

    // Suodatetaan näytettävät matkat
    const visibleJourneys = (journeys || []).filter(journey => {
        if (journey.is_bought) {
            return isRecentlyBought(journey.bought_at);
        }
        return true;
    });

    const getSlotIcon = (slot) => {
        switch (slot) {
            case 'aamu': return <Sunrise size={16} />;
            case 'paiva': return <Sun size={16} />;
            case 'iltapaiva': return <Sunset size={16} />;
            case 'ilta': return <Moon size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const getSlotName = (slot) => {
        switch (slot) {
            case 'aamu': return 'Aamu (06-10)';
            case 'paiva': return 'Päivä (10-14)';
            case 'iltapaiva': return 'Iltapäivä (14-18)';
            case 'ilta': return 'Ilta (18+)';
            default: return 'Tuntematon';
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'ostettu':
                return { icon: CheckCircle2, color: 'var(--color-success)', text: 'Lippu ostettu', bg: 'rgba(30,154,90,0.05)' };
            case 'odota':
                return { icon: Clock, color: 'var(--color-success)', text: 'Odota, ei kiirettä', bg: '#fff' };
            case 'osta_tanaan':
                return { icon: AlertCircle, color: 'var(--color-warning)', text: 'Osta tänään', bg: '#fff' };
            case 'osta_heti':
                return { icon: AlertTriangle, color: 'var(--color-danger)', text: 'Osta heti! (Porras ylitetty)', bg: 'rgba(227,74,74,0.05)' };
            default:
                return { icon: Info, color: 'var(--color-text-secondary)', text: 'Ei dataa', bg: '#fff' };
        }
    };

    if (visibleJourneys.length === 0) {
        return (
            <Card title="Kaukoliikenteen ohjuri" icon={Train} variant="default">
                <p className="text-sm text-secondary font-italic m-0">
                    Ei tulevia toimintaa vaativia kaukoliikenteen matkoja.
                </p>
            </Card>
        );
    }

    // Kassavirtasuunnittelun lennosta laskenta ostamattomille lipuille
    const nextPayday = getNextPayday();
    const unboughtJourneys = visibleJourneys.filter(j => !j.is_bought);
    
    const buyNowList = [];
    const waitPaydayList = [];

    unboughtJourneys.forEach(j => {
        const matchDate = new Date(j.date);
        const deadlineDate = new Date(matchDate);
        deadlineDate.setDate(deadlineDate.getDate() - (j.days_to_price_jump || 7));
        
        if (deadlineDate < nextPayday) {
            buyNowList.push(j);
        } else {
            waitPaydayList.push(j);
        }
    });

    // Rajataan näytettävät rivit tilan mukaan (oletuksena 3)
    const displayLimit = 3;
    const journeysToRender = isExpanded ? visibleJourneys : visibleJourneys.slice(0, displayLimit);

    return (
        <Card 
            title="Kaukoliikenteen ohjuri" 
            icon={Train} 
            variant="default"
            headerAction={
                <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={PiggyBank}
                    onClick={() => setShowBudget(!showBudget)}
                >
                    {showBudget ? 'Piilota kassa' : 'Suunnittele kassa'}
                </Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* LAJITTELUNÄKYMÄ (KASSAVIRTASUUNNITTELIJA) */}
                {showBudget && (
                    <div className="view-fade-in">
                        <AlertBox type="info">
                            <div style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Seuraava palkkapäivä: {nextPayday.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--color-text-primary)' }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    • <strong>{buyNowList.length} matkaa</strong> kriittinen ostoikkuna sulkeutuu ennen palkkaa &rarr; <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>Rahoitettava nykyisestä kassasta:</span>
                                    {buyNowList.length > 0 && (
                                        <div style={{ paddingLeft: '1rem', marginTop: '0.2rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {buyNowList.map((j, i) => (
                                                <div key={i}>
                                                    - {new Date(j.date).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} | {j.direction === 'meno' ? 'Mikkeli → Helsinki' : 'Helsinki → Mikkeli'}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    • <strong>{waitPaydayList.length} matkaa</strong> hinta pysyy stabiilina palkanmaksuun asti &rarr; <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>Voi odottaa palkkapäivää:</span>
                                    {waitPaydayList.length > 0 && (
                                        <div style={{ paddingLeft: '1rem', marginTop: '0.2rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {waitPaydayList.map((j, i) => (
                                                <div key={i}>
                                                    - {new Date(j.date).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} | {j.direction === 'meno' ? 'Mikkeli → Helsinki' : 'Helsinki → Mikkeli'}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AlertBox>
                    </div>
                )}

                {journeysToRender.map((journey, idx) => {
                    const StatusIcon = getStatusConfig(journey.action_status).icon;
                    const statusColor = getStatusConfig(journey.action_status).color;
                    
                    return (
                        <div key={idx} style={{ 
                            border: `1px solid ${journey.is_bought ? 'var(--color-success)' : 'var(--color-border)'}`, 
                            borderRadius: '8px', 
                            padding: '1rem',
                            backgroundColor: getStatusConfig(journey.action_status).bg
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                    <span style={{ fontSize: '1.1rem' }}>
                                        {new Date(journey.date).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                    </span>
                                    <span style={{ color: 'var(--color-border)' }}>|</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                                        {journey.direction === 'meno' ? 'Mikkeli' : 'Helsinki'}
                                        <ArrowRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                        {journey.direction === 'meno' ? 'Helsinki' : 'Mikkeli'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: statusColor, fontWeight: '700', fontSize: '0.85rem' }}>
                                    <StatusIcon size={16} />
                                    {getStatusConfig(journey.action_status).text}
                                </div>
                            </div>

                            {!journey.is_bought && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px dashed var(--color-border)', paddingTop: '0.75rem' }}>
                                    
                                    {journey.recommended_slot && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                            <div style={{ marginTop: '2px', color: 'var(--color-primary)' }}>
                                                {getSlotIcon(journey.recommended_slot)}
                                            </div>
                                            <div>
                                                <strong>Suositeltu slotti:</strong> {getSlotName(journey.recommended_slot)} on tyypillisesti edullisin. 
                                                {journey.slot_savings > 0 && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontWeight: '600', marginLeft: '6px' }}>
                                                        <TrendingDown size={14} /> Säästö ~{Number(journey.slot_savings).toFixed(2)} €
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                        <div style={{ marginTop: '2px' }}><Clock size={16} /></div>
                                        <div>
                                            <strong>Milloin ostaa:</strong> Hinta nousee historiadatan mukaan {journey.days_to_price_jump} päivää ennen lähtöä. 
                                            {journey.action_status === 'osta_tanaan' && <span style={{ color: 'var(--color-warning)', fontWeight: '600', marginLeft: '4px' }}>Lukitse hinta tänään!</span>}
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    );
                })}

                {/* PAINIKE: Näita lisää / vähemmän */}
                {visibleJourneys.length > displayLimit && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={isExpanded ? ChevronUp : ChevronDown}
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? 'Näytä vähemmän' : `Näytä lisää (${visibleJourneys.length - displayLimit})`}
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default LongDistancePanel;