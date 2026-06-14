import React, { useState, useEffect, useRef } from 'react';
import { generateSectionContent, generateFullSummary, generateHybridSummary, generateHybridSectionContent } from '../utils/summaryGenerator.js';
import { planData } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';
import CopyButton from './common/CopyButton';

const FINGERPRINT = '\u200B\u200D\u200C';

const SummaryPanel = ({ state, sections, dbPlanData, dbKnowledge }) => {
    const [feedback, setFeedback] = useState('');
    const [activeSectionId, setActiveSectionId] = useState(null);
    const observerRef = useRef(null); 

    // --- VANHA TURVALLINEN KOPIOINTI ---
    const handleCopy = () => {
        const summaryToCopy = generateFullSummary(state); 
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); 
            navigator.clipboard.write([clipboardItem]).then(() => { setFeedback('Kopioitu muotoiltuna!'); setTimeout(() => setFeedback(''), 2000); }, () => { setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 3000); }); 
        } catch (err) {
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { setFeedback('Kopioitu (ei-muotoiltuna)!'); setTimeout(() => setFeedback(''), 2000); }, () => { setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2000); }); 
        }
    };

    // --- UUSI HYBRIDI KOPIOINTI ---
    const handleHybridCopy = () => {
        const summaryToCopy = generateHybridSummary(state, dbPlanData, dbKnowledge); 
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); 
            navigator.clipboard.write([clipboardItem]).then(() => { setFeedback('Hybridi kopioitu!'); setTimeout(() => setFeedback(''), 2000); }, () => { setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 3000); }); 
        } catch (err) {
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { setFeedback('Hybridi kopioitu!'); setTimeout(() => setFeedback(''), 2000); }, () => { setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2000); }); 
        }
    };

    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
        
        const existsInDb = dbPlanData?.aihealueet?.some(s => s.id === simpleId);
        const existsInStatic = planData.aihealueet.some(s => s.id === simpleId);
        
        // Salli koulutus ja 33 § edellytykset mennä läpi, vaikkei niitä ole tietokannoissa
        if (!existsInDb && !existsInStatic && !['kielitaso', 'edellytykset'].includes(simpleId) && simpleId !== 'koulutus') { 
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
             if (customKoulutus || customKielitaso) {
                 return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' };
             }
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }

        // TÄSSÄ 33 § EDELLYTYKSET STATUS (UUSI)
        if (simpleId === 'edellytykset' && state['custom-edellytykset']) {
            return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
        }

        const sectionState = state[simpleId];
        if (!sectionState && !state[`custom-${simpleId}`]) {
            return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
        }

        if (sectionState && Object.keys(sectionState).length > 0) {
             if (simpleId === 'palkkatuki' && state.palkkatuki?.palkkatuki_puolletaan !== undefined) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyokyky' && state.tyokyky?.paavalinta) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyonhakuvelvollisuus' && state.tyonhakuvelvollisuus?.avainsana) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'suunnitelma' && Object.keys(state.suunnitelma || {}).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'suunnitelman_perustiedot' && Object.keys(sectionState || {}).length >= 2) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyotilanne' && Object.keys(sectionState || {}).length >= 1) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (sectionState && Object.keys(sectionState).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
        }
        
        if (state[`custom-${simpleId}`]) { 
            return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; 
        }

        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };

    const areAllSectionsComplete = sections.every(section => getSectionStatus(section.id).text === 'Valmis');
    const isStateEmpty = !state || Object.keys(state).length === 0;

    useEffect(() => {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.4 };
        const observerCallback = (entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) { setActiveSectionId(entry.target.id); } });
        };
        const observer = new IntersectionObserver(observerCallback, observerOptions);
        observerRef.current = observer; 
        const targets = sections.map(section => document.getElementById(section.id)).filter(target => target !== null); 
        targets.forEach(target => observer.observe(target));
        return () => {
            targets.forEach(target => { if (observerRef.current) { observerRef.current.unobserve(target); } });
            if (observerRef.current) { observerRef.current.disconnect(); }
        };
    }, [sections]); 

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

                     const sectionDataFromDb = dbPlanData?.aihealueet?.find(s => s.id === sectionId);
                     const sectionDataFromPlan = sectionDataFromDb || planData.aihealueet.find(s => s.id === sectionId);
                     
                     const selection = state[sectionId];
                     let sectionText = '';
                     
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
                     // TÄSSÄ 33 § EDELLYTYKSET LUENTA (UUSI)
                     else if (sectionId === 'edellytykset') {
                         sectionText = state['custom-edellytykset']?.trim() || '';
                     }
                     else if (sectionDataFromPlan) { 
                         sectionText = generateHybridSectionContent(sectionDataFromPlan, selection, state, dbKnowledge);
                         let customText = state[`custom-${sectionId}`]?.trim() || '';
                         
                         if (sectionId === 'tyokyky') {
                             const tyokykyLopullinen = state['custom-tyokyky_lopullinen']?.trim();
                             if (tyokykyLopullinen) {
                                 customText = customText ? `${customText}\n\n${tyokykyLopullinen}` : tyokykyLopullinen;
                             }
                         }

                         if (customText && !sectionText.includes(customText)) { 
                            sectionText += (sectionText ? '\n\n' : '') + customText;
                         }
                     }
                     
                     const statusId = `${sectionId.replace(/_/g, '-')}-status`;
                     if (!sectionDataFromPlan && !['koulutus', 'edellytykset'].includes(sectionId)) return null;

                     const isActive = panelSection.id === activeSectionId;
                     const liClassName = `summary-item ${isActive ? 'summary-item--active' : ''}`;

                     return (
                        <li
                            key={panelSection.id}
                            className={liClassName} 
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
                                <div className="summary-item-content-wrapper" style={{ marginTop: '0.5rem' }}>
                                    <div className="summary-item-generated-text">
                                        {sectionText.split('\n').map((line, index, arr) => (
                                            <React.Fragment key={index}>
                                                {line}
                                                {index < arr.length - 1 && <br />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <CopyButton 
                                            textToCopy={sectionText.replace(FINGERPRINT, '').replace(/\*\*/g, '').trim()} 
                                        />
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="summary-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button id="save-button" className="btn" disabled={!areAllSectionsComplete}> Tallenna analyysi </button>
                <button className="btn btn--secondary" onClick={handleCopy} disabled={isStateEmpty}> Kopioi yhteenveto (Vanha) </button>
                <button 
                    className="btn" 
                    style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', border: '2px dashed var(--color-primary)' }} 
                    onClick={handleHybridCopy} 
                    disabled={isStateEmpty}
                > 
                    🚀 Kopioi kokeilu (Supabase) 
                </button>
                {feedback && <p className="feedback-text" style={{ textAlign: 'center', marginTop: '0.25rem' }}>{feedback}</p>}
            </div>

             <AikatauluEhdotus state={state} />
        </>
    );
};

export default SummaryPanel;