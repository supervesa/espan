// --- src/components/scraper/ScraperModal.jsx ---

import React, { useState } from 'react';
import { BrainCircuit, CheckCircle, Zap } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { parsePlanText } from './planParser';

// Yhteiset komponentit
import Modal from '../common/Modal';
import Tag from '../common/Tag';
import Checkbox from '../common/Checkbox';

// Imurin omat paneelit
import ScraperServicesPanel from './ScraperServicesPanel';
import ScraperPatevyydetPanel from './ScraperPatevyydetPanel';
import ScraperVariablesPanel from './ScraperVariablesPanel';
import ScraperCustomTextsPanel from './ScraperCustomTextsPanel';
import ScraperTyokykyPanel from './ScraperTyokykyPanel';

const ScraperModal = ({ isOpen, onClose, onApply }) => {
    const [step, setStep] = useState('input');
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeSections, setActiveSections] = useState({});

    const [parsedData, setParsedData] = useState({
        phrases: [], 
        signals: [], 
        services: [], 
        patevyydet: [], 
        variables: {}, 
        customTexts: {},
        tyokykyData: {}
    });

    const handleAnalyze = async () => {
        if (!rawText.trim()) {
            return alert("Liitä tekstiä ensin!");
        }
        
        setIsAnalyzing(true);
        
        try {
            const [secRes, phraseRes, sigRes, varRes, serviceRes, patevyysRes] = await Promise.all([
                supabase.from('sections').select('id, section_key, title, is_multi_select'),
                supabase.from('phrases').select('id, phrase_key, short_title, base_text, extraction_pattern, section_id'),
                supabase.from('system_signals').select('signal_key, label, description'), 
                supabase.from('variables').select('phrase_id, variable_key, import_behavior'),
                supabase.from('services').select('*'),
                supabase.from('patevyydet_master').select('*')
            ]);
                
            if (secRes.error) throw secRes.error;
            if (phraseRes.error) throw phraseRes.error;
            if (sigRes.error) throw sigRes.error;
            if (varRes.error) throw varRes.error;
            if (serviceRes.error) throw serviceRes.error;
            if (patevyysRes.error) throw patevyysRes.error;

            const extractedData = parsePlanText(
                rawText, 
                secRes.data || [], 
                phraseRes.data || [], 
                sigRes.data || [], 
                varRes.data || [],
                serviceRes.data || [],
                patevyysRes.data || []
            );
            
            // Varmistetaan, että tyokykyData on olemassa, vaikka parseri ei sitä palauttaisi
            if (!extractedData.tyokykyData) {
                extractedData.tyokykyData = {};
            }

            // Asetetaan kaikki vapaan tekstin osiot oletuksena aktiivisiksi
            const initialActive = {};
            Object.keys(extractedData.customTexts).forEach(key => { 
                initialActive[key] = true; 
            });
            
            setActiveSections(initialActive);
            setParsedData(extractedData);
            setStep('review');
            
        } catch (err) {
            console.error("Virhe analysoinnissa:", err);
            alert("Virhe analysoitaessa tekstiä. Tarkista tietokantayhteys.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApply = () => {
        if (typeof onApply === 'function') {
            const filteredCustomTexts = {};
            Object.entries(parsedData.customTexts).forEach(([key, text]) => {
                if (activeSections[key]) {
                    filteredCustomTexts[key] = text;
                }
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

    // Apufunktiot tilamuutoksille
    const removeItem = (type, id) => {
        setParsedData(prev => ({ 
            ...prev, 
            [type]: prev[type].filter(item => item.id !== id) 
        }));
    };

    const updateVariable = (key, value) => {
        setParsedData(prev => ({ 
            ...prev, 
            variables: { ...prev.variables, [key]: value } 
        }));
    };

    const updateCustomText = (key, value) => {
        setParsedData(prev => ({ 
            ...prev, 
            customTexts: { ...prev.customTexts, [key]: value } 
        }));
    };

    const toggleSection = (key) => {
        setActiveSections(prev => ({ 
            ...prev, 
            [key]: !prev[key] 
        }));
    };

    // Footerin napit Modaliin
    const modalFooter = step === 'input' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button className="btn btn--secondary" onClick={resetAndClose}>
                Peruuta
            </button>
            <button 
                className="btn" 
                onClick={handleAnalyze} 
                disabled={isAnalyzing} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                {isAnalyzing ? 'Analysoidaan...' : <><Zap size={18}/> Pura ja analysoi teksti</>}
            </button>
        </div>
    ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn--secondary" onClick={resetAndClose}>
                    Peruuta
                </button>
                <button className="btn btn--secondary" onClick={() => setStep('input')}>
                    Takaisin tekstiin
                </button>
            </div>
            <button 
                className="btn" 
                onClick={handleApply} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <CheckCircle size={18} /> Vie valinnat suunnitelmaan
            </button>
        </div>
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={resetAndClose} 
            title={step === 'input' ? 'URA-imuri: Pura vanha suunnitelma' : 'Tarkista ja muokkaa tuodut tiedot'}
            icon={BrainCircuit}
            maxWidth="1000px"
            footer={modalFooter}
        >
            {step === 'input' ? (
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        Kopioi ja liitä aiempi työllisyyssuunnitelma tai asiantuntijan muistiinpanot tähän. 
                        Järjestelmä "syö" tekstistä automaattisesti vakiolausekkeet, signaalit ja päivämäärät, ja jakaa loput tekstistä automaattisesti oikeille välilehdille lisätietoihin.
                    </p>
                    <textarea 
                        className="form-input text-mono" 
                        rows="12" 
                        placeholder="Liitä teksti tähän (Ctrl+V)..."
                        value={rawText} 
                        onChange={(e) => setRawText(e.target.value)} 
                        style={{ resize: 'vertical' }}
                    />
                </div>
            ) : (
                <div className="flex-col-gap" style={{ paddingTop: '1rem' }}>
                    
                    {/* WIDGET-RIVI YLHÄÄLLÄ (3 saraketta, tiivis asettelu) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        
                        <ScraperServicesPanel 
                            services={parsedData.services} 
                            onToggleService={(id) => removeItem('services', id)} 
                        />

                        <ScraperPatevyydetPanel 
                            patevyydet={parsedData.patevyydet} 
                            onRemove={(id) => removeItem('patevyydet', id)} 
                        />

                        <div className="card-inner" style={{ padding: '1rem', borderLeft: '4px solid var(--color-warning)' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Havaitut Signaalit</span>
                                <span className="text-primary" style={{ fontWeight: 'bold' }}>{parsedData.signals.length} kpl</span>
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                                {parsedData.signals.map(sig => (
                                    <Tag key={sig.id} onRemove={() => removeItem('signals', sig.id)}>
                                        {sig.label}
                                    </Tag>
                                ))}
                                {parsedData.signals.length === 0 && (
                                    <span className="stat-label">Ei signaaleja.</span>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* PÄÄALUE (50/50 Sarakkeet) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start', marginTop: '0.5rem' }}>
                        
                        {/* VASEN SARAKE: Vapaa teksti */}
                        <div className="flex-col-gap">
                            <ScraperCustomTextsPanel 
                                customTexts={parsedData.customTexts} 
                                activeSections={activeSections} 
                                onToggleSection={toggleSection} 
                                onUpdateText={updateCustomText} 
                            />
                        </div>

                        {/* OIKEA SARAKE: Työkyky, Muuttujat ja Lomakevalinnat (Vakiolauseet) */}
                        <div className="flex-col-gap">
                            
                            <ScraperTyokykyPanel 
                                tyokykyData={parsedData.tyokykyData}
                                onUpdate={(newData) => setParsedData(prev => ({ ...prev, tyokykyData: newData }))}
                            />

                            <ScraperVariablesPanel 
                                variables={parsedData.variables} 
                                onUpdate={updateVariable} 
                            />

                            <div className="card-inner" style={{ padding: '1rem', flexGrow: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Aktivoitavat lomakevalinnat</h4>
                                    <span className="stat-label" style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                        Yhteensä: <strong className="text-primary">{parsedData.phrases.length}</strong>
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {parsedData.phrases.map(phrase => (
                                        <div key={phrase.id} style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                                            <Checkbox 
                                                label={phrase.label}
                                                checked={true} 
                                                onChange={() => removeItem('phrases', phrase.id)} 
                                            />
                                            {phrase.variables && Object.keys(phrase.variables).length > 0 && (
                                                <div style={{ marginTop: '0.25rem', marginLeft: '1.5rem', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                                                    + Muuttujat: {Object.values(phrase.variables).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {parsedData.phrases.length === 0 && (
                                        <span className="stat-label">Kaikki valinnat poistettu.</span>
                                    )}
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