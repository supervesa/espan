import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const FINGERPRINT = '\u200B\u200D\u200C'; // Näkymätön sormenjälki

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];

        // Käydään läpi kaikki osiot ja formatoidaan niiden data sujuvaksi tekstiksi
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let contentParts = [];

            // Apufunktio muuttujien korvaamiseen fraasitekstissä
            const processPhrase = (phraseObject) => {
                let text = phraseObject.teksti;
                const phraseState = section.monivalinta ? selection?.[phraseObject.avainsana] : selection;
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                        // Korvataan placeholder vain, jos arvo on olemassa
                        if (value) {
                             text = text.replace(`[${key}]`, value);
                        }
                    });
                }
                // Siistitään jäljelle jääneet placeholderit pois
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim();
            };

            // --- OSIOKOHTAINEN LOGIIKKA ---

            if (selection) {
                 if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => contentParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    if (section.id === 'tyonhakuvelvollisuus') {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                    }
                    contentParts.push(text);
                }
            }
            
            // --- ERIKOISKÄSITTELYT ---

            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                contentParts = []; // Tyhjennetään perusvalinnat ja rakennetaan alusta
                if (s.paavalinta) {
                    if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                        contentParts.push(`Asiakkaalla on työkyvyn alentuma. ${s.alentumaKuvaus}`);
                    } else {
                        contentParts.push(s.paavalinta.teksti);
                    }
                }
                if (s.omaArvio) contentParts.push(`Asiakkaan oma arvio työkyvystään on ${s.omaArvio}/10.`);
                 if (s.koonti) contentParts.push(s.koonti);
            }

            if (section.id === 'palkkatuki' && state.palkkatuki) {
                 // Tulostetaan vain koonti, jos sellainen on
                 const calculatorState = state.palkkatuki;
                 if (calculatorState.koonti) {
                     contentParts = [calculatorState.koonti];
                 }
            }

            // Lisätään vapaa teksti loppuun, jos sitä on
            if (customText) {
                contentParts.push(customText);
            }

            // Jos osiolle kertyi sisältöä, lisätään se tulosteeseen
            if (contentParts.length > 0) {
                textParts.push(`${section.otsikko}\n${contentParts.join(' ')}`);
            }
        });
        
        if (textParts.length === 0) return '';
        return FINGERPRINT + textParts.join('\n\n');

    }, [state]);

    const handleCopy = () => {
        const plainText = summaryText.replace(FINGERPRINT, '');
        navigator.clipboard.writeText(plainText).then(() => {
            setFeedback('Kopioitu!');
            setTimeout(() => setFeedback(''), 2000);
        });
    };
    
    return (
        <aside className="summary-sticky-container">
            <div className="summary-box">
                <h2>Koottu suunnitelma</h2>
                <div className="summary-content">
                    {summaryText ? (
                        summaryText.replace(FINGERPRINT, '').split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex}>
                                {paragraph.split('\n').map((line, lIndex) => {
                                    if (lIndex === 0) {
                                        return <strong key={lIndex}>{line}</strong>;
                                    }
                                    return <React.Fragment key={lIndex}><br />{line}</React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi...</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>Kopioi leikepöydälle</button>
                <p className="feedback-text">{feedback}</p>
            </div>
        </aside>
    );
};
export default Summary;
