import React, { useState } from 'react';
import { BrainCircuit, CheckCircle, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { parsePlanText } from './planParser';

// Tuodaan uusi älykäs hook, joka hoitaa kaiken salauksen!
import { useSentinelIdentity } from '../../hooks/useSentinelIdentity';

// Yhteiset komponentit
import Modal from '../common/Modal';
import Tag from '../common/Tag';
import Checkbox from '../common/Checkbox';

// Imurin omat paneelit
import ScraperGMServicePanel from './ScraperGMServicePanel'; 
import ScraperServicesPanel from './ScraperServicesPanel'; // Lisätty asiantuntijapalveluiden paneeli
import ScraperGMEducationPanel from './ScraperGMEducationPanel'; 
import ScraperPatevyydetPanel from './ScraperPatevyydetPanel';
import ScraperVariablesPanel from './ScraperVariablesPanel';
import ScraperCustomTextsPanel from './ScraperCustomTextsPanel';
import ScraperTyokykyPanel from './ScraperTyokykyPanel';
import ScraperEdellytyksetPanel from './ScraperEdellytyksetPanel'; 
import ScraperSentinelPanel from './ScraperSentinelPanel'; 

const ScraperModal = ({ isOpen, onClose, onApply, state, actions }) => {
    const [step, setStep] = useState('input');
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeSections, setActiveSections] = useState({});
    
    // Tila arkistosta haetuille tiedoille
    const [sentinelMeta, setSentinelMeta] = useState({ isKnown: false, sources: {} });

    // Tuodaan Ovimies-hook suoraan käyttöön
    const { checkIdentity } = useSentinelIdentity();

    const [parsedData, setParsedData] = useState({
        phrases: [], signals: [], services: [], sessionServices: [],
        sessionEducations: [], patevyydet: [], variables: {}, 
        customTexts: {}, tyokykyData: {}, edellytyksetData: {},
        tyottomyysturvaData: { answers: {} }
    });

    const handleAnalyze = async () => {
        if (!rawText.trim()) return alert("Liitä tekstiä ensin!");
        setIsAnalyzing(true);
        
        try {
            const [secRes, phraseRes, sigRes, varRes, serviceRes, patevyysRes] = await Promise.all([
                supabase.from('sections').select('id, section_key, title, is_multi_select'),
                supabase.from('phrases').select('id, phrase_key, short_title, base_text, extraction_pattern, section_id, grouping_key, metadata'),
                supabase.from('system_signals').select('signal_key, label, description'), 
                supabase.from('variables').select('phrase_id, variable_key, import_behavior'),
                supabase.from('services').select('*'),
                supabase.from('patevyydet_master').select('*')
            ]);
                
            if (secRes.error) throw secRes.error;

            const extractedData = parsePlanText(
                rawText, secRes.data || [], phraseRes.data || [], 
                sigRes.data || [], varRes.data || [], serviceRes.data || [], patevyysRes.data || []
            );
            
            if (!extractedData.tyokykyData) extractedData.tyokykyData = {};
            if (!extractedData.tyottomyysturvaData) extractedData.tyottomyysturvaData = { answers: {} };
            if (!extractedData.edellytyksetData) {
                extractedData.edellytyksetData = {
                    escoNimi: null, finescoAla: null, vaihtoehtoisetAlat: [],
                    activeTags: { tavoitteet: [], markkina: [], elamantila: [] },
                    selections: { vireilla: null, hylatty: null }
                };
            }

            // =========================================================
            // 🕵️ OVIMIEHEN TAUSTAHAKU (Tyhmä ja nopea modal-reititys)
            // =========================================================
            let isKnown = false;
            const sources = {};

            const normalize = (str) => {
                if (!str || str === 'X' || str === 'XX' || str === 'XXXX' || str === 'XXX') return str; 
                return String(str).toUpperCase().replace(/[^A-Z0-9ÄÖÅ]/g, '');
            };

            // Rakennetaan väliaikainen avain (Modulo 997)
            let suola = 'XXX', vuosiPari = 'X';
            if (extractedData.variables.tyonhaku_alkanut) {
                const parts = String(extractedData.variables.tyonhaku_alkanut).split('.');
                if (parts.length >= 3) {
                    const p = parts[0].padStart(2, '0');
                    const k = parts[1].padStart(2, '0');
                    const v = parts[2].trim().substring(0, 4); 
                    
                    if (v.length === 4) {
                        const rimpsuNum = parseInt(`${p}${k}${v}`, 10);
                        if (!isNaN(rimpsuNum)) {
                            suola = String(rimpsuNum % 997).padStart(3, '0');
                        }
                        vuosiPari = v.charAt(1) + v.charAt(3);
                    }
                }
            }
            const kieli = extractedData.variables.aidinkieli || 'X';
            const kunta = extractedData.variables.kotikunta || 'X';
            
            const idPart = `${suola}${normalize(kieli)}${normalize(kunta)}${normalize(vuosiPari)}`;
            const realDataLength = idPart.replace(/X/g, '').length;

            if (realDataLength >= 4) {
                try {
                    // Hook hoitaa nyt kaiken salauksen ja purkamisen!
                    const result = await checkIdentity(idPart);
                    
                    if (result?.found && result?.processed) {
                        isKnown = true;
                        const { sv, postinro, historia, viimeKayntiKk, latestTapa, signals } = result.processed;
                        
                        // Yhdistetään tietokannan löydökset (Syntymävuosi)
                        if (!extractedData.variables.syntymavuosi && sv) {
                            extractedData.variables.syntymavuosi = sv;
                            sources.syntymavuosi = 'db'; 
                        }

                        // Yhdistetään tietokannan löydökset (Postinumero)
                        if (!extractedData.variables.postinumero && postinro) {
                            extractedData.variables.postinumero = postinro;
                            sources.postinumero = 'db'; 
                            
                            if (!extractedData.signals.some(s => s.id === `postinumero_${postinro}`)) {
                                extractedData.signals.push({ 
                                    id: `postinumero_${postinro}`, 
                                    label: `Postinumero: ${postinro}` 
                                });
                            }
                        }

                        // Tallennetaan historia
                        if (historia.length > 0) {
                            extractedData.variables.tapaamishistoria = historia;
                        }

                        if (viimeKayntiKk) {
                            extractedData.variables.viime_kaynti_kk = viimeKayntiKk;
                            sources.viime_kaynti_kk = 'db';
                        }
                        
                        if (!extractedData.variables.yhteydenottotapa && latestTapa) {
                            extractedData.variables.yhteydenottotapa = latestTapa;
                            sources.yhteydenottotapa = 'db';
                        }
                        
                        // Lisätään Ovimiehen luomat älykkäät signaalit (esim. 6kk hälytys)
                        signals.forEach(sig => {
                            if (!extractedData.signals.some(s => s.id === sig.id)) {
                                extractedData.signals.push(sig);
                            }
                        });
                    }
                } catch (err) {
                    console.error("Sentinel Modal Check Error:", err);
                }
            }
            // =========================================================
            
            setSentinelMeta({ isKnown, sources });

            const initialActive = {};
            Object.keys(extractedData.customTexts).forEach(key => { initialActive[key] = true; });
            
            setActiveSections(initialActive);
            setParsedData(extractedData);
            setStep('review');
            
        } catch (err) {
            console.error("Virhe analysoinnissa:", err);
            alert("Virhe analysoitaessa tekstiä.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApply = () => {
        if (typeof onApply === 'function') {
            
            // 1. Viedään uudet Asiantuntijapalvelut (TÄMÄ PUUTTUI!)
            const asiantuntijaToApply = parsedData.services || [];
            if (asiantuntijaToApply.length > 0 && actions?.onUpdateVariable) {
                const currentAsiantuntija = Array.isArray(state?.services) ? state.services : [];
                actions.onUpdateVariable('global', 'services', null, [...currentAsiantuntija, ...asiantuntijaToApply]);
            }

            // 2. Viedään vanhat raskaat palvelut
            const servicesToApply = parsedData.sessionServices || [];
            if (servicesToApply.length > 0 && actions?.onUpdateVariable) {
                const currentServices = Array.isArray(state?.sessionServices) ? state.sessionServices : [];
                actions.onUpdateVariable('global', 'sessionServices', null, [...currentServices, ...servicesToApply]);
            }

            // 3. Viedään koulutukset
            const edusToApply = parsedData.sessionEducations || [];
            if (edusToApply.length > 0 && actions?.onUpdateVariable) {
                const currentEdus = Array.isArray(state?.sessionEducations) ? state.sessionEducations : [];
                actions.onUpdateVariable('global', 'sessionEducations', null, [...currentEdus, ...edusToApply]);
            }

            // 4. Viedään vapaat tekstit
            const filteredCustomTexts = {};
            Object.entries(parsedData.customTexts).forEach(([key, text]) => {
                if (activeSections[key]) filteredCustomTexts[key] = text;
            });

            onApply({ 
                ...parsedData, 
                customTexts: filteredCustomTexts 
            }); 
        }
        resetAndClose();
    };

    const resetAndClose = () => {
        setStep('input');
        setRawText(''); 
        setActiveSections({});
        setSentinelMeta({ isKnown: false, sources: {} });
        onClose();
    };

    const removeItem = (type, id) => {
        setParsedData(prev => ({ 
            ...prev, 
            [type]: prev[type].filter(item => item.id !== id) 
        }));
    };

    const toggleSection = (key) => {
        setActiveSections(prev => ({ 
            ...prev, 
            [key]: !prev[key] 
        }));
    };

    const modalFooter = step === 'input' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button className="btn btn--secondary" onClick={resetAndClose}>Peruuta</button>
            <button className="btn" onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analysoidaan...' : <><Zap size={18}/> Pura ja analysoi</>}
            </button>
        </div>
    ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button className="btn btn--secondary" onClick={() => setStep('input')}>Takaisin</button>
            <button className="btn" onClick={handleApply}>
                <CheckCircle size={18} /> Vie valinnat suunnitelmaan
            </button>
        </div>
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={resetAndClose} 
            title={step === 'input' ? 'URA-imuri: Pura vanha suunnitelma' : 'Tarkista tuodut tiedot'}
            icon={BrainCircuit}
            maxWidth="1100px" 
            footer={modalFooter}
        >
            {step === 'input' ? (
                <div style={{ padding: '1rem 0' }}>
                    <textarea 
                        className="form-input text-mono" 
                        rows="12" 
                        placeholder="Liitä teksti tähän (Ctrl+V)..."
                        value={rawText} 
                        onChange={(e) => setRawText(e.target.value)} 
                    />
                </div>
            ) : (
                <div className="flex-col-gap" style={{ paddingTop: '1rem' }}>
                    
                 {/* UUSI: Älykäs paneeli propseilla ja historialla! */}
                    <ScraperSentinelPanel 
                        variables={parsedData.variables} 
                        isKnownCustomer={sentinelMeta.isKnown}
                        sourceFlags={sentinelMeta.sources}
                        historia={parsedData.variables.tapaamishistoria || []}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        
                        <div className="flex-col-gap">
                            
                            {/* LISÄTTY: Asiantuntijapalveluiden auditointipaneeli */}
                            <ScraperServicesPanel 
                                services={parsedData.services} 
                                onUpdateService={(newData) => setParsedData(prev => ({ ...prev, services: newData }))}
                                onRemoveService={(id) => removeItem('services', id)}
                            />

                            <ScraperGMServicePanel 
                                services={parsedData.sessionServices} 
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, sessionServices: newData }))}
                                onRemove={(id) => removeItem('sessionServices', id)}
                            />
                            
                            <ScraperGMEducationPanel 
                                educations={parsedData.sessionEducations} 
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, sessionEducations: newData }))}
                                onRemove={(id) => removeItem('sessionEducations', id)}
                            />
                        </div>

                        <ScraperPatevyydetPanel 
                            patevyydet={parsedData.patevyydet} 
                            onRemove={(id) => removeItem('patevyydet', id)} 
                        />

                        <div className="card-inner" style={{ padding: '1rem', borderLeft: '4px solid var(--color-warning)' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Signaalit</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {parsedData.signals.map(sig => (
                                    <Tag key={sig.id} onRemove={() => removeItem('signals', sig.id)}>{sig.label}</Tag>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
                        <div className="flex-col-gap">
                            <ScraperCustomTextsPanel 
                                customTexts={parsedData.customTexts} 
                                activeSections={activeSections} 
                                onToggleSection={toggleSection} 
                                onUpdateText={(key, val) => setParsedData(prev => ({...prev, customTexts: {...prev.customTexts, [key]: val}}))} 
                            />
                        </div>

                        <div className="flex-col-gap">
                            <ScraperEdellytyksetPanel 
                                edellytyksetData={parsedData.edellytyksetData}
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, edellytyksetData: newData }))}
                            />
                            <ScraperTyokykyPanel 
                                tyokykyData={parsedData.tyokykyData}
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, tyokykyData: newData }))}
                            />
                            <div className="card-inner" style={{ padding: '1rem' }}>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>Lomakevalinnat ({parsedData.phrases.length})</h4>
                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {parsedData.phrases.map(phrase => (
                                        <Checkbox 
                                            key={phrase.id}
                                            label={phrase.label || phrase.short_title || phrase.base_text || phrase.phrase_key || 'Tuntematon valinta'}
                                            checked={true} 
                                            onChange={() => removeItem('phrases', phrase.id)} 
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ScraperModal;