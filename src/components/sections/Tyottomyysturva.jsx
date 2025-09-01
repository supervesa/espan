import React, { useMemo } from 'react';

// Kysymykset ja rakenne pidetään komponentin sisällä
const sectionData = {
    questions: [
        { id: "tyonhaku_voimassa", teksti: "Minne saakka työnhaku on voimassa?", tyyppi: "teksti", placeholder: "esim. 31.12.2025" },
        { id: "hakee_kokoaikatyota", teksti: "Hakeeko asiakas kokoaikatyötä?", tyyppi: "boolean" },
        { id: "suomen_kansalainen", teksti: "Onko asiakas Suomen kansalainen?", tyyppi: "boolean" },
        { id: "oleskelulupa", teksti: "Mikä on oleskeluluvan tilanne?", tyyppi: "teksti", ehto: { id: "suomen_kansalainen", arvo: false } },
        { id: "tyosuhde_paattyminen_45pv", teksti: "Onko työsuhde päättynyt viimeisen 45 päivän aikana muusta kuin tuotannollis-taloudellisesta syystä?", tyyppi: "boolean" },
        { id: "vapaaehtoistyo", teksti: "Onko asiakas vapaaehtoistyössä tai palkattomassa työssä?", tyyppi: "boolean" },
        { id: "oma_tyo", teksti: "Työllistyykö asiakas omassa työssä (esim. omaishoitajana)?", tyyppi: "teksti" },
        { id: "yritystoiminta", teksti: "Onko asiakkaalla yritystoimintaa tai omistaako hän osuutta yrityksestä?", tyyppi: "boolean" },
        { id: "yritystoiminta_selvitys", teksti: "Selvitä yritystoiminnan laajuus ja luonne.", tyyppi: "teksti", ehto: { id: "yritystoiminta", arvo: true } },
        { id: "opiskelija", teksti: "Onko asiakas opiskelija tai alkamassa opinnot lähiaikoina?", tyyppi: "boolean" },
        { id: "alle25_puuttuva_tutkinto", teksti: "Puuttuuko ammatillinen tutkinto?", tyyppi: "boolean", ehto: "alle25" },
        { id: "alle25_laiminlyoty_haku", teksti: "Onko koulutushakuvelvoite laiminlyöty?", tyyppi: "boolean", ehto: "alle25" },
        { id: "estava_lausunto", teksti: "Onko voimassaolevaa työssäolovelvoitetta tai muuta estävää lausuntoa?", tyyppi: "boolean" },
        { id: "estava_lausunto_selvitys", teksti: "Kirjaa tiedot lausunnosta.", tyyppi: "teksti", ehto: { id: "estava_lausunto", arvo: true } },
    ]
};

const Tyottomyysturva = ({ state, actions }) => {
    const { onUpdateTyottomyysturva } = actions;
    const ttState = state.tyottomyysturva || {};

    const tyotilanneInfo = useMemo(() => {
        const tilanteet = state.tyotilanne ? Object.values(state.tyotilanne).map(s => s.teksti.replace(/\[.*?\]/g, '').trim()) : [];
        return tilanteet.length > 0 ? tilanteet.join(', ') : "Ei vielä määritetty.";
    }, [state.tyotilanne]);

    const asiakasAlle25 = useMemo(() => {
        // Hakee iän nyt Perustiedot-osiosta
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!syntymavuosi) return false;
        const age = new Date().getFullYear() - parseInt(syntymavuosi, 10);
        return age < 25;
    }, [state.suunnitelman_perustiedot]);

    const handleAnswerChange = (id, value) => {
        onUpdateTyottomyysturva('updateKysymys', { id, value });
    };

    const handleKoontiUpdate = () => {
        let koontiText = '';
        sectionData.questions.forEach(q => {
            if (ttState.answers?.[q.id]) {
                const vastaus = ttState.answers[q.id];
                koontiText += `- ${q.teksti}: ${vastaus === true ? 'Kyllä' : vastaus === false ? 'Ei' : vastaus}\n`;
            }
        });
        onUpdateTyottomyysturva('koonti', koontiText.trim());
    };

    return (
        <section className="section-container">
            <h2 className="section-title">Työttömyysturva</h2>
            
            <details className="discussion-accordion">
                <summary>Keskustelun tuki: Työttömyysturvan selvitys</summary>
                <div className="discussion-content">
                    <div className="info-box">
                        <p><b>Tarkistus (Asiakkaan työtilanne):</b> {tyotilanneInfo}</p>
                        {asiakasAlle25 && <p><b>Huomio:</b> Asiakas on alle 25-vuotias.</p>}
                        <p className="reminder"><b>Muistutus:</b> Tarkasta aiemmat merkinnät järjestelmästä (opinnot, yrittäjyys yms.).</p>
                    </div>
                    {sectionData.questions.map(q => {
                        if (q.ehto) {
                            if (q.ehto === "alle25" && !asiakasAlle25) return null;
                            if (typeof q.ehto === 'object' && ttState.answers?.[q.ehto.id] !== q.ehto.arvo) return null;
                        }
                        return (
                            <div key={q.id} className="question-row">
                                <label htmlFor={q.id}>{q.teksti}</label>
                                {q.tyyppi === 'boolean' && (
                                    <div className="boolean-buttons">
                                        <button onClick={() => handleAnswerChange(q.id, true)} className={ttState.answers?.[q.id] === true ? 'selected' : ''}>Kyllä</button>
                                        <button onClick={() => handleAnswerChange(q.id, false)} className={ttState.answers?.[q.id] === false ? 'selected' : ''}>Ei</button>
                                    </div>
                                )}
                                {q.tyyppi === 'teksti' && <input type="text" id={q.id} placeholder={q.placeholder || ''} value={ttState.answers?.[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />}
                            </div>
                        )
                    })}
                </div>
            </details>

             <div className="koonti-container">
                <label htmlFor="tt-koonti-textarea">Koonti työttömyysturvaselvityksestä</label>
                <textarea id="tt-koonti-textarea" rows="5" placeholder="Tähän kerätään muistiinpanot keskustelusta..." value={ttState.koonti || ''} onChange={(e) => onUpdateTyottomyysturva('koonti', e.target.value)} />
                <button onClick={handleKoontiUpdate}>Päivitä koonti vastauksista</button>
            </div>
        </section>
    );
};

export default Tyottomyysturva;
