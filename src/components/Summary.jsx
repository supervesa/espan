import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';

const FINGERPRINT = '\u200B\u200D\u200C';

// Apufunktio fraasin käsittelyyn
const processPhrase = (phraseData, specificSelectionState) => {
    if (!phraseData || !phraseData.teksti) return '';

    let text = phraseData.teksti;
    const variableSource = specificSelectionState?.muuttujat || {};

    if (phraseData.muuttujat && typeof variableSource === 'object') {
        Object.keys(phraseData.muuttujat).forEach((key) => {
            const value = variableSource[key];
            if (value !== undefined && value !== null) {
                try {
                    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`\\[${escapedKey}\\]`, 'g');
                    text = text.replace(regex, String(value));
                } catch (e) {
                    console.error(`Error replacing variable [${key}]:`, e);
                }
            }
        });
    }
    text = text.replace(/\(\s*v\.\s*\)/g, '').replace(/\s*\[[A-Z_]+\]/g, '').trim();
    return text.replace(/\.$/, '').trim();
};

// Apufunktio yksittäisen osion sisällön generointiin
// Tämä funktio ei nyt enää kutsu Koulutus/Yrittäjyys/Ammattikortit-osioille mitään,
// koska niille on uusi erityinen käsittely useMemo-hookissa.
const generateSectionContent = (section, selection, state) => {
    let generated = '';

    if (section.id === 'tyokyky' && state.tyokyky) {
        const s = state.tyokyky;
        let tyokykyParts = [];

        // Käsittele kaikki valinnat ja arviot ensin
        if (s.paavalinta) {
            if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                tyokykyParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`);
            } else if (s.paavalinta.avainsana === 'tyokyky_selvityksessa') {
                tyokykyParts.push("Työkyky vaatii lisäselvitystä");
            } else if (s.paavalinta.avainsana === 'tyokyky_normaali') {
                tyokykyParts.push("Työkyky on normaali");
            }
        }
        if (s.omaArvio) {
            tyokykyParts.push(`Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10`);
        }
        if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
            const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti.toLowerCase().replace(/\.$/, '')).join(', ');
            tyokykyParts.push(`Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}`);
        }

        // Yhdistä kaikki valinnat yhdeksi kappaleeksi
        let combinedSelectionsText = tyokykyParts.join('. ').trim();
        
        // Lisää koonti keskustelusta erillisenä kappaleena, jos sitä on
        if (s.koonti && s.koonti.trim()) {
            const koontiFormatted = `Koonti keskustelusta:\n${s.koonti.trim()}`;
            if (combinedSelectionsText) {
                // Lisätään rivinvaihto vain jos edellistä tekstiä on
                generated = combinedSelectionsText + '\n\n' + koontiFormatted;
            } else {
                generated = koontiFormatted;
            }
        } else {
            generated = combinedSelectionsText;
        }

    }
    else if (section.id === 'palkkatuki' && state.palkkatuki?.puoltoKappale) {
        generated = state.palkkatuki.puoltoKappale.replace(/\.$/, '').trim();
    }
    else if (section.id === 'tyonhakuvelvollisuus' && selection) {
        const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
        if (phraseData) {
            let koottuTeksti = processPhrase(phraseData, selection);
            if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([, v]) => v).map(([k]) => k);
                let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                koottuTeksti += alennusTeksti;
            }
            generated = koottuTeksti;
        }
    }
    // Yleinen käsittely: monivalinnat ja yksittäiset valinnat (EI koske koulutus/ammattikortit/yrittajyys-osioita enää tässä)
    else if (selection && typeof selection === 'object' && !['koulutus', 'ammattikortit', 'yrittajyys'].includes(section.id)) {
        let generatedParts = [];
        if (section.monivalinta) {
            const selectedKeys = Object.keys(selection).filter(avainsana => 
                avainsana !== 'syntymavuosi' && 
                avainsana !== 'alle_6kk_tyossa' && 
                (selection[avainsana] === true || (typeof selection[avainsana] === 'object' && selection[avainsana] !== null && Object.keys(selection[avainsana]).length > 0))
            );

            if (selectedKeys.length > 0) {
                selectedKeys.forEach(avainsana => {
                    const phraseState = selection[avainsana];
                    const phraseData = section.fraasit?.find(f => f.avainsana === avainsana);

                    if (phraseData) {
                        let processedText = '';
                        if (typeof phraseState === 'object' && phraseState !== null && phraseState.avainsana === avainsana) {
                            processedText = processPhrase(phraseData, phraseState);
                        } else if (phraseState === true) {
                            processedText = processPhrase(phraseData, {});
                        }
                        if (processedText) generatedParts.push(processedText);
                    }
                });
                generated = generatedParts.join('. ');
            }
        } else if (selection.avainsana) {
            const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
            if (phraseData) {
                generated = processPhrase(phraseData, selection);
            }
        }
    }
    return generated.trim();
};


const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');

    const summaryText = useMemo(() => {
        let textParts = [];
        let tyottomyysturvaFraasi = '';
        let koulutusJaYrittajyysCustomText = ''; // Tähän kerätään vain customText koulutus/yrittäjyys-osioista

        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`]?.trim() || '';

            let generatedContent = '';

            if (section.id === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
                tyottomyysturvaFraasi = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
                return;
            }

            // Koulutus, ammattikortit ja yrittäjyys -osioiden käsittely:
            // Kerätään customText talteen, muu generointi ohitetaan tässä loopissa
            if (['koulutus', 'ammattikortit', 'yrittajyys'].includes(section.id)) {
                if (customText) {
                    koulutusJaYrittajyysCustomText += (koulutusJaYrittajyysCustomText ? '\n\n' : '') + customText;
                }
                return; // Älä lisää näitä osioita yksittäin päälooppiin
            }

            // Muut osiot - customText täydentää generoitua sisältöä
            // Tärkein muutos tässä on, että tarkistetaan, onko customText olemassa
            // ennen kuin lisätään generatedContentiin.
            generatedContent = generateSectionContent(section, selection, state);

            let finalContent = generatedContent;

            if (customText) {
                finalContent += (finalContent ? '\n\n' : '') + customText;
            }
            if (finalContent === '.') finalContent = '';


            if (finalContent) {
                // Varmistetaan, että rivinvaihtojen jälkeiset pisteet poistetaan oikein.
                // Ja lisätään piste vain, jos teksti ei jo pääty välimerkkiin ja ei ole rivinvaihtoja lopussa.
                const lastLine = finalContent.split('\n').pop();
                if (!/[.!?]$/.test(lastLine) && !finalContent.endsWith('\n\n')) {
                    finalContent += '.';
                }
                textParts.push(`**${section.otsikko}**\n${finalContent}`);

                if (section.id === 'tyonhakuvelvollisuus' && selection) {
                    textParts[textParts.length - 1] += `\n\n${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI.trim()}`;
                }
            }
        }); // End of forEach loop

        // --- Kootaan ja lisätään Koulutus ja yrittäjyys -osio (VAIN customTextillä) ---
        let koulutusJaYrittajyysFinalContent = koulutusJaYrittajyysCustomText.trim(); 
        
        if (koulutusJaYrittajyysFinalContent) {
            // Varmistetaan, että rivinvaihtojen jälkeiset pisteet poistetaan oikein.
            const lastLine = koulutusJaYrittajyysFinalContent.split('\n').pop();
            if (!/[.!?]$/.test(lastLine) && !koulutusJaYrittajyysFinalContent.endsWith('\n\n')) {
                koulutusJaYrittajyysFinalContent += '.';
            }
            let tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Asiakkaan työtilanne**'));
            if (tyotilanneIndex === -1) { 
                tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));
            }
            const insertIndex = tyotilanneIndex > -1 ? tyotilanneIndex + 1 : 0;
            textParts.splice(insertIndex, 0, `**Koulutus ja yrittäjyys**\n${koulutusJaYrittajyysFinalContent}`);
        }

        // --- Sijoita Työttömyysturva suunnitelman perustiedot -osion jälkeen ---
        if (tyottomyysturvaFraasi) {
            const formattedTtFraasi = tyottomyysturvaFraasi.endsWith('.') ? tyottomyysturvaFraasi : tyottomyysturvaFraasi + '.';
            const perustiedotIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));

            if (perustiedotIndex > -1) {
                const existingPerustiedot = textParts[perustiedotIndex];
                textParts[perustiedotIndex] = existingPerustiedot + `\n${formattedTtFraasi}`;
            } else {
                const tyyppiIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman tyyppi**'));
                textParts.splice(tyyppiIndex > -1 ? tyyppiIndex + 1 : 0, 0, `**Työttömyysturva**\n${formattedTtFraasi}`);
            }
        }
        
        // --- Siivotaan ylimääräisiä tyhjiä rivejä ja pisteitä ---
        let cleanedTextParts = textParts.map(part => {
            // Poistetaan piste, jos se on yksittäinen rivinvaihtojen keskellä tai lopussa
            // ja varmistetaan, ettei poisteta pisteitä lauseen lopusta
            return part.replace(/\n\s*\.\s*$/, '').trim(); 
        }).filter(Boolean); 

        return FINGERPRINT + cleanedTextParts.join('\n\n');

    }, [state]);

    const handleCopy = () => {
        try {
            const plainText = summaryText.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryText.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); // prettier-ignore
            navigator.clipboard.write([clipboardItem]).then(() => { setFeedback('Kopioitu muotoiltuna!'); setTimeout(() => setFeedback(''), 2000); }, (rejectReason) => { console.error("Formatted copy failed:", rejectReason); throw new Error("Formatted copy failed"); }); // prettier-ignore
        } catch (err) {
            console.warn("Clipboard API error or formatted copy failed, falling back to plain text:", err);
            navigator.clipboard.writeText(summaryText.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { setFeedback('Kopioitu (ei-muotoiltuna)!'); setTimeout(() => setFeedback(''), 2000); }, (rejectErr) => { console.error("Plain text copy failed:", rejectErr); setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2000); }); // prettier-ignore
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
                                    return <React.Fragment key={lIndex}>{lIndex > 0 && <br />}{line}</React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi..</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>Kopioi leikepöydälle</button>
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>

            <AikatauluEhdotus state={state} />
        </aside>
    );
};
export default Summary;