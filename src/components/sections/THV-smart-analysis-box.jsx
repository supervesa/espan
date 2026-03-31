// --- src/components/sections/THV-smart-analysis-box.jsx ---

import React, { useMemo } from 'react';
import { BrainCircuit, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

const THVSmartAnalysisBox = ({ state, actions }) => {
    
    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];

        // ---------------------------------------------------------
        // 1. TÄSMÄTUTKA 2.0 (Joustava, mutta turvallinen)
        // Etsii sisältääkö mikään AKTIIVINEN arvo etsittyä sanaa.
        // Tunnistaa esim. "tyokokeilu_puollettu", mutta hylkää "false" arvot.
        // ---------------------------------------------------------
        const hasActiveKey = (searchStr) => {
            if (!state) return false;
            
            // 1. Tarkistetaan Signaalipaneelin globaalit signaalit (joissa arvo on true)
            if (state.signals) {
                for (const key in state.signals) {
                    if (key.includes(searchStr) && state.signals[key] === true) return true;
                }
            }

            // 2. Tarkistetaan kaikkien välilehtien aktiiviset valinnat
            for (const section in state) {
                const sectionData = state[section];
                if (typeof sectionData === 'object' && sectionData !== null) {
                    
                    // Monivalinnat (esim. { tyokokeilu_puollettu: true })
                    for (const key in sectionData) {
                        if (key.includes(searchStr) && sectionData[key] === true) return true;
                    }
                    
                    // Radiopainikkeet (esim. { avainsana: 'tyokyky_alentunut' })
                    if (sectionData.avainsana && sectionData.avainsana.includes(searchStr)) return true;
                }
            }
            return false;
        };

        // =========================================================
        // LOKIIKKA 1: Työkyky ja Terveys
        // =========================================================
        const isTyokykyAlentunut = hasActiveKey('tyokyky_alentunut');
        const isTyokykySelvityksessa = hasActiveKey('tyokyky_selvityksessa') || hasActiveKey('selvitetaan_tyokyky');

        if (isTyokykyAlentunut || isTyokykySelvityksessa) {
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
        if (hasActiveKey('osa-aikainen') || hasActiveKey('osa_aika')) {
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
        if (hasActiveKey('lomautettu')) {
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
        // LOKIIKKA 4: Palvelussa oleva asiakas (KORJATTU)
        // =========================================================
        if (hasActiveKey('tyokokeilu') || hasActiveKey('palkkatuki') || hasActiveKey('tyovoimakoulutus')) {
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
        // LOKIIKKA 5: Tuettu opiskelu (UUSI)
        // =========================================================
        if (hasActiveKey('tuettu_opiskelu_omaehtoinen') || hasActiveKey('tuettu_opiskelu_kotoutuja')) {
            detected.push('Tuettu opiskelu (Omaehtoinen / Kotoutuja) havaittu');
            
            suggestions.push({
                id: 'opiskelu_kevennetty',
                label: 'Aseta kevennetty (Omaehtoinen opiskelu)',
                info: 'Asettaa valmiin lausekkeen: vähintään 3 työmahdollisuutta kolmen kuukauden aikana.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'kevennetty_opiskelija'
            });
        }

        // Lyhytkestoinen tai sivutoiminen näytetään havaittuna, mutta ei yleensä alenna velvoitetta
        if (hasActiveKey('tuettu_opiskelu_lyhytkestoinen') || hasActiveKey('tuettu_opiskelu_sivutoiminen')) {
            detected.push('Tuettu opiskelu (Lyhytkestoinen / Sivutoiminen) havaittu');
        }

        return { detected, suggestions };
    }, [state]);

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
        <div className="thv-resolution-hub" style={{ marginBottom: '1.5rem' }}>
            <div className="thv-resolution-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-primary)', color: '#fff', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', fontWeight: 'bold' }}>
                <BrainCircuit size={20} /> Sentinel Guardian: Älykäs Ratkaisukeskus
            </div>
            
            <div style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '1.5rem', backgroundColor: '#fff' }}>
                {analysis.detected.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <CheckCircle size={32} color="var(--color-success)" style={{ marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontWeight: '500', color: 'var(--color-text-primary)' }}>Järjestelmä valmiudessa. Ei havaittuja poikkeuksia.</p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                            Voit asettaa normaalin 4 paikan velvollisuuden alapuolelta.
                        </p>
                    </div>
                ) : (
                    <div className="thv-resolution-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div className="thv-resolution-column">
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Master-profiilista havaittu:
                            </h4>
                            <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--color-text-primary)' }}>
                                {analysis.detected.map((cond, i) => (
                                    <li key={i} style={{ marginBottom: '0.5rem' }}>{cond}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="thv-resolution-column">
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                1-Klikkauksen suositukset:
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {analysis.suggestions.map(sugg => (
                                    <div key={sugg.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-background)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => handleApplyAction(sugg)} 
                                            className="btn" 
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', margin: '0' }}
                                        >
                                            <Zap size={16} /> {sugg.label}
                                        </button>
                                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                                            {sugg.info}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default THVSmartAnalysisBox;