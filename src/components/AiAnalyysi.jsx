import React, { useState } from 'react';

/**
 * Tämä komponentti hakee tekoälyltä ehdotuksen ja välittää sen
 * 'Suunnitelma'-osion lisätietokenttään.
 */
const AiAnalyysi = ({ state, actions }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [error, setError] = useState('');

    // Otetaan 'actions'-objektista tarvitsemamme funktio
    const { onUpdateCustomText } = actions;

    const handleGenerateSuggestion = async () => {
        setIsLoading(true);
        setError('');
        setAiSuggestion('');

        try {
            const response = await fetch('/.netlify/functions/generatePlan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(state), 
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Palvelimella tapahtui virhe');
            }

            if (data.suggestion) {
                const suggestionText = data.suggestion;
                
                // 1. Näytä ehdotus väliaikaisesti myös tässä komponentissa
                setAiSuggestion(suggestionText);

                // --- TÄMÄ KOHTA ON NYT MUUTETTU ---
                // 2. Hae nykyinen teksti 'Suunnitelma'-osion lisätietokentästä
                const currentCustomText = state['custom-suunnitelma'] || '';
                
                // 3. Yhdistä vanha teksti ja uusi ehdotus (ILMAN "AI-EHDOITUS" -TEKSTIÄ)
                const newCustomText = currentCustomText
                    ? `${currentCustomText}\n\n${suggestionText}` // Lisää perään rivinvaihdoilla
                    : suggestionText; // Aseta suoraan, jos kenttä oli tyhjä

                // 4. Kutsu App.js:n actionia ja päivitä 'suunnitelma'-osion kenttä
                onUpdateCustomText('suunnitelma', newCustomText);
                // --- MUUTOS LOPPUU ---

            } else {
                throw new Error('Vastaus ei sisältänyt ehdotusta.');
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="section-container ai-analyysi-section">
            <h2 className="section-title">Tekoälyanalyysi</h2>
            <div className="options-container">
                <p>Hae tekoälyltä ehdotus tärkeimmäksi palveluohjaukseksi. Ehdotus kopioidaan automaattisesti Suunnitelma-osion lisätietokenttään.</p>
                <button 
                    onClick={handleGenerateSuggestion} 
                    disabled={isLoading}
                    className="button-primary"
                >
                    {isLoading ? 'Analysoidaan...' : 'Luo ehdotus'}
                </button>
            </div>

            {error && (
                <div className="error-message" style={{ marginTop: '1rem' }}>
                    <strong>Virhe:</strong> {error}
                </div>
            )}
            
            {/* Päivitin myös tämän kuittauksen:
                - Poistin lainausmerkit.
                - Lisäsin 'whiteSpace: 'pre-wrap'', jotta se näyttää
                  AI:n luomat rivinvaihdot oikein.
            */}
            {aiSuggestion && !isLoading && (
                <div className="ai-response-container" style={{ marginTop: '1rem' }}>
                    <strong>Ehdotus kopioitu suunnitelmaan:</strong>
                    <p 
                        className="ai-suggestion-text" 
                        style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}
                    >
                        {aiSuggestion}
                    </p>
                </div>
            )}
        </section>
    );
};

export default AiAnalyysi;