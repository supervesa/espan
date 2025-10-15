import React, { useState, useMemo, useEffect } from 'react';

// Tuodaan erotellut osat ja komponentit oikeilla poluilla
import { laskePalkkatukiAnalyysi, laskeHelsinkiLisa } from '../../utils/palkkatukiLogiikka';
import { OHJEET, TYOKYKY_AVAINSANAT, STATE_MUUTTUJAT, MUUT_SUOSITUKSET } from '../../data/constants';
import BooleanQuestion from '../BooleanQuestion';
import Checkbox from '../Checkbox';
import Modal from '../Modal';

const PalkkatukiCalculator = ({ state, actions }) => {
    // Tila modaalin näkyvyydelle
    const [showModal, setShowModal] = useState(false);

    const { onUpdatePalkkatuki } = actions;
    const palkkatukiState = state.palkkatuki || {};

    // --- Älykäs datanhaku muista osioista ---
    const tyottomyysKuukausia = useMemo(() => {
        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.[STATE_MUUTTUJAT.TYONHAKU_ALKUPVM];
        if (!tyonhakuAlkanut) return null;
        const parts = tyonhakuAlkanut.split('.');
        if (parts.length < 3) return null;
        try {
            const startDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            if (isNaN(startDate.getTime())) return null;
            const diffTime = new Date().getTime() - startDate.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        } catch (e) {
            return null;
        }
    }, [state.suunnitelman_perustiedot]);

    const age = useMemo(() => {
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI];
        if (!syntymavuosi) return -1;
        return new Date().getFullYear() - parseInt(syntymavuosi, 10);
    }, [state.suunnitelman_perustiedot]);

    const tyokykyStatus = useMemo(() => {
        const tyokykyAvainsana = state.tyokyky?.paavalinta?.avainsana;
        return (tyokykyAvainsana === TYOKYKY_AVAINSANAT.SELVITYKSESSA || tyokykyAvainsana === TYOKYKY_AVAINSANAT.ALENTUNUT)
            ? "Alentunut / Selvityksessä"
            : "Normaali";
    }, [state.tyokyky]);

    const onkoEiTutkintoa = useMemo(() => !!state.koulutus_yrittajyys?.ei_tutkintoa, [state.koulutus_yrittajyys]);
    const onkoOppisopimus = useMemo(() => !!state.koulutus_yrittajyys?.oppisopimus, [state.koulutus_yrittajyys]);
    const onkoTyoton = useMemo(() => !!(state.tyotilanne?.tyoton || state.tyotilanne?.irtisanottu), [state.tyotilanne]);
    const eiAnsiotyossa6kk = useMemo(() => !!state.tyotilanne?.alle_6kk_tyossa, [state.tyotilanne]);

    // --- Sääntömoottorin kutsuminen ---
    const analysisResult = useMemo(() => {
        const asiakasData = {
            age, tyottomyysKuukausia, tyokykyStatus, onkoTyoton, onkoEiTutkintoa,
            eiAnsiotyossa6kk, onkoOppisopimus,
            tyonantaja_yhdistys: palkkatukiState.tyonantaja_yhdistys,
            onko_oppisopimus: palkkatukiState.onko_oppisopimus,
        };
        return laskePalkkatukiAnalyysi(asiakasData);
    }, [
        age, tyottomyysKuukausia, tyokykyStatus, onkoTyoton, onkoEiTutkintoa,
        eiAnsiotyossa6kk, onkoOppisopimus, palkkatukiState.tyonantaja_yhdistys,
        palkkatukiState.onko_oppisopimus
    ]);

    // --- Helsinki-lisän laskenta ---
    const helsinkiLisaTulos = useMemo(() => {
        return laskeHelsinkiLisa(analysisResult.ehdotus);
    }, [analysisResult.ehdotus]);

    // --- Tulosten raportointi ylöspäin App-komponentille ---
    useEffect(() => {
        const tyokokeiluPuolto = palkkatukiState.tyokokeilu_puolletaan
            ? MUUT_SUOSITUKSET.TYOKOKEILU_PUOLTO
            : null;

        onUpdatePalkkatuki('analyysi', {
            ...analysisResult,
            helsinkiLisa: helsinkiLisaTulos,
            tyokokeiluPuolto: tyokokeiluPuolto,
        });
    }, [analysisResult, helsinkiLisaTulos, palkkatukiState.tyokokeilu_puolletaan, onUpdatePalkkatuki]);

    return (
        <>
            <section className="section-container">
                <div className="section-header">
                    <h2 className="section-title">Palkkatuki</h2>
                    <button onClick={() => setShowModal(true)} className="info-button">Näytä ohjeet</button>
                </div>
                <div className="info-box">
                    <h3>Automaattisesti haetut tiedot</h3>
                    <p><b>Asiakkaan ikä:</b> {age !== -1 ? `${age} v` : 'Ei määritetty'}</p>
                    <p><b>Työttömyyden kesto:</b> {tyottomyysKuukausia !== null ? `${tyottomyysKuukausia} kk` : 'Ei määritetty'}</p>
                    <p><b>Työkyky:</b> {tyokykyStatus}</p>
                    <p><b>Onko työtön työnhakija:</b> {onkoTyoton ? 'Kyllä' : 'Ei'}</p>
                    <p><b>Ei ansiotyössä 6kk aikana:</b> {eiAnsiotyossa6kk ? 'Kyllä' : 'Ei'}</p>
                    <p><b>Ei toisen asteen tutkintoa:</b> {onkoEiTutkintoa ? 'Kyllä' : 'Ei'}</p>
                </div>
                <div className="questions-container">
                    <h3>Tarkentavat kysymykset</h3>
                    <BooleanQuestion
                        label="Onko työnantaja yhdistys/säätiö/uskonnollinen yhdyskunta?"
                        value={palkkatukiState.tyonantaja_yhdistys}
                        onChange={(val) => onUpdatePalkkatuki('tyonantaja_yhdistys', val)}
                    />
                    {!onkoOppisopimus && (
                        <BooleanQuestion
                            label="Onko kyseessä oppisopimus (jos ei valittu aiemmin)?"
                            value={palkkatukiState.onko_oppisopimus}
                            onChange={(val) => onUpdatePalkkatuki('onko_oppisopimus', val)}
                        />
                    )}
                </div>
            </section>

            <section className="section-container">
                <h2 className="section-title">Muut toimenpiteet</h2>
                <div className="questions-container">
                    <Checkbox
                        label="Puolletaanko työkokeilua?"
                        checked={palkkatukiState.tyokokeilu_puolletaan}
                        onChange={(val) => onUpdatePalkkatuki('tyokokeilu_puolletaan', val)}
                    />
                </div>
            </section>

            <section className="section-container analysis-container">
                <h2 className="section-title">Yhteenveto ja ehdotukset</h2>

                <h3>Palkkatuki</h3>
                {analysisResult.conditionsMet.length > 0
                    ? <ul>{analysisResult.conditionsMet.map(c => <li key={c}>{c}</li>)}</ul>
                    : <p>Perustuu yleisiin ehtoihin.</p>}
                <p className="ehdotus">{analysisResult.ehdotus}</p>

                {helsinkiLisaTulos && (
                    <>
                        <h3 style={{ marginTop: '1rem' }}>Helsinki-lisä</h3>
                        <p className="ehdotus">{helsinkiLisaTulos}</p>
                    </>
                )}

                {palkkatukiState.tyokokeilu_puolletaan && (
                     <>
                        <h3 style={{ marginTop: '1rem' }}>Työkokeilu</h3>
                        <p className="ehdotus">{MUUT_SUOSITUKSET.TYOKOKEILU_PUOLTO}</p>
                    </>
                )}
            </section>

            <Modal show={showModal} onClose={() => setShowModal(false)} title={OHJEET.OTSIKKO}>
                {OHJEET.KAPPALEET.map((kappale, index) => (
                    <div key={index}>
                        <h5>{kappale.otsikko}</h5>
                        {kappale.teksti && <p>{kappale.teksti}</p>}
                        {kappale.lista && (
                            <ul>
                                {kappale.lista.map((item, i) => (
                                    <li key={i} dangerouslySetInnerHTML={{ __html: item }}></li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </Modal>
        </>
    );
};

export default PalkkatukiCalculator;