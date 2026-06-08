// --- src/components/sections/Tyotilanne/UraAnalyzer/Step1Input.jsx ---
import React, { useRef } from 'react';
import { Eye, ShieldAlert, ShieldCheck, FileText } from 'lucide-react';

// UUSI IMPORT POLKU
import { COMPANY_PATTERN, SCHOOL_PATTERN, HETU_PATTERN, SINGLE_DATE_PATTERN } from '../../../../utils/regex';

const Step1Input = ({ rawData, setRawData, hasRisks, onAutoAnonymize, isAnalyzing }) => {
    const textareaRef = useRef(null);

    // Siirsin tämän tähän sisälle, koska tämä komponentti tarvitsee vain tämän visuaalisen funktion
    const getHighlightedAnonymizationHTML = (text) => {
        if (!text) return '<span style="color: var(--color-text-muted); font-style: italic;">Liitä teksti alla olevaan kenttään nähdäksesi esikatselun...</span>';
        let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const greenStyle = 'background-color: #d1fae5; color: #065f46; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px solid #34d399; font-size: 0.85em; margin: 0 2px;';
        const redStyle = 'background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #f87171; font-size: 0.85em; margin: 0 2px; cursor: help;';
        const warningStyle = 'background-color: #fffbeb; color: #b45309; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #fbbf24; font-size: 0.85em; margin: 0 2px; cursor: help;';

        html = html.replace(/(\[ORGANISAATIO\]|\[OPPILAITOS\]|\[HETU\]|\[PVM: \d{2}\/\d{4}\])/g, `<span style="${greenStyle}">$1</span>`);
        html = html.replace(COMPANY_PATTERN, `<span style="${redStyle}">$&</span>`);
        html = html.replace(SCHOOL_PATTERN, `<span style="${redStyle}">$&</span>`);
        html = html.replace(HETU_PATTERN, `<span style="${redStyle}">$&</span>`);
        html = html.replace(SINGLE_DATE_PATTERN, `<span style="${warningStyle}" title="Päivämäärä yksinkertaistetaan muotoon KK/VVVV">$&</span>`);

        return html.replace(/\n/g, '<br />');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Liitä asiakkaan URA-historia alle. Tietosuoja turvataan ja tarkat päivämäärät yksinkertaistetaan automaattisesti tekoälyä varten.
            </p>

            <div 
                className="card-inner-sm" 
                style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'text' }}
                onClick={() => textareaRef.current && textareaRef.current.focus()}
                title="Klikkaa muokataksesi (Siirtää kursorin alempaan kenttään)"
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    <label className="icon-label text-primary" style={{ margin: 0 }}>
                        <Eye size={16} /> Koneen lukema esikatselu
                    </label>
                    {hasRisks ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                            <ShieldAlert size={16} /> Data vaatii siistimistä
                        </span>
                    ) : rawData.length > 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                            <ShieldCheck size={16} /> Teksti on puhdas
                        </span>
                    ) : null}
                </div>
                
                <div 
                    style={{ 
                        minHeight: '80px', maxHeight: '200px', overflowY: 'auto', 
                        fontFamily: 'monospace', fontSize: '0.9rem', 
                        lineHeight: '1.6', color: '#334155'
                    }}
                    dangerouslySetInnerHTML={{ __html: getHighlightedAnonymizationHTML(rawData) }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-0.5rem 0' }}>
                <button 
                    className={`btn ${hasRisks ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={onAutoAnonymize}
                    disabled={!hasRisks}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        borderRadius: '999px', padding: '0.5rem 1.5rem',
                        boxShadow: hasRisks ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    {hasRisks ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                    Siisti tiedot automaattisesti
                </button>
            </div>

            <div>
                <label className="icon-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span><FileText size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.4rem' }}/> Muokattava tekstikenttä</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Voit muokata tekstiä vapaasti käsin</span>
                </label>
                <textarea 
                    ref={textareaRef}
                    className="form-input text-mono" 
                    rows="10" 
                    value={rawData} 
                    onChange={(e) => setRawData(e.target.value)} 
                    disabled={isAnalyzing}
                    placeholder="Liitä URA-historia tänne..."
                />
            </div>
        </div>
    );
};

export default Step1Input;