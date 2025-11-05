import React, { useState } from 'react'; // Poistettu useMemo
// TUODAAN LOGIIKKA UUDESTA TIEDOSTOSTA
import { generateSectionContent, generateFullSummary } from '../utils/summaryGenerator.js';
// TUODAAN DATAA VAIN STATUKSEN TARKISTUSTA VARTEN
import { planData } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';

const FINGERPRINT = '\u200B\u200D\u200C'; // Tarvitaan 'disabled'-tarkistukseen

const SummaryPanel = ({ state, sections }) => {

    console.log("[SummaryPanel] Received props:", { state, sections });

    const [feedback, setFeedback] = useState('');

    // --- KEVYT handleCopy-FUNKTIO ---
    const handleCopy = () => {
        // Raskas laskenta tehdään VAIN klikatessa
        const summaryToCopy = generateFullSummary(state); 
        console.log("[SummaryPanel handleCopy] Attempting to copy text:", summaryToCopy);
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); // prettier-ignore
            navigator.clipboard.write([clipboardItem]).then(() => { setFeedback('Kopioitu muotoiltuna!'); setTimeout(() => setFeedback(''), 2000); }, (rejectReason) => { console.error("Formatted copy failed:", rejectReason); setFeedback('! Muotoiltu kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 3000); throw new Error("Formatted copy failed"); }); // prettier-ignore
        } catch (err) {
            console.warn("Clipboard API error or formatted copy failed, falling back to plain text:", err);
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { setFeedback('Kopioitu (ei-muotoiltuna)!'); setTimeout(() => setFeedback(''), 2000); }, (rejectErr) => { console.error("Plain text copy failed:", rejectErr); setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2000); }); // prettier-ignore
        }
    };

    // --- Statusten haku ---
    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
         const sectionExistsInData = planData.aihealueet.some(s => s.id === simpleId);
         if (!sectionExistsInData && !['kielitaso'].includes(simpleId)) { 
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }
        
         if (simpleId === 'koulutus') {
             const koulutusState = state.koulutus;
             const kortitState = state.ammattikortit;
             const yrittajyysState = state.yrittajyys;
             const customKoulutus = state['custom-koulutus'];
             const customKielitaso = state['custom-kielitaso'];
             if ((koulutusState?.avainsana) || (kortitState && Object.keys(kortitState).length > 0) || (yrittajyysState?.avainsana) || customKoulutus || customKielitaso) {
                 return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
             }
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }
        if (state[simpleId] && Object.keys(state[simpleId]).length > 0) {
            if (Object.keys(state[simpleId]).length === 1 && state[`custom-${simpleId}`]) { return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; }
             if (simpleId === 'palkkatuki' && state.palkkatuki?.palkkatuki_puolletaan !== undefined) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyokyky' && state.tyokyky?.paavalinta) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyonhakuvelvollisuus' && state.tyonhakuvelvollisuus?.avainsana) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
              if (simpleId === 'suunnitelma' && Object.keys(state.suunnitelma || {}).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
               if (simpleId === 'suunnitelman_perustiedot' && Object.keys(state[simpleId] || {}).length >= 2) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
                if (simpleId === 'tyotilanne' && Object.keys(state[simpleId] || {}).length >= 1) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
                 if (simpleId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
        } else if (state[`custom-${simpleId}`]) { return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; }
        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };
     const areAllSectionsComplete = sections.every(section => getSectionStatus(section.id).text === 'Valmis');
    const isStateEmpty = !state || Object.keys(state).length === 0;

    return (
        <>
            <div className="summary-drag-handle"></div>
            <h2>Yhteenveto</h2>
            <div className="summary-progress-tracker">
                {sections.map(section => {
                    const status = getSectionStatus(section.id);
                    const chipId = `${section.id.replace('osio-','').replace(/_/g, '-')}-chip`;
                    return <div key={section.id} id={chipId} className={`chip ${status.chipClass}`}>{section.name}</div>;
                })}
            </div>

            {/* --- KORJATTU LISTAN RENDERÖINTI HYBRIDILOGIIKALLA --- */}
            <ul className="summary-items-list">
                {sections.map(panelSection => {
                     const status = getSectionStatus(panelSection.id);
                     let sectionId = panelSection.id.replace('osio-', '').replace(/-/g, '_');
                     if (sectionId === 'tyonhaku') sectionId = 'tyonhakuvelvollisuus';
                     if (sectionId === 'palveluohjaus') sectionId = 'palveluunohjaus';

                     const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
                     const selection = state[sectionId];
                     
                     let sectionText = '';
                     
                     // --- TÄSSÄ HALUAMASI HYBRIDILOGIIKKA ---
                     
                     // 1. Koulutus & Osaam. -kohdalle VAIN custom-tekstit
                     if (sectionId === 'koulutus') {
                         let koonti = '';
                         const koulutusCustom = state['custom-koulutus']?.trim() || '';
                         if (koulutusCustom) koonti += koulutusCustom;
                         
                         const kielitasoCustom = state['custom-kielitaso']?.trim() || '';
                         if (kielitasoCustom) koonti += (koonti ? '\n\n' : '') + kielitasoCustom;
                         
                         // Tähän voisi lisätä myös custom-ammattikortit ja custom-yrittäjyys, jos sellaiset kentät on olemassa
                         
                         sectionText = koonti;
                     } 
                     // Piilotetaan niputetut osiot
                     else if (['ammattikortit', 'yrittajyys', 'kielitaso'].includes(sectionId)) { 
                         return null; 
                     } 
                     // 2. Työkyvylle VAIN koonti-teksti
                     else if (sectionId === 'tyokyky') {
                         if (state.tyokyky?.koonti) {
                             sectionText = `Koonti keskustelusta:\n${state.tyokyky.koonti}`;
                         }
                     }
                     // 3. Suunnitelmalle VAIN custom-teksti
                     else if (sectionId === 'suunnitelma') {
                         sectionText = state['custom-suunnitelma']?.trim() || '';
                     }
                     // 4. KAIKKI MUUT OSIOT: Näytetään täysi sisältö (fraasit + custom)
                     else if (sectionDataFromPlan) { 
                         sectionText = generateSectionContent(sectionDataFromPlan, selection, state);
                         
                         // Varmistetaan custom-tekstin mukaan tulo (jos generateSectionContent ei sitä tehnyt)
                         const customText = state[`custom-${sectionId}`]?.trim() || '';
                         if (customText && !sectionText.includes(customText)) { 
                            sectionText += (sectionText ? '\n\n' : '') + customText;
                         }
                     }
                     // --- LOGIIKKA LOPPUU ---
                     
                     const statusId = `${sectionId.replace(/_/g, '-')}-status`;
                     console.log(`[RENDER LOOP] panelSection.id: ${panelSection.id}, Mapped sectionId: ${sectionId}, Text Length: ${sectionText.length}, Section Data Found: ${!!sectionDataFromPlan}`);
                     if (!sectionDataFromPlan && sectionId !== 'koulutus') return null;

                     return (
                        <li
                            key={panelSection.id}
                            className="summary-item"
                            data-target={panelSection.id}
                        >
                            <div className="summary-item-header" onClick={() => {
                                const targetElement = document.getElementById(panelSection.id);
                                if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth' }); }
                            }}>
                                <span className="summary-item__title">{panelSection.name}</span>
                                <span id={statusId} className={`tag ${status.tagClass}`}>{status.text}</span>
                            </div>

                            {sectionText && (
                                <div className="summary-item-generated-text">
                                    {sectionText.split('\n').map((line, index, arr) => (
                                        <React.Fragment key={index}>
                                            {line}
                                            {index < arr.length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="summary-actions">
                <button id="save-button" className="btn" disabled={!areAllSectionsComplete}> Tallenna analyysi </button>
                {/* KORJATTU: 'disabled'-ehto käyttää nyt isStateEmpty-tarkistusta, joka on yksinkertainen ja toimii */}
                <button className="btn btn--secondary" onClick={handleCopy} disabled={isStateEmpty}> Kopioi yhteenveto </button>
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>

             <AikatauluEhdotus state={state} />
        </>
    );
};

export default SummaryPanel;