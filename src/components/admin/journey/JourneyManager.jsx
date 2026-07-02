import React, { useState } from 'react';
import Card from '../../common/Card';
import TicketSplitScreen from './TicketSplitScreen';
import { useJourneyManager } from '../../../hooks/useJourneyManager';
import { Bus, Train, Ticket, ChevronRight, Inbox, Clock, Loader2, RefreshCw } from 'lucide-react';

const JourneyManager = () => {
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false); // Tila manuaaliselle sähköpostien haulle
    
    // Otetaan älykäs Hook käyttöön, lisätään refreshReceipts jonon päivittämiseen
    const { 
        pendingReceipts, 
        loading, 
        approveReceipt, 
        rejectReceipt,
        refreshReceipts
    } = useJourneyManager();

    // Funktio, joka kutsuu Netlify-funktiota ja hakee uudet kuitit livenä sähköpostista
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
                // Päivitetään Supabase-jono heti käyttöliittymään
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

    const handleApprove = async (updatedReceipt) => {
        const success = await approveReceipt(updatedReceipt);
        if (success) {
            setSelectedReceipt(null);
        } else {
            alert("Virhe tallennuksessa. Yritä uudelleen.");
        }
    };

    const handleReject = async (receiptId) => {
        if (!window.confirm("Haluatko varmasti hylätä ja piilottaa tämän kuitin?")) return;
        
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* MANUAALINEN PÄIVITYS PAINIKE */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleFetchTickets}
                    disabled={isSyncing || loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        backgroundColor: isSyncing ? 'var(--color-border)' : 'var(--color-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        cursor: (isSyncing || loading) ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'background-color 0.2s ease'
                    }}
                    onMouseOver={(e) => { if(!isSyncing && !loading) e.currentTarget.style.backgroundColor = '#e65c00' }}
                    onMouseOut={(e) => { if(!isSyncing && !loading) e.currentTarget.style.backgroundColor = 'var(--color-primary)' }}
                >
                    {isSyncing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Haetaan sähköposteja...</span>
                        </>
                    ) : (
                        <>
                            <RefreshCw size={16} />
                            <span>Hae uudet kuitit sähköpostista</span>
                        </>
                    )}
                </button>
            </div>

            {/* VIIKON MATKABUDJETTI (VERSIO 1.0 LASKURI) */}
            <Card title="Viikon matkabudjetti ja toteumat" icon={Ticket}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'block' }}>Reaaliaikainen kulutusarvio (Vk 27)</span>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-primary)' }}>40.30 €</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                        <div>Klaukkalan paikallislippu: <strong>5 kpl (40,30 €)</strong></div>
                        <div>Tulomatka: <strong>Odottaa tositetta</strong></div>
                        <div>Menomatka: <strong>Odottaa tositetta</strong></div>
                    </div>
                </div>
            </Card>

            {/* KUITTIJONO (VERSIO 2.0 TARKASTUSJONO) */}
            <Card title={`Vahvistusta odottavat kuitit (${pendingReceipts.length})`} icon={Inbox} variant={pendingReceipts.length > 0 ? "bordered" : "default"}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                        <Loader2 size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                        <span>Ladataan tekoälyn löydöksiä...</span>
                    </div>
                ) : pendingReceipts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
                        <Inbox size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                        <p>Kaikki kuitit käsitelty! Tekoäly päivystää uusia sähköposteja.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {pendingReceipts.map(receipt => {
                            const metadata = receipt.ai_metadata || {};
                            const confidence = metadata.confidenceScore || 0;
                            const isTrain = (receipt.keywords || []).some(kw => kw === 'vr' || kw === 'juna');
                            const Icon = isTrain ? Train : Bus;
                            
                            return (
                                <div 
                                    key={receipt.id}
                                    onClick={() => setSelectedReceipt(receipt)}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                        padding: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-border)', 
                                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isTrain ? 'rgba(37, 99, 235, 0.1)' : 'rgba(234, 88, 12, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isTrain ? '#2563eb' : '#ea580c' }}>
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{receipt.route_info || 'Reitti tuntematon'}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                {receipt.departure_time && (
                                                    <>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Clock size={12} /> 
                                                            {new Date(receipt.departure_time).toLocaleDateString()}
                                                        </span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                <span>Luotettavuus: {confidence}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)' }}>
                                            {receipt.total_price ? `${receipt.total_price} €` : '-'}
                                        </span>
                                        <ChevronRight size={20} color="var(--color-text-secondary)" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default JourneyManager;