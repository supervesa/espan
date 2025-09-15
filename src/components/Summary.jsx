import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const FINGERPRINT = '\u200B\u200D\u200C'; // Näkymätön sormenjälki

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject, sectionId) => {
                let phraseState = section.monivalinta 
                    ? state[sectionId]?.[phraseObject.avainsana] 
                    : state[sectionId];

                // Yksittäisvalinnoissa ja erikoiskomponenteissa käytetään yleistä nimeä "Valinta"
                let key = section.monivalinta ? `Valinta (${phraseObject.avainsana})` : 'Valinta';
                let text = phraseState?.teksti || phraseObject.teksti;

                if (phraseState?.muuttujat && Object.keys(phraseState.muuttujat).length > 0) {
                    const variablesText = Object.entries(phraseState.muuttujat)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                    text = `${text} (${variablesText})`;
                }
                // Poistetaan muuttujat, koska ne on jo lisätty sulkeisiin
                return `${key}: ${text.replace(/\[.*?\]/g, '').trim()}`;
            };

            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                if (s.paavalinta) {
                    if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                        sectionTextParts.push(`Valinta: ${s.paavalinta.teksti}`);
                        sectionTextParts.push(`Kuvaus alentumasta: ${s.alentumaKuvaus}`);
                    } else {
                        sectionTextParts.push(`Valinta: ${s.paavalinta.teksti}`);
                    }
                }
                if (s.omaArvio) sectionTextParts.push(`Oma arvio: ${s.omaArvio}/10`);
                if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                     const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti).join(', ');
                     sectionTextParts.push(`Palveluohjaus: ${ohjaukset}`);
                 }
                if (s.koonti) sectionTextParts.push(`Koonti keskustelusta: ${s.koonti}`);
            } 
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase, section.id)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection, section.id);
                    // Lisätään pitkä lopputeksti työnhakuvelvollisuuteen
                    if (section.id === 'tyonhakuvelvollisuus') {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(`Lisätiedot: ${customText}`);
            }

            if (sectionTextParts.length > 0) {
                textParts.push(`${section.otsikko}\n${sectionTextParts.join('\n')}`);
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
