import React, { useState, useEffect } from 'react';

const PhraseEditModal = ({ phrase, onClose, onSave }) => {
    const [shortTitle, setShortTitle] = useState(phrase.short_title || '');
    const [baseText, setBaseText] = useState(phrase.base_text || '');
    const [detectedVars, setDetectedVars] = useState([]);

    // Tarkkaillaan tekstiä ja etsitään [MUUTTUJIA] reaaliajassa
    useEffect(() => {
        const matches = baseText.match(/\[([A-Z_ÄÖÅ0-9]+)\]/g) || [];
        // Poistetaan tuplakappaleet
        const uniqueVars = [...new Set(matches)];
        setDetectedVars(uniqueVars);
    }, [baseText]);

    const handleSave = () => {
        onSave(phrase.id, {
            short_title: shortTitle,
            base_text: baseText
        });
    };

    return (
        <div className="modal-overlay" style={overlayStyle}>
            <div className="modal-content" style={modalStyle}>
                <h3 style={{ marginTop: 0 }}>Muokkaa fraasia</h3>
                <p className="tag tag--pending" style={{ marginBottom: '1rem', display: 'inline-block' }}>
                    Avainsana: {phrase.phrase_key}
                </p>

                <div style={formGroupStyle}>
                    <label>Lyhyt otsikko (näkyy asiantuntijalle napissa):</label>
                    <input 
                        type="text" 
                        value={shortTitle} 
                        onChange={(e) => setShortTitle(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label>Varsinainen tulostuva teksti:</label>
                    <textarea 
                        rows="5"
                        value={baseText}
                        onChange={(e) => setBaseText(e.target.value)}
                        style={textareaStyle}
                    />
                </div>

                <div className="info-box" style={{ marginBottom: '1.5rem', backgroundColor: 'var(--color-background)' }}>
                    <strong>Havaitut muuttujat tekstissä:</strong>
                    {detectedVars.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {detectedVars.map(v => (
                                <span key={v} className="chip chip--warning">{v}</span>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0 0', color: 'var(--color-text-secondary)' }}>
                            Ei havaittuja muuttujia. Voit lisätä muuttujan kirjoittamalla sen isoilla kirjaimilla hakasulkeisiin, esim. [PÄIVÄMÄÄRÄ].
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn--secondary" onClick={onClose}>Peruuta</button>
                    <button className="btn" onClick={handleSave}>Tallenna muutokset</button>
                </div>
            </div>
        </div>
    );
};

// Yksinkertaiset sisäiset tyylit modaalille (voit myöhemmin siirtää CSS-tiedostoon)
const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
};
const modalStyle = {
    backgroundColor: 'var(--color-surface)', padding: '2rem',
    borderRadius: 'var(--border-radius)', width: '100%', maxWidth: '600px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
};
const formGroupStyle = { marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const inputStyle = { padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', width: '100%' };
const textareaStyle = { ...inputStyle, fontFamily: 'var(--font-sans)', resize: 'vertical' };

export default PhraseEditModal;