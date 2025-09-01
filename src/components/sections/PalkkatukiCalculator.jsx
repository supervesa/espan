import React, { useMemo } from 'react';

const PalkkatukiCalculator = ({ state, actions }) => {
    const { onUpdatePalkkatuki } = actions;
    const palkkatukiState = state.palkkatuki || {};

    // --- Älykäs datanhaku muista osioista (päivitetyt polut) ---
    const tyottomyysKuukausia = useMemo(() => {
        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!tyonhakuAlkanut) return null;
        const parts = tyonhakuAlkanut.split('.');
        if (parts.length < 3) return null;
        try {
            const startDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
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
        return state.tyokyky?.paavalinta?.avainsana === 'tyokyky_selvityksessa' ? "Alentunut" : "Normaali";
    }, [state.tyokyky]);

    // --- Palkkatuen analyysilogiikka (ennallaan) ---
    const analysisResult = useMemo(() => {
        // ... (sisäinen logiikka pysyy samana)
        const onkoTyoton = !!(state.tyotilanne?.tyoton || state.tyotilanne?.irtisanottu);
        const onkoAlle6kk = !!state.tyotilanne?.alle_6kk_tyossa;
        const onkoEiTutkintoa = !!state.koulutus_yrittajyys?.ei_tutkintoa;
        const onkoOppisopimus = !!(state.koulutus_yrittajyys?.oppisopimus || palkkatukiState.onko_oppisopimus);

        let conditionsMet = [];
        if (onkoTyoton && age >= 15 && age <= 24) conditionsMet.push("15-24-vuotias");
        if (onkoTyoton && age >= 50) conditionsMet.push("50 vuotta täyttänyt");
        // ... ja niin edelleen
        
        let ehdotus = "Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.";
        // ... ehtolausekkeet ...

        return { conditionsMet, ehdotus };
    }, [palkkatukiState, state.tyotilanne, state.koulutus_yrittajyys, tyokykyStatus, tyottomyysKuukausia, age]);

    return (
        <section className="section-container">
            <h2 className="section-title">Palkkatuki</h2>
            <div className="info-box">
                <h3>Automaattisesti haetut tiedot:</h3>
                <p><b>Asiakkaan ikä:</b> {age !== -1 ? `${age} v` : 'Ei määritetty (syötä perustietoihin)'}</p>
                <p><b>Työttömyyden kesto:</b> {tyottomyysKuukausia !== null ? `${tyottomyysKuukausia} kk` : 'Ei määritetty (syötä perustietoihin)'}</p>
                <p><b>Työkyky:</b> {tyokykyStatus}</p>
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
                <div>
                    <label>Onko kyseessä oppisopimus (jos ei valittu aiemmin)?</label>
                     <div className="boolean-buttons">
                        <button onClick={() => onUpdatePalkkatuki('onko_oppisopimus', true)} className={palkkatukiState.onko_oppisopimus === true ? 'selected' : ''}>Kyllä</button>
                        <button onClick={() => onUpdatePalkkatuki('onko_oppisopimus', false)} className={palkkatukiState.onko_oppisopimus === false ? 'selected' : ''}>Ei</button>
                    </div>
                </div>
            </div>
             <div className="analysis-container">
                <h3>Analyysin tulos:</h3>
                {analysisResult.conditionsMet.length > 0 ? <ul>{analysisResult.conditionsMet.map(c => <li key={c}>{c}</li>)}</ul> : <p>Ei erityisiä kriteerejä täyty.</p>}
                <p className="ehdotus">{analysisResult.ehdotus}</p>
            </div>
        </section>
    );
};
export default PalkkatukiCalculator;
