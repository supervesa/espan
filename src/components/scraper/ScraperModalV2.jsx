import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { parsePlanTextV2 } from './planParserV2'; // Uusi parseri!

// Globaalit UI-komponentit
import Modal from '../common/Modal';
import AlertBox from '../common/AlertBox';
import Checkbox from '../common/Checkbox';
import Tag from '../common/Tag';
import { BrainCircuit, CheckCircle, FileText, Calendar, Briefcase, Zap } from 'lucide-react';

const ScraperModalV2 = ({ isOpen, onClose, onApply }) => {
    const [step, setStep] = useState('input');
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [parsedData, setParsedData] = useState({
        phrases: [], services: [], signals: [], variables: {}, customTexts: {}
    });

    // Tila sille, mitkä vapaat tekstit asiantuntija haluaa tuoda!
    const [includedTexts, setIncludedTexts] = useState({});

    const handleAnalyze = async () => {
        if (!rawText.trim()) return alert("Liitä tekstiä ensin!");
        setIsAnalyzing(true);
        
        try {
            // Haetaan KAIKKI tarvittavat sanakirjat
            const [secRes, phraseRes, sigRes, varRes, srvRes] = await Promise.all([
                supabase.from('sections').select('id, section_key, title, import_aliases, is_multi_select'),
                supabase.from('phrases').select('id, phrase_key, short_title, base_text, extraction_pattern, section_id'),
                supabase.from('system_signals').select('signal_key, label'),
                supabase.from('variables').select('phrase_id, variable_key, import_behavior'),
                supabase.from('services').select('id, title, plan_text, service_type')
            ]);
                
            const extractedData = parsePlanTextV2(
                rawText, 
                secRes.data || [], 
                phraseRes.data || [], 
                sigRes.data || [], 
                varRes.data || [],
                srvRes.data || []
            );
            
            // Oletuksena kaikki löydetyt tekstilohkot ovat "valittuna" (true)
            const initialIncluded = {};
            Object.keys(extractedData.customTexts).forEach(key => {
                initialIncluded[key] = true;
            });
            
            setIncludedTexts(initialIncluded);
            setParsedData(extractedData);
            setStep('review');
            
        } catch (err) {
            console.error("Virhe:", err);
            alert("Virhe analysoinnissa.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApply = () => {
        // Suodatetaan pois ne tekstit, joilta asiantuntija otti ruksin pois!
        const finalCustomTexts = {};
        Object.entries(parsedData.customTexts).forEach(([key, text]) => {
            if (includedTexts[key]) {
                finalCustomTexts[key] = text;
            }
        });

        // Lähetetään siivottu data eteenpäin adapterille
        const finalData = { ...parsedData, customTexts: finalCustomTexts };
        if (typeof onApply === 'function') onApply(finalData);

        setStep('input');
        setRawText('');
        onClose();
    };

    const toggleTextInclusion = (sectionKey) => {
        setIncludedTexts(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
    };

    const updateVariable = (key, value) => {
        setParsedData(prev => ({ ...prev, variables: { ...prev.variables, [key]: value } }));
    };

    // --- MODAALIN ALATUNNISTEET (Footerit) ---
    const inputFooter = (
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn" onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analysoidaan...' : <><Zap size={18} style={{marginRight: '8px'}}/> Pura ja analysoi teksti</>}
            </button>
        </div>
    );

    const reviewFooter = (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button className="btn btn--secondary" onClick={() => setStep('input')}>Takaisin</button>
            <button className="btn" onClick={handleApply} style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                <CheckCircle size={18} style={{marginRight: '8px'}}/> Vie valinnat suunnitelmaan
            </button>
        </div>
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={() => { setStep('input'); onClose(); }} 
            title={step === 'input' ? 'URA-imuri (BETA)' : 'Tarkista ja muokkaa'} 
            icon={BrainCircuit}
            maxWidth="1000px"
            footer={step === 'input' ? inputFooter : reviewFooter}
        >
            {step === 'input' && (
                <div style={{ padding: '1rem 0' }}>
                    <AlertBox type="info" customStyle={{ marginBottom: '1.5rem' }}>
                        Tämä on uusi, älykkäämpi URA-imuri. Se ymmärtää dynaamisia otsikoita, poimii palvelut fiksusti ja sallii sinun valita tuotavat tekstit!
                    </AlertBox>
                    <textarea 
                        className="form-input text-mono"
                        rows="14"
                        placeholder="Liitä URA-teksti tähän (Ctrl+V)..."
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                    />
                </div>
            )}

            {step === 'review' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '1rem 0' }}>
                    
                    {/* VASEN SARAKE: Vapaat tekstit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                                <FileText size={18} color="var(--color-primary)" /> Vapaa teksti (Siirretään lisätietoihin)
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                                Poista ruksi niiden välilehtien kohdalta, joita <strong>et halua</strong> tuoda tähän uuteen suunnitelmaan.
                            </p>

                            {Object.keys(parsedData.customTexts).length === 0 && (
                                <AlertBox type="success">Kaikki teksti tunnistettiin vakiolauseiksi!</AlertBox>
                            )}

                            {Object.entries(parsedData.customTexts).map(([section, text]) => {
                                const isIncluded = includedTexts[section];
                                return (
                                    <div key={section} style={{ marginBottom: '1rem', opacity: isIncluded ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                                        <div style={{ marginBottom: '0.5rem' }}>
                                            {/* GLOBAALI CHECKBOX-KOMPONENTTI */}
                                            <Checkbox 
                                                label={`Välilehti: ${section.toUpperCase()}`}
                                                checked={isIncluded}
                                                onChange={() => toggleTextInclusion(section)}
                                            />
                                        </div>
                                        <textarea 
                                            className="form-input" 
                                            rows="4" 
                                            value={text}
                                            disabled={!isIncluded}
                                            onChange={(e) => {
                                                setParsedData(prev => ({
                                                    ...prev,
                                                    customTexts: { ...prev.customTexts, [section]: e.target.value }
                                                }));
                                            }}
                                            style={{ textDecoration: !isIncluded ? 'line-through' : 'none' }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* OIKEA SARAKE: Automaatio (Fraasit, Palvelut, Signaalit) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* ERIKOISMUUTTUJAT */}
                        <div className="panel-gray" style={{ margin: 0, padding: '1rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={18} color="var(--color-primary)"/> Poimitut erikoismuuttujat
                            </h4>
                            <div className="grid-cols-2-tight">
                                <div><label className="stat-label">Palvelu alkaa</label><input type="text" className="form-input text-mono" value={parsedData.variables['palvelu_alku'] || ''} onChange={(e) => updateVariable('palvelu_alku', e.target.value)} /></div>
                                <div><label className="stat-label">Palvelu päättyy</label><input type="text" className="form-input text-mono" value={parsedData.variables['palvelu_loppu'] || ''} onChange={(e) => updateVariable('palvelu_loppu', e.target.value)} /></div>
                                <div><label className="stat-label">Työnhaku alkanut</label><input type="text" className="form-input text-mono" value={parsedData.variables['tyonhaku_alkanut'] || ''} onChange={(e) => updateVariable('tyonhaku_alkanut', e.target.value)} /></div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="stat-label"><Briefcase size={12} style={{ display:'inline' }}/> Tavoiteammatti (ESCO)</label>
                                    <input type="text" className="form-input" value={parsedData.variables['tavoiteammatti_esco'] || ''} onChange={(e) => updateVariable('tavoiteammatti_esco', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* FRAASIT JA PALVELUT */}
                        <div className="card-inner" style={{ padding: '1rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Aktivoitavat laatikot & palvelut</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {parsedData.phrases.map(phrase => (
                                    <div key={phrase.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle size={16} color="var(--color-primary)" />
                                        <span style={{ fontWeight: '500' }}>{phrase.label}</span>
                                    </div>
                                ))}
                                {parsedData.services.map(service => (
                                    <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle size={16} color="var(--color-success)" />
                                        <span style={{ fontWeight: '500', color: 'var(--color-success-dark)' }}>[Palvelu] {service.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SIGNAALIT */}
                        <div className="card-inner" style={{ padding: '1rem', flexGrow: 1 }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Havaitut Signaalit</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {parsedData.signals.map(sig => (
                                    // GLOBAALI TAG-KOMPONENTTI
                                    <Tag key={sig.id} type="primary" onRemove={() => {
                                        setParsedData(prev => ({ ...prev, signals: prev.signals.filter(s => s.id !== sig.id) }));
                                    }}>
                                        {sig.label}
                                    </Tag>
                                ))}
                                {parsedData.signals.length === 0 && <span className="stat-label">Ei signaaleja.</span>}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ScraperModalV2;