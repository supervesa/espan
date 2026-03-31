// --- src/components/koulutusYrittajyys/index.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Ammattikortit from './Ammattikortit';
import RadioPhraseSection from './RadioPhraseSection';
import SummaryPreview from './SummaryPreview';
import { useKoulutusSummary } from './useKoulutusSummary';
import { PhraseOption } from '../PhraseOption';
import TuettuOpiskelu from './TuettuOpiskelu';
import { GraduationCap, Award, Briefcase, Languages, User, Sparkles, CheckCircle2, Loader2, MousePointerClick, Info, Plus } from 'lucide-react';

const KoulutusJaYrittajyys = ({ state, actions }) => {
    const DB_KOULUTUS = 'e73f3897-85e1-4c05-a601-d5a2b67e9c75';
    const DB_KORTIT = 'fbb22c56-6a1c-49a7-8a7c-52c53f0c5dbf';
    const DB_YRITTAJYYS = '29118579-1f9e-4286-a60c-7810a9adce45';

    const UI_KOULUTUS = 'koulutus';
    const UI_KORTIT = 'ammattikortit';
    const UI_YRITTAJYYS = 'yrittajyys';

    const [data, setData] = useState({ koulutus: [], ammattikortit: [], yrittajyys: [], languageLevels: [] });
    const [loading, setLoading] = useState(true);
    
    const [pasteText, setPasteText] = useState('');
    const [parseFeedback, setParseFeedback] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    const [isBoxExtracting, setIsBoxExtracting] = useState(false);
    const [extractedDegrees, setExtractedDegrees] = useState([]); 
    const [boxParseFeedback, setBoxParseFeedback] = useState('');

    const { onSelect, onUpdateVariable, onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;

    const transformVariables = (varsArray) => {
        if (!varsArray || !Array.isArray(varsArray) || varsArray.length === 0) return null;
        const transformed = varsArray.reduce((acc, curr) => {
            let parsedOptions = [];
            try {
                if (curr.options) {
                    parsedOptions = JSON.parse(curr.options);
                    if (typeof parsedOptions === 'string') parsedOptions = JSON.parse(parsedOptions);
                }
            } catch (e) {}
            acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: curr.default_value, vaihtoehdot: parsedOptions };
            return acc;
        }, {});
        return Object.keys(transformed).length > 0 ? transformed : null;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [phrasesRes, varsRes, langRes] = await Promise.all([
                    supabase.from('phrases').select('*').in('section_id', [DB_KOULUTUS, DB_KORTIT, DB_YRITTAJYYS]),
                    supabase.from('variables').select('*'),
                    supabase.from('language_levels').select('*').order('sort_order')
                ]);

                if (phrasesRes.error) throw phrasesRes.error;

                const phrasesData = phrasesRes.data || [];
                const variablesData = varsRes.data || [];

                const enrichedPhrases = phrasesData.map(phrase => ({
                    ...phrase,
                    variables: variablesData.filter(v => v.phrase_id === phrase.id)
                }));

                setData({
                    koulutus: enrichedPhrases.filter(p => p.section_id === DB_KOULUTUS),
                    ammattikortit: enrichedPhrases.filter(p => p.section_id === DB_KORTIT),
                    yrittajyys: enrichedPhrases.filter(p => p.section_id === DB_YRITTAJYYS),
                    languageLevels: langRes.data || []
                });
            } catch (err) {
                console.error("Virhe datan latauksessa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const registerLanguageSignals = async () => {
            if (!data.languageLevels || data.languageLevels.length === 0) return;

            const languageSignals = data.languageLevels.map(l => ({
                signal_key: `language_fi_${l.level_key.toLowerCase().replace('.', '_')}`,
                label: `Suomen kieli: ${l.level_key} - ${l.name}`,
                category: 'Kielitaito',
                description: l.work_description || `Asiakkaan suomen kielen taito on tasolla ${l.level_key}.`
            }));

            try {
                await supabase.from('system_signals').upsert(languageSignals, { onConflict: 'signal_key' });
            } catch (error) {}
        };
        registerLanguageSignals();
    }, [data.languageLevels]);

    const handleSuomiChange = (val) => {
        onUpdateCustomText('kielitaso_suomi', val);
        const currentSignals = state.signals || {};
        
        Object.keys(currentSignals).forEach(key => {
            if (key.startsWith('language_fi_')) {
                if (typeof onRemoveSignal === 'function') onRemoveSignal(key);
            }
        });
        
        if (val) {
            const newKey = `language_fi_${val.toLowerCase().replace('.', '_')}`;
            if (typeof onAddSignal === 'function') onAddSignal(newKey);
        }
    };

    const handleAIParse = async () => {
        if (!pasteText) return setParseFeedback('Liitä ensin tekstiä laatikkoon.');
        setIsExtracting(true);
        setParseFeedback('Tekoäly analysoi koulutustietoja...');

        try {
            const response = await fetch('/.netlify/functions/extract_education', {
                method: 'POST',
                body: JSON.stringify({ rawText: pasteText })
            });

            if (!response.ok) throw new Error('Haku epäonnistui');
            const aiResult = await response.json();

            if (aiResult.degree) {
                onSelect(UI_KOULUTUS, 'koulutus_tausta', false);
                setTimeout(() => {
                    onUpdateVariable(UI_KOULUTUS, 'koulutus_tausta', 'KOULUTUS', aiResult.degree);
                    if (aiResult.year) onUpdateVariable(UI_KOULUTUS, 'koulutus_tausta', 'VUOSI', aiResult.year);
                    setParseFeedback(`Koulutus "${aiResult.degree}" poimittu onnistuneesti!`);
                    setPasteText(''); 
                }, 300);
            } else {
                setParseFeedback('Tekoäly ei löytänyt tekstistä valmista tutkintoa.');
            }
        } catch (error) {
            setParseFeedback('Virhe analysoinnissa. Varmista että Netlify-funktio on olemassa.');
        } finally {
            setIsExtracting(false);
        }
    };

    const handleBoxAIParse = async () => {
        const textToParse = state['custom-ai_koulutushistoria'];
        if (!textToParse) return;
        
        setIsBoxExtracting(true);
        setBoxParseFeedback('Etsitään tutkintoja ja kortteja...');
        setExtractedDegrees([]);

        try {
            const response = await fetch('/.netlify/functions/extract_education', {
                method: 'POST',
                body: JSON.stringify({ rawText: textToParse, mode: 'list' }) 
            });

            if (!response.ok) throw new Error('Haku epäonnistui');
            const aiResult = await response.json();

            if (aiResult.degrees && aiResult.degrees.length > 0) {
                setExtractedDegrees(aiResult.degrees);
                setBoxParseFeedback('Valitse alta asiakkaan pääkoulutus klikkaamalla:');
            } else {
                setBoxParseFeedback('Ei löytynyt selkeitä tutkintoja valittavaksi.');
            }

            if (aiResult.cards && aiResult.cards.length > 0) {
                aiResult.cards.forEach(card => {
                    onUpdateVariable(UI_KORTIT, card, true);
                });
            }
        } catch (error) {
            setBoxParseFeedback('Virhe analysoinnissa.');
        } finally {
            setIsBoxExtracting(false);
        }
    };

    const handleDegreeSelect = (degreeObj) => {
        onSelect(UI_KOULUTUS, 'koulutus_tausta', false); 
        setTimeout(() => {
            onUpdateVariable(UI_KOULUTUS, 'koulutus_tausta', 'KOULUTUS', degreeObj.degree);
            if (degreeObj.year) onUpdateVariable(UI_KOULUTUS, 'koulutus_tausta', 'VUOSI', degreeObj.year);
            setExtractedDegrees([]);
            setBoxParseFeedback(`✓ Pääkoulutukseksi asetettu: ${degreeObj.degree}`);
        }, 300);
    };

    const summary = useKoulutusSummary(
        state[UI_KOULUTUS], state[UI_KORTIT], state[UI_YRITTAJYYS], null,
        { 
            aidinkieli: state['custom-kielitaso_aidinkieli'], 
            suomiTaso: state['custom-kielitaso_suomi'],
            valitutAiIdeat: state['custom-valitut_ai_ideat'],
            aiKoulutushistoria: state['custom-ai_koulutushistoria'],
            
            tuettu_aktiivinen: state['custom-tuettu_aktiivinen'],
            tuettu_tyyppi: state['custom-tuettu_tyyppi'],
            tuettu_opinnon_nimi: state['custom-tuettu_opinnon_nimi'],
            tuettu_alku_pvm: state['custom-tuettu_alku_pvm'],
            tuettu_loppu_pvm: state['custom-tuettu_loppu_pvm'],
            tuettu_perusopetus: state['custom-tuettu_perusopetus'],
            tuettu_edellytys_suunnitelma: state['custom-tuettu_edellytys_suunnitelma'],
            tuettu_edellytys_tarkoituksenmukaisuus: state['custom-tuettu_edellytys_tarkoituksenmukaisuus'],
            tuettu_edellytys_seuranta: state['custom-tuettu_edellytys_seuranta']
        },
        data.koulutus, data.ammattikortit, data.yrittajyys, data.languageLevels
    );

    let aiIdeas = [];
    try { const rawIdeas = state['custom-ai_koulutus_ideat']; if (rawIdeas) aiIdeas = JSON.parse(rawIdeas); } catch(e) {}

    let valitutAiIdeat = [];
    try { const rawValitut = state['custom-valitut_ai_ideat']; if (rawValitut) valitutAiIdeat = JSON.parse(rawValitut); } catch(e) {}

    if (loading) return <div className="section-container">Ladataan tietoja tietokannasta...</div>;

    const aiTuotuKoulutushistoria = state['custom-ai_koulutushistoria'];

    return (
        <section className="section-container">
            <h2 className="section-title">Koulutus, osaaminen ja yrittäjyys</h2>

            {/* --- 1. KOULUTUS --- */}
            <div className="subsection">
                <h3 className="subsection-title"><GraduationCap size={20} /> Koulutus</h3>

                {aiTuotuKoulutushistoria && (
                    <div className="ai-import-box">
                        <div className="ai-import-header">
                            <label className="ai-import-label"><Sparkles size={18} /> URA-historiasta tuodut tutkinnot ja kortit (AI)</label>
                            <button onClick={handleBoxAIParse} disabled={isBoxExtracting} className="btn-ai-action">
                                {isBoxExtracting ? <><Loader2 size={14} className="animate-spin" /> Etsitään...</> : <><MousePointerClick size={14} /> Poimi tiedot lomakkeelle</>}
                            </button>
                        </div>
                        
                        <textarea
                            className="form-input ai-import-textarea"
                            rows="5"
                            value={aiTuotuKoulutushistoria}
                            onChange={(e) => onUpdateCustomText('ai_koulutushistoria', e.target.value)}
                        />
                        
                        {boxParseFeedback && (
                            <p className={`ai-import-feedback ${boxParseFeedback.includes('✓') ? 'ai-import-feedback--success' : ''}`}>
                                {boxParseFeedback.includes('✓') ? <CheckCircle2 size={16} /> : null} {boxParseFeedback}
                            </p>
                        )}
                        
                        {extractedDegrees.length > 0 && (
                            <div className="ai-degree-list">
                                {extractedDegrees.map((deg, idx) => (
                                    <button key={idx} onClick={() => handleDegreeSelect(deg)} className="btn-ai-degree">
                                        <span>{deg.degree}</span>
                                        {deg.year && <span className="ai-degree-year">{deg.year}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TEKOÄLYN KOULUTUSEHDOTUKSET */}
                {aiIdeas.length > 0 && (
                 <div className="panel-gray mb-6 info-box--blue">
    <label className="icon-label text-info-dark"><Info size={18} /> Koulutussuuntien apupilotti</label>
                        <p className="stat-label mb-6">Tekoäly poimi nämä ideat asiakkaan historiasta. Klikkaa ehdotusta valitaksesi tai poistaaksesi sen.</p>
                        
                        <div className="ai-ideas-list">
                            {aiIdeas.map((idea, idx) => {
                                const isSelected = valitutAiIdeat.includes(idea);
                                return (
                                    <button key={idx} className={`btn-ai-idea ${isSelected ? 'btn-ai-idea--selected' : ''}`}
                                        onClick={() => {
                                            let uudetValitut = isSelected ? valitutAiIdeat.filter(i => i !== idea) : [...valitutAiIdeat, idea];
                                            onUpdateCustomText('valitut_ai_ideat', JSON.stringify(uudetValitut));
                                        }}>
                                        <span className="ai-idea-icon">{isSelected ? <CheckCircle2 size={18} /> : <Plus size={18} />}</span> 
                                        {idea}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                <div className="paste-area-container" style={{ opacity: aiTuotuKoulutushistoria ? 0.6 : 1 }}>
                    <textarea rows="2" placeholder="Liitä yksittäinen uusi tutkintotieto tähän (esim. Koski-palvelusta kopioitu)..."
                        value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="paste-area-textarea" />
                    <button onClick={handleAIParse} disabled={isExtracting} type="button" className="btn btn--secondary paste-area-button">
                        {isExtracting ? 'Poimitaan...' : <><Sparkles size={16} /> Poimi (AI)</>}
                    </button>
                </div>
                {parseFeedback && (
                    <p className={`parse-feedback ${parseFeedback.includes('onnistuneesti') ? 'parse-feedback--success' : 'parse-feedback--error'}`}>
                        {parseFeedback}
                    </p>
                )}

                <div className="options-container">
                    {data.koulutus.map(phrase => (
                        <PhraseOption key={phrase.id} phrase={{ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title, muuttujat: transformVariables(phrase.variables) }}
                            section={{ id: UI_KOULUTUS, monivalinta: false }} isSelected={state[UI_KOULUTUS]?.avainsana === phrase.phrase_key ? state[UI_KOULUTUS] : null} onSelect={onSelect} onUpdateVariable={onUpdateVariable} />
                    ))}
                </div>
            </div>

            {/* --- 2. OSAAMINEN JA KIELITAITO --- */}
            <div className="subsection">
                <h3 className="subsection-title"><Award size={20} /> Osaaminen ja kielitaito</h3>
                <div className="grid-cols-2 mb-6">
                    <div>
                        <label className="icon-label"><User size={18} /> Äidinkieli</label>
                        <input type="text" className="input-field" placeholder="Esim. suomi, arabia..." value={state['custom-kielitaso_aidinkieli'] || ''} onChange={(e) => onUpdateCustomText('kielitaso_aidinkieli', e.target.value)} />
                    </div>
                    <div>
                        <label className="icon-label"><Languages size={18} /> Suomen kielen taito (CEFR)</label>
                        <select className="modern-select" value={state['custom-kielitaso_suomi'] || ''} onChange={(e) => handleSuomiChange(e.target.value)}>
                            <option value="">Valitse...</option>
                            {data.languageLevels.map(l => <option key={l.id} value={l.level_key}>{l.level_key} - {l.name}</option>)}
                        </select>
                    </div>
                </div>

                <TuettuOpiskelu state={state} actions={actions} />

                <Ammattikortit sectionId={UI_KORTIT} sectionState={state[UI_KORTIT] || {}} actions={actions} korttiFraasit={data.ammattikortit.map(phrase => ({ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title, muuttujat: transformVariables(phrase.variables) }))} />
            </div>

            {/* --- 3. YRITTÄJYYS --- */}
            <RadioPhraseSection title={<><Briefcase size={20} /> Yrittäjyys</>} sectionId={UI_YRITTAJYYS} sectionState={state[UI_YRITTAJYYS] || {}} actions={actions} phrases={data.yrittajyys.map(phrase => ({ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title, muuttujat: transformVariables(phrase.variables) }))} />

            {/* --- 4. YHTEENVETO --- */}
            <div className="subsection" style={{ marginTop: '2rem', borderTop: '2px solid var(--color-border)' }}>
                <SummaryPreview summaryData={summary} sectionId={UI_KOULUTUS} onUpdateCustomText={onUpdateCustomText} />
                <div className="custom-text-container">
                    <label className="custom-text-label">Lopullinen koonti (Koulutus, osaaminen ja yrittäjyys):</label>
                    <textarea rows="4" placeholder="Siirrä yllä oleva ehdotus tähän ja muokkaa tarvittaessa..." value={state[`custom-${UI_KOULUTUS}`] || ''} onChange={(e) => onUpdateCustomText(UI_KOULUTUS, e.target.value)} />
                </div>
            </div>
        </section>
    );
};

export default KoulutusJaYrittajyys;