// --- src/components/admin/journey/TicketSplitScreen.jsx ---
import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import AIInsightsPanel from './AIInsightsPanel';
import { CheckCircle, Trash2, MapPin, Calendar, CreditCard, Loader2, Save, Undo } from 'lucide-react';

const TicketSplitScreen = ({ receipt, onApprove, onReject, onCancel }) => {
    const [formData, setFormData] = useState({
        departure_time: receipt.departure_time || '',
        route_info: receipt.route_info || '',
        total_price: receipt.total_price || ''
    });

    const [htmlContent, setHtmlContent] = useState('');
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    // Onko tämä uusi kuitti vai vanhan muokkaus?
    const isAlreadyApproved = receipt.status === 'approved';

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

    const handleSave = () => {
        onApprove({ ...receipt, ...formData });
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', height: '100%', minHeight: '600px' }}>
            
            {/* VASEMMAN PUOLEN LOMAKE & DATA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '1rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--color-text)' }}>
                        {isAlreadyApproved ? 'Muokkaa matkan tietoja' : 'Vahvista matkakulu'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {isAlreadyApproved 
                            ? 'Voit korjata matkustuspäivää, hintaa tai reittiä. Muutokset päivittyvät suoraan budjettiin.' 
                            : 'Tarkista tekoälyn poimimat tiedot ja korjaa tarvittaessa ennen hyväksyntää.'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Calendar size={14}/> Matkustuspäivä (Lähtöaika)
                        </label>
                        <input 
                            type="datetime-local" 
                            className="modern-input" 
                            value={formData.departure_time ? formData.departure_time.substring(0, 16) : ''}
                            onChange={(e) => setFormData({...formData, departure_time: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <MapPin size={14}/> Reitti / Selite
                        </label>
                        <input 
                            type="text" 
                            className="modern-input" 
                            value={formData.route_info}
                            onChange={(e) => setFormData({...formData, route_info: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <CreditCard size={14}/> Hinta (€)
                        </label>
                        <input 
                            type="number" 
                            step="0.01"
                            className="modern-input" 
                            style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                            value={formData.total_price}
                            onChange={(e) => setFormData({...formData, total_price: e.target.value})}
                        />
                    </div>
                </div>

                {/* Tekoälypaneeli näytetään vain jos kyseessä ei ole käyttäjän manuaalisesti luoma "0€ ohituskuitti" */}
                {!receipt.ai_metadata?.isVirtual && (
                    <AIInsightsPanel metadata={receipt.ai_metadata} />
                )}

                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Button variant="success" icon={isAlreadyApproved ? Save : CheckCircle} onClick={handleSave} fullWidth>
                        {isAlreadyApproved ? 'Tallenna muutokset' : 'Hyväksy kuitti kirjanpitoon'}
                    </Button>
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