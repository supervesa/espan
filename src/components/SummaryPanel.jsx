import React, { useState, useEffect, useRef } from 'react';
import { generateSectionContent, generateFullSummary, generateHybridSummary, generateHybridSectionContent } from '../utils/summaryGenerator.js';
import { planData } from '../data/planData.js';
import AikatauluEhdotus from './AikatauluEhdotus';
import CopyButton from './common/CopyButton';
import Button from './common/Button';
import Checkbox from './common/Checkbox';
import ServiceManager from './ServiceManager'; 
import { Database, Zap } from 'lucide-react';
import { useSentinelAnalytics } from '../context/useSentinelAnalytics';
import { useSentinelFingerprint } from '../hooks/useSentinelFingerprint';
import { useSentinelIdentity } from '../hooks/useSentinelIdentity';

const FINGERPRINT = '\u200B\u200D\u200C';

const SummaryPanel = ({ state, sections, dbPlanData, dbKnowledge, actions, asiantuntijaId }) => {
    const [feedback, setFeedback] = useState('');
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false); 
    const [isSaved, setIsSaved] = useState(false); 
    
    // UUDET TILAT ASETUKSILLE
    const [useLegacy, setUseLegacy] = useState(false);
    const [skipAnalytics, setSkipAnalytics] = useState(false);
    const [skipSentinel, setSkipSentinel] = useState(false);
    
    const [currentFingerprint, setCurrentFingerprint] = useState(''); 
    const observerRef = useRef(null); 
    const identityCheckedRef = useRef(false); 
    
    const { logPlanCopied } = useSentinelAnalytics();
    const { getFingerprintData } = useSentinelFingerprint(state);
    const { checkIdentity, registerIdentity, isReturning } = useSentinelIdentity();

    const isStateEmpty = !state || Object.keys(state).length === 0;

    // --- 🕵️ OVIMIEHEN TAUSTATARKISTUS (HILJAINEN) ---
    useEffect(() => {
        if (!getFingerprintData) return;
        
        const { idPart } = getFingerprintData('check');
        
        if (idPart) {
            setCurrentFingerprint(idPart);

            if (!isStateEmpty && !identityCheckedRef.current) {
                const realDataLength = idPart.replace(/X/g, '').length;

                if (realDataLength >= 4) {
                    console.log("Ovimies: Tunniste analysoitu, kysytään tietokannalta...");
                    
                    checkIdentity(idPart).then(result => {
                        if (result?.found) {
                            console.group("📋 OVIMIEHEN LÖYDÖKSET LOMAKKEELLE:");
                            console.log("Holvin sisältö (JSON):", result.vaultData);
                            console.log("Tiedot ovat nyt muistissa, niitä ei vielä pakoteta lomakkeelle.");
                            console.groupEnd();
                        }
                    });
                    identityCheckedRef.current = true; 
                }
            }
        }
    }, [state, isStateEmpty, getFingerprintData, checkIdentity]);

    useEffect(() => {
        setIsSaved(false);
    }, [state]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (!isStateEmpty && !isSaved) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isStateEmpty, isSaved]);

    // --- YHDISTETTY MASTER-KOPIOINTI ---
    const handleMasterCopy = () => {
        // Valitaan generaattori asetuksen mukaan
        const summaryToCopy = useLegacy 
            ? generateFullSummary(state) 
            : generateHybridSummary(state, dbPlanData, dbKnowledge); 
            
        try {
            const plainText = summaryToCopy.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = summaryToCopy.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {
                const lines = paragraph.split('\n'); 
                const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; 
                const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); 
                return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;
            }).join('');

            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml, 'text/plain': blobText}); 
            
            navigator.clipboard.write([clipboardItem]).then(() => { 
                setFeedback('Suunnitelma kopioitu ja tiedot lukittu!'); 
                setIsSaved(true); 
                
                if (!skipAnalytics && logPlanCopied) {
                    logPlanCopied(state, asiantuntijaId);
                }

                if (!skipSentinel && getFingerprintData) {
                    const { idPart, payload } = getFingerprintData('save');
                    if (payload && (payload.sv !== 'XXXX' || payload.historia.length > 0)) {
                        registerIdentity(idPart, payload);
                    }
                }

                setTimeout(() => setFeedback(''), 2500); 
            }, () => { 
                navigator.clipboard.writeText(plainText).then(() => {
                    setFeedback('Kopioitu (ei-muotoiltuna)!');
                    setIsSaved(true);
                    
                    if (!skipAnalytics && logPlanCopied) {
                        logPlanCopied(state, asiantuntijaId);
                    }
                    
                    if (!skipSentinel && getFingerprintData) {
                        const { idPart, payload } = getFingerprintData('save');
                        if (payload && (payload.sv !== 'XXXX' || payload.historia.length > 0)) {
                            registerIdentity(idPart, payload);
                        }
                    }
                    
                    setTimeout(() => setFeedback(''), 2500);
                });
            }); 
        } catch (err) {
            console.error("Kopiointi epäonnistui", err);
        }
    };

    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
        
        if (simpleId === 'koulutus') {
            const hasContent = state.koulutus?.avainsana || state.ammattikortit || state.yrittajyys || state['custom-koulutus'] || state['custom-kielitaso'];
            return hasContent ? { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' } : { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
        }

        if (simpleId === 'edellytykset') {
            const hasContent = state['custom-lopullinen_33_arvio'] || state['custom-edellytykset'];
            return hasContent ? { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' } : { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
        }

        const sectionState = state[simpleId];
        if (sectionState && Object.keys(sectionState).length > 0) {
            return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
        }
        if (state[`custom-${simpleId}`]) {
            return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' };
        }
        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };

    const areAllSectionsComplete = sections.every(section => {
        const status = getSectionStatus(section.id);
        return status.text === 'Valmis' || status.text === 'Muokattu';
    });

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
            if (observerRef.current) { observerRef.current.disconnect(); }
        };
    }, [sections]); 

    return (
        <>
            <div className="summary-drag-handle"></div>
            
            <div style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 className="text-xl fw-bold" style={{ margin: 0 }}>Yhteenveto</h2>
                        {isReturning && (
                            <span className="tag tag--warning text-xs-dense fw-bold" style={{ backgroundColor: '#fef08a', color: '#854d0e', border: '1px solid #fde047' }}>
                                🔄 Tunnettu asiakas
                            </span>
                        )}
                    </div>
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
                        return <div key={section.id} className={`chip ${status.chipClass}`}>{section.name}</div>;
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
                     else if (sectionId === 'edellytykset') {
                         sectionText = state['custom-lopullinen_33_arvio']?.trim() || state['custom-edellytykset']?.trim() || '';
                     }
                     else if (sectionDataFromPlan) { 
                         // Huom: Tässä paneelin esikatselussa käytetään aina Hybridiä näyttämiseen
                         sectionText = generateHybridSectionContent(sectionDataFromPlan, selection, state, dbKnowledge);
                         let customText = state[`custom-${sectionId}`]?.trim() || '';
                         
                         if (sectionId === 'tyokyky') {
                             const tyokykyLopullinen = state['custom-tyokyky_lopullinen']?.trim();
                             if (tyokykyLopullinen) customText = customText ? `${customText}\n\n${tyokykyLopullinen}` : tyokykyLopullinen;
                         }

                         if (customText && !sectionText.includes(customText)) { 
                            sectionText += (sectionText ? '\n\n' : '') + customText;
                         }
                     }
                     
                     if (!sectionDataFromPlan && !['koulutus', 'edellytykset'].includes(sectionId)) return null;

                     const isActive = panelSection.id === activeSectionId;
                     return (
                        <li key={panelSection.id} className={`summary-item ${isActive ? 'summary-item--active' : ''}`} data-target={panelSection.id}>
                            <div className="summary-item-header" onClick={() => {
                                document.getElementById(panelSection.id)?.scrollIntoView({ behavior: 'smooth' });
                            }}>
                                <span className="summary-item__title text-sm fw-semibold">{panelSection.name}</span>
                                <span className={`tag ${status.tagClass} text-xs-dense fw-medium`}>{status.text}</span>
                            </div>

                            {sectionText && (
                                <div className="summary-item-content-wrapper" style={{ marginTop: '0.5rem' }}>
                                    <div className="summary-item-generated-text text-sm lh-tight text-slate-700">
                                        {sectionText.split('\n').map((line, idx) => (
                                            <React.Fragment key={idx}>
                                                {line}
                                                <br />
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <CopyButton textToCopy={sectionText.replace(FINGERPRINT, '').replace(/\*\*/g, '').trim()} />
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="summary-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                
                {/* UUDET ASETUS-CHECKBOXIT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <Checkbox 
                        label="Käytä perinteistä tekstigeneraattoria (Legacy)" 
                        checked={useLegacy} 
                        onChange={setUseLegacy} 
                    />
                    <Checkbox 
                        label="Älä tallenna tilastoihin (Testitila)" 
                        checked={skipAnalytics} 
                        onChange={setSkipAnalytics} 
                    />
                    <Checkbox 
                        label="Älä päivitä asiakkaan taustatietoja arkistoon" 
                        checked={skipSentinel} 
                        onChange={setSkipSentinel} 
                    />
                </div>
                
                <Button 
                    fullWidth={true}
                    onClick={handleMasterCopy} 
                    disabled={isStateEmpty}
                    icon={Zap}
                > 
                    Kopioi ja Tallenna
                </Button>

                {currentFingerprint && (
                    <div className="text-xs-dense text-muted font-mono" style={{ textAlign: 'center', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                        [Tunniste: {currentFingerprint}]
                    </div>
                )}

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