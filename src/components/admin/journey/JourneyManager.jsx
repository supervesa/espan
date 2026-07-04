// --- src/components/admin/journey/JourneyManager.jsx ---
import React, { useState, useEffect } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import AlertBox from '../../common/AlertBox';
import Accordion from '../../common/Accordion'; 
import TicketSplitScreen from './TicketSplitScreen';
import JourneyMatchmaker from './JourneyMatchmaker';

import { useLocalTransportStats } from '../../../hooks/useLocalTransportStats';

import { Bus, Train, Inbox, Clock, Loader2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

const JourneyManager = ({ 
    currentWeekStart, 
    dailyLocations = [], 
    exceptions = [], 
    nationalHolidays = [], 
    settings = {}, 
    arriveDayBefore = false,
    pendingReceipts = [],
    approvedReceipts = [],
    loading = false,
    approveReceipt,
    rejectReceipt,
    refreshReceipts,
    fetchApprovedReceipts,
    addVirtualReceipt
}) => {
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const { forecast } = useLocalTransportStats({
        currentWeekStart,
        dailyLocations,
        exceptions,
        nationalHolidays,
        settings,
        arriveDayBefore
    });

    const weekStartKey = currentWeekStart 
        ? new Date(currentWeekStart).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];

    useEffect(() => {
        const start = currentWeekStart ? new Date(currentWeekStart) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        fetchApprovedReceipts(start.toISOString(), end.toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekStartKey]);

    const handleFetchTickets = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/.netlify/functions/fetch-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok) {
                alert(`Haku onnistui! Prosessoituja uusia kuitteja: ${result.processedCount || 0}`);
                await refreshReceipts();
            } else {
                throw new Error(result.error || 'Sähköpostien haku epäonnistui.');
            }
        } catch (error) {
            console.error("Virhe sähköpostien manuaalisessa haussa:", error);
            alert(`Virhe haussa: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleApprove = async (updatedReceipt, newJourneys) => {
        const success = await approveReceipt(updatedReceipt, newJourneys);
        if (success) {
            setSelectedReceipt(null);
        } else {
            alert("Virhe tallennuksessa. Yritä uudelleen.");
        }
    };

    const handleReject = async (receiptId) => {
        if (!window.confirm("Haluatko varmasti hylätä ja piilottaa tämän kuitin? (Sitä ei lasketa kuluihin)")) return;
        
        const success = await rejectReceipt(receiptId);
        if (success) {
            setSelectedReceipt(null);
        }
    };

    if (selectedReceipt) {
        return (
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--color-border)', minHeight: '70vh' }}>
                <TicketSplitScreen 
                    receipt={selectedReceipt} 
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onCancel={() => setSelectedReceipt(null)} 
                />
            </div>
        );
    }

    const renderReceiptRow = (receipt) => {
        const metadata = receipt.ai_metadata || {};
        const confidence = metadata.confidenceScore || 0;
        const anomaly = metadata.anomalyInfo;
        const isVirtual = metadata.isVirtual;
        
        const isTrain = (receipt.keywords || []).some(kw => ['vr', 'juna'].includes(kw.toLowerCase()));
        const isBus = (receipt.keywords || []).some(kw => ['korsisaari', 'onnibus', 'bussi'].includes(kw.toLowerCase()));
        const Icon = isTrain ? Train : (isBus ? Bus : Inbox);
        
        return (
            <div 
                key={receipt.id}
                onClick={() => setSelectedReceipt(receipt)}
                style={{ 
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    padding: '1rem', backgroundColor: isVirtual ? '#f8fafc' : '#fff', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isTrain ? 'rgba(37, 99, 235, 0.1)' : 'rgba(234, 88, 12, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isTrain ? '#2563eb' : '#ea580c' }}>
                            {receipt.status === 'approved' && !isVirtual ? <CheckCircle size={20} color="#16a34a" /> : <Icon size={20} />}
                        </div>
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '1rem', color: isVirtual ? 'var(--color-text-secondary)' : 'var(--color-text)' }}>
                                {receipt.route_info || 'Reitti tuntematon'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                {receipt.departure_time && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} /> 
                                        {new Date(receipt.departure_time).toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                                
                                {!isVirtual && receipt.status !== 'approved' && (
                                    <Badge variant={confidence >= 90 ? 'success' : (confidence >= 70 ? 'warning' : 'danger')}>
                                        Luotettavuus {confidence}%
                                    </Badge>
                                )}
                                {isVirtual && <Badge variant="default">Manuaalinen ohitus</Badge>}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: isVirtual ? 'var(--color-text-secondary)' : 'var(--color-text)' }}>
                            {receipt.total_price ? `${Number(receipt.total_price).toFixed(2)} €` : '0.00 €'}
                        </span>
                    </div>
                </div>
                
                {anomaly && receipt.status !== 'approved' && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <AlertBox type="warning" icon={AlertTriangle} customStyle={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                            {anomaly}
                        </AlertBox>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    onClick={handleFetchTickets}
                    disabled={isSyncing || loading}
                    icon={isSyncing ? Loader2 : RefreshCw}
                    variant={isSyncing ? 'secondary' : 'primary'}
                >
                    {isSyncing ? 'Haetaan sähköposteja...' : 'Hae uudet kuitit sähköpostista'}
                </Button>
            </div>

            <JourneyMatchmaker 
                currentWeekStart={currentWeekStart}
                expectedLocalTickets={forecast?.localTickets || 0}
                expectedLocalCost={forecast?.localCost || 0.00}
                hasOfficeDays={(forecast?.officeDaysCount || 0) > 0}
                firstTravelDate={forecast?.firstTravelDate}
                lastTravelDate={forecast?.lastTravelDate}
                approvedReceipts={approvedReceipts}
                pendingReceipts={pendingReceipts}
                onAddVirtualReceipt={addVirtualReceipt}
            />

            <Card title={`Vahvistusta odottavat kuitit (${pendingReceipts.length})`} icon={Inbox} variant={pendingReceipts.length > 0 ? "bordered" : "default"}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                        <Loader2 size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                        <span>Ladataan tekoälyn löydöksiä...</span>
                    </div>
                ) : pendingReceipts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
                        <Inbox size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                        <p style={{ marginTop: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>Kaikki kuitit käsitelty!</p>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Tekoäly päivystää uusia sähköposteja taustalla.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {pendingReceipts.map(renderReceiptRow)}
                    </div>
                )}
            </Card>

            {approvedReceipts.length > 0 && (
                <Accordion title={`Tämän viikon käsitellyt kuitit (${approvedReceipts.length})`} defaultOpen={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {approvedReceipts.map(renderReceiptRow)}
                    </div>
                </Accordion>
            )}

        </div>
    );
};

export default JourneyManager;