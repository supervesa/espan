// src/components/Scraper.jsx

import React, { useState } from 'react';
// Emme enää tuo mitään paikallisia parsereita (ruleEngine, fingerprint, newScraper)
// Emme myöskään tarvitse deepMerge-funktiota.

const Scraper = ({ onScrape }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const handleGeminiParse = async () => {
        if (!text.trim()) {
            alert("Liitä ensin teksti kenttään.");
            return;
        }
        setIsLoading(true);
        setError('');
        setFeedback('Lähetetään teksti Geminille analysoitavaksi...');

        try {
            // --- AINOA TOIMINTO: KUTSU GEMINIÄ ---
            // Tämä kutsuu nyt uutta, kaikenkattavaa funktiotasi
            const response = await fetch('/.netlify/functions/parseWithGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: text }),
            });

            const aiState = await response.json();
            if (!response.ok) {
                throw new Error(aiState.error || 'Tekoälyn kutsu epäonnistui');
            }
            
            setFeedback('Gemini vastasi, täytetään lomake...');

            // --- LÄHETÄ DATA SUORAAN APP.JS:LLE ---
            // Koska Gemini palauttaa nyt TÄYDELLISEN state-objektin,
            // emme tarvitse mitään yhdistelyä.
            onScrape(aiState); 

            setFeedback('Lomake täytetty onnistuneesti! ✅');
            setTimeout(() => setFeedback(''), 4000);

        } catch (err) {
            setError(err.message);
            setFeedback(''); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="scraper-container section-container">
            <h3>Lue tiedot Oma asiointi -sivulta</h3>
            <p className="scraper-description">Liitä alle olemassa oleva suunnitelma. Tekoäly (Gemini) yrittää täyttää koko lomakkeen automaattisesti.</p>
            <textarea
                className="scraper-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Liitä tähän tekstiä Oma Asiointi -palvelun 'Yhteenveto'-sivulta..."
                rows="10"
            />
            <div className="scraper-buttons">
                <button 
                    onClick={handleGeminiParse} 
                    disabled={isLoading} 
                    className="button-primary"
                >
                    {isLoading ? 'Analysoidaan (Gemini)...' : 'Lue & täytä lomake (Vain AI)'}
                </button>
            </div>
            
            {/* Palaute- ja virheviestit */}
            {isLoading && feedback && <p className="scraper-feedback" style={{ marginTop: '1rem', color: '#666' }}>{feedback}</p>}
            {!isLoading && feedback && <p className="scraper-feedback" style={{ marginTop: '1rem', color: 'green' }}>{feedback}</p>}
            {error && <p className="error-message" style={{ marginTop: '1sem' }}>{error}</p>}
        </section>
    );
};

export default Scraper;