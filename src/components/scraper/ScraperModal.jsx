// --- src/components/scraper/ScraperModal.jsx ---

import React, { useState } from 'react';
import { FileText, BrainCircuit, CheckCircle, X, Calendar, Briefcase, Zap } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { parsePlanText } from './planParser';

const ScraperModal = ({ isOpen, onClose, onApply }) => {
    const [step, setStep] = useState('input');
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [parsedData, setParsedData] = useState({
        phrases: [],
        signals: [],
        variables: {},
        customTexts: {}
    });

    const handleAnalyze = async () => {
        if (!rawText.trim()) return alert("Liitä tekstiä ensin!");
        setIsAnalyzing(true);
        
        try {
            console.log("Käynnistetään URA-imuri... Haetaan dynaamiset säännöt tietokannasta.");
            
            // 1. Haetaan KAIKKI tarvittavat tietosanakirjat Supabasesta
      const [secRes, phraseRes, sigRes, varRes] = await Promise.all([
    supabase.from('sections').select('id, section_key, title, is_multi_select'), // <-- LISÄTTY id ja is_multi_select
    supabase.from('phrases').select('id, phrase_key, short_title, base_text, extraction_pattern, section_id'), // <-- LISÄTTY section_id
    supabase.from('system_signals').select('signal_key, label'),
    supabase.from('variables').select('phrase_id, variable_key, import_behavior')
]);
                
            if (secRes.error) throw secRes.error;
            if (phraseRes.error) throw phraseRes.error;
            if (sigRes.error) throw sigRes.error;
            if (varRes.error) throw varRes.error;

            // 2. Syötetään teksti ja KAIKKI sanakirjat älykkäälle kapellimestarille
            const extractedData = parsePlanText(
                rawText, 
                secRes.data || [], 
                phraseRes.data || [], 
                sigRes.data || [], 
                varRes.data || []
            );
            
            // 3. Tallennetaan tulos ja vaihdetaan näkymää
            setParsedData(extractedData);
            setStep('review');
            
        } catch (err) {
            console.error("Virhe analysoinnissa:", err);
            alert("Virhe analysoitaessa tekstiä. Tarkista tietokantayhteys.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const togglePhrase = (id) => {
        setParsedData(prev => ({
            ...prev,
            phrases: prev.phrases.filter(p => p.id !== id)
        }));
    };

    const removeSignal = (id) => {
        setParsedData(prev => ({
            ...prev,
            signals: prev.signals.filter(s => s.id !== id)
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

    const handleApply = () => {
        if (typeof onApply === 'function') {
            onApply(parsedData); // TÄMÄ TRIGGAA useScraperAdapterin!
        }
        // Nollataan tila valmiiksi seuraavaa kertaa varten
        setStep('input');
        setRawText('');
        onClose();
    };

    const handleClose = () => {
        setStep('input');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                
                <div className="admin-modal-header" style={{ backgroundColor: 'var(--color-primary)', color: 'white', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        <BrainCircuit size={24} />
                        {step === 'input' ? 'URA-imuri: Pura vanha suunnitelma' : 'Tarkista ja muokkaa tuodut tiedot'}
                    </h2>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {step === 'input' && (
                    <div className="admin-modal-body" style={{ display: 'block', padding: '2rem' }}>
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
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                className="btn" 
                                onClick={handleAnalyze} 
                                disabled={isAnalyzing}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}
                            >
                                {isAnalyzing ? 'Analysoidaan...' : <><Zap size={18}/> Pura ja analysoi teksti</>}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'review' && (
                    <div className="admin-modal-body">
                        
                        <div className="flex-col-gap">
                            <div className="smart-analysis-box" style={{ margin: 0 }}>
                                <div className="smart-analysis-header">
                                    <CheckCircle size={20} color="var(--color-success)" />
                                    Analyysi valmis!
                                </div>
                                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                    Järjestelmä on poiminut tekstistä tutut elementit. Voit muokata poimintoja tai poistaa yksittäisiä valintoja oikealla olevasta sarakkeesta ennen hyväksymistä.
                                </p>
                                
                                <div className="grid-cols-2-tight">
                                    <div className="stat-box" style={{ padding: '0.75rem' }}>
                                        <span className="stat-label">Lomakevalinnat</span>
                                        <strong className="stat-value text-primary">{parsedData.phrases.length} kpl</strong>
                                    </div>
                                    <div className="stat-box" style={{ padding: '0.75rem' }}>
                                        <span className="stat-label">Signaalit (Tagit)</span>
                                        <strong className="stat-value text-primary">{parsedData.signals.length} kpl</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="card-inner flex-grow">
                                <h4 className="icon-heading" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                                    <FileText size={18} /> Vapaa teksti (Siirretään lisätietoihin)
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                                    Näitä kappaleita ei tunnistettu vakiolauseiksi, joten ne siirretään suoraan kyseisten välilehtien tekstikenttiin.
                                </p>

                                <div className="flex-col-gap">
                                    {Object.keys(parsedData.customTexts).length === 0 && (
                                        <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                                            Kaikki teksti tunnistettiin vakiolauseiksi. Ei vapaata tekstiä.
                                        </p>
                                    )}
                                    {Object.entries(parsedData.customTexts).map(([section, text]) => (
                                        <div key={section}>
                                            <label className="stat-label" style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
                                                Välilehti: {section.toUpperCase()}
                                            </label>
                                            <textarea 
                                                className="form-input" 
                                                rows="4" 
                                                value={text}
                                                onChange={(e) => updateCustomText(section, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-col-gap">
                            
                            <div className="panel-gray" style={{ margin: 0, padding: '1rem 1.5rem' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Calendar size={18} color="var(--color-primary)"/> Poimitut erikoismuuttujat
                                </h4>
                                <div className="grid-cols-2-tight">
                                    <div>
                                        <label className="stat-label">Palvelu alkaa</label>
                                        <input type="text" className="form-input text-mono" value={parsedData.variables['palvelu_alku'] || ''} onChange={(e) => updateVariable('palvelu_alku', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="stat-label">Palvelu päättyy</label>
                                        <input type="text" className="form-input text-mono" value={parsedData.variables['palvelu_loppu'] || ''} onChange={(e) => updateVariable('palvelu_loppu', e.target.value)} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="stat-label"><Briefcase size={12} style={{ display:'inline', marginRight:'0.2rem' }}/> Tavoiteammatti (ESCO)</label>
                                        <input type="text" className="form-input" value={parsedData.variables['tavoiteammatti_esco'] || ''} onChange={(e) => updateVariable('tavoiteammatti_esco', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="card-inner" style={{ padding: '1rem 1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Havaitut Signaalit</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {parsedData.signals.map(sig => (
                                        <span key={sig.id} className="tag-dismissible tag-dismissible--primary">
                                            {sig.label}
                                            <button className="btn-tag-dismiss" onClick={() => removeSignal(sig.id)} title="Poista signaali">
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                    {parsedData.signals.length === 0 && <span className="stat-label">Ei signaaleja.</span>}
                                </div>
                            </div>

                            <div className="card-inner" style={{ padding: '1rem 1.5rem', flexGrow: 1 }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Aktivoitavat vakiolauseet</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {parsedData.phrases.map(phrase => (
                                        <div key={phrase.id} className="checkbox-wrapper" style={{ padding: '0.25rem 0' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={true} 
                                                onChange={() => togglePhrase(phrase.id)} 
                                                className="modern-checkbox"
                                                id={`phrase-${phrase.id}`}
                                            />
                                            <label htmlFor={`phrase-${phrase.id}`} className="modern-checkbox-label" style={{ margin: 0, fontWeight: '500' }}>
                                                {phrase.label}
                                                {/* Näytetään myös fraasista poimitut muuttujat, jos niitä on (esim pvm) */}
                                                {phrase.variables && Object.keys(phrase.variables).length > 0 && (
                                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                                                        Muuttujat: {Object.entries(phrase.variables).map(([k,v]) => `${k}=${v}`).join(', ')}
                                                    </span>
                                                )}
                                            </label>
                                        </div>
                                    ))}
                                    {parsedData.phrases.length === 0 && <span className="stat-label">Kaikki valinnat poistettu.</span>}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {step === 'review' && (
                    <div className="admin-modal-footer">
                        <button className="btn btn--secondary" onClick={() => setStep('input')}>
                            Takaisin
                        </button>
                        <button className="btn" onClick={handleApply} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} /> Vie valinnat suunnitelmaan
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ScraperModal;