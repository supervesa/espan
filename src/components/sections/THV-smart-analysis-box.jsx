// --- src/components/sections/THV-smart-analysis-box.jsx ---

import React, { useMemo } from 'react';
import { BrainCircuit, Zap, CheckCircle } from 'lucide-react';

const THVSmartAnalysisBox = ({ state, actions }) => {
    const signals = state.signals || {};

    const analysis = useMemo(() => {
        const activeSignalKeys = Object.entries(signals)
            .filter(([key, data]) => !data.isMuted)
            .map(([key]) => key.toLowerCase());

        const detected = [];
        const suggestions = [];

        // LOKIIKKA 1: Työkyky ja Terveys
        const hasWorkAbilityIssues = activeSignalKeys.some(s => 
            (s.includes('tyokyky') || s.includes('sairas') || s.includes('alentuma') || s.includes('haaste') || s.includes('selvitys')) 
            && !s.includes('normaali')
        );

        if (hasWorkAbilityIssues) {
            detected.push('Työkykyyn tai terveyteen liittyvä signaali');
            
            suggestions.push({
                id: 'tyokyky_0',
                label: 'Aseta 0 paikkaa (Työkykyrajoite)',
                info: 'Keskeyttää työnhaun seurannan tilapäisesti. Suositellaan pitkissä sairaslomissa tai odotettaessa lausuntoja.',
                action: () => applyAutomation(0, 'tyokyky_peruste')
            });
            
            suggestions.push({
                id: 'tyokyky_2',
                label: 'Aseta 2 paikkaa (Työkyvyn alentuma)',
                info: 'Alentaa velvollisuutta. Soveltuu, jos asiakas kykenee hakemaan osittaista työtä.',
                action: () => applyAutomation(2, 'tyokyky_peruste')
            });
        }

        // LOKIIKKA 2: Osa-aikatyö
        if (activeSignalKeys.some(s => s.includes('osa_aika') || s.includes('osa-aika') || s.includes('palkkatuki'))) {
            detected.push('Osa-aikatyö tai palkkatuki');
            
            suggestions.push({
                id: 'osa_aika_1',
                label: 'Aseta 1-3 paikkaa (Työssäolo)',
                info: 'Alentaa määrää tehtyjen työtuntien perusteella.',
                action: () => applyAutomation(2, 'tyossaolo_peruste') 
            });
        }

        // LOKIIKKA 3: Lomautus
        if (activeSignalKeys.some(s => s.includes('lomautettu') || s.includes('lomautus'))) {
            detected.push('Lomautus');
            
            suggestions.push({
                id: 'lomautus_0',
                label: 'Aseta 0 paikkaa (Lomautettu alle 1kk)',
                info: 'Ei työnhakuvelvollisuutta lomautuksen ensimmäisen kuukauden aikana.',
                action: () => applyAutomation(0, 'lomautus_peruste')
            });
        }

        return { detected, suggestions };
    }, [signals]);

    const applyAutomation = (maara, syyAvainsana) => {
        // HUOM: Tämä on väliaikainen tunniste, joka myöhemmin kytketään oikeaan tietokannan fraasiin
        const ALENNUS_FRAASI_DB_KEY = 'alennus_fraasin_avainsana'; 

        actions.onSelect('tyonhakuvelvollisuus', ALENNUS_FRAASI_DB_KEY, false);
        actions.onUpdateVariable('tyonhakuvelvollisuus', ALENNUS_FRAASI_DB_KEY, 'LKM', maara);

        alert(`Taikatemppu suoritettu!\n\nJärjestelmä asetti velvollisuudeksi: ${maara} paikkaa.`);
    };

    return (
        <div className="thv-resolution-hub">
            <div className="thv-resolution-header">
                <BrainCircuit size={22} /> Älykäs Ratkaisukeskus
            </div>
            
            {/* JOS EI LÖYDY ALENNUSPERUSTEITA, NÄYTETÄÄN TYHJÄ TILA */}
            {analysis.detected.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-secondary)' }}>
                    <CheckCircle size={28} color="var(--color-success)" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: '500' }}>Järjestelmä valmiudessa. Ei havaittuja alennusperusteita.</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                        Voit asettaa normaalin 4 paikan velvollisuuden alapuolelta. Jos tilanne muuttuu, lisää havainto oikean reunan Signaalikeskuksesta.
                    </p>
                </div>
            ) : (
                /* JOS LÖYTYY PERUSTEITA, NÄYTETÄÄN NORMAALI GRID */
                <div className="thv-resolution-grid">
                    <div className="thv-resolution-column">
                        <h4 className="thv-column-title">Havaitut sääntö-osumistat:</h4>
                        <ul className="thv-resolution-signals">
                            {analysis.detected.map((cond, i) => <li key={i}>{cond}</li>)}
                        </ul>
                        <p className="thv-resolution-info" style={{ marginTop: '1rem' }}>
                            Järjestelmä on suodattanut hiljennetyt signaalit pois. Voit hallita järjestelmän aivoja oikean reunan Signaalikeskuksesta.
                        </p>
                    </div>

                    <div className="thv-resolution-column">
                        <h4 className="thv-column-title">1-Klikkauksen toimenpiteet:</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {analysis.suggestions.map(sugg => (
                                <div key={sugg.id}>
                                    <button type="button" onClick={sugg.action} className="thv-action-button">
                                        <Zap size={18} /> {sugg.label}
                                    </button>
                                    <p className="thv-resolution-info" style={{ marginTop: '0.4rem' }}>
                                        {sugg.info}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default THVSmartAnalysisBox;