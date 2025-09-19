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
            
            const processPhrase = (phraseObject) => {
                let text = phraseObject.teksti;
                const phraseState = section.monivalinta ? selection?.[phraseObject.avainsana] : selection;
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                        text = text.replace(`[${key}]`, value || '');
                    });
                }
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim();
            };
            
            // --- OSIOKOHTAINEN LOGIIKKA ---
            if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    if (section.id === 'tyonhakuvelvollisuus') {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                        // Lisätään myös mahdolliset alentamisen perustelut
                        if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                             const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([,v]) => v).map(([k]) => k).join(', ');
                             let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                             if (perustelut) alennusTeksti += ` Perusteet: ${perustelut}.`;
                             if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                             text += alennusTeksti;
                        }
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
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
