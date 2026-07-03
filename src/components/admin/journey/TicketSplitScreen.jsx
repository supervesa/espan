// --- src/components/admin/journey/TicketSplitScreen.jsx ---
import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import AIInsightsPanel from './AIInsightsPanel';
import { CheckCircle, Trash2, MapPin, Calendar, CreditCard, Loader2, Save, Undo, Plus, AlertCircle, Calculator } from 'lucide-react';

const TicketSplitScreen = ({ receipt, onApprove, onReject, onCancel }) => {
    
    // 1. KUITIN YLEISET TIEDOT (Eurot)
    const [totalPrice, setTotalPrice] = useState(receipt.total_price || '');

    // 2. KUITTIIN LIITTYVÄT MATKAT (Kalenteritapahtumat)
    const [journeys, setJourneys] = useState(() => {
        // Jos kuitilla on jo uuden tietokantamallin matkoja, käytetään niitä
        if (receipt.expert_journeys && receipt.expert_journeys.length > 0) {
            return receipt.expert_journeys.map(j => ({ 
                ...j, 
                _tempId: j.id,
                price: j.price || 0 
            }));
        } 
        // AUTOMAATTINEN MIGRAATIO: Jos kyseessä on vanha kuitti, tehdään sen tiedoista eka matka
        return [{
            _tempId: Date.now().toString(),
            departure_time: receipt.departure_time || '',
            route_info: receipt.route_info || '',
            direction: (receipt.route_info || '').toLowerCase().includes('paluu') ? 'paluu' : 'meno',
            price: receipt.total_price || 0
        }];
    });

    const [htmlContent, setHtmlContent] = useState('');
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    const isAlreadyApproved = receipt.status === 'approved';

    // Lasketaan matkojen yhteissumma ja erotus
    const allocatedSum = journeys.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
    const priceDifference = Number(totalPrice || 0) - allocatedSum;
    const isSumMatching = Math.abs(priceDifference) < 0.01; // Sietää pienet pyöristysvirheet

    useEffect(() => {
        const fetchReceiptHtml = async () => {
            if (!receipt.bucket_file_url) return;
            
            setLoadingReceipt(true);
            try {
                const response = await fetch(receipt.bucket_file_url);
                const buffer = await response.arrayBuffer();
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(buffer);
                setHtmlContent(text);
            } catch (error) {
                console.error("Kuitin lataus epäonnistui:", error);
                setHtmlContent('<div style="padding:20px; color:#ef4444; font-family:sans-serif;">Kuitin lataus epäonnistui tietoturva- tai verkkosyistä.</div>');
            } finally {
                setLoadingReceipt(false);
            }
        };

        fetchReceiptHtml();
    }, [receipt.bucket_file_url]);

    // Matkalistan hallintafunktiot
    const handleUpdateJourney = (index, field, value) => {
        const updated = [...journeys];
        updated[index][field] = value;
        setJourneys(updated);
    };

    const handleAddJourney = () => {
        setJourneys([
            ...journeys, 
            { 
                _tempId: Date.now().toString(), 
                departure_time: '', 
                route_info: '', 
                direction: 'paluu',
                price: priceDifference > 0 ? priceDifference.toFixed(2) : '' // Ehdotetaan suoraan jäljellä olevaa summaa
            }
        ]);
    };

    const handleRemoveJourney = (indexToRemove) => {
        setJourneys(journeys.filter((_, idx) => idx !== indexToRemove));
    };

    // Tallennus (Lähettää kuitin JA matkat eteenpäin hookille)
    const handleSave = () => {
        const updatedReceipt = { 
            ...receipt, 
            total_price: totalPrice,
            // Pidetään legacy-kentät synkassa ensimmäisen matkan kanssa varmuuden vuoksi
            departure_time: journeys[0]?.departure_time || receipt.departure_time,
            route_info: journeys[0]?.route_info || receipt.route_info
        };
        
        onApprove(updatedReceipt, journeys);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', height: '100%', minHeight: '600px' }}>
            
            {/* VASEMMAN PUOLEN LOMAKE & DATA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '1rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--color-text)' }}>
                        {isAlreadyApproved ? 'Muokkaa kuitin matkoja' : 'Vahvista matkakulu'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {isAlreadyApproved 
                            ? 'Voit korjata matkustuspäiviä, hintoja tai reittejä. Muutokset päivittyvät kalenteribudjettiin.' 
                            : 'Tarkista kuitin summa ja jaa se tarvittaessa useammalle kalenterimatkalle.'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* KUITIN LOPPUSUMMA JA LASKIN */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CreditCard size={14}/> Kuitin kokonaishinta (€)
                            </label>
                        </div>
                        <input 
                            type="number" 
                            step="0.01"
                            className="modern-input" 
                            style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: '0.25rem' }}
                            value={totalPrice}
                            onChange={(e) => setTotalPrice(e.target.value)}
                        />
                        
                        {/* Visuaalinen laskin */}
                        <div style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            backgroundColor: isSumMatching ? '#f0fdf4' : '#fef2f2', 
                            padding: '0.75rem', borderRadius: '6px', 
                            border: `1px solid ${isSumMatching ? '#bbf7d0' : '#fecaca'}`, 
                            marginTop: '0.75rem' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isSumMatching ? '#16a34a' : '#ef4444' }}>
                                {isSumMatching ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                                    {isSumMatching ? 'Summat täsmäävät' : `Erotus: ${priceDifference.toFixed(2)} € (Tarkista matkojen hinnat)`}
                                </span>
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: isSumMatching ? '#16a34a' : '#ef4444', fontFamily: 'monospace' }}>
                                {allocatedSum.toFixed(2)} / {Number(totalPrice || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* MATKOJEN LISTAUS (Dynaaminen) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {journeys.map((journey, idx) => (
                            <div key={journey._tempId} style={{ border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '1rem', position: 'relative' }}>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text-secondary)' }}>MATKA {idx + 1}</span>
                                    {journeys.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveJourney(idx)}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                                            title="Poista matka"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <Calendar size={14}/> Matkustuspäivä
                                            </label>
                                            <input 
                                                type="datetime-local" 
                                                className="modern-input" 
                                                value={journey.departure_time ? journey.departure_time.substring(0, 16) : ''}
                                                onChange={(e) => handleUpdateJourney(idx, 'departure_time', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <MapPin size={14}/> Suunta
                                            </label>
                                            <select 
                                                className="modern-select" 
                                                value={journey.direction || 'meno'}
                                                onChange={(e) => handleUpdateJourney(idx, 'direction', e.target.value)}
                                            >
                                                <option value="meno">Menomatka</option>
                                                <option value="paluu">Paluumatka</option>
                                                <option value="paikallis">Paikallisliikenne</option>
                                                <option value="tuntematon">Tuntematon</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label className="text-sm fw-semibold text-primary" style={{ marginBottom: '4px', display: 'block' }}>Reittiselite</label>
                                            <input 
                                                type="text" 
                                                className="modern-input" 
                                                value={journey.route_info}
                                                onChange={(e) => handleUpdateJourney(idx, 'route_info', e.target.value)}
                                                placeholder="Esim. Helsinki - Mikkeli"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <Calculator size={14}/> Hinta (€)
                                            </label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                className="modern-input" 
                                                value={journey.price}
                                                onChange={(e) => handleUpdateJourney(idx, 'price', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <Button variant="secondary" icon={Plus} size="sm" onClick={handleAddJourney} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                            Lisää matka tälle kuitille
                        </Button>
                    </div>
                </div>

                {!receipt.ai_metadata?.isVirtual && (
                    <AIInsightsPanel metadata={receipt.ai_metadata} />
                )}

                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Button variant="success" icon={isAlreadyApproved ? Save : CheckCircle} onClick={handleSave} fullWidth disabled={!isSumMatching}>
                        {isAlreadyApproved ? 'Tallenna muutokset' : 'Hyväksy kuitti kirjanpitoon'}
                    </Button>
                    {!isSumMatching && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', textAlign: 'center', fontWeight: '600' }}>
                            Korjaa matkojen hinnat vastaamaan kuitin loppusummaa ennen tallennusta.
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button variant="secondary" onClick={onCancel} fullWidth>Peruuta</Button>
                        <Button variant="danger" icon={isAlreadyApproved ? Undo : Trash2} onClick={() => onReject(receipt.id)} fullWidth>
                            {isAlreadyApproved ? 'Hylkää ja poista kuitti' : 'Hylkää'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* OIKEAN PUOLEN TOSITE (ESIKATSELU) */}
            <div style={{ backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Alkuperäinen tosite</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                        Saapunut: {receipt.email_received_at ? new Date(receipt.email_received_at).toLocaleDateString() : 'Tuntematon'}
                    </span>
                </div>
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
                    
                    {loadingReceipt ? (
                        <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
                            <Loader2 size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                            <span>Puretaan tositetta...</span>
                        </div>
                    ) : receipt.bucket_file_url ? (
                        <iframe 
                            srcDoc={htmlContent} 
                            sandbox="allow-same-origin allow-popups"
                            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderRadius: '4px' }}
                            title="Tosite"
                        />
                    ) : (
                        <div style={{ margin: 'auto', color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                            {receipt.ai_metadata?.isVirtual 
                                ? "Tämä on manuaalisesti luotu ohitusmerkintä, ei alkuperäistä tositetta." 
                                : "Tositetiedostoa ei voitu ladata."}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default TicketSplitScreen;