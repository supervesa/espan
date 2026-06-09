import React, { useState } from 'react';
import Accordion from '../../common/Accordion';
import BooleanQuestion from '../../common/BooleanQuestion';
import CopyButton from '../../common/CopyButton';
import { Sparkles, ArrowDown, X, Loader2 } from 'lucide-react';

const KeskusteluJaAi = ({ state, actions, kysymysKategoriat = {} }) => {
    const { onUpdateCustomText } = actions;
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiLuonnos, setAiLuonnos] = useState('');

    const aiPromptiLomakkeelta = state['custom-tyokyky_ai_prompt'] || '';
    const asiantuntijanVapaaSana = state['custom-tyokyky_lisatieto'] || '';

    // Muuttaa yksittäisen arvon
    const handleAnswerChange = (qId, value) => {
        onUpdateCustomText(`tyokyky_v_${qId}`, value);
    };

    // Kerää KAIKKI lomakkeen tiedot (arviot, toimenpiteet, vastaukset) nätiksi tekstiksi tekoälyä varten
    const handleKoontiUpdate = () => {
        let koontiText = '--- TYÖKYKYOSION LOMAKETIEDOT ---\n\n';

        // 1. Asiantuntijan arvio ja kuvaus
        if (state['custom-tyokyky_paavalinta']) {
            koontiText += `Asiantuntijan pääarvio: ${state['custom-tyokyky_paavalinta']}\n`;
        }
        if (state['custom-tyokyky_alentuma_kuvaus']) {
            koontiText += `Alentuman kuvaus: ${state['custom-tyokyky_alentuma_kuvaus']}\n`;
        }

        // 2. Asiakkaan omat arviot (1-10 numerot)
        const arviot = Object.keys(state).filter(k => k.startsWith('custom-tyokyky_arvio_'));
        if (arviot.length > 0) {
            koontiText += '\n[Asiakkaan omat arviot (asteikko 1-10)]\n';
            arviot.forEach(key => {
                const id = key.replace('custom-tyokyky_arvio_', '');
                koontiText += `- Kysymys/ID (${id}): ${state[key]}\n`;
            });
        }

        // 3. Valitut toimenpiteet ja palvelut
        try {
            const extrat = JSON.parse(state['custom-tyokyky_valitut_extrat'] || "[]");
            if (extrat.length > 0) {
                koontiText += '\n[Valitut toimenpiteet ja palvelut]\n';
                koontiText += extrat.join(', ') + '\n';
                
                // Haetaan näihin liittyvät tarkenteet (esim. päivämäärät, tekstit)
                const varKeys = Object.keys(state).filter(k => k.startsWith('custom-tyokyky_var_') && state[k]);
                if (varKeys.length > 0) {
                    varKeys.forEach(k => {
                        const id = k.replace('custom-tyokyky_var_', '');
                        koontiText += `- Tarkenne (${id}): ${state[k]}\n`;
                    });
                }
            }
        } catch(e) {}

        // 4. Keskustelun kysymykset (Haitarit)
        let kysymysTeksti = '\n[Keskustelun muistiinpanot]\n';
        let foundQuestions = false;
        Object.entries(kysymysKategoriat).forEach(([kategoria, questions]) => {
            questions.forEach(q => {
                const vastaus = state[`custom-tyokyky_v_${q.id}`];
                if (vastaus && vastaus !== '') {
                    kysymysTeksti += `- ${q.teksti}: ${vastaus}\n`;
                    foundQuestions = true;
                }
            });
        });
        
        if (foundQuestions) {
            koontiText += kysymysTeksti;
        }

        // Tarkistus, ettei yritetä hakea tyhjää
        if (koontiText.trim() === '--- TYÖKYKYOSION LOMAKETIEDOT ---') {
            alert("Lomakkeella ei ole vielä lainkaan täytettyjä tietoja!");
            return;
        }

        // Viedään tiedot tekoälyn tekstikenttään
        if (aiPromptiLomakkeelta.trim()) {
            if (window.confirm("Haluatko korvata nykyisen AI-syötteen kaikilla lomakkeen päivitetyillä tiedoilla?")) {
                onUpdateCustomText('tyokyky_ai_prompt', koontiText.trim());
            }
        } else {
            onUpdateCustomText('tyokyky_ai_prompt', koontiText.trim());
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPromptiLomakkeelta) return alert("Hae ensin data lomakkeelta klikkaamalla 'Päivitä data listasta'!");
        
        setIsGenerating(true);
        setAiLuonnos('');

        try {
            const response = await fetch('/.netlify/functions/generate-tyokyky-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ koonti: aiPromptiLomakkeelta })
            });

            if (!response.ok) throw new Error('Palvelinvirhe');
            const data = await response.json();
            setAiLuonnos(data.text);
        } catch (error) {
            console.error("AI-generointi epäonnistui:", error);
            setAiLuonnos("Tekstin generointi epäonnistui. Tarkista verkkoyhteys.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAcceptAI = () => {
        const uusiLisatieto = asiantuntijanVapaaSana ? `${asiantuntijanVapaaSana}\n\n${aiLuonnos}` : aiLuonnos;
        onUpdateCustomText('tyokyky_lisatieto', uusiLisatieto);
        setAiLuonnos(''); // Tyhjennetään luonnos hyväksynnän jälkeen
    };

    return (
        <div style={{ marginTop: '2rem', borderTop: '2px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Keskustelun tuki ja muistiinpanot</h3>
            
            {/* KYSYMYSPATTERISTO HAITAREISSA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                {Object.keys(kysymysKategoriat).map(kategoriaTitle => {
                    const kysymykset = kysymysKategoriat[kategoriaTitle];
                    return (
                        <Accordion key={kategoriaTitle} title={kategoriaTitle}>
                            {kysymykset.map(q => {
                                const val = state[`custom-tyokyky_v_${q.id}`];
                                return (
                                    <div key={q.id} style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                                        {q.tyyppi === 'boolean' && (
                                            <BooleanQuestion 
                                                label={q.teksti} 
                                                value={val === 'Kyllä'} 
                                                onChange={(isYes) => handleAnswerChange(q.id, isYes ? 'Kyllä' : 'Ei')} 
                                            />
                                        )}
                                        {q.tyyppi === 'teksti' && (
                                            <>
                                                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{q.teksti}</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    value={val || ''} 
                                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)} 
                                                />
                                            </>
                                        )}
                                        {q.tyyppi === 'valinta' && q.vaihtoehdot && (
                                            <>
                                                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{q.teksti}</label>
                                                <select className="modern-select" value={val || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)}>
                                                    <option value="">Valitse...</option>
                                                    {q.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </Accordion>
                    );
                })}
            </div>

            {/* TEKSTIKENTÄT (Lähde ja Tulos) */}
            <div className="grid-cols-2" style={{ alignItems: 'start' }}>
                
                {/* AI-SYÖTE */}
                <div className="card-inner" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontWeight: 'bold', margin: 0 }}>AI-Syöte: Rakennepuu ja havainnot</label>
                        <button onClick={handleKoontiUpdate} className="btn-tag-dismiss" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', background: 'var(--color-bg-secondary)' }}>
                            Päivitä data listasta ↻
                        </button>
                    </div>
                    <textarea 
                        className="form-input" 
                        rows="6" 
                        placeholder="Hae data listasta tai kirjoita vapaita ranskalaisia viivoja Geminille..." 
                        value={aiPromptiLomakkeelta} 
                        onChange={(e) => onUpdateCustomText('tyokyky_ai_prompt', e.target.value)}
                    />
                    
                    <button 
                        className="btn" 
                        onClick={handleGenerateAI} 
                        disabled={isGenerating || !aiPromptiLomakkeelta}
                        style={{ marginTop: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                        {isGenerating ? 'Generoidaan...' : 'Generoi asiantuntijateksti (AI)'}
                    </button>

                    {/* AI-LUONNOKSEN KÄSITTELY */}
                    {aiLuonnos && (
                        <div style={{ marginTop: '1rem', border: '1px solid var(--color-primary)', borderRadius: '6px', padding: '1rem', backgroundColor: 'var(--color-primary-light)' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary-dark)' }}>AI-Ehdotus:</h4>
                            <div style={{ fontSize: '0.9rem', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>{aiLuonnos}</div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={handleAcceptAI} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, justifyContent: 'center' }}>
                                    <ArrowDown size={16} /> Hyväksy
                                </button>
                                <CopyButton textToCopy={aiLuonnos} />
                                <button className="btn btn--secondary" onClick={() => setAiLuonnos('')} title="Hylkää luonnos" style={{ padding: '0.5rem' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* VAPAA SANA (SUOJATTU) */}
                <div className="card-inner" style={{ padding: '1rem', borderLeft: '4px solid var(--color-success)' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Asiantuntijan vapaa sana (Suojattu)</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                        Kirjoita omat muistiinpanosi tai hyväksy AI-teksti tänne. Tämä laatikko on suojattu, eikä URA-imuri tai automaatio ylikirjoita sitä.
                    </p>
                    <textarea 
                        className="form-input" 
                        rows="12" 
                        value={asiantuntijanVapaaSana} 
                        onChange={(e) => onUpdateCustomText('tyokyky_lisatieto', e.target.value)} 
                    />
                </div>
                
            </div>
        </div>
    );
};

export default KeskusteluJaAi;