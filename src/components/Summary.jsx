import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject) => {
                let phraseText = phraseObject.teksti;
                const phraseState = section.monivalinta ? state[section.id]?.[phraseObject.avainsana] : state[section.id];
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                         phraseText = phraseText.replace(`[${key}]`, value || `[${key}]`);
                    });
                }
                return phraseText;
            };

            // Erikoiskomponenttien käsittely
            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                if (s.paavalinta) {
                    if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                        sectionTextParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`);
                    } else {
                        sectionTextParts.push(s.paavalinta.teksti);
                    }
                }
                if (s.omaArvio) sectionTextParts.push(`Asiakkaan oma arvio työkyvystään: ${s.omaArvio}/10.`);
                if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                     const ohjaukset = Object.values(s.palveluohjaukset).map(p => `- ${p.teksti}`).join('\n');
                     sectionTextParts.push(`Palveluohjaus:\n${ohjaukset}`);
                 }
                if (s.koonti) sectionTextParts.push(`Koonti työkykykeskustelusta:\n${s.koonti}`);
            } 
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    // Lisätään pitkä lopputeksti vain, jos se ei ole jo osa fraasia
                    if (section.id === 'tyonhakuvelvollisuus' && !text.includes("Haetut paikat")) {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
            }

            if (sectionTextParts.length > 0) {
                textParts.push(`**${section.otsikko}**\n${sectionTextParts.join('\n')}`);
            }
        });
        return textParts.join('\n\n');
    }, [state]);

    const handleCopy = () => {
        const plainText = summaryText.replace(/\*\*/g, '');
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
                        summaryText.split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex}>
                                {paragraph.split('\n').map((line, lIndex) => {
                                    if (lIndex === 0 && line.startsWith('**') && line.endsWith('**')) {
                                        return <strong key={lIndex}>{line.replace(/\*\*/g, '')}</strong>;
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
