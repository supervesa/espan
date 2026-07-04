// --- src/components/admin/journey/JourneyMatchmaker.jsx ---
import React, { useState } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import { Bus, Train, CheckCircle, AlertTriangle, XCircle, Clock, Check, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

const JourneyMatchmaker = ({ 
    currentWeekStart,
    expectedLocalTickets = 0, 
    expectedLocalCost = 0.00, 
    hasOfficeDays = false,
    firstTravelDate,
    lastTravelDate,
    approvedReceipts = [],
    pendingReceipts = [],
    onAddVirtualReceipt
}) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const weekStart = currentWeekStart ? new Date(currentWeekStart) : new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const isThisWeek = (dateStr) => {
        if (!dateStr) return true; 
        const d = new Date(dateStr);
        return d >= weekStart && d < weekEnd;
    };

    const formatTravelDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
    };

    const calculateJourneyCost = (receipts) => {
        let total = 0;
        receipts.forEach(r => {
            if (r.expert_journeys && r.expert_journeys.length > 0) {
                r.expert_journeys.forEach(j => {
                    if (isThisWeek(j.departure_time)) {
                        total += Number(j.price || 0);
                    }
                });
            } else {
                if (isThisWeek(r.departure_time)) {
                    total += Number(r.total_price || 0);
                }
            }
        });
        return total;
    };

    const localApproved = approvedReceipts.filter(r => (r.keywords || []).some(k => k.toLowerCase() === 'korsisaari' || k.toLowerCase() === 'paikallisliikenne'));
    const localPending = pendingReceipts.filter(r => 
        (r.keywords || []).some(k => k.toLowerCase() === 'korsisaari' || k.toLowerCase() === 'paikallisliikenne') && 
        isThisWeek(r.departure_time)
    );

    const hasMonthlyPass = localApproved.some(r => 
        Number(r.total_price) > 100 || 
        (r.ai_metadata?.smartTags || []).some(tag => tag.toLowerCase().includes('kausilippu'))
    );

    const localApprovedCount = localApproved.length;
    const localPendingCount = localPending.length;
    const localApprovedCost = calculateJourneyCost(localApproved);
    const localMissingCount = hasMonthlyPass ? 0 : Math.max(0, expectedLocalTickets - localApprovedCount - localPendingCount);

    const isKaukoliikenne = (r) => (r.keywords || []).some(k => ['onnibus', 'vr', 'juna', 'bussi', 'kaukoliikenne'].includes(k.toLowerCase())) && !(r.keywords || []).some(k => k.toLowerCase() === 'korsisaari');

    const longDistApproved = approvedReceipts.filter(isKaukoliikenne);
    const longDistPending = pendingReceipts.filter(r => isKaukoliikenne(r) && isThisWeek(r.departure_time));

    let hasApprovedMeno = false;
    let hasApprovedPaluu = false;

    longDistApproved.forEach(r => {
        if (r.expert_journeys && r.expert_journeys.length > 0) {
            r.expert_journeys.forEach(j => {
                if (isThisWeek(j.departure_time)) {
                    if (j.direction === 'meno') hasApprovedMeno = true;
                    if (j.direction === 'paluu') hasApprovedPaluu = true;
                }
            });
        } else {
            if (isThisWeek(r.departure_time)) {
                const info = (r.route_info || '').toLowerCase();
                if (info.includes('meno-paluu') || (r.ai_metadata?.smartTags || []).some(t => t.toLowerCase().includes('meno-paluu'))) {
                    hasApprovedMeno = true;
                    hasApprovedPaluu = true;
                } else if (info.includes('paluu') || info.includes('tulomatka')) {
                    hasApprovedPaluu = true;
                } else {
                    hasApprovedMeno = true;
                }
            }
        }
    });

    let hasPendingMeno = false;
    let hasPendingPaluu = false;

    longDistPending.forEach(r => {
        if (r.expert_journeys && r.expert_journeys.length > 0) {
            r.expert_journeys.forEach(j => {
                if (isThisWeek(j.departure_time)) {
                    if (j.direction === 'meno') hasPendingMeno = true;
                    if (j.direction === 'paluu') hasPendingPaluu = true;
                }
            });
        } else {
            if (isThisWeek(r.departure_time)) {
                const info = (r.route_info || '').toLowerCase();
                if (info.includes('meno-paluu') || (r.ai_metadata?.smartTags || []).some(t => t.toLowerCase().includes('meno-paluu'))) {
                    hasPendingMeno = true;
                    hasPendingPaluu = true;
                } else if (info.includes('paluu') || info.includes('tulomatka')) {
                    hasPendingPaluu = true;
                } else {
                    hasPendingMeno = true;
                }
            }
        }
    });

    const menoStatus = hasApprovedMeno ? 'approved' : (hasPendingMeno ? 'pending' : 'missing');
    const tuloStatus = hasApprovedPaluu ? 'approved' : (hasPendingPaluu ? 'pending' : 'missing');

    const isMenoVirtual = longDistApproved.some(r => 
        r.ai_metadata?.isVirtual && 
        ((r.expert_journeys && r.expert_journeys.some(j => isThisWeek(j.departure_time) && j.direction === 'meno')) || 
        (!r.expert_journeys?.length && isThisWeek(r.departure_time) && (r.route_info || '').includes('Menomatka')))
    );

    const isTuloVirtual = longDistApproved.some(r => 
        r.ai_metadata?.isVirtual && 
        ((r.expert_journeys && r.expert_journeys.some(j => isThisWeek(j.departure_time) && j.direction === 'paluu')) || 
        (!r.expert_journeys?.length && isThisWeek(r.departure_time) && (r.route_info || '').includes('Tulomatka')))
    );

    const longDistApprovedCost = calculateJourneyCost(longDistApproved);

    const estimatedLongDistCost = hasOfficeDays ? 50.00 : 0;
    const totalExpectedBudget = expectedLocalCost + estimatedLongDistCost;
    const totalActualCost = localApprovedCost + longDistApprovedCost;

    const totalMissing = localMissingCount + (tuloStatus === 'missing' && hasOfficeDays ? 1 : 0) + (menoStatus === 'missing' && hasOfficeDays ? 1 : 0);
    const totalPending = localPendingCount + (hasPendingMeno ? 1 : 0) + (hasPendingPaluu ? 1 : 0);

    const handleVirtualReceipt = async (type, travelDateISO) => {
        setIsProcessing(true);
        const date = travelDateISO ? new Date(travelDateISO).toISOString() : new Date().toISOString();
        const success = await onAddVirtualReceipt(date, `${type} (Ohitettu manuaalisesti)`, ['ohitettu', 'kaukoliikenne']);
        if (!success) alert("Ohituksen tallennus epäonnistui.");
        setIsProcessing(false);
    };

    return (
        <Card title="Viikon matkabudjetti ja tilanne" icon={CheckCircle} variant={totalMissing > 0 ? "warning" : "default"}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: totalMissing === 0 && totalPending === 0 ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px solid ${totalMissing === 0 && totalPending === 0 ? '#bbf7d0' : '#cbd5e1'}` }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Odotettu kulu (Arvio)
                            </span>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text)' }}>
                                {totalExpectedBudget.toFixed(2)} €
                            </span>
                        </div>
                        <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '2rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Toteutunut (Hyväksytty)
                            </span>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                {totalActualCost.toFixed(2)} €
                            </span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {totalMissing === 0 && totalPending === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 'bold', backgroundColor: '#dcfce7', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem' }}>
                                <Check size={18} /> Kaikki kuitit kunnossa!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                {totalMissing > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        <XCircle size={14} /> {totalMissing} kuittia puuttuu
                                    </span>
                                )}
                                {totalPending > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        <Clock size={14} /> {totalPending} kuittia tarkastusjonossa
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                        <Bus size={18} color="#2563eb" /> PAIKALLISLIIKENNE (Klaukkala)
                    </h5>
                    
                    {expectedLocalTickets === 0 && !hasMonthlyPass ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', paddingLeft: '1.5rem' }}>
                            Ei tarvetta paikallislipuille tällä viikolla.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                                Odotettu tarve kalenterista: <strong>{expectedLocalTickets} lippua</strong>
                            </div>

                            {hasMonthlyPass && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '0.9rem', fontWeight: '600', backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', width: 'fit-content' }}>
                                    <CheckCircle size={16} /> Kuukauden kausilippu aktiivinen (Tarve täytetty automaattisesti!)
                                </div>
                            )}

                            {!hasMonthlyPass && localApprovedCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '0.9rem' }}>
                                    <CheckCircle size={16} /> {localApprovedCount} kpl viety kirjanpitoon ({localApprovedCost.toFixed(2)} €)
                                </div>
                            )}

                            {!hasMonthlyPass && localPendingCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', fontSize: '0.9rem' }}>
                                    <Clock size={16} /> {localPendingCount} kpl odottaa vahvistustasi alhaalla jonossa
                                </div>
                            )}

                            {!hasMonthlyPass && localMissingCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '0.9rem', fontWeight: '600' }}>
                                    <XCircle size={16} /> {localMissingCount} kpl puuttuu (Sähköpostia ei ole vielä saapunut)
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <hr style={{ border: 'none', borderTop: '1px dashed var(--color-border)', margin: '0' }} />

                <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                        <Train size={18} color="#ea580c" /> KAUKOLIIKENNE (Mikkeli - Helsinki)
                    </h5>

                    {!hasOfficeDays ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', paddingLeft: '1.5rem' }}>
                            Ei toimistopäiviä tällä viikolla, kaukoliikennettä ei odoteta.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1.5rem' }}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <ArrowRight size={16} color="var(--color-text-secondary)" />
                                    <span style={{ fontWeight: '600' }}>Menomatka (MIKKELI - HELSINKI) {firstTravelDate ? `- ${formatTravelDate(firstTravelDate)}` : ''}:</span>
                                    
                                    {menoStatus === 'approved' && isMenoVirtual && <span style={{ color: '#64748b' }}><Check size={14}/> Matkustettu muulla kyydillä (Ohitettu)</span>}
                                    {menoStatus === 'approved' && !isMenoVirtual && <span style={{ color: '#16a34a', fontWeight: 'bold' }}><CheckCircle size={14}/> Kuitti hyväksytty</span>}
                                    {menoStatus === 'pending' && <span style={{ color: '#d97706' }}><Clock size={14}/> Odottaa vahvistustasi jonossa</span>}
                                    {menoStatus === 'missing' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}><AlertTriangle size={14}/> Odottaa tositetta sähköpostiin</span>}
                                </div>
                                
                                {menoStatus === 'missing' && (
                                    <Button variant="secondary" size="sm" onClick={() => handleVirtualReceipt('Menomatka', firstTravelDate)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : "Ohita / Ei kulua"}
                                    </Button>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <ArrowLeft size={16} color="var(--color-text-secondary)" />
                                    <span style={{ fontWeight: '600' }}>Tulomatka (HELSINKI - MIKKELI) {lastTravelDate ? `- ${formatTravelDate(lastTravelDate)}` : ''}:</span>
                                    
                                    {tuloStatus === 'approved' && isTuloVirtual && <span style={{ color: '#64748b' }}><Check size={14}/> Matkustettu muulla kyydillä (Ohitettu)</span>}
                                    {tuloStatus === 'approved' && !isTuloVirtual && <span style={{ color: '#16a34a', fontWeight: 'bold' }}><CheckCircle size={14}/> Kuitti hyväksytty</span>}
                                    {tuloStatus === 'pending' && <span style={{ color: '#d97706' }}><Clock size={14}/> Odottaa vahvistustasi jonossa</span>}
                                    {tuloStatus === 'missing' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}><AlertTriangle size={14}/> Odottaa tositetta sähköpostiin</span>}
                                </div>
                                
                                {tuloStatus === 'missing' && (
                                    <Button variant="secondary" size="sm" onClick={() => handleVirtualReceipt('Tulomatka', lastTravelDate)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : "Ohita / Ei kulua"}
                                    </Button>
                                )}
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </Card>
    );
};

export default JourneyMatchmaker;