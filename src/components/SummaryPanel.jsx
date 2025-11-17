import React, { useState, useEffect, useRef } from 'react'; // LISÄTTY useEffect JA useRef
// TUODAAN LOGIIKKA UUDESTA TIEDOSTOSTA
import { generateSectionContent, generateFullSummary } from '../utils/summaryGenerator.js';
// TUODAAN DATAA VAIN STATUKSEN TARKISTUSTA VARTEN
import { planData } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';

const FINGERPRINT = '\u200B\u200D\u200C'; // Tarvitaan 'disabled'-tarkistukseen

const SummaryPanel = ({ state, sections }) => {

    console.log("[SummaryPanel] Received props:", { state, sections });

    const [feedback, setFeedback] = useState('');
    // --- LISÄYS: Uusi tila vierityksen seurantaa varten ---
    const [activeSectionId, setActiveSectionId] = useState(null);
    const observerRef = useRef(null); // Säilö observer-instanssille

    // --- KEVYT handleCopy-FUNKTIO (ennallaan) ---
    const handleCopy = () => {
        // ... (Kopiointilogiikka ennallaan) ...
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

    // --- PÄIVITETTY: Statusten haku (Reaaliaikainen päivitys) ---
    const getSectionStatus = (sectionId) => {
        // Muuntaa 'osio-suunnitelman-perustiedot' -> 'suunnitelman_perustiedot'
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
        
        // Tarkistus 1: Onko osio olemassa planDatassa (estää virheet)
        const sectionExistsInData = planData.aihealueet.some(s => s.id === simpleId);
         if (!sectionExistsInData && !['kielitaso'].includes(simpleId) && simpleId !== 'koulutus') { 
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }
        
        // Erikoissääntö: Koulutus & Osaam. (niputettu)
         if (simpleId === 'koulutus') {
             const koulutusState = state.koulutus;
             const kortitState = state.ammattikortit;
             const yrittajyysState = state.yrittajyys;
             const customKoulutus = state['custom-koulutus'];
             const customKielitaso = state['custom-kielitaso'];

             if ((koulutusState?.avainsana) || (kortitState && Object.keys(kortitState).length > 0) || (yrittajyysState?.avainsana) || customKoulutus || customKielitaso) {
                 return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
             }
             // Jos mitään ei ole valittu, tarkistetaan onko custom-kenttiä muokattu
             if (customKoulutus || customKielitaso) {
                 return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' };
             }
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }

        // Tarkistus 2: Onko osiolle ylipäätään dataa statessa
        const sectionState = state[simpleId];
        if (!sectionState && !state[`custom-${simpleId}`]) {
            return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
        }

        // Tarkistus 3: Yleiset säännöt "Valmis"-tilalle
        // Jos `state[simpleId]` on olemassa, ajetaan tarkemmat säännöt
        if (sectionState && Object.keys(sectionState).length > 0) {
             if (simpleId === 'palkkatuki' && state.palkkatuki?.palkkatuki_puolletaan !== undefined) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyokyky' && state.tyokyky?.paavalinta) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyonhakuvelvollisuus' && state.tyonhakuvelvollisuus?.avainsana) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'suunnitelma' && Object.keys(state.suunnitelma || {}).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'suunnitelman_perustiedot' && Object.keys(sectionState || {}).length >= 2) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyotilanne' && Object.keys(sectionState || {}).length >= 1) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             // Jos jokin muu osio (kuten palveluunohjaus) on valittu
             if (sectionState && Object.keys(sectionState).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
        }
        
        // Tarkistus 4: Onko vain custom-tekstiä (ei fraasivalintaa)
        if (state[`custom-${simpleId}`]) { 
            return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; 
        }

        // Oletus
        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };

    const areAllSectionsComplete = sections.every(section => getSectionStatus(section.id).text === 'Valmis');
    const isStateEmpty = !state || Object.keys(state).length === 0;

    // --- LISÄYS: Vierityksen seuranta (Scroll-Spy) ---
    useEffect(() => {
        const observerOptions = {
            root: null, // Käyttää viewportia
            rootMargin: '0px',
            threshold: 0.4 // 40% osiosta pitää näkyä
        };

        const observerCallback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Kun osio tulee näkyviin, päivitä aktiivinen ID
                    console.log(`[ScrollSpy] Active section: ${entry.target.id}`);
                    setActiveSectionId(entry.target.id);
                }
            });
        };

        // Luo observer
        const observer = new IntersectionObserver(observerCallback, observerOptions);
        observerRef.current = observer; // Tallenna viittaus, jotta voimme siivota

        // Etsi kaikki seurattavat elementit `sections`-propsin perusteella
        const targets = sections
            .map(section => document.getElementById(section.id))
            .filter(target => target !== null); // Suodata pois ne, joita ei löydy
        
        // Laita observer seuraamaan jokaista kohdetta
        targets.forEach(target => observer.observe(target));

        // Siivousfunktio, joka ajetaan kun komponentti poistuu
        return () => {
            targets.forEach(target => {
                if (observerRef.current) {
                    observerRef.current.unobserve(target);
                }
            });
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [sections]); // Ajetaan vain, jos sections-lista muuttuu


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

            <ul className="summary-items-list">
                {sections.map(panelSection => {
                     const status = getSectionStatus(panelSection.id);
                     let sectionId = panelSection.id.replace('osio-', '').replace(/-/g, '_');
                     if (sectionId === 'tyonhaku') sectionId = 'tyonhakuvelvollisuus';
                     if (sectionId === 'palveluohjaus') sectionId = 'palveluunohjaus';

                     const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
                     const selection = state[sectionId];
                     
                     let sectionText = '';
                     
                     // --- TÄSSÄ HALUAMASI HYBRIDILOGIIKKA (ennallaan) ---
                     if (sectionId === 'koulutus') {
                         let koonti = '';
                         const koulutusCustom = state['custom-koulutus']?.trim() || '';
                         if (koulutusCustom) koonti += koulutusCustom;
                         const kielitasoCustom = state['custom-kielitaso']?.trim() || '';
                         if (kielitasoCustom) koonti += (koonti ? '\n\n' : '') + kielitasoCustom;
                         sectionText = koonti;
                     } 
                     else if (['ammattikortit', 'yrittajyys', 'kielitaso'].includes(sectionId)) { 
                         return null; 
                     } 
                
                     else if (sectionId === 'suunnitelma') {
                         sectionText = state['custom-suunnitelma']?.trim() || '';
                     }
                     else if (sectionDataFromPlan) { 
                         sectionText = generateSectionContent(sectionDataFromPlan, selection, state);
                         const customText = state[`custom-${sectionId}`]?.trim() || '';
                         if (customText && !sectionText.includes(customText)) { 
                            sectionText += (sectionText ? '\n\n' : '') + customText;
                         }
                     }
                     // --- LOGIIKKA LOPPUU ---
                     
                     const statusId = `${sectionId.replace(/_/g, '-')}-status`;
                     // console.log(`[RENDER LOOP] panelSection.id: ${panelSection.id}, Mapped sectionId: ${sectionId}, Text Length: ${sectionText.length}, Section Data Found: ${!!sectionDataFromPlan}`);
                     if (!sectionDataFromPlan && sectionId !== 'koulutus') return null;

                     // --- LISÄYS: Dynaaminen className scroll-spytä varten ---
                     const isActive = panelSection.id === activeSectionId;
                     const liClassName = `summary-item ${isActive ? 'summary-item--active' : ''}`;

                     return (
                        <li
                            key={panelSection.id}
                            className={liClassName} // KÄYTETÄÄN DYNAAMISTA LUOKKAA
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
                <button className="btn btn--secondary" onClick={handleCopy} disabled={isStateEmpty}> Kopioi yhteenveto </button>
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>

             <AikatauluEhdotus state={state} />
        </>
    );
};

export default SummaryPanel;