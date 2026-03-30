// --- src/components/sections/THV-smart-analysis-box.jsx ---

import React, { useMemo } from 'react';
import { BrainCircuit, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

const THVSmartAnalysisBox = ({ state, actions }) => {
    
    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];

        // Muutetaan koko state tekstiksi nopeaa ja pomminvarmaa skannausta varten
        const fullStateStr = JSON.stringify(state || {}).toLowerCase();

        // LOKIIKKA 1: Työkyky ja Terveys
        if (fullStateStr.includes('työkyky_alentunut') || fullStateStr.includes('tyokyky_alentunut') || fullStateStr.includes('sairausloma') || fullStateStr.includes('tyokyky_selvityksessa')) {
            detected.push('Työkykyyn tai terveyteen liittyvä rajoite havaittu');
            
            // Vaihtoehto A: 0 paikkaa (Selvitys kesken) -> Käytetään suoraan tietokannan valmista fraasia
            suggestions.push({
                id: 'tyokyky_0',
                label: 'Aseta 0 paikkaa (Työkyky selvityksessä)',
                info: 'Työnhakuvelvollisuutta ei aseteta työkyvyn selvittämisen ajaksi.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'selvitetaan_tyokyky'
            });
            
            // Vaihtoehto B: 2 paikkaa -> Käytetään 'paasaanto'-fraasia, lasketaan LKM = 2, ja valitaan alennussyy 'perustelu_2' (Työkyky)
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

        // LOKIIKKA 2: Osa-aikatyö
        if (fullStateStr.includes('osa_aika') || fullStateStr.includes('osa-aika')) {
            detected.push('Osa-aikatyö havaittu');
            
            // Käytetään suoraan tietokannan upeaa valmista 'kevennetty_osa_aikainen' -fraasia (1 paikka / 3kk)
            suggestions.push({
                id: 'osa_aika_1',
                label: 'Aseta kevennetty (Osa-aikatyö)',
                info: 'Asettaa valmiin lausekkeen: vähintään 1 työmahdollisuus kolmen kuukauden aikana.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'kevennetty_osa_aikainen'
            });
        }

        // LOKIIKKA 3: Lomautus
        if (fullStateStr.includes('lomautettu') || fullStateStr.includes('lomautus')) {
            detected.push('Lomautus havaittu');
            
            // Käytetään suoraan tietokannan valmista 'ei_velvoitetta_lomautus' -fraasia
            suggestions.push({
                id: 'lomautus_0',
                label: 'Aseta 0 paikkaa (Lomautus alle 3kk)',
                info: 'Työnhakuvelvollisuus alkaa vasta 3kk kuluttua.',
                actionType: 'SET_DIRECT_PHRASE',
                phraseKey: 'ei_velvoitetta_lomautus'
            });
        }

        // LOKIIKKA 4: Palvelussa oleva asiakas
        if (fullStateStr.includes('tyokokeilu') || fullStateStr.includes('työkokeilu') || 
            fullStateStr.includes('tyovoimakoulutus') || fullStateStr.includes('työvoimakoulutus') || 
            fullStateStr.includes('palkkatuki') || fullStateStr.includes('palkkatuettu')) {
            
            detected.push('Asiakas on työllistymistä edistävässä palvelussa');
            
            suggestions.push({
                id: 'palvelu_clear',
                label: 'Siivoa numeerinen velvollisuus (Siirry Aikataulu-tilaan)',
                info: 'Palvelun aikana ei vaadita THV-lukumäärää. Poistaa turhat valinnat ja käyttää vain Aikatauluehdotusta.',
                actionType: 'CLEAR'
            });
        }

        return { detected, suggestions };
    }, [state]);

    const handleApplyAction = (sugg) => {
        if (!actions) return;

        // TOIMENPIDE A: Tyhjennetään valinnat (Palvelussa olevat)
        if (sugg.actionType === 'CLEAR') {
            actions.onSelect('tyonhakuvelvollisuus', '', false, {
                avainsana: '',
                alentamisenPerustelut: null,
                alentamisenVapaaTeksti: ''
            });
            return;
        }

        // TOIMENPIDE B: Asetetaan suoraan valmis erikoisfraasi (Ei vaadi muuttujia)
        if (sugg.actionType === 'SET_DIRECT_PHRASE') {
            actions.onSelect('tyonhakuvelvollisuus', sugg.phraseKey, false, {
                avainsana: sugg.phraseKey,
                alentamisenPerustelut: null,
                alentamisenVapaaTeksti: ''
            });
            return;
        }

        // TOIMENPIDE C: Asetetaan Pääsääntö ('paasaanto') ja annetaan sille LKM, AIKAJAKSO ja Alennussyy
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

            // 1. Asetetaan fraasi ja alennuksen syy paikallisesti
            actions.onSelect('tyonhakuvelvollisuus', sugg.phraseKey, false, updatedSelection);
            
            // 2. Päivitetään muuttujat varmuuden vuoksi myös globaalisti
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
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}
                                        >
                                            <Zap size={16} /> {sugg.label}
                                        </button>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
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