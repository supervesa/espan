import React, { useState } from 'react';
// Tuo vain YKSI pääfunktio, joka osaa käsitellä kaikkea.
import { parsePlanInput } from '../utils/fingerprintParser'; 
// Tuo promptin luontityökalu
import { processTextForAI } from '../utils/newScraper';

const Scraper = ({ onScrape }) => {
    // Tila alkuperäiselle tekstille
    const [inputText, setInputText] = useState('');
    // Tila tekoälyn JSON-vastaukselle
    const [aiResponseText, setAiResponseText] = useState('');
    // Tila palauteviesteille
    const [feedback, setFeedback] = useState('');

    // --- KÄSITTELIJÄT ---

    // Tämä käsittelee alkuperäisen tekstin (esim. lihavoiduilla otsikoilla)
    const handleParseInitialText = () => {
        if (!inputText.trim()) {
            alert("Liitä ensin alkuperäinen teksti ylempään kenttään.");
            return;
        }
        try {
            const scrapedState = parsePlanInput(inputText);
            onScrape(scrapedState);
        } catch (error) {
            alert(error.message); // Näyttää virheen, esim. "otsikoita ei löytynyt"
        }
    };

    // Tämä luo ja kopioi promptin tekoälylle
    const handleCreateAndCopyPrompt = () => {
        if (!inputText.trim()) {
            setFeedback('Ylempi tekstikenttä on tyhjä!');
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

    // Tämä käsittelee tekoälyn tuottaman JSON-vastauksen
  const handleFillFormWithAIData = () => {
        if (!aiResponseText.trim()) {
            alert("Liitä ensin tekoälyn tuottama JSON-vastaus alempaan kenttään.");
            return;
        }
        try {
            // --- TÄMÄ ON UUSI, TEHOKKAAMPI SIIVOUSVAIHE ---
            
            // 1. Siivotaan teksti kaikista yleisimmistä kopiointivirheistä.
            const cleanedText = aiResponseText
                .replace(/[\u2018\u2019]/g, "'")   // Korvataan kaarevat yksöislainausmerkit suorilla
                .replace(/[\u201C\u201D]/g, '"')   // Korvataan kaarevat KAKSOISLAINAUSMERKIT suorilla (TÄRKEIN!)
                .replace(/\u00A0/g, ' ');         // Korvataan sitovat välilyönnit tavallisilla

            // 2. Käytetään älykästä pääfunktiota siivotulle tekstille.
            const finalStateObject = parsePlanInput(cleanedText);
            onScrape(finalStateObject);

        } catch (error) {
            // Nyt virheilmoitus tulee todennäköisesti vain, jos JSON-rakenne on oikeasti rikki.
            console.error("Virheellinen JSON-muoto tekoälyn vastauksessa:", error);
            alert(error.message); // Näytetään tarkempi virheilmoitus fingerprintParserista
        }
    };

    return (
        <section className="scraper-container">
            {/* --- OSA 1: Alkuperäisen tekstin käsittely --- */}
            <h2 className="scraper-title">1. Lue ja valmistele teksti</h2>
            <p className="scraper-description">Liitä alle olemassa oleva suunnitelma ja valitse toiminto.</p>
            <textarea
                className="scraper-textarea"
                rows="8"
                placeholder="Liitä alkuperäinen teksti tähän..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            <div className="scraper-buttons">
                <button onClick={handleParseInitialText}>Lue teksti ja täytä lomake</button>
                <button onClick={handleCreateAndCopyPrompt}>Luo & kopioi prompti tekoälylle</button>
            </div>
            {feedback && <p className="scraper-feedback" style={{ marginTop: '1rem' }}>{feedback}</p>}

            {/* --- OSA 2: Tekoälyn vastauksen hyödyntäminen --- */}
            <div className="ai-response-container" style={{ marginTop: '2.5rem', borderTop: '1px solid #ccc', paddingTop: '1.5rem' }}>
                <h2 className="scraper-title">2. Täytä lomake tekoälyn avulla</h2>
                <p className="scraper-description">Liitä tekoälyn antama JSON-vastaus alla olevaan kenttään ja paina nappia.</p>
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