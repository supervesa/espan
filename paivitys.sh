#!/bin/bash

# Espan-projektin viimeistelyskripti Palkkatukilaskurille
# Tämä skripti päivittää Palkkatuki-osion sen lopulliseen,
# älykkääseen ja vakaaseen muotoon.

echo "Viimeistellään Palkkatuki-osio..."

# --- 1. KORVATAAN PalkkatukiCalculator.jsx LOPULLISELLA VERSIOLLA ---
echo "Päivitetään src/components/sections/PalkkatukiCalculator.jsx..."
cat <<'EOF' > src/components/sections/PalkkatukiCalculator.jsx
import React, { useMemo } from 'react';

const PalkkatukiCalculator = ({ state, actions }) => {
    const { onUpdatePalkkatuki } = actions;
    const palkkatukiState = state.palkkatuki || {};

    // --- Älykäs datanhaku muista osioista ---
    const tyottomyysKuukausia = useMemo(() => {
        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!tyonhakuAlkanut) return null;
        const parts = tyonhakuAlkanut.split('.');
        if (parts.length < 3) return null;
        try {
            const startDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            if (isNaN(startDate.getTime())) return null;
            const diffTime = new Date().getTime() - startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return Math.floor(diffDays / 30.44);
        } catch(e) { return null; }
    }, [state.suunnitelman_perustiedot]);

    const age = useMemo(() => {
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!syntymavuosi) return -1;
        return new Date().getFullYear() - parseInt(syntymavuosi, 10);
    }, [state.suunnitelman_perustiedot]);

    const tyokykyStatus = useMemo(() => {
        const tyokykyState = state.tyokyky || {};
        return (tyokykyState.paavalinta?.avainsana === 'tyokyky_selvityksessa' || tyokykyState.paavalinta?.avainsana === 'tyokyky_alentunut') 
            ? "Alentunut / Selvityksessä" 
            : "Normaali";
    }, [state.tyokyky]);

    // UUDET AUTOMAATTISET TIEDOT
    const onkoTyoton = useMemo(() => !!(state.tyotilanne?.tyoton || state.tyotilanne?.irtisanottu), [state.tyotilanne]);
    const eiAnsiotyossa6kk = useMemo(() => !!state.tyotilanne?.alle_6kk_tyossa, [state.tyotilanne]);
    const onkoEiTutkintoa = useMemo(() => !!state.koulutus_yrittajyys?.ei_tutkintoa, [state.koulutus_yrittajyys]);
    const onkoOppisopimus = useMemo(() => !!state.koulutus_yrittajyys?.oppisopimus, [state.koulutus_yrittajyys]);

    // --- UUSI SÄÄNTÖMOOTTORI JA PRIORISOINTI ---
    const analysisResult = useMemo(() => {
        let conditionsMet = [];
        if (onkoTyoton && age >= 15 && age <= 24) conditionsMet.push("15-24-vuotias");
        if (onkoTyoton && age >= 50) conditionsMet.push("50 vuotta täyttänyt");
        if (onkoTyoton && onkoEiTutkintoa) conditionsMet.push("Ei toisen asteen tutkintoa");
        if (onkoTyoton && eiAnsiotyossa6kk) conditionsMet.push("Ei ansiotyössä 6kk aikana");
        if (tyokykyStatus.startsWith("Alentunut")) conditionsMet.push("Alentunut työkyky");
        if (onkoTyoton && age >= 60 && tyottomyysKuukausia !== null && tyottomyysKuukausia >= 12) conditionsMet.push("60v täyttänyt pitkäaikaistyötön");
        if (onkoOppisopimus || palkkatukiState.onko_oppisopimus) conditionsMet.push("Oppisopimuskoulutus");
        
        let ehdotus = "Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.";
        
        // Perusvaihtoehto, jos asiakas on työtön
        if (onkoTyoton && tyottomyysKuukausia !== null) {
             if (tyottomyysKuukausia >= 12) {
                ehdotus = "Ehdotus: Ammatillisen osaamisen parantaminen (50%, max 10kk).";
             } else {
                ehdotus = "Ehdotus: Ammatillisen osaamisen parantaminen (50%, max 5kk).";
             }
        }
        
        // Ylikirjoitetaan perusvaihtoehto, jos jokin parempi erityisehto täyttyy
        if (conditionsMet.includes("Alentunut työkyky")) {
            ehdotus = "Ehdotus: Alentuneesti työkykyisen palkkatuki (70%, 10kk, jatkettavissa).";
        } else if (onkoTyoton && tyottomyysKuukausia >= 24 && palkkatukiState.tyonantaja_yhdistys) {
            ehdotus = "Ehdotus: 100% palkkatuki yhdistykselle (100%, 10kk).";
        } else if (conditionsMet.includes("60v täyttänyt pitkäaikaistyötön")) {
            ehdotus = "Ehdotus: 60v täyttänyt, pitkään työtön (50%, max 24kk).";
        } else if (conditionsMet.includes("Oppisopimuskoulutus")) {
            ehdotus = "Ehdotus: Palkkatuki oppisopimukseen (50%, koko koulutuksen ajan).";
        }
        
        return { conditionsMet, ehdotus };
    }, [palkkatukiState, tyokykyStatus, tyottomyysKuukausia, age, onkoTyoton, eiAnsiotyossa6kk, onkoEiTutkintoa, onkoOppisopimus]);

    return (
        <section className="section-container">
            <h2 className="section-title">Palkkatuki</h2>
            <div className="info-box">
                <h3>Automaattisesti haetut tiedot:</h3>
                <p><b>Asiakkaan ikä:</b> {age !== -1 ? `${age} v` : 'Ei määritetty'}</p>
                <p><b>Työttömyyden kesto:</b> {tyottomyysKuukausia !== null ? `${tyottomyysKuukausia} kk` : 'Ei määritetty'}</p>
                <p><b>Työkyky:</b> {tyokykyStatus}</p>
                <p><b>Onko työtön työnhakija:</b> {onkoTyoton ? 'Kyllä' : 'Ei'}</p>
                <p><b>Ei ansiotyössä 6kk aikana:</b> {eiAnsiotyossa6kk ? 'Kyllä' : 'Ei'}</p>
                <p><b>Ei toisen asteen tutkintoa:</b> {onkoEiTutkintoa ? 'Kyllä' : 'Ei'}</p>
                <p><b>On oppisopimuksessa:</b> {onkoOppisopimus ? 'Kyllä' : 'Ei'}</p>
            </div>
            <div className="questions-container">
                <h3>Tarkentavat kysymykset:</h3>
                 <div>
                    <label>Onko työnantaja yhdistys/säätiö/uskonnollinen yhdyskunta?</label>
                    <div className="boolean-buttons">
                        <button onClick={() => onUpdatePalkkatuki('tyonantaja_yhdistys', true)} className={palkkatukiState.tyonantaja_yhdistys === true ? 'selected' : ''}>Kyllä</button>
                        <button onClick={() => onUpdatePalkkatuki('tyonantaja_yhdistys', false)} className={palkkatukiState.tyonantaja_yhdistys === false ? 'selected' : ''}>Ei</button>
                    </div>
                </div>
                 {!onkoOppisopimus && (
                    <div>
                        <label>Onko kyseessä oppisopimus (jos ei valittu aiemmin)?</label>
                        <div className="boolean-buttons">
                            <button onClick={() => onUpdatePalkkatuki('onko_oppisopimus', true)} className={palkkatukiState.onko_oppisopimus === true ? 'selected' : ''}>Kyllä</button>
                            <button onClick={() => onUpdatePalkkatuki('onko_oppisopimus', false)} className={palkkatukiState.onko_oppisopimus === false ? 'selected' : ''}>Ei</button>
                        </div>
                    </div>
                 )}
            </div>
             <div className="analysis-container">
                <h3>Analyysin tulos:</h3>
                {analysisResult.conditionsMet.length > 0 ? <ul>{analysisResult.conditionsMet.map(c => <li key={c}>{c}</li>)}</ul> : <p>Perustuu yleisiin ehtoihin.</p>}
                <p className="ehdotus">{analysisResult.ehdotus}</p>
            </div>
        </section>
    );
};
export default PalkkatukiCalculator;
EOF

# --- 2. PÄIVITETÄÄN Summary.jsx VASTAAMAAN UUTTA LOGIIKKAA ---
echo "Päivitetään src/components/Summary.jsx..."
rm -f src/components/Summary.jsx
cat <<'EOF' > src/components/Summary.jsx
import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const FINGERPRINT = '\u200B\u200D\u200C'; // Näkymätön sormenjälki

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject) => {
                let text = phraseObject.teksti;
                const phraseState = section.monivalinta ? selection?.[phraseObject.avainsana] : selection;
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                        text = text.replace(`[${key}]`, value || '');
                    });
                }
                return text.replace(/\s*\[.*?\]/g, '').replace(/\(\s*v\.\s*\)/, '').trim();
            };
            
            if (section.id === 'palkkatuki' && (state.suunnitelman_perustiedot?.syntymavuosi || Object.keys(state.palkkatuki || {}).length > 0)) {
                // Kopioidaan analyysilogiikka tänne tulostusta varten
                const palkkatukiState = state.palkkatuki || {};
                const age = state.suunnitelman_perustiedot?.syntymavuosi ? new Date().getFullYear() - parseInt(state.suunnitelman_perustiedot.syntymavuosi.muuttujat.SYNTYMÄVUOSI, 10) : -1;
                const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
                let tyottomyysKuukausia = -1;
                if (tyonhakuAlkanut) {
                    const parts = tyonhakuAlkanut.split('.');
                    if (parts.length > 2) {
                        const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        tyottomyysKuukausia = Math.floor(((new Date() - startDate) / (1000 * 60 * 60 * 24)) / 30.44);
                    }
                }
                const tyokykyStatus = state.tyokyky?.paavalinta?.avainsana?.includes('selvitys') || state.tyokyky?.paavalinta?.avainsana?.includes('alentunut') ? "Alentunut" : "Normaali";
                const onkoTyoton = !!(state.tyotilanne?.tyoton || state.tyotilanne?.irtisanottu);
                const eiAnsiotyossa6kk = !!state.tyotilanne?.alle_6kk_tyossa;
                const onkoEiTutkintoa = !!state.koulutus_yrittajyys?.ei_tutkintoa;
                const onkoOppisopimus = !!(state.koulutus_yrittajyys?.oppisopimus || palkkatukiState.onko_oppisopimus);
                
                let conditionsMet = [];
                if (onkoTyoton && age >= 15 && age <= 24) conditionsMet.push("15-24-vuotias");
                if (onkoTyoton && age >= 50) conditionsMet.push("50 vuotta täyttänyt");
                if (onkoTyoton && onkoEiTutkintoa) conditionsMet.push("Ei toisen asteen tutkintoa");
                if (onkoTyoton && eiAnsiotyossa6kk) conditionsMet.push("Ei ansiotyössä 6kk aikana");
                if (tyokykyStatus === "Alentunut") conditionsMet.push("Alentunut työkyky");
                if (onkoTyoton && age >= 60 && tyottomyysKuukausia >= 12) conditionsMet.push("60v täyttänyt pitkäaikaistyötön");
                if (onkoOppisopimus) conditionsMet.push("Oppisopimuskoulutus");

                let ehdotus = "Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.";
                if (onkoTyoton && tyottomyysKuukausia !== null && tyottomyysKuukausia >= 0) {
                     if (tyottomyysKuukausia >= 12) ehdotus = "Ammatillisen osaamisen parantaminen (50%, max 10kk).";
                     else ehdotus = "Ammatillisen osaamisen parantaminen (50%, max 5kk).";
                }
                if (conditionsMet.includes("Alentunut työkyky")) ehdotus = "Alentuneesti työkykyisen palkkatuki (70%, 10kk, jatkettavissa).";
                else if (onkoTyoton && tyottomyysKuukausia >= 24 && palkkatukiState.tyonantaja_yhdistys) ehdotus = "100% palkkatuki yhdistykselle (100%, 10kk).";
                else if (conditionsMet.includes("60v täyttänyt pitkäaikaistyötön")) ehdotus = "60v täyttänyt, pitkään työtön (50%, max 24kk).";
                else if (conditionsMet.includes("Oppisopimuskoulutus")) ehdotus = "Palkkatuki oppisopimukseen (50%, koko koulutuksen ajan).";

                sectionTextParts.push(`Palkkatuen arviointi: ${ehdotus}`);
            }
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    if (section.id === 'tyonhakuvelvollisuus') {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
            }

            if (sectionTextParts.length > 0) {
                textParts.push(`${section.otsikko}\n${sectionTextParts.join(' ')}`);
            }
        });
        
        if (textParts.length === 0) return '';
        return FINGERPRINT + textParts.join('\n\n');

    }, [state]);

    const handleCopy = () => {
        const plainText = summaryText.replace(FINGERPRINT, '');
        navigator.clipboard.writeText(plainText).then(() => {
            setFeedback('Kopioitu!');
            setTimeout(() => setFeedback(''), 2000);
        });
    };
    
    return (
        <aside className="summary-sticky-container">
            <div className="summary-box">
                <h2>Koottu suunnitelma</h2>
                <div className="summary-content">
                    {summaryText ? (
                        summaryText.replace(FINGERPRINT, '').split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex}>
                                {paragraph.split('\n').map((line, lIndex) => {
                                    if (lIndex === 0) {
                                        return <strong key={lIndex}>{line}</strong>;
                                    }
                                    return <React.Fragment key={lIndex}><br />{line}</React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi...</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>Kopioi leikepöydälle</button>
                <p className="feedback-text">{feedback}</p>
            </div>
        </aside>
    );
};
export default Summary;
EOF

echo "Korjaus valmis! Palkkatuki-laskuri on päivitetty vastaamaan yksityiskohtaisia sääntöjä."
echo "Voit käynnistää sovelluksen komennolla: npm run dev"