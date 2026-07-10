import React, { useState, useEffect, useRef } from 'react';
import { generateSectionContent, generateFullSummary, generateHybridSummary, generateHybridSectionContent } from '../utils/summaryGenerator.js';
import { planData } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';
import CopyButton from './common/CopyButton';
import Button from './common/Button';
import ServiceManager from './ServiceManager'; 
import { Database } from 'lucide-react';
import { useSentinelAnalytics } from '../context/useSentinelAnalytics';

const FINGERPRINT = '\u200B\u200D\u200C';

const SummaryPanel = ({ state, sections, dbPlanData, dbKnowledge, actions, asiantuntijaId }) => {
    const [feedback, setFeedback] = useState('');
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false); 
    const [isSaved, setIsSaved] = useState(false); // UUSI: Varoituskytkin
    const observerRef = useRef(null); 
    
    const { logPlanCopied } = useSentinelAnalytics();

    const isStateEmpty = !state || Object.keys(state).length === 0;

    // --- UUSI: Nollataan kytkin aina kun state muuttuu (työtä on tehty) ---
    useEffect(() => {
        setIsSaved(false);
    }, [state]);

    // --- UUSI: Selaimen varoitusikkuna jos työtä ei ole tallennettu/kopioitu ---
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (!isStateEmpty && !isSaved) {
                e.preventDefault();
                e.returnValue = ''; // Herättää selaimen varoitusikkunan
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isStateEmpty, isSaved]);

    // --- VANHA TURVALLINEN KOPIOINTI ---
    const handleCopy = () => {
        const summaryToCopy = generateFullSummary(state); 
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {const lines = paragraph.split('\n'); const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;}).join(''); // prettier-ignore
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); 
            navigator.clipboard.write([clipboardItem]).then(() => { 
                setFeedback('Kopioitu muotoiltuna!'); 
                logPlanCopied(state, asiantuntijaId); // ANALYTIIKKA
                setIsSaved(true); // UUSI: Merkitään tallennetuksi
                setTimeout(() => setFeedback(''), 2000); 
            }, () => { 
                setFeedback('Kopiointi epäonnistui.'); 
                setTimeout(() => setFeedback(''), 3000); 
            }); 
        } catch (err) {
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { 
                setFeedback('Kopioitu (ei-muotoiltuna)!'); 
                logPlanCopied(state, asiantuntijaId); // ANALYTIIKKA
                setIsSaved(true); // UUSI: Merkitään tallennetuksi
                setTimeout(() => setFeedback(''), 2000); 
            }, () => { 
                setFeedback('Kopiointi epäonnistui.'); 
                setTimeout(() => setFeedback(''), 2000); 
            }); 
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
            navigator.clipboard.write([clipboardItem]).then(() => { 
                setFeedback('Hybridi kopioitu!'); 
                logPlanCopied(state, asiantuntijaId); // ANALYTIIKKA
                setIsSaved(true); // UUSI: Merkitään tallennetuksi
                setTimeout(() => setFeedback(''), 2000); 
            }, () => { 
                setFeedback('Kopiointi epäonnistui.'); 
                setTimeout(() => setFeedback(''), 3000); 
            }); 
        } catch (err) {
            navigator.clipboard.writeText(summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(() => { 
                setFeedback('Hybridi kopioitu!'); 
                logPlanCopied(state, asiantuntijaId); // ANALYTIIKKA
                setIsSaved(true); // UUSI: Merkitään tallennetuksi
                setTimeout(() => setFeedback(''), 2000); 
            }, () => { 
                setFeedback('Kopiointi epäonnistui.'); 
                setTimeout(() => setFeedback(''), 2000); 
            }); 
        }
    };

    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
        
        const existsInDb = dbPlanData?.aihealueet?.some(s => s.id === simpleId);
        const existsInStatic = planData.aihealueet.some(s => s.id === simpleId);
        
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

        // --- KORJAUS 1: Tarkistetaan uutta lopullinen_33_arvio -avainta ---
        if (simpleId === 'edellytykset' && (state['custom-lopullinen_33_arvio'] || state['custom-edellytykset'])) {
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
            
            {/* OTSIKKO JA HALLINTA-NAPPI */}
            <div style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 className="text-xl fw-bold" style={{ margin: 0 }}>Yhteenveto</h2>
                    <Button 
                        variant="secondary" 
                        className="text-xs fw-medium"
                        style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setIsManagerOpen(true)}
                    >
                        <Database size={14} /> Hallitse palveluita
                    </Button>
                </div>

                <div className="summary-progress-tracker">
                    {sections.map(section => {
                        const status = getSectionStatus(section.id);
                        const chipId = `${section.id.replace('osio-','').replace(/_/g, '-')}-chip`;
                        return <div key={section.id} id={chipId} className={`chip ${status.chipClass}`}>{section.name}</div>;
                    })}
                </div>
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
                     // --- KORJAUS 2: Haetaan oikea avain tekstin tulostukseen ---
                     else if (sectionId === 'edellytykset') {
                         sectionText = state['custom-lopullinen_33_arvio']?.trim() || state['custom-edellytykset']?.trim() || '';
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
                                <span className="summary-item__title text-sm fw-semibold">{panelSection.name}</span>
                                <span id={statusId} className={`tag ${status.tagClass} text-xs-dense fw-medium`}>{status.text}</span>
                            </div>

                            {sectionText && (
                                <div className="summary-item-content-wrapper" style={{ marginTop: '0.5rem' }}>
                                    <div className="summary-item-generated-text text-sm lh-tight text-slate-700">
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
                <Button 
                    id="save-button" 
                    disabled={!areAllSectionsComplete}
                > 
                    Tallenna analyysi 
                </Button>
                
                <Button 
                    variant="secondary" 
                    onClick={handleCopy} 
                    disabled={isStateEmpty}
                > 
                    Kopioi yhteenveto (Vanha) 
                </Button>
                
                <Button 
                    variant="secondary" 
                    className="text-primary fw-bold" 
                    style={{ backgroundColor: 'var(--color-background)', border: '2px dashed var(--color-primary)' }} 
                    onClick={handleHybridCopy} 
                    disabled={isStateEmpty}
                > 
                    🚀 Kopioi kokeilu (Supabase) 
                </Button>
                
                {feedback && <p className="feedback-text text-sm-dense fw-medium text-success" style={{ textAlign: 'center', marginTop: '0.25rem' }}>{feedback}</p>}
            </div>

            <AikatauluEhdotus state={state} actions={actions} />

            <ServiceManager 
                state={state} 
                actions={actions} 
                isOpen={isManagerOpen} 
                onClose={() => setIsManagerOpen(false)} 
            />
        </>
    );
};

export default SummaryPanel;