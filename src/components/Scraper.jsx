import React, { useState } from 'react';
import { planData } from '../data/planData';

// --- VAKIOT JA APUFUNKTIOT ---

const DATE_REGEX = /(\d{1,2}\.\d{1,2}\.\d{4})/; // Tunnistaa esim. 2.9.2021
const YEAR_REGEX = /\b(19|20)\d{2}\b/;          // Tunnistaa esim. 2016

const getTodayDate = () => new Date().toLocaleDateString('fi-FI');

/**
 * Puhdistaa tekstistä fraasin staattisen osan vertailua varten.
 * Esim: "Asiakkaan työnhaku on alkanut [PÄIVÄMÄÄRÄ]." -> "Asiakkaan työnhaku on alkanut"
 */
const getPhraseBase = (text) => {
    return text.split('[')[0].trim().replace(/\.$/, '');
};

/**
 * Puhdistaa "syödyn" tekstin jämät (esim. alussa olevat pilkut tai pisteet).
 */
const cleanRemainder = (text) => {
    // Poistetaan alusta välimerkit (, . -) ja tyhjät, sekä lopusta turhat
    return text
        .replace(/^[\s,.\-]+/, '') // Poista alusta roskat
        .replace(/\s+/g, ' ')      // Normalisoi välilyönnit
        .trim();
};

/**
 * PÄÄLOGIIKKA: SYÖVÄ JÄSENNIN
 */
const parseConsuming = (rawText) => {
    const state = {};
    
    // 1. LOHKOMINEN: Jaetaan teksti lohkoihin tyhjien rivien perusteella
    // Tämä pitää kappaleet (kuten Työtilanne-kuvauksen) yhtenäisinä.
    const blocks = rawText.split(/\n\s*\n/).filter(b => b.trim().length > 0);

    // Luodaan kartta otsikoille tunnistusta varten
    const sectionMap = planData.aihealueet.map(s => ({
        id: s.id,
        header: s.otsikko.toLowerCase(),
        data: s
    }));

    // Käsitellään jokainen lohko
    blocks.forEach(originalBlock => {
        let blockContent = originalBlock; // Tätä muuttujaa "syödään"
        let matchedSection = null;

        // 2. OSION TUNNISTUS (Sumea haku)
        // Katsotaan, löytyykö minkään osion otsikko tästä lohkosta
        const firstLine = blockContent.split('\n')[0].toLowerCase();
        
        matchedSection = sectionMap.find(s => 
            firstLine.includes(s.header) || blockContent.toLowerCase().includes(s.header)
        );

        // Jos osiota ei tunnisteta, lohko on "orpo". 
        // Tässä versiossa ohitamme orvot lohkot, tai ne voisi laittaa yleisiin lisätietoihin.
        if (!matchedSection) return;

        const sectionConfig = matchedSection.data;
        
        // Alustetaan state tälle osiolle
        if (sectionConfig.monivalinta && !state[sectionConfig.id]) {
            state[sectionConfig.id] = {};
        }

        // Poistetaan otsikko tekstistä, jotta se ei sotke fraasien etsintää
        // (Yksinkertainen tapa: poistetaan otsikkoteksti case-insensitive)
        const headerRegex = new RegExp(matchedSection.header, 'i');
        blockContent = blockContent.replace(headerRegex, '');

        // 3. FRAASIEN SYÖMINEN (Consuming Loop)
        if (sectionConfig.fraasit) {
            sectionConfig.fraasit.forEach(phrase => {
                const phraseBase = getPhraseBase(phrase.teksti);
                // Etsitään fraasin kantaosa tekstistä (case-insensitive voisi olla hyvä, mutta pidetään tarkkana varmuuden vuoksi)
                const phraseIndex = blockContent.indexOf(phraseBase);

                if (phraseIndex !== -1) {
                    // --- OSUMA LÖYTYY ---
                    
                    // Valmistellaan tallennettava objekti
                    const selectionObj = {
                        avainsana: phrase.avainsana,
                        teksti: phrase.teksti,
                        muuttujat: {}
                    };

                    // PÄIVÄMÄÄRÄLOGIIKKA (Historical vs. Current)
                    let textToRemove = phraseBase; // Oletuksena poistetaan vain fraasi

                    // A) Työnhaun alku (HISTORIALLINEN FAKTA)
                    if (phrase.avainsana === 'tyonhaku_alkanut') {
                        // Katsotaan fraasin perään: onko siellä päivämäärä?
                        const textAfter = blockContent.substring(phraseIndex + phraseBase.length);
                        const dateMatch = textAfter.match(DATE_REGEX);
                        
                        if (dateMatch) {
                            selectionObj.muuttujat['PÄIVÄMÄÄRÄ'] = dateMatch[0]; // Otetaan 24.9.2025
                            textToRemove += textAfter.substring(0, dateMatch.index + dateMatch[0].length); // Poistetaan myös pvm
                        } else {
                            // Fallback: Jos ei löydy, käytä oletusta (tänään)
                            selectionObj.muuttujat['PÄIVÄMÄÄRÄ'] = getTodayDate();
                        }
                    }
                    // B) Laatimispäivä (NYKYHETKEN PAKOTUS)
                    else if (phrase.avainsana === 'laadittu') {
                        // Asetetaan AINA tämä päivä
                        selectionObj.muuttujat['PÄIVÄMÄÄRÄ'] = getTodayDate();
                        
                        // Mutta yritetään silti "syödä" vanha päivämäärä tekstistä pois, ettei se jää kummittelemaan
                        const textAfter = blockContent.substring(phraseIndex + phraseBase.length);
                        const dateMatch = textAfter.match(DATE_REGEX);
                        if (dateMatch) {
                             textToRemove += textAfter.substring(0, dateMatch.index + dateMatch[0].length);
                        }
                        // Lisäksi, jos kyseessä on laatimistapa (puhelin/käynti), yritetään tunnistaa se
                         if (phrase.muuttujat?.YHTEYDENOTTOTAPA) {
                            if (blockContent.includes('puhelin')) selectionObj.muuttujat['YHTEYDENOTTOTAPA'] = 'puhelinajalla';
                            if (blockContent.includes('käynti')) selectionObj.muuttujat['YHTEYDENOTTOTAPA'] = 'käyntiajalla';
                        }
                    }
                    // C) Syntymävuosi (HISTORIALLINEN)
                    else if (phrase.avainsana === 'syntymavuosi') {
                         const textAfter = blockContent.substring(phraseIndex + phraseBase.length);
                         const yearMatch = textAfter.match(YEAR_REGEX);
                         if (yearMatch) {
                             selectionObj.muuttujat['SYNTYMÄVUOSI'] = yearMatch[0];
                             textToRemove += textAfter.substring(0, yearMatch.index + yearMatch[0].length);
                         }
                    }
                    // D) Koulutus (Muuttujan poiminta)
                    else if (phrase.avainsana === 'koulutus_tausta') {
                        // Tämä on vaikeampi ilman AI:ta. Yritetään arvata, että lause jatkuu pisteeseen asti.
                        // "Asiakas on koulutukseltaan [TUTKINTO] (v. [VUOSI])."
                        // Yksinkertaistus: Ei yritetä parsia tutkintoa raakatekstistä automaattisesti väärin,
                        // vaan annetaan käyttäjän täyttää se, mutta merkitään valinta.
                        // Koulutus-komponentin "Opintopolku-leikkuri" hoitaa tarkemman poiminnan.
                    }

                    // TALLENNETAAN VALINTA
                    if (sectionConfig.monivalinta) {
                        state[sectionConfig.id][phrase.avainsana] = selectionObj;
                    } else {
                        state[sectionConfig.id] = selectionObj;
                    }

                    // POISTETAAN LÖYDETTY TEKSTI LOHKOSTA
                    // Korvataan löydetty kohta tyhjällä.
                    // Huom: replace poistaa vain ensimmäisen esiintymän, mikä on oikein.
                    blockContent = blockContent.replace(textToRemove, '');
                }
            });
        }

        // 4. JÄÄNNÖKSEN KÄSITTELY (The Remainder)
        // Kaikki mitä lohkossa on jäljellä, on "lisätietoa" tai "tuntematonta".
        // Siivotaan se ja tallennetaan.
        const remainder = cleanRemainder(blockContent);
        
        if (remainder) {
            const customKey = `custom-${sectionConfig.id}`;
            const prev = state[customKey] || '';
            // Yhdistetään nätisti
            state[customKey] = prev ? `${prev}\n${remainder}` : remainder;
        }
    });

    return state;
};

// --- KOMPONENTTI ---

const Scraper = ({ onImport }) => {
    const [inputText, setInputText] = useState('');
    const [feedback, setFeedback] = useState(null);

    const handleScrape = () => {
        setFeedback(null);
        if (!inputText.trim()) {
            setFeedback({ type: 'error', msg: 'Liitä ensin tekstiä laatikkoon.' });
            return;
        }

        try {
            const parsedState = parseConsuming(inputText);
            const sectionCount = Object.keys(parsedState).filter(k => !k.startsWith('custom-')).length;

            if (sectionCount === 0) {
                 setFeedback({ type: 'error', msg: 'Yhtään osiota ei tunnistettu. Varmista, että tekstissä on otsikot (esim. "Suunnitelman perustiedot").' });
                 return;
            }

            // Lähetetään App.jsx:lle
            if (onImport) {
                onImport(parsedState);
            }
            
            setFeedback({ type: 'success', msg: `Jäsennys onnistui! Tunnistettiin ${sectionCount} osiota ja poimittiin lisätiedot talteen.` });
            
        } catch (err) {
            console.error(err);
            setFeedback({ type: 'error', msg: 'Jotain meni pieleen jäsennyksessä.' });
        }
    };

    return (
        <div className="scraper-container section-container">
            <h3 className="section-title">Tuo suunnitelma tekstinä</h3>
            
            <div className="scraper-info-box">
                <p><strong>Ohje:</strong> Liitä tähän vanha suunnitelma tai muistiinpanot.</p>
                <ul style={{fontSize: '0.9rem', marginTop: '5px', paddingLeft: '20px'}}>
                    <li>Jäsennin tunnistaa osiot otsikoiden perusteella (esim. "Asiakkaan työtilanne").</li>
                    <li>Työnhaun alkamispäivä säilytetään alkuperäisenä.</li>
                    <li>Laatimispäivä päivitetään tähän päivään.</li>
                    <li>Tuntemattomat lauseet siirretään automaattisesti lisätietoihin.</li>
                </ul>
            </div>

            <textarea
                className="scraper-textarea"
                rows="8"
                placeholder="Liitä teksti tähän (esim. kopioi Työmarkkinatorilta)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            
            <div className="scraper-actions">
                <button onClick={handleScrape} className="btn">
                    Täytä lomake tekstin perusteella
                </button>
                
                {feedback && (
                    <span className={`scraper-status ${feedback.type === 'error' ? 'status-error' : 'status-success'}`}>
                        {feedback.msg}
                    </span>
                )}
            </div>
        </div>
    );
};

export default Scraper;