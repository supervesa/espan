// src/components/Jalkimarkkinointi.jsx
import React, { useState } from 'react';

// Tämä komponentti saa propsina KOKO staten
const Jalkimarkkinointi = ({ state }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [emailBody, setEmailBody] = useState('');
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    // Haetaan asiakkaan sähköposti suoraan statesta
    const customerEmail = state?.perustiedot?.sahkoposti || '';

    const handleGenerateFollowup = async () => {
        setIsLoading(true);
        setError('');
        setCopySuccess('');
        setEmailBody('');

        try {
            // Kutsutaan juuri luomaamme funktiota
            const response = await fetch('/.netlify/functions/generateFollowup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerState: state }), // Lähetä koko state
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Pyyntö epäonnistui');
            }
            setEmailBody(data.followupEmail);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (!emailBody) return;
        navigator.clipboard.writeText(emailBody).then(() => {
            setCopySuccess('Sähköposti kopioitu leikepöydälle! ✅');
            setTimeout(() => setCopySuccess(''), 3000);
        });
    };

    const handleMailto = () => {
        if (!emailBody) return;
        const subject = encodeURIComponent("Kiitos tapaamisesta! (Helsingin työllisyyspalvelut)");
        const body = encodeURIComponent(emailBody);
        window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
    };

    return (
        <section className="section-container ai-analyysi-section">
            <h2 className="section-title">Asiakkaan yhteenveto (Jälkimarkkinointi)</h2>
            <div className="options-container">
                <p>Luo tekoälyn avulla asiakkaalle ystävällinen yhteenvetoviesti ja ehdota hyödyllisiä lisäresursseja tapaamisen perusteella.</p>
                <button 
                    onClick={handleGenerateFollowup} 
                    disabled={isLoading}
                    className="button-primary"
                >
                    {isLoading ? 'Luodaan yhteenvetoa...' : 'Luo sähköpostiyhteenveto (AI)'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            
            {emailBody && (
                <div className="esikatselu-container" style={{ marginTop: '1.5rem' }}>
                    <h3>Luotu sähköpostiviesti:</h3>
                    <textarea 
                        value={emailBody} 
                        readOnly // Tai poista readOnly, jos haluat muokata
                        rows="15"
                        style={{ backgroundColor: '#f9f9f9', width: '100%', whiteSpace: 'pre-wrap' }}
                    />
                    <div className="button-container">
                         <button onClick={handleCopy}>Kopioi viesti</button>
                         <button onClick={handleMailto} className="secondary-button" disabled={!customerEmail}>
                            Avaa sähköpostissa
                         </button>
                    </div>
                    {copySuccess && <p className="copy-success-message">{copySuccess}</p>}
                </div>
            )}
        </section>
    );
};

export default Jalkimarkkinointi;