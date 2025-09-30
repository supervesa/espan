import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus.jsx';

// --- NÄKYMÄTÖN SORMENJÄLKI ---
const FINGERPRINT = '\u200B\u200D\u200C'; // Uniikki yhdistelmä näkymättömiä merkkejä

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
                        if (value || typeof value === 'number') {
                             text = text.replace(`[${key}]`, value);
                        }
                    });
                }
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim();
            };

            // --- OSIOKOHTAINEN LOGIIKKA ---

            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                let combinedText = '';
                if (s.paavalinta) {
                    if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                        combinedText += `Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}.`;
                    } else {
                        combinedText += s.paavalinta.teksti;
                    }
                }
                if (s.omaArvio) combinedText += ` Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10.`;
                if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                     const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti).join(', ');
                     combinedText += ` Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}.`;
                 }
                if (s.koonti) combinedText += `\nKoonti keskustelusta: ${s.koonti}`;
                if (combinedText) sectionTextParts.push(combinedText);
            } 
            else if (section.id === 'palkkatuki' && state.palkkatuki?.analyysi) {
                const { conditionsMet, ehdotus } = state.palkkatuki.analyysi;
                let text = `Asiakas täyttää useita palkkatuen kriteerejä`;
                if(conditionsMet.length > 0) {
                    text += `, kuten ${conditionsMet.join(', ')}.`;
                } else {
                    text += '.';
                }
                text += ` Näiden perusteella suositellaan seuraavaa: ${ehdotus}`;
                sectionTextParts.push(text);
            }
            else if (section.id === 'tyonhakuvelvollisuus' && selection) {
                let baseText = processPhrase(selection);
                
                if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                    const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([,v]) => v).map(([k]) => k);
                    let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                    if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                    if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                    baseText += alennusTeksti;
                }
                
                // Lisätään lopputeksti vain, jos se ei ole jo osa fraasia
                if (!baseText.includes("Haetut paikat")) {
                    // Tämä tarkistus on nyt tarpeeton, koska lopputeksti on osa fraasia
                    // baseText += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI; 
                }
                sectionTextParts.push(baseText);
            }
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    sectionTextParts.push(processPhrase(selection));
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
            
            <AikatauluEhdotus state={state} />
        </aside>
    );
};
export default Summary;

