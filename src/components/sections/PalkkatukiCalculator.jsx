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
