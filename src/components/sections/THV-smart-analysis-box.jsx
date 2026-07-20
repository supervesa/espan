// --- src/components/sections/THV-smart-analysis-box.jsx ---

import React, { useMemo } from 'react';
import { BrainCircuit, Zap } from 'lucide-react';
import { useSignal } from '../signals/useSignal';
import Card from '../common/Card';
import Button from '../common/Button';
import AlertBox from '../common/AlertBox';

const THVSmartAnalysisBox = ({ actions }) => {
    // Tuodaan globaalit signaalit suoraan Contextista! (Ei enää hidasta prop-drillingia tai state-haravointia)
    const { activeSignals } = useSignal();

    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];

        // Täsmätutka 3.0: Erittäin kevyt ja tarkka apufunktio
        const isSignalActive = (key) => !!activeSignals[key];
        const hasAnySignal = (keys) => keys.some(isSignalActive);

        // =========================================================
        // LOKIIKKA 1: Työkyky ja Terveys
        // =========================================================
        if (hasAnySignal(['tyokyky_alentunut', 'tyokyky_selvityksessa', 'selvitetaan_tyokyky'])) {
            detected.push('Työkykyyn tai terveyteen liittyvä rajoite havaittu');
            
            suggestions.push({
                id: 'tyokyky_0',
                label: 'Aseta 0 paikkaa (Työkyky selvityksessä)',
                info: 'Työnhakuvelvollisuutta ei aseteta työkyvyn selvittämisen ajaksi.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'selvitetaan_tyokyky'
            });
            
            suggestions.push({
                id: 'tyokyky_2',
                label: 'Aseta 2 paikkaa (Työkyvyn alentuma)',
                info: 'Asettaa pääsäännön mukaisen fraasin (2 kpl/kk) ja kirjaa alennusperusteeksi työkyvyn.',
                actionType: 'SET_WITH_DISCOUNT',
                phraseKey: 'paasaanto',
                lkm: 2,
                aikajakso: 'kuukaudessa',
                perusteluKey: 'perustelu_2'
            });
        }

        // =========================================================
        // LOKIIKKA 2: Osa-aikatyö
        // =========================================================
        if (hasAnySignal(['osa-aikainen', 'osa_aika'])) {
            detected.push('Osa-aikatyö havaittu');
            
            suggestions.push({
                id: 'osa_aika_1',
                label: 'Aseta kevennetty (Osa-aikatyö)',
                info: 'Asettaa valmiin lausekkeen: vähintään 1 työmahdollisuus kolmen kuukauden aikana.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'kevennetty_osa_aikainen'
            });
        }

        // =========================================================
        // LOKIIKKA 3: Lomautus
        // =========================================================
        if (isSignalActive('lomautettu')) {
            detected.push('Lomautus havaittu');
            
            suggestions.push({
                id: 'lomautus_0',
                label: 'Aseta 0 paikkaa (Lomautus alle 3kk)',
                info: 'Työnhakuvelvollisuus alkaa vasta 3kk kuluttua.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'ei_velvoitetta_lomautus'
            });
        }

        // =========================================================
        // LOKIIKKA 4: Palvelussa oleva asiakas
        // =========================================================
        if (hasAnySignal(['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus'])) {
            detected.push('Asiakas on työllistymistä edistävässä palvelussa');
            
            suggestions.push({
                id: 'palvelu_aikana',
                label: 'Aseta 0 paikkaa (Palvelun aikana)',
                info: 'Työnhakuvelvollisuutta ei aseteta palvelun ajaksi. Asettaa sääntömoottorin mukaisen fraasin.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'palvelun_aikana'
            });
        }

        // =========================================================
        // LOKIIKKA 5: Tuettu opiskelu
        // =========================================================
        if (hasAnySignal(['tuettu_opiskelu_omaehtoinen', 'tuettu_opiskelu_kotoutuja'])) {
            detected.push('Tuettu opiskelu (Omaehtoinen / Kotoutuja) havaittu');
            
            suggestions.push({
                id: 'opiskelu_kevennetty',
                label: 'Aseta kevennetty (Omaehtoinen opiskelu)',
                info: 'Asettaa valmiin lausekkeen: vähintään 3 työmahdollisuutta kolmen kuukauden aikana.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'kevennetty_opiskelija'
            });
        }

        if (hasAnySignal(['tuettu_opiskelu_lyhytkestoinen', 'tuettu_opiskelu_sivutoiminen'])) {
            detected.push('Tuettu opiskelu (Lyhytkestoinen / Sivutoiminen) havaittu');
        }

        return { detected, suggestions };
    }, [activeSignals]);

    const handleApplyAction = (sugg) => {
        if (!actions) return;

        if (sugg.actionType === 'CLEAR') {
            actions.onSelect('tyonhakuvelvollisuus', '', false, {
                avainsana: '',
                alentamisenPerustelut: null,
                alentamisenVapaaTeksti: ''
            });
            return;
        }

        if (sugg.actionType === 'SET_DIRECT_PHRASE') {
            actions.onSelect('tyonhakuvelvollisuus', sugg.phraseKey, false, {
                avainsana: sugg.phraseKey,
                alentamisenPerustelut: null,
                alentamisenVapaaTeksti: ''
            });
            return;
        }

        if (sugg.actionType === 'SET_WITH_DISCOUNT') {
            const updatedSelection = {
                avainsana: sugg.phraseKey,
                muuttujat: { 
                    LKM: sugg.lkm, 
                    AIKAJAKSO: sugg.aikajakso 
                },
                alentamisenPerustelut: { [sugg.perusteluKey]: true },
                alentamisenVapaaTeksti: ''
            };

            actions.onSelect('tyonhakuvelvollisuus', sugg.phraseKey, false, updatedSelection);
            actions.onUpdateVariable('tyonhakuvelvollisuus', sugg.phraseKey, 'LKM', sugg.lkm);
            actions.onUpdateVariable('tyonhakuvelvollisuus', sugg.phraseKey, 'AIKAJAKSO', sugg.aikajakso);
        }
    };

    return (
        <Card title="Sentinel Guardian: Älykäs Ratkaisukeskus" icon={BrainCircuit} variant="ai" className="thv-resolution-hub">
            {analysis.detected.length === 0 ? (
                <AlertBox type="success" customStyle={{ margin: 0 }}>
                    <strong className="fw-semibold text-primary block">Järjestelmä valmiudessa. Ei havaittuja poikkeuksia.</strong>
                    <span className="text-sm text-secondary">Voit asettaa normaalin 4 paikan velvollisuuden alapuolelta.</span>
                </AlertBox>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    
                    {/* HAVAITUT LÖYDÖKSET */}
                    <div className="thv-resolution-column">
                        <h4 className="text-xs fw-bold text-uppercase text-slate-500" style={{ marginBottom: '1rem', letterSpacing: '0.5px' }}>
                            Master-profiilista havaittu:
                        </h4>
                        <ul className="text-sm text-primary" style={{ paddingLeft: '1.2rem', margin: 0 }}>
                            {analysis.detected.map((cond, i) => (
                                <li key={i} style={{ marginBottom: '0.5rem' }}>{cond}</li>
                            ))}
                        </ul>
                    </div>

                    {/* EHDOTUKSET JA TOIMINNOT */}
                    <div className="thv-resolution-column">
                        <h4 className="text-xs fw-bold text-uppercase text-slate-500" style={{ marginBottom: '1rem', letterSpacing: '0.5px' }}>
                            1-Klikkauksen suositukset:
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {analysis.suggestions.map(sugg => (
                                <div key={sugg.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                                    <Button 
                                        variant="ai" 
                                        icon={Zap} 
                                        fullWidth 
                                        onClick={() => handleApplyAction(sugg)}
                                    >
                                        {sugg.label}
                                    </Button>
                                    <p className="text-xs lh-tight text-secondary" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                                        {sugg.info}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </Card>
    );
};

export default THVSmartAnalysisBox;