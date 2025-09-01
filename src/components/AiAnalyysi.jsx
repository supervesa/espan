import React, { useState } from 'react';

const AiAnalyysi = ({ state, actions }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError('');
        setSuggestions(null);

        try {
            const response = await fetch('/api/analysoi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });

            if (!response.ok) {
                throw new Error(`Palvelinvirhe: ${response.statusText}`);
            }

            const data = await response.json();
            setSuggestions(data.suggestions);

        } catch (err) {
            setError(`Analyysi epäonnistui: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const addSuggestionToActionPlan = (suggestion) => {
        // Lisätään ehdotus Suunnitelma-osioon
        actions.onSelect('suunnitelma', suggestion.avainsana, true);
        // Poistetaan ehdotus näkyvistä, kun se on lisätty
        setSuggestions(prev => ({
            ...prev,
            suunnitelma: prev.suunnitelma.filter(s => s.avainsana !== suggestion.avainsana)
        }));
    };
    
    const addSuggestionToServices = (suggestion) => {
        // Tässä pitäisi olla oma action palveluohjausten lisäämiseksi,
        // mutta käytetään custom-textiä yksinkertaisuuden vuoksi.
        const customText = state['custom-palveluunohjaus'] || '';
        actions.onUpdateCustomText('palveluunohjaus', customText + '\n- ' + suggestion.teksti);
        setSuggestions(prev => ({
            ...prev,
            palveluohjaukset: prev.palveluohjaukset.filter(s => s.avainsana !== suggestion.avainsana)
        }));
    };

    return (
        <section className="section-container ai-container">
            <h2 className="section-title">Vaihe 3: Tekoälyanalyysi</h2>
            <div className="analysis-controls">
                <button onClick={handleAnalyze} disabled={isLoading} className="analysis-button">
                    {isLoading ? 'Analysoidaan...' : 'Analysoi tilanne tekoälyllä'}
                </button>
            </div>

            {error && <p className="error-text">{error}</p>}

            {suggestions && (
                <div className="suggestions-container">
                    <h3>Tekoälyn ehdotukset:</h3>
                    {suggestions.palveluohjaukset.length > 0 && (
                        <div>
                            <h4>Palveluohjaukset:</h4>
                            <ul>
                                {suggestions.palveluohjaukset.map(s => (
                                    <li key={s.avainsana}>
                                        <span>{s.teksti}</span>
                                        <button onClick={() => addSuggestionToServices(s)}>+ Lisää</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {suggestions.suunnitelma.length > 0 && (
                        <div>
                            <h4>Toimenpiteet suunnitelmaan:</h4>
                            <ul>
                                {suggestions.suunnitelma.map(s => (
                                    <li key={s.avainsana}>
                                        <span>{s.teksti}</span>
                                        <button onClick={() => addSuggestionToActionPlan(s)}>+ Lisää</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {suggestions.palveluohjaukset.length === 0 && suggestions.suunnitelma.length === 0 && (
                        <p>Tekoäly ei löytänyt erityisiä ehdotuksia annettujen tietojen perusteella.</p>
                    )}
                </div>
            )}
        </section>
    );
};

export default AiAnalyysi;
