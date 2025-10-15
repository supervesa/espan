import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';

const FINGERPRINT = '\u200B\u200D\u200C';

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject) => {
                let text = phraseObject?.teksti || '';
                const phraseState = section.monivalinta ? selection?.[phraseObject.avainsana] : selection;
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                        if (value || typeof value === 'number') {
                             text = text.replace(`[${key}]`, value);
                        }
                    });
                }
                // Poistetaan lopusta piste, jotta lauseiden yhdistäminen on siistimpää.
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim().replace(/\.$/, '');
            };

            // --- OSIOKOHTAINEN TULOSTUSLOGIIKKA ---

            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                let combinedText = '';
                if (s.paavalinta) {
                    combinedText += s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus ?
                        `Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}.` : (s.paavalinta.teksti || '');
                }
                if (s.omaArvio) {
                    combinedText += (combinedText ? ' ' : '') + `Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10.`;
                }
                if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                     const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti.toLowerCase()).join(', ');
                     combinedText += (combinedText ? ' ' : '') + `Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}.`;
                 }
                if (s.koonti) {
                    combinedText += `\n\nKoonti keskustelusta:\n${s.koonti}`;
                }
                if (combinedText) sectionTextParts.push(combinedText.trim());
            } 
            else if (section.id === 'palkkatuki' && state.palkkatuki?.puoltoKappale) {
                // Otetaan suoraan valmis, PalkkatukiCalculatorissa rakennettu lause.
                sectionTextParts.push(state.palkkatuki.puoltoKappale);
            }
            else if (section.id === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
                sectionTextParts.push(state.tyottomyysturva.yhteenvetoFraasi);
            }
            else if (section.id === 'tyonhakuvelvollisuus' && selection) {
                let koottuTeksti = processPhrase(selection);
                if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                    const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([,v]) => v).map(([k]) => k);
                    let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                    if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                    if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                    koottuTeksti += alennusTeksti;
                }
                if (!koottuTeksti.includes("Haetut paikat") && !koottuTeksti.includes("TYÖNHAKUVELVOLLISUUDEN TOTEUTTAMINEN JA SEURANTA")) {
                    koottuTeksti += `\n\n${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI.trim()}`; 
                }
                sectionTextParts.push(koottuTeksti);
            }
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection)
                        .filter(phrase => phrase.avainsana !== 'syntymavuosi') // Poistaa syntymävuoden
                        .forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    sectionTextParts.push(processPhrase(selection));
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
            }

            if (sectionTextParts.length > 0) {
                // Yhdistetään osion sisäiset tekstit välilyönnillä, paitsi tietyissä erikoistapauksissa.
                const joiner = (section.id === 'tyonhakuvelvollisuus' || section.id === 'tyokyky') ? '\n' : '. ';
                let content = sectionTextParts.join(joiner);
                if(joiner === '. ' && !content.endsWith('.') && !content.endsWith('!')) {
                    content += '.';
                }
                textParts.push(`**${section.otsikko}**\n${content}`);
            }
        });

        const ttIndex = textParts.findIndex(p => p.startsWith('**Työttömyysturva**'));
        const perustiedotIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));

        if (ttIndex > -1 && perustiedotIndex > -1) {
            const ttContent = textParts[ttIndex].replace('**Työttömyysturva**\n', '');
            textParts[perustiedotIndex] += ` ${ttContent}`; // Yhdistetään välilyönnillä
            textParts.splice(ttIndex, 1);
        }
        
        if (textParts.length === 0) return '';
        return FINGERPRINT + textParts.join('\n\n');

    }, [state]);

    const handleCopy = () => {
        try {
            // Kopioidaan sekä HTML- että raakatekstinä.
            const plainText = summaryText.replace(FINGERPRINT, '').replace(/\*\*/g, '');

            const htmlText = summaryText
                .replace(FINGERPRINT, '')
                .split('\n\n')
                .map(paragraph => {
                    const lines = paragraph.split('\n');
                    const header = `<strong>${lines[0].replace(/\*\*/g, '')}</strong>`;
                    const body = lines.slice(1).join('<br>');
                    // Jos kappaleessa on vain otsikko, älä lisää turhaa <br>-tagia.
                    return `<p>${header}${body ? '<br>' + body : ''}</p>`;
                })
                .join('');
            
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText,
            });

            navigator.clipboard.write([clipboardItem]).then(() => {
                setFeedback('Kopioitu muotoiltuna!');
                setTimeout(() => setFeedback(''), 2000);
            });
        } catch (err) {
            // Varmuuskopio vanhoille selaimille
            navigator.clipboard.writeText(summaryText.replace(FINGERPRINT, '').replace(/\*\*/g, ''))
            .then(() => {
                setFeedback('Kopioitu (ei-muotoiltuna)!');
                setTimeout(() => setFeedback(''), 2000);
            });
        }
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
            
            <AikatauluEhdotus state={state} />
        </aside>
    );
};

export default Summary;