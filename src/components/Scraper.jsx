import React, { useState } from 'react';
import { planData } from '../data/planData';

// --- APUFUNKTIOT ---

const getTodayDate = () => new Date().toLocaleDateString('fi-FI');

// Siivoaa rivin vertailua varten (poistaa Markdown-merkit ja ylimääräiset välilyönnit)
const cleanLine = (text) => {
    if (!text) return '';
    return text
        .replace(/\*\*/g, '')   // Poista lihavoinnit
        .replace(/^#+\s*/, '')  // Poista Markdown otsikot (#)
        .replace(/:$/, '')      // Poista lopun kaksoispiste
        .trim();                // Poista tyhjät alusta ja lopusta
};

// Erottelee fraasin staattisen osan (esim. "Asiakas on [AMMATTI]" -> "Asiakas on")
const getPhraseBase = (text) => {
    return text.split('[')[0].trim();
};

/**
 * PÄÄJÄSENNIN
 * Lukee tekstin rivi riviltä ja vertaa sitä planDataan.
 */
const parsePlanText = (rawText) => {
    const state = {};
    const lines = rawText.split('\n');
    let currentSection = null;

    // Luodaan hakukartta otsikoille nopeaa vertailua varten
    // Map: "siivottu otsikko" -> sectionObject
    const sectionMap = new Map();
    planData.aihealueet.forEach(section => {
        sectionMap.set(cleanLine(section.otsikko).toLowerCase(), section);
    });

    lines.forEach(line => {
        const cleanedLine = cleanLine(line);
        if (!cleanedLine) return; // Ohitetaan tyhjät rivit

        // --- 1. TARKISTUS: ONKO RIVI OTSIKKO? ---
        const potentialSection = sectionMap.get(cleanedLine.toLowerCase());
        
        if (potentialSection) {
            currentSection = potentialSection;
            // Alustetaan osio valmiiksi stateen, jos sitä ei ole
            if (potentialSection.monivalinta && !state[currentSection.id]) {
                state[currentSection.id] = {};
            }
            return; // Siirrytään seuraavaan riviin, koska tämä oli otsikko
        }

        // Jos emme ole minkään otsikon alla, rivi on "orpo" -> ohitetaan tai laitetaan yleiseen (tässä ohitetaan)
        if (!currentSection) return;

        // --- 2. TARKISTUS: ONKO RIVI TUNNETTU FRAASI? ---
        let matchFound = false;

        if (currentSection.fraasit) {
            // Etsitään fraasi, jonka alku täsmää riviin
            const matchedPhrase = currentSection.fraasit.find(f => {
                const phraseBase = getPhraseBase(f.teksti);
                // Verrataan vain alkua, jotta muuttujat (esim. tutkinnon nimi) eivät riko tunnistusta
                return cleanedLine.startsWith(cleanLine(phraseBase));
            });

            if (matchedPhrase) {
                // Luodaan valintaobjekti
                const selectionObj = {
                    avainsana: matchedPhrase.avainsana,
                    teksti: matchedPhrase.teksti,
                    muuttujat: {}
                };

                // --- PAKOTUS: PÄIVÄMÄÄRÄT ---
                // Jos fraasi on laadittu tai työnhaun alku, pakotetaan TÄMÄ PÄIVÄ
                const needsDateForce = matchedPhrase.avainsana === 'laadittu' || matchedPhrase.avainsana === 'tyonhaku_alkanut';
                
                if (matchedPhrase.muuttujat) {
                    Object.keys(matchedPhrase.muuttujat).forEach(key => {
                        if (key === 'PÄIVÄMÄÄRÄ' && needsDateForce) {
                            selectionObj.muuttujat[key] = getTodayDate();
                        } else {
                            // Tässä yksinkertainen jäsennin käyttää oletusarvoa, 
                            // koska emme käytä AI:ta poimimaan tekstistä arvoa.
                            // (Käyttäjä voi muokata arvoa käyttöliittymässä myöhemmin)
                            selectionObj.muuttujat[key] = matchedPhrase.muuttujat[key].oletus || '';
                        }
                    });
                }

                // Tallennetaan stateen osion tyypin mukaan
                if (currentSection.monivalinta) {
                    // Varmistetaan että objekti on olemassa (vaikka se alustettiin otsikossa, varmistus on hyvä)
                    if (!state[currentSection.id]) state[currentSection.id] = {};
                    state[currentSection.id][matchedPhrase.avainsana] = selectionObj;
                } else {
                    state[currentSection.id] = selectionObj;
                }
                
                matchFound = true;
            }
        }

        // --- 3. ÄMPÄRI: TUNTEMATON SISÄLTÖ ---
        // Jos rivi ei ollut otsikko eikä fraasi, se menee Lisätiedot-kenttään
        if (!matchFound) {
            const customKey = `custom-${currentSection.id}`;
            const previousText = state[customKey] || '';
            // Lisätään rivinvaihto vain jos siellä on jo tekstiä
            state[customKey] = previousText ? `${previousText}\n${line.trim()}` : line.trim();
        }
    });

    return state;
};

// --- KOMPONENTTI ---

const Scraper = ({ onImport }) => {
    const [inputText, setInputText] = useState('');
    const [status, setStatus] = useState('');

    const handleScrape = () => {
        if (!inputText.trim()) {
            setStatus('Liitä ensin tekstiä.');
            return;
        }

        try {
            const parsedState = parsePlanText(inputText);
            
            console.log("Jäsennetty tila:", parsedState); // Debug
            
            if (Object.keys(parsedState).length === 0) {
                setStatus('Yhtään osiota ei tunnistettu. Tarkista otsikot.');
                return;
            }

            // Lähetetään tulos ylöspäin (esim. App.jsx:ään)
            if (onImport) {
                onImport(parsedState);
            }
            
            setStatus(`Jäsennys onnistui! Tunnistettiin ${Object.keys(parsedState).filter(k => !k.startsWith('custom-')).length} osiota.`);
        } catch (error) {
            console.error(error);
            setStatus('Virhe jäsennyksessä.');
        }
    };

    return (
        <div className="scraper-container section-container">
            <h3 className="section-title">Tuo vanha suunnitelma tekstinä</h3>
            <p className="scraper-instructions">
                Liitä tähän tekstiä. Jäsennin etsii otsikoita (esim. "Suunnitelman perustiedot") 
                ja valitsee niiden alta tunnistetut kohdat. Tuntemattomat rivit siirretään lisätietoihin.
            </p>
            
            <textarea
                className="scraper-textarea"
                rows="6"
                placeholder="Liitä teksti tähän..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ width: '100%', marginBottom: '10px', padding: '10px' }}
            />
            
            <div className="scraper-actions">
                <button onClick={handleScrape} className="btn">
                    Jäsennä ja täytä
                </button>
                {status && <span className="scraper-status" style={{ marginLeft: '15px', fontWeight: 'bold' }}>{status}</span>}
            </div>
        </div>
    );
};

export default Scraper;