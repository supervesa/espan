import React, { useState } from 'react';
import { BrainCircuit, CheckCircle, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { parsePlanText } from './planParser';

// Yhteiset komponentit
import Modal from '../common/Modal';
import Tag from '../common/Tag';
import Checkbox from '../common/Checkbox';

// Imurin omat paneelit
import ScraperGMServicePanel from './ScraperGMServicePanel'; 
import ScraperGMEducationPanel from './ScraperGMEducationPanel'; // UUSI PANEELI TUOTU
import ScraperPatevyydetPanel from './ScraperPatevyydetPanel';
import ScraperVariablesPanel from './ScraperVariablesPanel';
import ScraperCustomTextsPanel from './ScraperCustomTextsPanel';
import ScraperTyokykyPanel from './ScraperTyokykyPanel';
import ScraperEdellytyksetPanel from './ScraperEdellytyksetPanel'; 

const ScraperModal = ({ isOpen, onClose, onApply, state, actions }) => {
    const [step, setStep] = useState('input');
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeSections, setActiveSections] = useState({});

    const [parsedData, setParsedData] = useState({
        phrases: [], 
        signals: [], 
        services: [], 
        sessionServices: [],
        sessionEducations: [], // UUSI: Golden Master koulutukset
        patevyydet: [], 
        variables: {}, 
        customTexts: {},
        tyokykyData: {},
        edellytyksetData: {},
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
                rawText, 
                secRes.data || [], 
                phraseRes.data || [], 
                sigRes.data || [], 
                varRes.data || [],
                serviceRes.data || [],
                patevyysRes.data || []
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
            
            // --- 1. TALLENNETAAN GM PALVELUT ---
            const servicesToApply = parsedData.sessionServices || [];
            if (servicesToApply.length > 0 && actions?.onUpdateVariable) {
                const currentServices = Array.isArray(state?.sessionServices) ? state.sessionServices : [];
                const mergedServices = [...currentServices, ...servicesToApply];
                actions.onUpdateVariable('global', 'sessionServices', null, mergedServices);
            }

            // --- 2. TALLENNETAAN GM KOULUTUKSET ---
            const edusToApply = parsedData.sessionEducations || [];
            if (edusToApply.length > 0 && actions?.onUpdateVariable) {
                const currentEdus = Array.isArray(state?.sessionEducations) ? state.sessionEducations : [];
                const mergedEdus = [...currentEdus, ...edusToApply];
                actions.onUpdateVariable('global', 'sessionEducations', null, mergedEdus);
                console.log("GM Sync: Koulutukset tallennettu", mergedEdus);
            }

            // --- 3. MUUT TIEDOT JA TEKSTIT ---
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
            maxWidth="1000px"
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        
                        {/* VASEN SARAKE: Koulutukset ja Palvelut */}
                        <div className="flex-col-gap">
                            <ScraperGMServicePanel 
                                services={parsedData.sessionServices} 
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, sessionServices: newData }))}
                                onRemove={(id) => removeItem('sessionServices', id)}
                            />
                            
                            {/* UUSI KOULUTUSPANEELI */}
                            <ScraperGMEducationPanel 
                                educations={parsedData.sessionEducations} 
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, sessionEducations: newData }))}
                                onRemove={(id) => removeItem('sessionEducations', id)}
                            />
                        </div>

                        {/* KESKISARAKE: Pätevyydet */}
                        <ScraperPatevyydetPanel 
                            patevyydet={parsedData.patevyydet} 
                            onRemove={(id) => removeItem('patevyydet', id)} 
                        />

                        {/* OIKEA SARAKE: Signaalit */}
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
                                {parsedData.phrases.map(phrase => (
                                    <Checkbox 
                                        key={phrase.id}
                                        label={phrase.short_title || phrase.base_text || phrase.phrase_key || 'Tuntematon valinta'}
                                        checked={true} 
                                        onChange={() => removeItem('phrases', phrase.id)} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ScraperModal;