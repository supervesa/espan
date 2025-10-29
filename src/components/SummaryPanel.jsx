import React, { useState, useMemo } from 'react';
// TUO TARVITTAVAT DATATIEDOSTOT JA VAKIOT
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js'; // Varmista oikea polku
import AikatauluEhdotus from './AikatauluEhdotus'; // Varmista oikea polku

// --- KOPIOITU Summary.js:stä ---
const FINGERPRINT = '\u200B\u200D\u200C';

// Apufunktio fraasin käsittelyyn (KOPIOITU)
const processPhrase = (phraseData, specificSelectionState) => {
    // ... (Koodi täsmälleen sama kuin Summary.js:ssä) ...
    if (!phraseData || !phraseData.teksti) return '';
    let text = phraseData.teksti;
    const variableSource = specificSelectionState?.muuttujat || {};
    if (phraseData.muuttujat && typeof variableSource === 'object') {
        Object.keys(phraseData.muuttujat).forEach((key) => {
            const value = variableSource[key];
            if (value !== undefined && value !== null) {
                try {
                    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`\\\[${escapedKey}\\]`, 'g'); // Korjattu regex
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

// Apufunktio yksittäisen osion sisällön generointiin (KOPIOITU)
const generateSectionContent = (section, selection, state) => {
    // ... (Koodi täsmälleen sama kuin Summary.js:ssä) ...
        let generated = '';

    if (section.id === 'tyokyky' && state.tyokyky) {
        const s = state.tyokyky;
        let tyokykyParts = [];
        if (s.paavalinta) {
            if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) { tyokykyParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`); }
            else if (s.paavalinta.avainsana === 'tyokyky_selvityksessa') { tyokykyParts.push("Työkyky vaatii lisäselvitystä"); }
            else if (s.paavalinta.avainsana === 'tyokyky_normaali') { tyokykyParts.push("Työkyky on normaali"); }
        }
        if (s.omaArvio) { tyokykyParts.push(`Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10`); }
        if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) { const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti.toLowerCase().replace(/\.$/, '')).join(', '); tyokykyParts.push(`Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}`); }
        let combinedSelectionsText = tyokykyParts.join('. ').trim();
        if (s.koonti && s.koonti.trim()) { const koontiFormatted = `Koonti keskustelusta:\n${s.koonti.trim()}`; generated = combinedSelectionsText ? combinedSelectionsText + '\n\n' + koontiFormatted : koontiFormatted; }
        else { generated = combinedSelectionsText; }
    }
    else if (section.id === 'palkkatuki' && state.palkkatuki?.puoltoKappale) { generated = state.palkkatuki.puoltoKappale.replace(/\.$/, '').trim(); }
    else if (section.id === 'tyonhakuvelvollisuus' && selection) {
        const originalSectionData = planData.aihealueet.find(s => s.id === section.id); // Haetaan alkuperäinen
        const phraseData = originalSectionData?.fraasit?.find(f => f.avainsana === selection.avainsana);
        if (phraseData) {
            let koottuTeksti = processPhrase(phraseData, selection);
            if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([, v]) => v).map(([k]) => k);
                let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                koottuTeksti += alennusTeksti;
            }
            // Lisätään lopputeksti VAIN jos se on määritelty
             if (TYONHAKUVELVOLLISUUS_LOPPUTEKSTI) {
                 koottuTeksti += `\n\n${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI.trim()}`;
             }
            generated = koottuTeksti;
        }
    }
    // Muut osiot (yleinen käsittely)
    else if (selection && typeof selection === 'object' && !['koulutus', 'ammattikortit', 'yrittajyys'].includes(section.id)) {
         const originalSectionData = planData.aihealueet.find(s => s.id === section.id); // Haetaan alkuperäinen
        let generatedParts = [];
        if (originalSectionData?.monivalinta) {
            const selectedKeys = Object.keys(selection).filter(avainsana => avainsana !== 'avainsana' && avainsana !== 'muuttujat' && (selection[avainsana] === true || (typeof selection[avainsana] === 'object' && selection[avainsana] !== null && Object.keys(selection[avainsana]).length > 0)) );
            selectedKeys.forEach(avainsana => {
                const phraseState = selection[avainsana];
                const phraseData = originalSectionData.fraasit?.find(f => f.avainsana === avainsana);
                if (phraseData) {
                    let processedText = '';
                    if (typeof phraseState === 'object' && phraseState !== null && phraseState.avainsana === avainsana) { processedText = processPhrase(phraseData, phraseState); }
                    else if (phraseState === true) { processedText = processPhrase(phraseData, {}); }
                    if (processedText) generatedParts.push(processedText);
                }
            });
            generated = generatedParts.join('. ');
        } else if (selection.avainsana) {
            const phraseData = originalSectionData?.fraasit?.find(f => f.avainsana === selection.avainsana);
            if (phraseData) { generated = processPhrase(phraseData, selection); }
        }
    }

     // Lisätään customText loppuun, jos sitä on
     const customText = state[`custom-${section.id}`]?.trim() || '';
     if (customText) {
         generated += (generated ? '\n\n' : '') + customText;
     }

    return generated.trim();
};
// --- KOPIOINTI PÄÄTTYY TÄHÄN ---


const SummaryPanel = ({ state, sections }) => {

    // --- KOPIOITU Summary.js:stä ---
    const [feedback, setFeedback] = useState('');

    // TÄMÄ LASKEE KOKO TEKSTIN KERRALLA KOPIOINTIA VARTEN
    const fullSummaryText = useMemo(() => {
        let textParts = [];
        // Käytetään App.jsx:stä saatua sections-listaa
        sections.forEach(panelSection => {
            const sectionId = panelSection.id.replace('osio-', ''); // Muunnetaan 'osio-palkkatuki' -> 'palkkatuki'
            const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
            if (!sectionDataFromPlan) return; // Skipataan, jos ei löydy datasta

            const selection = state[sectionId];
            const generatedContent = generateSectionContent(sectionDataFromPlan, selection, state);

            if (generatedContent) {
                let finalContent = generatedContent;
                // Lisätään piste loppuun, jos puuttuu
                const lastLine = finalContent.split('\n').pop();
                if (!/[.!?]$/.test(lastLine) && !finalContent.endsWith('\n\n')) {
                    finalContent += '.';
                }
                textParts.push(`**${sectionDataFromPlan.otsikko}**\n${finalContent}`);
            }
        });

        // Tähän voisi lisätä vielä esim. Työttömyysturvan ja Koulutus/Yrittäjyys-koonnin
        // logiikan, jos ne halutaan mukaan kopioitavaan tekstiin.

        let cleanedTextParts = textParts.map(part => part.replace(/\n\s*\.\s*$/, '').trim()).filter(Boolean);
        return FINGERPRINT + cleanedTextParts.join('\n\n');

    }, [state, sections]); // Lisätty sections riippuvuudeksi

    const handleCopy = () => {
        // KÄYTETÄÄN fullSummaryText-muuttujaa
        const summaryToCopy = fullSummaryText;
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); // prettier-ignore
            navigator.clipboard.write([clipboardItem]).then(() => { setFeedback('Kopioitu muotoiltuna!'); setTimeout(() => setFeedback(''), 2000); }, (rejectReason) => { console.error("Formatted copy failed:", rejectReason); throw new Error("Formatted copy failed"); }); // prettier-ignore
        } catch (err) {
            console.warn("Clipboard API error or formatted copy failed, falling back to plain text:", err);
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { setFeedback('Kopioitu (ei-muotoiltuna)!'); setTimeout(() => setFeedback(''), 2000); }, (rejectErr) => { console.error("Plain text copy failed:", rejectErr); setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2000); }); // prettier-ignore
        }
    };
    // --- KOPIOINTI PÄÄTTYY TÄHÄN ---


    // --- UUSI OSUUS: Statusten haku ja renderöinti ---
    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '');
        // Tähän kehittyneempi logiikka state-objektin perusteella
        if (state[simpleId] && Object.keys(state[simpleId]).length > 0) {
            return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
        }
        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };
    // Tähän kehittyneempi logiikka state-objektin perusteella
    const areAllSectionsComplete = sections.every(section => getSectionStatus(section.id).text === 'Valmis');

    return (
        <>
            <div className="summary-drag-handle"></div>
            <h2>Yhteenveto</h2>
            <div className="summary-progress-tracker">
                {sections.map(section => {
                    const status = getSectionStatus(section.id);
                    return <div key={section.id} id={`${section.id.replace('osio-','')}-chip`} className={`chip ${status.chipClass}`}>{section.name}</div>;
                })}
            </div>

            {/* --- MUOKATTU LISTAN RENDERÖINTI --- */}
            <ul className="summary-items-list">
                {sections.map(panelSection => {
                     const status = getSectionStatus(panelSection.id);
                     const sectionId = panelSection.id.replace('osio-', '');
                     const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
                     const selection = state[sectionId];
                     
                     // Generoidaan teksti VAIN TÄLLE OSIOLLE
                     const sectionText = sectionDataFromPlan ? generateSectionContent(sectionDataFromPlan, selection, state) : '';

                     return (
                        <li
                            key={panelSection.id}
                            className="summary-item"
                            data-target={panelSection.id}
                        >
                            {/* Yläosa: Otsikko, tagi ja klikkaustoiminto */}
                            <div className="summary-item-header" onClick={() => {
                                const targetElement = document.getElementById(panelSection.id);
                                if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth' }); }
                            }}>
                                <span className="summary-item__title">{panelSection.name}</span>
                                <span id={`${sectionId}-status`} className={`tag ${status.tagClass}`}>{status.text}</span>
                            </div>

                            {/* Alaosa: Generoitu teksti (jos sitä on) */}
                            {sectionText && (
                                <div className="summary-item-generated-text">
                                    {/* Muotoillaan teksti samalla tavalla kuin vanhassa summaryssä */}
                                    {sectionText.split('\n').map((line, index) => (
                                        <React.Fragment key={index}>
                                            {line}
                                            {index < sectionText.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {/* --- MUOKKAUS PÄÄTTYY --- */}


            {/* Toiminnot (Tallenna, Kopioi) */}
            <div className="summary-actions">
                <button
                    id="save-button"
                    className="btn"
                    disabled={!areAllSectionsComplete}
                >
                    Tallenna analyysi
                </button>
                {/* MUOKATTU: Lisätty onClick ja disabled-logiikka */}
                <button
                    className="btn btn--secondary"
                    onClick={handleCopy}
                    disabled={!fullSummaryText || fullSummaryText === FINGERPRINT}
                >
                    Kopioi yhteenveto
                </button>
                {/* MUOKATTU: Lisätty feedback-elementti */}
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>

             {/* Aikatauluehdotus paneelin loppuun */}
             <AikatauluEhdotus state={state} />
        </>
    );
};

export default SummaryPanel;