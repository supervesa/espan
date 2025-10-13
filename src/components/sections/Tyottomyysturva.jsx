import React, { useState, useMemo } from 'react';

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

    // --- UUDET TILAMUUTTUJAT FRAASIEN HALLINTAAN ---
    const [ehdotetutFraasit, setEhdotetutFraasit] = useState([]);
    const [valittuFraasi, setValittuFraasi] = useState('');

    const tyotilanneInfo = useMemo(() => {
        const tilanteet = state.tyotilanne ? Object.values(state.tyotilanne).map(s => s.teksti.replace(/\[.*?\]/g, '').trim()) : [];
        return tilanteet.length > 0 ? tilanteet.join(', ') : "Ei vielä määritetty.";
    }, [state.tyotilanne]);

    const asiakasAlle25 = useMemo(() => {
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!syntymavuosi) return false;
        const age = new Date().getFullYear() - parseInt(syntymavuosi, 10);
        return age < 25;
    }, [state.suunnitelman_perustiedot]);

    const handleAnswerChange = (id, value) => {
        onUpdateTyottomyysturva('updateKysymys', { id, value });
    };

    // --- UUSI ÄLYKÄS FUNKTIO, JOKA LUO LISTAN FRAASIEHDOTUKSIA ---
    const generateSummaryPhrases = (answers) => {
        const phrases = [];
        const huomiot = [];

        if (answers.opiskelija === true) huomiot.push("opintoja");
        if (answers.yritystoiminta === true) huomiot.push("yritystoimintaa");
        if (answers.oma_tyo) huomiot.push("omaa työtä");
        if (answers.estava_lausunto === true) huomiot.push("estävän lausunnon");
        if (answers.tyosuhde_paattyminen_45pv === true) huomiot.push("työsuhteen päättymisen, joka vaatii selvitystä");

        if (huomiot.length === 0) {
            // Lisätään kaikki "negatiiviset" ehdotukset
            phrases.push("Työttömyysturvan kannalta ei ilmennyt huomioitavia seikkoja: ei opintoja, ei yritystoimintaa, ei muuta työnhakuun vaikuttavaa.");
            phrases.push("Ei opintoja, ei yrittäjyyttä, ei muuta työnhakuun tai työttömyysturvaan vaikuttavaa.");
            phrases.push("Asiakkaan tilanteessa ei ole työttömyysturvalain mukaisia rajoitteita tai odotusaikoja.");
        } else {
            // Lisätään "positiiviset" ehdotukset
            phrases.push(`Työttömyysturvaan vaikuttavat tekijät: ${huomiot.join(', ')}.`);
            // Lisätään myös toimenpidettä vaativia ehdotuksia tarvittaessa
            if (answers.yritystoiminta === true) {
                phrases.push("Työttömyysturvan selvitys edellyttää yritystoiminnan laajuuden arviointia.");
            }
            if (answers.tyosuhde_paattyminen_45pv === true) {
                phrases.push("Asiakkaalle on mahdollisesti asetettava työssäolovelvoite työsuhteen päättymisen vuoksi.");
            }
        }
        return phrases;
    };

    // --- PÄIVITETTY FUNKTIO, JOKA PÄIVITTÄÄ KOONNIN JA LUO EHDOTUKSET ---
    const handleGenerateSuggestions = () => {
        const answers = ttState.answers || {};
        
        // 1. Luo ja päivitä yksityiskohtainen koonti
        let koontiText = '';
        sectionData.questions.forEach(q => {
            if (answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '') {
                const vastaus = answers[q.id];
                koontiText += `- ${q.teksti}: ${vastaus === true ? 'Kyllä' : vastaus === false ? 'Ei' : vastaus}\n`;
            }
        });
        onUpdateTyottomyysturva('koonti', koontiText.trim());

        // 2. Luo lista fraasiehdotuksista
        const suggestions = generateSummaryPhrases(answers);
        setEhdotetutFraasit(suggestions);

        // 3. Tyhjennetään aiempi valinta
        setValittuFraasi('');
    };

    // --- UUSI FUNKTIO, JOLLA KÄYTTÄJÄ VALITSEE FRAASIN ---
    const handleSelectPhrase = (phraseText) => {
        setValittuFraasi(phraseText);
    };

    // --- UUSI FUNKTIO, JOLLA VALITTU FRAASI SIIRRETÄÄN YHTEENVETOON ---
    const handleMoveToSummary = () => {
        if (!valittuFraasi) return;
        onUpdateTyottomyysturva('updateYhteenveto', valittuFraasi);
        // Annetaan pieni visuaalinen palaute ja tyhjennetään ehdotukset
        alert(`Fraasi "${valittuFraasi}" siirretty yhteenvetoon!`);
        setEhdotetutFraasit([]);
        setValittuFraasi('');
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
                <label htmlFor="tt-koonti-textarea">Koonti työttömyysturvaselvityksestä (yksityiskohtainen)</label>
                <textarea id="tt-koonti-textarea" rows="5" placeholder="Tähän kerätään muistiinpanot keskustelusta..." value={ttState.koonti || ''} onChange={(e) => onUpdateTyottomyysturva('koonti', e.target.value)} />
                <button onClick={handleGenerateSuggestions}>Luo yhteenvetofraasit</button>
            </div>

            {/* --- UUSI OSA: FRAASIEHDOTUKSET JA VALINTA --- */}
            {ehdotetutFraasit.length > 0 && (
                <div className="suggestions-container">
                    <h4>Ehdotetut fraasit yhteenvetoon:</h4>
                    {ehdotetutFraasit.map((phrase, index) => (
                        <div 
                            key={index}
                            className={`suggestion-item ${valittuFraasi === phrase ? 'selected' : ''}`}
                            onClick={() => handleSelectPhrase(phrase)}
                        >
                            {phrase}
                        </div>
                    ))}
                    {valittuFraasi && (
                        <button className="move-to-summary-button" onClick={handleMoveToSummary}>
                            Siirrä valittu yhteenvetoon
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default Tyottomyysturva;