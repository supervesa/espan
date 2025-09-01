import React, { useState } from 'react';
import { parseTextToState } from '../utils/scraper';

const Scraper = ({ onScrape }) => {
    const [inputText, setInputText] = useState('');

    const handleParse = () => {
        if (!inputText) return;
        const scrapedState = parseTextToState(inputText);
        onScrape(scrapedState);
    };

    return (
        <section className="scraper-container">
            <h2 className="scraper-title">Tekstin esitäyttötyökalu (Scraper)</h2>
            <p className="scraper-description">Liitä alle olemassa oleva suunnitelma tai muu teksti, ja yritä täyttää lomake automaattisesti sen pohjalta.</p>
            <textarea
                className="scraper-textarea"
                rows="8"
                placeholder="Liitä teksti tähän..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            <div className="scraper-buttons">
                <button className="scraper-button-parse" onClick={handleParse}>
                    Täytä lomake tekstistä
                </button>
                <button className="scraper-button-ai" disabled>
                    Käytä tekoälyä (tulossa pian)
                </button>
            </div>
        </section>
    );
};

export default Scraper;
