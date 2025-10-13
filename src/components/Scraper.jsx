import React, { useState } from 'react';
// TUO VAIN YKSI, OIKEA FUNKTIO
import { parsePlanInput } from '../utils/fingerprintParser'; 
// Uusi putki, joka luo promptin tekoälylle
import { processTextForAI } from '../utils/newScraper';

const Scraper = ({ onScrape }) => {
    const [inputText, setInputText] = useState('');
    const [feedback, setFeedback] = useState('');
    const [aiResponseText, setAiResponseText] = useState('');

    const handleParseText = () => {
        if (!inputText) return;
        try {
            // Tämä nappi käsittelee kaikenlaisen tekstisyötteen
            const scrapedState = parsePlanInput(inputText);
            if (Object.keys(scrapedState).length === 0) {
                 alert("Virhe: Tekstistä ei löytynyt tunnistettavaa sisältöä. Tarkista tekstin muotoilu.");
                 return;
            }
            onScrape(scrapedState);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleAnonymizeForAI = () => {
        if (!inputText.trim()) {
            setFeedback('Tekstikenttä on tyhjä!');
            setTimeout(() => setFeedback(''), 3000);
            return;
        }
        try {
            const finalPrompt = processTextForAI(inputText);
            navigator.clipboard.writeText(finalPrompt);
            setFeedback('Anonymisoitu prompti kopioitu leikepöydälle! ✅');
            setTimeout(() => setFeedback(''), 4000);
        } catch (error) {
            console.error("Virhe promptin luomisessa:", error);
            setFeedback('Jotain meni pieleen. Tarkista konsoli.');
        }
    };

    const handleFillFormWithAIData = () => {
        if (!aiResponseText.trim()) {
            alert("Liitä ensin tekoälyn tuottama JSON-vastaus tekstikenttään.");
            return;
        }
        try {
            // Käytetään samaa älykästä pääfunktiota, joka osaa käsitellä JSON-merkkijonon
            const finalStateObject = parsePlanInput(aiResponseText);
            onScrape(finalStateObject);
        } catch (error) {
            console.error("Virheellinen JSON-muoto tekoälyn vastauksessa:", error);
            alert("Virheellinen JSON-muoto. Varmista, että kopioit koko tekoälyn vastauksen oikein.");
        }
    };

    return (
        <section className="scraper-container">
            <h2 className="scraper-title">1. Lue ja valmistele teksti</h2>
            <p className="scraper-description">Liitä alle olemassa oleva suunnitelma tai muu teksti.</p>
            <textarea
                className="scraper-textarea"
                rows="8"
                placeholder="Liitä alkuperäinen teksti tähän..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            <div className="scraper-buttons">
                <button className="scraper-button-fingerprint" onClick={handleParseText}>Lue teksti</button>
                <button className="scraper-button-ai" onClick={handleAnonymizeForAI}>Luo & kopioi prompti tekoälylle</button>
            </div>
            {feedback && <p className="scraper-feedback" style={{ marginTop: '1rem' }}>{feedback}</p>}

            <div className="ai-response-container" style={{ marginTop: '2.5rem', borderTop: '1px solid #ccc', paddingTop: '1.5rem' }}>
                <h2 className="scraper-title">2. Täytä lomake tekoälyn avulla</h2>
                <p className="scraper-description">Liitä tekoälyn antama JSON-vastaus alla olevaan kenttään ja paina nappia täyttääksesi suunnitelman.</p>
                <textarea
                    className="scraper-textarea"
                    rows="10"
                    placeholder="Liitä tekoälyn tuottama JSON-vastaus tähän..."
                    value={aiResponseText}
                    onChange={(e) => setAiResponseText(e.target.value)}
                />
                <div className="scraper-buttons">
                    <button className="scraper-button-fill" onClick={handleFillFormWithAIData}>
                        Täytä lomake tekoälyn datalla
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Scraper;