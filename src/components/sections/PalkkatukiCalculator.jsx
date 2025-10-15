import React, { useState, useMemo, useEffect } from 'react';
import { laskePalkkatukiAnalyysi, laskeHelsinkiLisa } from '../../utils/palkkatukiLogiikka';
import {
    OHJEET,
    TYOKYKY_AVAINSANAT,
    STATE_MUUTTUJAT,
    MUUT_SUOSITUKSET,
    PALKKATUKI_EHDOTUKSET,
    EHDOTUS_MUUNNOKSET,
    KRITEERI_MUUNNOKSET,
    PALKKATUKI_LISAHUOMIOT
} from '../../data/constants';
import BooleanQuestion from '../BooleanQuestion';
import Checkbox from '../Checkbox';
import Modal from '../Modal';

const PalkkatukiCalculator = ({ state, actions }) => {
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
            return Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        } catch (e) { return null; }
    }, [state.suunnitelman_perustiedot]);

    const age = useMemo(() => {
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI];
        if (!syntymavuosi) return -1;
        return new Date().getFullYear() - parseInt(syntymavuosi, 10);
    }, [state.suunnitelman_perustiedot]);

    const tyokykyStatus = useMemo(() => {
        const tyokykyAvainsana = state.tyokyky?.paavalinta?.avainsana;
        return (tyokykyAvainsana === TYOKYKY_AVAINSANAT.SELVITYKSESSA || tyokykyAvainsana === TYOKYKY_AVAINSANAT.ALENTUNUT)
            ? "Alentunut / Selvityksessä" : "Normaali";
    }, [state.tyokyky]);

    const onkoEiTutkintoa = useMemo(() => !!state.koulutus_yrittajyys?.ei_tutkintoa, [state.koulutus_yrittajyys]);
    const onkoOppisopimus = useMemo(() => !!state.koulutus_yrittajyys?.oppisopimus, [state.koulutus_yrittajyys]);
    const onkoTyoton = useMemo(() => !!(state.tyotilanne?.tyoton || state.tyotilanne?.irtisanottu), [state.tyotilanne]);
    const eiAnsiotyossa6kk = useMemo(() => !!state.tyotilanne?.alle_6kk_tyossa, [state.tyotilanne]);

    // --- Sääntömoottorin ja analyysin suoritus ---
    const analysisResult = useMemo(() => {
        return laskePalkkatukiAnalyysi({
            age, tyottomyysKuukausia, tyokykyStatus, onkoTyoton, onkoEiTutkintoa,
            eiAnsiotyossa6kk, onkoOppisopimus,
            tyonantaja_yhdistys: palkkatukiState.tyonantaja_yhdistys,
            onko_oppisopimus: palkkatukiState.onko_oppisopimus,
        });
    }, [age, tyottomyysKuukausia, tyokykyStatus, onkoTyoton, onkoEiTutkintoa, eiAnsiotyossa6kk, onkoOppisopimus, palkkatukiState.tyonantaja_yhdistys, palkkatukiState.onko_oppisopimus]);
    
    const helsinkiLisaTulos = useMemo(() => laskeHelsinkiLisa(analysisResult.ehdotus), [analysisResult.ehdotus]);

    // --- KORJATTU useEffect, joka rakentaa halutun lauserakenteen ---
    useEffect(() => {
        const { ehdotus, conditionsMet } = analysisResult;
        let lopullinenFraasi = null;

        if (palkkatukiState.palkkatuki_puolletaan || palkkatukiState.helsinkilisa_puolletaan || palkkatukiState.tyokokeilu_puolletaan) {
            let parts = [];
            if (palkkatukiState.palkkatuki_puolletaan && ehdotus !== PALKKATUKI_EHDOTUKSET.EI_ERITYISIA) {
                const syy = EHDOTUS_MUUNNOKSET[ehdotus] || "erityisehdoin";
                const detailsMatch = ehdotus.match(/\((.*)\)/); // Etsitään sulkujen sisältö
                const detailsText = detailsMatch ? `(${detailsMatch[1]})` : '';
                
                parts.push(`Asiakkaalle voidaan puoltaa palkkatukea ${syy} ${detailsText}`);
            }
            const muutPuollot = [];
            if (palkkatukiState.helsinkilisa_puolletaan && helsinkiLisaTulos) {
                muutPuollot.push("Helsinki-lisää");
            }
            if (palkkatukiState.tyokokeilu_puolletaan) {
                muutPuollot.push("työkokeilua");
            }
            if (muutPuollot.length > 0) {
                const liitos = parts.length > 0 ? ", sekä puolletaan " : "Asiakkaalle voidaan puoltaa ";
                parts.push(liitos + muutPuollot.join(" ja "));
            }
            parts.push(".");
            const perustelut = conditionsMet.map(kriteeri => KRITEERI_MUUNNOKSET[kriteeri]).filter(Boolean);
            const uniikitPerustelut = [...new Set(perustelut)];
            if (palkkatukiState.palkkatuki_puolletaan && uniikitPerustelut.length > 0) {
                const perusteluLause = uniikitPerustelut.join(" ja ");
                parts.push(` Palkkatuen perusteena on ${perusteluLause}.`);
            }
            
            const lisatiedot = Object.values(PALKKATUKI_LISAHUOMIOT)
                .filter(huomio => palkkatukiState.lisahuomiot?.[huomio.id])
                .map(huomio => huomio.teksti);

            if (lisatiedot.length > 0) {
                parts.push(`\n\n${lisatiedot.join('\n\n')}`);
            }

            lopullinenFraasi = parts.join('');
        }
        onUpdatePalkkatuki('puoltoKappale', lopullinenFraasi);
    }, [
        analysisResult, 
        helsinkiLisaTulos, 
        palkkatukiState.palkkatuki_puolletaan, 
        palkkatukiState.helsinkilisa_puolletaan, 
        palkkatukiState.tyokokeilu_puolletaan, 
        palkkatukiState.lisahuomiot,
        onUpdatePalkkatuki
    ]);

    const handleLisahuomioChange = (huomioId, isChecked) => {
        const currentHuomiot = palkkatukiState.lisahuomiot || {};
        const newHuomiot = { ...currentHuomiot, [huomioId]: isChecked };
        onUpdatePalkkatuki('lisahuomiot', newHuomiot);
    };

    return (
        <>
            <section className="section-container">
                <div className="section-header">
                    <h2 className="section-title">Palkkatuki ja muut tuet</h2>
                    <button onClick={() => setShowModal(true)} className="info-button">Näytä ohjeet</button>
                </div>
                
                <div className="info-box">
                    <h3>Automaattisesti haetut tiedot</h3>
                    <p><b>Asiakkaan ikä:</b> {age !== -1 ? `${age} v` : 'Ei määritetty'}</p>
                    <p><b>Työttömyyden kesto:</b> {tyottomyysKuukausia !== null ? `${tyottomyysKuukausia} kk` : 'Ei määritetty'}</p>
                    <p><b>Työkyky:</b> {tyokykyStatus}</p>
                    <p><b>Ei ansiotyössä 6kk aikana:</b> {eiAnsiotyossa6kk ? 'Kyllä' : 'Ei'}</p>
                    <p><b>Ei toisen asteen tutkintoa:</b> {onkoEiTutkintoa ? 'Kyllä' : 'Ei'}</p>
                </div>

                <div className="questions-container">
                    <h3>Tarkentavat kysymykset ja päätökset</h3>
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
                    <hr />
                    <h4>Puollot</h4>
                    <Checkbox
                        label="Puolletaanko analyysin mukaista palkkatukea?"
                        checked={palkkatukiState.palkkatuki_puolletaan}
                        onChange={(val) => onUpdatePalkkatuki('palkkatuki_puolletaan', val)}
                    />
                    {helsinkiLisaTulos && (
                         <Checkbox
                            label="Puolletaanko Helsinki-lisää?"
                            checked={palkkatukiState.helsinkilisa_puolletaan}
                            onChange={(val) => onUpdatePalkkatuki('helsinkilisa_puolletaan', val)}
                        />
                    )}
                     <Checkbox
                        label="Puolletaanko työkokeilua?"
                        checked={palkkatukiState.tyokokeilu_puolletaan}
                        onChange={(val) => onUpdatePalkkatuki('tyokokeilu_puolletaan', val)}
                    />

                    <div style={{ marginTop: '1rem' }}>
                        <h5>Lisättävät huomiot ja ehdot</h5>
                        {Object.values(PALKKATUKI_LISAHUOMIOT).map(huomio => (
                            <Checkbox
                                key={huomio.id}
                                label={huomio.label}
                                checked={palkkatukiState.lisahuomiot?.[huomio.id]}
                                onChange={(val) => handleLisahuomioChange(huomio.id, val)}
                            />
                        ))}
                    </div>

                </div>
            </section>
            
            <section className="section-container analysis-container">
                <h2 className="section-title">Yhteenveto ja ehdotukset</h2>
                <div>
                    <h3>Palkkatuki</h3>
                    <p><strong>Analyysin ehdotus: </strong>{analysisResult.ehdotus}</p>
                    <p><strong>Päätös: </strong>
                        <span className={palkkatukiState.palkkatuki_puolletaan ? 'puollettu' : 'ei-puollettu'}>
                            {palkkatukiState.palkkatuki_puolletaan ? 'Puolletaan' : 'Ei puolleta'}
                        </span>
                    </p>
                </div>
                {helsinkiLisaTulos && (
                    <div style={{ marginTop: '1rem' }}>
                        <h3>Helsinki-lisä</h3>
                        <p><strong>Analyysin ehdotus: </strong>{helsinkiLisaTulos}</p>
                        <p><strong>Päätös: </strong>
                            <span className={palkkatukiState.helsinkilisa_puolletaan ? 'puollettu' : 'ei-puollettu'}>
                                {palkkatukiState.helsinkilisa_puolletaan ? 'Puolletaan' : 'Ei puolleta'}
                            </span>
                        </p>
                    </div>
                )}
                {palkkatukiState.tyokokeilu_puolletaan && (
                    <div style={{ marginTop: '1rem' }}>
                        <h3>Työkokeilu</h3>
                        <p><strong>Päätös: </strong><span className="puollettu">Puolletaan</span></p>
                    </div>
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