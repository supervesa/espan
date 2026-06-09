import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Activity, BrainCircuit, Sparkles, ArrowDown, X } from 'lucide-react';

const KeskusteluOsa = ({ title, questions, answers, onAnswerChange }) => {
    return (
        <details className="modern-accordion">
            <summary>{title}</summary>
            <div className="discussion-content">
                {questions.map(q => (
                    <div key={q.id} className="question-row">
                        <label htmlFor={q.id}>{q.teksti}</label>
                        
                        {q.tyyppi === 'boolean' && (
                            <div className="boolean-buttons">
                                <button 
                                    onClick={() => onAnswerChange(q.id, 'Kyllä')} 
                                    className={answers[q.id] === 'Kyllä' ? 'selected' : ''}
                                >
                                    Kyllä
                                </button>
                                <button 
                                    onClick={() => onAnswerChange(q.id, 'Ei')} 
                                    className={answers[q.id] === 'Ei' ? 'selected' : ''}
                                >
                                    Ei
                                </button>
                            </div>
                        )}
                        
                        {q.tyyppi === 'teksti' && (
                            <input 
                                type="text" 
                                id={q.id} 
                                value={answers[q.id] || ''} 
                                onChange={(e) => onAnswerChange(q.id, e.target.value)} 
                            />
                        )}
                        
                        {q.tyyppi === 'valinta' && q.vaihtoehdot && (
                            <select id={q.id} value={answers[q.id] || ''} onChange={(e) => onAnswerChange(q.id, e.target.value)}>
                                <option value="">Valitse...</option>
                                {q.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        )}
                    </div>
                ))}
            </div>
        </details>
    );
};

const Tyokyky = ({ state, actions }) => {
    // LISÄTTY: Otetaan actions-oliosta käyttöön myös imurin käyttämät funktiot
    const { onUpdateTyokyky, onUpdateVariable, onUpdateCustomText } = actions;
    const tyokykyState = state.tyokyky || {};

    const [dbData, setDbData] = useState({
        paavalinnat: [],
        palveluohjaukset: [],
        kysymysKategoriat: {}
    });
    const [isLoading, setIsLoading] = useState(true);
    
    const [aiLuonnos, setAiLuonnos] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const fetchTyokykyData = async () => {
            setIsLoading(true);
            try {
                const { data: phrasesData } = await supabase
                    .from('phrases')
                    .select('*')
                    .eq('section_id', '5b48f731-fc8d-4a00-894e-ac7104f6b422');

                const { data: questionsData } = await supabase
                    .from('assessment_questions')
                    .select('*')
                    .eq('is_active', true)
                    .order('order_index');

                if (phrasesData && questionsData) {
                    const paavalinnat = phrasesData
                        .filter(p => p.grouping_key === 'tyokyky_paavalinta')
                        .map(p => ({ ...p, avainsana: p.phrase_key, teksti: p.base_text, lyhyt: p.short_title }));

                    const palveluohjaukset = phrasesData
                        .filter(p => p.grouping_key === 'tyokyky_palveluohjaus')
                        .map(p => ({ ...p, avainsana: p.phrase_key, teksti: p.base_text, lyhyt: p.short_title }));

                    const kategoriat = {};
                    questionsData.forEach(q => {
                        if (!kategoriat[q.category]) kategoriat[q.category] = [];
                        kategoriat[q.category].push({
                            id: q.question_key,
                            teksti: q.question_text,
                            tyyppi: q.input_type,
                            vaihtoehdot: q.options
                        });
                    });

                    setDbData({ paavalinnat, palveluohjaukset, kysymysKategoriat: kategoriat });
                }
            } catch (error) {
                console.error("Virhe Työkyky-datan latauksessa:", error);
            }
            setIsLoading(false);
        };

        fetchTyokykyData();
    }, []);

// -----------------------------------------------------------------------------
    // TURVALLINEN SILTA URA-IMURILLE: Kääntää imurin käskyt Työkyvyn omaan formaattiin
    // -----------------------------------------------------------------------------
    useEffect(() => {
        if (!dbData.paavalinnat.length) return;

        // 1. Käännetään Päävalinnat (Etsitään, onko imuri laittanut jonkin true-tilaan)
        const activatedPaavalinta = dbData.paavalinnat.find(p => state.tyokyky?.[p.avainsana] === true);
        
        // Jos imuri laittoi jonkin päälle, JOTA meillä ei vielä ole valittuna
        if (activatedPaavalinta && tyokykyState.paavalinta?.avainsana !== activatedPaavalinta.avainsana) {
            onUpdateTyokyky('paavalinta', activatedPaavalinta);
        }

        // 2. Käännetään Palveluohjaukset
        dbData.palveluohjaukset.forEach(p => {
            if (state.tyokyky?.[p.avainsana] === true && !tyokykyState.palveluohjaukset?.[p.avainsana]) {
                onUpdateTyokyky('togglePalveluohjaus', p);
            }
        });

        // 3. Siirretään URA-imurin vapaa teksti Työkyvyn "Asiantuntijan vapaa sana" -laatikkoon
        const scrapedText = state['custom-tyokyky'];
        if (scrapedText) {
            const nykyinen = tyokykyState.lisatietoa || '';
            // Varmistetaan, ettei samaa tekstiä lisätä kahta kertaa peräkkäin
            if (!nykyinen.includes(scrapedText)) {
                const uusi = nykyinen ? `${nykyinen}\n\n${scrapedText}` : scrapedText;
                onUpdateTyokyky('lisatietoa', uusi);
                if (actions.onUpdateCustomText) {
                    actions.onUpdateCustomText('tyokyky', ''); // Tyhjennetään lähde turvallisesti
                }
            }
        }
        
    // HUOM: Riippuvuudet (dependencies) on minimoitu, jotta ikuista silmukkaa ei voi syntyä!
    }, [state.tyokyky, state['custom-tyokyky'], dbData.paavalinnat, dbData.palveluohjaukset]); 
    // -----------------------------------------------------------------------------

    const handleKoontiUpdate = () => {
        const answers = tyokykyState.keskustelunTiedot || {};
        let koontiText = '';
        
        Object.entries(dbData.kysymysKategoriat).forEach(([_, questions]) => {
            questions.forEach(q => {
                if (answers[q.id]) {
                    koontiText += `- ${q.teksti}: ${answers[q.id]}\n`;
                }
            });
        });
        
        // Mahdollistetaan manuaalisen tekstin säilyminen tai uuden koonnin päivitys
        if (tyokykyState.koonti && tyokykyState.koonti.trim()) {
            if (window.confirm("Haluatko päivittää rakennepuun? Tämä korvaa nykyisen tekstin lomakkeen tiedoilla. Voit muokata tekstiä päivityksen jälkeen.")) {
                onUpdateTyokyky('koonti', koontiText.trim());
            }
        } else {
            onUpdateTyokyky('koonti', koontiText.trim());
        }
    };

    const handleGenerateAI = async () => {
        if (!tyokykyState.koonti) return;
        
        setIsGenerating(true);
        setAiLuonnos('');

        try {
            const response = await fetch('/.netlify/functions/generate-tyokyky-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ koonti: tyokykyState.koonti })
            });

            if (!response.ok) throw new Error('Verkkovirhe tai palvelinvirhe');

            const data = await response.json();
            setAiLuonnos(data.text);
        } catch (error) {
            console.error("AI-generointi epäonnistui:", error);
            setAiLuonnos("Tekstin generointi epäonnistui. Tarkista yhteys ja yritä uudelleen.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAcceptAI = () => {
        const nykyinenLisatieto = tyokykyState.lisatietoa || '';
        const uusiLisatieto = nykyinenLisatieto ? `${nykyinenLisatieto}\n\n${aiLuonnos}` : aiLuonnos;
        
        onUpdateTyokyky('lisatietoa', uusiLisatieto);
        setAiLuonnos('');
    };

    if (isLoading) {
        return <section className="section-container"><p style={{ color: 'var(--color-text-secondary)' }}>Ladataan Työkyky-osiota...</p></section>;
    }

    const arvioKysymykset = dbData.kysymysKategoriat['Asiakkaan arvio'] || [];
    const muutKategoriat = Object.keys(dbData.kysymysKategoriat).filter(k => k !== 'Asiakkaan arvio');

    return (
        <section className="section-container">
            <div className="smart-analysis-box">
                <div className="smart-analysis-header">
                    <BrainCircuit size={20} /> Työkyky-analyysi
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>Järjestelmä valmiudessa: Kun teet valintoja, tässä näytetään ehdotukset työnhakuvelvollisuuden (THV) lakisääteisistä alennuksista.</p>
            </div>

            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={22} color="var(--color-primary)" /> Työkyky
            </h2>
            
            <div className="options-container">
                {dbData.paavalinnat.map(p => (
                    <div 
                        key={p.avainsana} 
                        onClick={() => onUpdateTyokyky('paavalinta', p)} 
                        className={`phrase-option ${tyokykyState.paavalinta?.avainsana === p.avainsana ? 'selected' : ''}`}
                    >
                        {p.lyhyt || p.teksti}
                    </div>
                ))}
            </div>

            {tyokykyState.paavalinta?.avainsana === 'tyokyky_alentunut' && (
                <div className="subsection">
                    <label htmlFor="alentuma-kuvaus">Kuvaus työkyvyn alentumasta:</label>
                    <textarea 
                        id="alentuma-kuvaus" 
                        rows="3" 
                        placeholder="Kirjaa tähän havainnot tai asiakkaan kertomus..."
                        value={tyokykyState.alentumaKuvaus || ''} 
                        onChange={(e) => onUpdateTyokyky('alentumaKuvaus', e.target.value)} 
                    />
                </div>
            )}

            {tyokykyState.paavalinta?.avainsana === 'tyokyky_selvityksessa' && (
                <div className="subsection">
                    <h3>Palveluohjaus</h3>
                    <div className="options-container">
                         {dbData.palveluohjaukset.map(p => (
                            <div 
                                key={p.avainsana} 
                                onClick={() => onUpdateTyokyky('togglePalveluohjaus', p)} 
                                className={`phrase-option ${tyokykyState.palveluohjaukset?.[p.avainsana] ? 'selected' : ''}`}
                            >
                                {p.lyhyt || p.teksti}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {arvioKysymykset.length > 0 && (
                <div className="subsection">
                    <h3>Asiakkaan oma arvio työkyvystään</h3>
                    {arvioKysymykset.map(q => (
                        <div key={q.id} className="slider-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.2rem', minWidth: '2rem', textAlign: 'center' }}>
                                {tyokykyState.keskustelunTiedot?.[q.id] || q.vaihtoehdot?.default || 5}
                            </span>
                            <input 
                                type="range" 
                                min={q.vaihtoehdot?.min || 0} 
                                max={q.vaihtoehdot?.max || 10} 
                                value={tyokykyState.keskustelunTiedot?.[q.id] || q.vaihtoehdot?.default || 5} 
                                onChange={(e) => onUpdateTyokyky('updateKeskustelutieto', { id: q.id, value: e.target.value })}
                                style={{ flexGrow: 1 }}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="subsection">
                <h3>Keskustelun tuki ja muistiinpanot</h3>
                
                {muutKategoriat.map(title => (
                    <KeskusteluOsa 
                        key={title} 
                        title={title} 
                        questions={dbData.kysymysKategoriat[title]} 
                        answers={tyokykyState.keskustelunTiedot || {}}
                        onAnswerChange={(id, value) => onUpdateTyokyky('updateKeskustelutieto', { id, value })}
                    />
                ))}
                
                <div className="split-textarea-container">
                    <div className="split-textarea-column">
                        <label htmlFor="koonti-textarea">AI-Syöte: Rakennepuu ja lisähavainnot</label>
                        <textarea 
                            id="koonti-textarea" 
                            rows="6" 
                            placeholder="Tähän poimitaan data lomakkeelta, mutta voit kirjoittaa tähän myös vapaasti muita havaintoja Geminille..." 
                            value={tyokykyState.koonti || ''} 
                            onChange={(e) => onUpdateTyokyky('koonti', e.target.value)}
                        />
                        <button onClick={handleKoontiUpdate} className="btn btn--secondary" style={{ marginTop: '0.5rem' }}>
                            Päivitä data lomakkeelta
                        </button>
                    </div>
                    
                    <div className="split-textarea-column">
                        <label htmlFor="lisatietoa-textarea">Asiantuntijan vapaa sana (Suojattu)</label>
                        <textarea 
                            id="lisatietoa-textarea" 
                            rows="6" 
                            placeholder="Kirjoita omat muistiinpanot tai siirrä tekoälyn luoma teksti tänne. Tämä laatikko ei koskaan ylikirjoitu automaattisesti." 
                            value={tyokykyState.lisatietoa || ''} 
                            onChange={(e) => onUpdateTyokyky('lisatietoa', e.target.value)} 
                        />
                    </div>
                </div>
            </div>

            <div className="ai-workspace">
                <h3 className="ai-workspace-header"><Sparkles size={20} color="var(--color-primary)" /> AI-avustaja</h3>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: 0 }}>Luo asiantuntijateksti automaattisen rakennepuun ja tekemiesi valintojen pohjalta.</p>
                
                <button 
                    className="btn-ai" 
                    onClick={handleGenerateAI} 
                    disabled={isGenerating || !tyokykyState.koonti}
                >
                    <Sparkles size={16} /> {isGenerating ? 'Generoidaan luonnosta...' : 'Generoi ammattimainen teksti'}
                </button>

                {aiLuonnos && (
                    <div className="ai-preview-container">
                        <div className="ai-preview-box">
                            {aiLuonnos}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn" onClick={handleAcceptAI} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowDown size={16} /> Siirrä "Vapaa sana" -laatikkoon
                            </button>
                            <button className="btn btn--secondary" onClick={() => setAiLuonnos('')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <X size={16} /> Hylkää
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default Tyokyky;