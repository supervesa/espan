// --- src/components/koulutusYrittajyys/index.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Ammattikortit from './Ammattikortit';
import RadioPhraseSection from './RadioPhraseSection';
import SummaryPreview from './SummaryPreview';
import { useKoulutusSummary } from './useKoulutusSummary';
import { PhraseOption } from '../PhraseOption';
import { GraduationCap, Award, Briefcase, Languages, User, Sparkles, CheckCircle2, Loader2, MousePointerClick, Info } from 'lucide-react';

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

    const { onSelect, onUpdateVariable, onUpdateCustomText, updateSignal } = actions;

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

    const handleSuomiChange = (val) => {
        onUpdateCustomText('kielitaso_suomi', val);
        const currentSignals = state.signals || {};
        Object.keys(currentSignals).forEach(key => {
            if (key.startsWith('language_fi_')) updateSignal(key, false);
        });
        if (val) updateSignal(`language_fi_${val.toLowerCase().replace('.', '_')}`, true);
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
                }, 50);
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
        }, 50);
    };

    const summary = useKoulutusSummary(
        state[UI_KOULUTUS], state[UI_KORTIT], state[UI_YRITTAJYYS], null,
        { aidinkieli: state['custom-kielitaso_aidinkieli'], suomiTaso: state['custom-kielitaso_suomi'] },
        data.koulutus, data.ammattikortit, data.yrittajyys, data.languageLevels
    );

    // UUSI: Parsitaan Työtilanteen modaalista tulleet koulutusideat
    let aiIdeas = [];
    try {
        const rawIdeas = state['custom-ai_koulutus_ideat'];
        if (rawIdeas) aiIdeas = JSON.parse(rawIdeas);
    } catch(e) {}

    if (loading) return <div className="section-container">Ladataan tietoja tietokannasta...</div>;

    const aiTuotuKoulutushistoria = state['custom-ai_koulutushistoria'];

    return (
        <section className="section-container">
            <h2 className="section-title">Koulutus, osaaminen ja yrittäjyys</h2>

            {/* --- 1. KOULUTUS --- */}
            <div className="subsection">
                <h3 className="subsection-title"><GraduationCap size={20} /> Koulutus</h3>

                {aiTuotuKoulutushistoria && (
                    <div style={{ backgroundColor: '#fffbe3', padding: '1.25rem', borderRadius: '6px', border: '1px solid #facc15', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>
                                <Sparkles size={18} /> URA-historiasta tuodut tutkinnot ja kortit (AI)
                            </label>
                            
                            <button 
                                onClick={handleBoxAIParse} 
                                disabled={isBoxExtracting} 
                                className="btn" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
                            >
                                {isBoxExtracting ? <><Loader2 size={14} className="animate-spin" /> Etsitään...</> : <><MousePointerClick size={14} /> Poimi tiedot lomakkeelle</>}
                            </button>
                        </div>
                        
                        <textarea
                            className="form-input"
                            rows="5"
                            value={aiTuotuKoulutushistoria}
                            onChange={(e) => onUpdateCustomText('ai_koulutushistoria', e.target.value)}
                            style={{ borderLeft: '3px solid #f59e0b', backgroundColor: '#fff' }}
                        />
                        
                        {boxParseFeedback && (
                            <p style={{ fontSize: '0.85rem', color: '#b45309', marginTop: '0.75rem', fontWeight: extractedDegrees.length > 0 ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {boxParseFeedback.includes('✓') ? <CheckCircle2 size={16} /> : null}
                                {boxParseFeedback}
                            </p>
                        )}
                        
                        {extractedDegrees.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {extractedDegrees.map((deg, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleDegreeSelect(deg)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#fff', border: '1px solid #fcd34d', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                        onMouseOver={e => Object.assign(e.currentTarget.style, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' })}
                                        onMouseOut={e => Object.assign(e.currentTarget.style, { backgroundColor: '#fff', borderColor: '#fcd34d' })}
                                    >
                                        <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{deg.degree}</span>
                                        {deg.year && <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{deg.year}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* UUSI: TEKOÄLYN KOULUTUSEHDOTUKSET (Työtilanteen modaalista) */}
                {aiIdeas.length > 0 && (
                    <div className="panel-gray" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginTop: '0', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
                        <label className="icon-label" style={{ color: '#1e40af', marginBottom: '0.5rem' }}>
                            <Info size={18} /> Koulutussuuntien apupilotti
                        </label>
                        <p className="stat-label" style={{ marginBottom: '1rem' }}>Tekoäly poimi nämä ideat asiakkaan historiasta. Klikkaa ideaa siirtääksesi sen suoraan osion lopulliseen koontiin.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {aiIdeas.map((idea, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => {
                                        const current = state[`custom-${UI_KOULUTUS}`] || '';
                                        const prefix = current ? current + '\n\n' : '';
                                        const newText = prefix + `Asiakkaan kanssa sovittiin seuraavan koulutusmahdollisuuden selvittämisestä: ${idea}.`;
                                        onUpdateCustomText(UI_KOULUTUS, newText);
                                        
                                        // Poistetaan listalta, kun on klikattu
                                        const newIdeas = aiIdeas.filter((_, i) => i !== idx);
                                        onUpdateCustomText('ai_koulutus_ideat', JSON.stringify(newIdeas));
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#fff', border: '1px solid #93c5fd', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', color: '#1e3a8a', fontWeight: '500' }}
                                    onMouseOver={e => Object.assign(e.currentTarget.style, { backgroundColor: '#dbeafe', borderColor: '#3b82f6', transform: 'translateY(-1px)' })}
                                    onMouseOut={e => Object.assign(e.currentTarget.style, { backgroundColor: '#fff', borderColor: '#93c5fd', transform: 'translateY(0)' })}
                                >
                                    <span style={{ fontSize: '1.2rem', color: '#3b82f6', fontWeight: 'bold' }}>+</span> {idea}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {/* -------------------------------------- */}
                
                <div className="paste-area-container" style={{ opacity: aiTuotuKoulutushistoria ? 0.6 : 1 }}>
                    <textarea
                        rows="2"
                        placeholder="Liitä yksittäinen uusi tutkintotieto tähän (esim. Koski-palvelusta kopioitu)..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        className="paste-area-textarea"
                    />
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
                        <PhraseOption
                            key={phrase.id}
                            phrase={{ 
                                ...phrase, 
                                avainsana: phrase.phrase_key, 
                                teksti: phrase.base_text, 
                                lyhenne: phrase.short_title, 
                                muuttujat: transformVariables(phrase.variables) 
                            }}
                            section={{ id: UI_KOULUTUS, monivalinta: false }}
                            isSelected={state[UI_KOULUTUS]?.avainsana === phrase.phrase_key ? state[UI_KOULUTUS] : null}
                            onSelect={onSelect}
                            onUpdateVariable={onUpdateVariable}
                        />
                    ))}
                </div>
            </div>

            {/* --- 2. OSAAMINEN --- */}
            <div className="subsection">
                <h3 className="subsection-title"><Award size={20} /> Osaaminen ja kielitaito</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={18} /> Äidinkieli
                        </label>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Esim. suomi, arabia..."
                            value={state['custom-kielitaso_aidinkieli'] || ''} 
                            onChange={(e) => onUpdateCustomText('kielitaso_aidinkieli', e.target.value)} 
                            style={{ marginTop: '0.5rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Languages size={18} /> Suomen kielen taito (CEFR)
                        </label>
                        <select 
                            className="modern-select" 
                            value={state['custom-kielitaso_suomi'] || ''} 
                            onChange={(e) => handleSuomiChange(e.target.value)}
                            style={{ marginTop: '0.5rem' }}
                        >
                            <option value="">Valitse...</option>
                            {data.languageLevels.map(l => <option key={l.id} value={l.level_key}>{l.level_key} - {l.name}</option>)}
                        </select>
                    </div>
                </div>
                <Ammattikortit
                    sectionId={UI_KORTIT}
                    sectionState={state[UI_KORTIT] || {}}
                    korttiFraasit={data.ammattikortit.map(phrase => ({ 
                        ...phrase, 
                        avainsana: phrase.phrase_key, 
                        teksti: phrase.base_text, 
                        lyhenne: phrase.short_title, 
                        muuttujat: transformVariables(phrase.variables) 
                    }))}
                    actions={actions}
                />
            </div>

            {/* --- 3. YRITTÄJYYS --- */}
            <RadioPhraseSection
                title={<><Briefcase size={20} /> Yrittäjyys</>}
                phrases={data.yrittajyys.map(phrase => ({ 
                    ...phrase, 
                    avainsana: phrase.phrase_key, 
                    teksti: phrase.base_text, 
                    lyhenne: phrase.short_title, 
                    muuttujat: transformVariables(phrase.variables) 
                }))}
                sectionId={UI_YRITTAJYYS}
                sectionState={state[UI_YRITTAJYYS] || {}}
                actions={actions}
            />

            {/* --- 4. YHTEENVETO --- */}
            <div className="subsection" style={{ marginTop: '2rem', borderTop: '2px solid var(--color-border)' }}>
                <SummaryPreview summaryData={summary} sectionId={UI_KOULUTUS} onUpdateCustomText={onUpdateCustomText} />
                <div className="custom-text-container">
                    <label className="custom-text-label">Lopullinen koonti (Koulutus, osaaminen ja yrittäjyys):</label>
                    <textarea 
                        rows="4" 
                        placeholder="Siirrä yllä oleva ehdotus tähän ja muokkaa tarvittaessa..."
                        value={state[`custom-${UI_KOULUTUS}`] || ''} 
                        onChange={(e) => onUpdateCustomText(UI_KOULUTUS, e.target.value)} 
                    />
                </div>
            </div>
        </section>
    );
};

export default KoulutusJaYrittajyys;