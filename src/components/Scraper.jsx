import React, { useState } from 'react';
import { parseWithBoldHeadings } from '../utils/fingerprintParser';
import { parseWithRuleEngine } from '../utils/ruleEngineParser';

const Scraper = ({ onScrape }) => {
    const [inputText, setInputText] = useState('');

    const handleParseBold = () => {
        if (!inputText) return;
        const scrapedState = parseWithBoldHeadings(inputText);
        onScrape(scrapedState);
    };
    
    const handleParseWild = () => {
        if (!inputText) return;
        const scrapedState = parseWithRuleEngine(inputText);
        onScrape(scrapedState);
    };

    return (
        <section className="scraper-container">
            <h2 className="scraper-title">Tekstin esitäyttötyökalu (Scraper)</h2>
            <p className="scraper-description">Liitä alle olemassa oleva suunnitelma tai muu teksti, ja valitse oikea työkalu sen lukemiseen.</p>
            <textarea
                className="scraper-textarea"
                rows="8"
                placeholder="Liitä teksti tähän..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            <div className="scraper-buttons">
                <button className="scraper-button-fingerprint" onClick={handleParseBold}>
                    Lue sovelluksen luoma teksti (lihavoidut otsikot)
                </button>
                <button className="scraper-button-wild" onClick={handleParseWild}>
                    Yritä tulkita muu teksti (Sääntömoottori)
                </button>
                 <button className="scraper-button-ai" disabled>
                    Käytä tekoälyä (tulossa pian)
                </button>
            </div>
        </section>
    );
};

export default Scraper;