import React, { useState } from 'react';
import Accordion from '../../common/Accordion';
import BooleanQuestion from '../../common/BooleanQuestion';
import CopyButton from '../../common/CopyButton';

// UUDET TUONNIT:
import Card from '../../common/Card';
import Button from '../../common/Button';
import { Sparkles, ArrowDown, X, Loader2, RefreshCw } from 'lucide-react';

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

        if (koontiText.trim() === '--- TYÖKYKYOSION LOMAKETIEDOT ---') {
            alert("Lomakkeella ei ole vielä lainkaan täytettyjä tietoja!");
            return;
        }

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
        setAiLuonnos('');
    };

    return (
        <div className="mt-5 pt-4" style={{ borderTop: '2px solid var(--color-border)' }}>
            <h3 className="text-lg fw-semibold mb-4">Keskustelun tuki ja muistiinpanot</h3>
            
            {/* KYSYMYSPATTERISTO HAITAREISSA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                {Object.keys(kysymysKategoriat).map(kategoriaTitle => {
                    const kysymykset = kysymysKategoriat[kategoriaTitle];
                    return (
                        <Accordion key={kategoriaTitle} title={kategoriaTitle}>
                            {kysymykset.map(q => {
                                const val = state[`custom-tyokyky_v_${q.id}`];
                                return (
                                    <div key={q.id} className="mb-3 p-3 rounded" style={{ backgroundColor: 'var(--color-bg-secondary, rgba(0,0,0,0.02))' }}>
                                        {q.tyyppi === 'boolean' && (
                                            <BooleanQuestion 
                                                label={q.teksti} 
                                                value={val === 'Kyllä'} 
                                                onChange={(isYes) => handleAnswerChange(q.id, isYes ? 'Kyllä' : 'Ei')} 
                                            />
                                        )}
                                        {q.tyyppi === 'teksti' && (
                                            <>
                                                <label className="text-sm fw-medium block mb-1">{q.teksti}</label>
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
                                                <label className="text-sm fw-medium block mb-1">{q.teksti}</label>
                                                <select className="modern-select form-input" value={val || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)}>
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
                
                {/* AI-SYÖTE KORTTI */}
                <Card 
                    title="AI-Syöte: Havainnot"
                    headerAction={
                        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={handleKoontiUpdate}>
                            Päivitä listasta
                        </Button>
                    }
                >
                    <textarea 
                        className="form-input mb-3 mt-2" 
                        rows="6" 
                        placeholder="Hae data listasta yllä olevalla napilla, tai kirjoita omia ranskalaisia viivoja tänne..." 
                        value={aiPromptiLomakkeelta} 
                        onChange={(e) => onUpdateCustomText('tyokyky_ai_prompt', e.target.value)}
                    />
                    
                    <Button 
                        variant="ai"
                        fullWidth 
                        disabled={isGenerating || !aiPromptiLomakkeelta}
                        onClick={handleGenerateAI}
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                        {isGenerating ? 'Generoidaan...' : 'Generoi asiantuntijateksti (AI)'}
                    </Button>

                    {/* AI-LUONNOKSEN KÄSITTELY */}
                    {aiLuonnos && (
                        <div 
                            className="mt-4 p-3 rounded" 
                            style={{ backgroundColor: 'var(--color-ai-bg)', border: '1px solid var(--color-ai-border)' }}
                        >
                            <h4 className="text-sm fw-semibold mb-2 text-ai">AI-Ehdotus:</h4>
                            <div className="text-sm mb-3" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)' }}>
                                {aiLuonnos}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flexGrow: 1 }}>
                                    <Button fullWidth variant="primary" icon={ArrowDown} onClick={handleAcceptAI}>
                                        Hyväksy teksti
                                    </Button>
                                </div>
                                <CopyButton textToCopy={aiLuonnos} />
                                <Button variant="secondary" icon={X} onClick={() => setAiLuonnos('')} title="Hylkää luonnos" />
                            </div>
                        </div>
                    )}
                </Card>

                {/* VAPAA SANA (SUOJATTU) - Hyödyntää teeman suojattua vasenta reunaa */}
                <Card 
                    title="Asiantuntijan vapaa sana (Suojattu)" 
                    style={{ borderLeft: '4px solid var(--color-success)' }}
                >
                    <p className="text-sm text-secondary mb-3">
                        Kirjoita omat muistiinpanosi tai hyväksy AI-teksti tänne. Tämä laatikko on suojattu, eikä URA-imuri tai automaatio ylikirjoita sitä.
                    </p>
                    <textarea 
                        className="form-input" 
                        rows="12" 
                        value={asiantuntijanVapaaSana} 
                        onChange={(e) => onUpdateCustomText('tyokyky_lisatieto', e.target.value)} 
                    />
                </Card>
                
            </div>
        </div>
    );
};

export default KeskusteluJaAi;