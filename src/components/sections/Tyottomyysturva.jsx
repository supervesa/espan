// --- src/components/sections/Tyottomyysturva.jsx ---
import React, { useState, useMemo } from 'react';
import { AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';

const sectionData = {
    questions: [
        { id: "tyonhaku_voimassa", teksti: "Minne saakka työnhaku on voimassa?", tyyppi: "teksti", placeholder: "esim. 31.12.2025" },
        { id: "hakee_kokoaikatyota", teksti: "Hakeeko asiakas kokoaikatyötä?", tyyppi: "boolean" },
        { id: "suomen_kansalainen", teksti: "Onko asiakas Suomen kansalainen?", tyyppi: "boolean" },
        { id: "oleskelulupa", teksti: "Mikä on oleskeluluvan tilanne?", tyyppi: "teksti", ehto: { id: "suomen_kansalainen", arvo: false } },
        { id: "tyosuhde_paattyminen_45pv", teksti: "Onko työsuhde päättynyt viim. 45 pv aikana (muu kuin tu-ta)?", tyyppi: "boolean" },
        { id: "vapaaehtoistyo", teksti: "Onko asiakas vapaaehtoistyössä tai palkattomassa työssä?", tyyppi: "boolean" },
        { id: "oma_tyo", teksti: "Työllistyykö asiakas omassa työssä (esim. omaishoitajana)?", tyyppi: "teksti" },
        { id: "yritystoiminta", teksti: "Onko asiakkaalla yritystoimintaa tai osuutta yrityksestä?", tyyppi: "boolean" },
        { id: "yritystoiminta_selvitys", teksti: "Selvitä yritystoiminnan laajuus ja luonne.", tyyppi: "teksti", ehto: { id: "yritystoiminta", arvo: true } },
        { id: "opiskelija", teksti: "Onko asiakas opiskelija tai alkamassa opinnot lähiaikoina?", tyyppi: "boolean" },
        { id: "alle25_puuttuva_tutkinto", teksti: "Puuttuuko ammatillinen tutkinto?", tyyppi: "boolean", ehto: "alle25" },
        { id: "alle25_laiminlyoty_haku", teksti: "Onko koulutushakuvelvoite laiminlyöty?", tyyppi: "boolean", ehto: "alle25" },
        { id: "estava_lausunto", teksti: "Onko voimassaolevaa työssäolovelvoitetta tai muuta estävää lausuntoa?", tyyppi: "boolean" },
        { id: "estava_lausunto_selvitys", teksti: "Kirjaa tiedot lausunnosta.", tyyppi: "teksti", ehto: { id: "estava_lausunto", arvo: true } },
    ]
};

const Tyottomyysturva = ({ state, actions }) => {
    const { onUpdateTyottomyysturva, onUpdateCustomText } = actions;
    const ttState = state.tyottomyysturva || {};

    const [ehdotetutFraasit, setEhdotetutFraasit] = useState([]);
    const [valittuFraasi, setValittuFraasi] = useState('');

    const tyotilanneInfo = useMemo(() => {
        const tilanteet = state.tyotilanne
            ? Object.values(state.tyotilanne)
                  .filter(s => s && typeof s === 'object' && typeof s.teksti === 'string')
                  .map(s => s.teksti.replace(/\[.*?\]/g, '').trim())
            : [];
        return tilanteet.length > 0 ? tilanteet.join(', ') : "Ei vielä määritetty.";
    }, [state.tyotilanne]);

    const asiakasAlle25 = useMemo(() => {
        const syntymavuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] 
                          || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!syntymavuosi) return false;
        const age = new Date().getFullYear() - parseInt(String(syntymavuosi).replace(/\D/g, ''), 10);
        return age < 25;
    }, [state.suunnitelman_perustiedot]);

    const handleAnswerChange = (id, value) => {
        onUpdateTyottomyysturva('updateKysymys', { id, value });
        
        // VETO-OIKEUS: Jos asiantuntija muuttaa tekoälyn automaatiota, poistetaan AI-tägi näkyvistä.
        if (ttState[`ai_tunnistus_${id}`]) {
            onUpdateTyottomyysturva(`ai_tunnistus_${id}`, false);
        }
    };

    const generateSummaryPhrases = (answers) => {
        const phrases = [];
        const huomiot = [];

        if (answers.opiskelija) huomiot.push("opintoja");
        if (answers.yritystoiminta) huomiot.push("yritystoimintaa");
        if (answers.oma_tyo) huomiot.push("omaa työtä");
        if (answers.estava_lausunto) huomiot.push("estävän lausunnon");
        if (answers.tyosuhde_paattyminen_45pv) huomiot.push("työsuhteen päättymisen, joka vaatii selvitystä");
        if (answers.alle25_puuttuva_tutkinto) huomiot.push("puuttuvan tutkinnon (Alle 25v)");

        if (huomiot.length === 0) {
            phrases.push("Työttömyysturvan kannalta ei ilmennyt huomioitavia seikkoja: ei opintoja, ei yritystoimintaa, ei muuta työnhakuun vaikuttavaa.");
            phrases.push("Asiakkaan tilanteessa ei ole työttömyysturvalain mukaisia rajoitteita tai odotusaikoja.");
        } else {
            phrases.push(`Työttömyysturvaan vaikuttavat tekijät: ${huomiot.join(', ')}.`);
            if (answers.yritystoiminta) phrases.push("Työttömyysturvan selvitys edellyttää yritystoiminnan laajuuden arviointia.");
            if (answers.tyosuhde_paattyminen_45pv) phrases.push("Asiakkaalle on mahdollisesti asetettava työssäolovelvoite työsuhteen päättymisen vuoksi.");
            if (answers.alle25_puuttuva_tutkinto) phrases.push("Koulutushakuvelvoitteen täyttyminen tarkistettava puuttuvan ammatillisen tutkinnon vuoksi.");
        }
        return phrases;
    };

    const handleGenerateSuggestions = () => {
        const answers = ttState.answers || {};
        let koontiText = '';
        sectionData.questions.forEach(q => {
            if (answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '') {
                const vastaus = answers[q.id];
                koontiText += `- ${q.teksti}: ${vastaus === true ? 'Kyllä' : vastaus === false ? 'Ei' : vastaus}\n`;
            }
        });
        onUpdateTyottomyysturva('koonti', koontiText.trim());
        setEhdotetutFraasit(generateSummaryPhrases(answers));
        setValittuFraasi('');
    };

    const handleMoveToSummary = () => {
        if (!valittuFraasi) return;
        
        // Siirretään valittu fraasi asiantuntijan vapaaseen tekstikenttään
        const currentText = state['custom-tyottomyysturva'] || '';
        const newText = currentText ? `${currentText}\n\n${valittuFraasi}` : valittuFraasi;
        onUpdateCustomText('tyottomyysturva', newText);
        
        setEhdotetutFraasit([]);
        setValittuFraasi('');
    };

    // Varoitusvalot alle 25-vuotiaille
    const showUnder25Warning = asiakasAlle25 && ttState.answers?.alle25_puuttuva_tutkinto;

    return (
        <section className="section-container">
            <h2 className="section-title">Työttömyysturva</h2>

            <div className="side-bordered-panel">
                <h3 className="icon-heading">
                    <AlertCircle size={20} /> Keskustelun tuki ja selvitykset
                </h3>
                
                <div className="alert-box" style={{ backgroundColor: 'var(--color-surface)', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
                    <p className="stat-label" style={{ marginBottom: '0.5rem' }}>Triggeiden tarkistus:</p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><b>Työtilanne-välilehdeltä valittu:</b> {tyotilanneInfo}</p>
                    {asiakasAlle25 && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-warning)', fontWeight: 600 }}>Asiakas on alle 25-vuotias!</p>}
                </div>

                {showUnder25Warning && (
                    <div className="alert-box alert-box--warning" style={{ marginBottom: '1.5rem' }}>
                        <div className="alert-box-content">
                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span className="alert-box-text">
                                <strong>HUOM: Tutkintoa vailla oleva alle 25v!</strong><br/>
                                Tarkista välittömästi koulutushakuvelvoitteen täyttyminen mahdollisten menetysten (esim. 5 kk odotusaika) varalta.
                            </span>
                        </div>
                    </div>
                )}

                <div className="card-inner flex-col-gap">
                    {sectionData.questions.map(q => {
                        if (q.ehto) {
                            if (q.ehto === "alle25" && !asiakasAlle25) return null;
                            if (typeof q.ehto === 'object' && ttState.answers?.[q.ehto.id] !== q.ehto.arvo) return null;
                        }

                        const isAiFilled = ttState[`ai_tunnistus_${q.id}`] && ttState.answers?.[q.id] === true;

                        return (
                            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--color-border)' }}>
                                <label htmlFor={q.id} style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                    {q.teksti}
                                </label>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {q.tyyppi === 'boolean' ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                onClick={() => handleAnswerChange(q.id, true)} 
                                                className="btn" 
                                                style={{ padding: '0.3rem 1rem', backgroundColor: ttState.answers?.[q.id] === true ? 'var(--color-primary)' : 'var(--color-surface)', color: ttState.answers?.[q.id] === true ? '#fff' : 'var(--color-text-secondary)', borderColor: ttState.answers?.[q.id] === true ? 'var(--color-primary)' : 'var(--color-border)' }}
                                            >
                                                Kyllä
                                            </button>
                                            <button 
                                                onClick={() => handleAnswerChange(q.id, false)} 
                                                className="btn" 
                                                style={{ padding: '0.3rem 1rem', backgroundColor: ttState.answers?.[q.id] === false ? '#475569' : 'var(--color-surface)', color: ttState.answers?.[q.id] === false ? '#fff' : 'var(--color-text-secondary)', borderColor: ttState.answers?.[q.id] === false ? '#475569' : 'var(--color-border)' }}
                                            >
                                                Ei
                                            </button>
                                        </div>
                                    ) : (
                                        <input type="text" id={q.id} className="form-input" placeholder={q.placeholder || ''} value={ttState.answers?.[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />
                                    )}

                                    {/* AI Vihje */}
                                    {isAiFilled && (
                                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                            <Sparkles size={12} /> Poimittu URA-historiasta
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="grid-cols-2">
                <div className="flex-col-gap">
                    <label htmlFor="tt-koonti-textarea" className="icon-label">Koonti lomakkeesta (Muistiinpanot)</label>
                    <textarea 
                        id="tt-koonti-textarea" 
                        className="form-input text-mono"
                        rows="6" 
                        placeholder="Tähän kerätään muistiinpanot keskustelusta..." 
                        value={ttState.koonti || ''} 
                        onChange={(e) => onUpdateTyottomyysturva('koonti', e.target.value)} 
                    />
                    <button className="btn btn--secondary" onClick={handleGenerateSuggestions}>Päivitä koonti ja luo lause-ehdotukset</button>
                </div>

                <div className="flex-col-gap">
                    <label className="icon-label">Lopullinen tuloste asiakirjaan:</label>
                    <textarea 
                        className="form-input"
                        rows="6" 
                        placeholder="Kirjoita lopullinen asiateksti tähän tai poimi se alla olevista ehdotuksista..." 
                        value={state['custom-tyottomyysturva'] || ''} 
                        onChange={(e) => onUpdateCustomText('tyottomyysturva', e.target.value)} 
                    />
                </div>
            </div>

            {/* FRAASIEHDOTUKSET */}
            {ehdotetutFraasit.length > 0 && (
                <div className="panel-gray" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginTop: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
                    <h4 className="icon-label" style={{ color: '#1e40af', marginBottom: '1rem' }}><Sparkles size={16}/> Ehdotetut fraasit yhteenvetoon:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {ehdotetutFraasit.map((phrase, index) => {
                            const isSelected = valittuFraasi === phrase;
                            return (
                                <div
                                    key={index}
                                    style={{ padding: '0.75rem 1rem', backgroundColor: isSelected ? '#dbeafe' : '#fff', border: `1px solid ${isSelected ? '#3b82f6' : '#93c5fd'}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', color: '#1e3a8a' }}
                                    onClick={() => setValittuFraasi(phrase)}
                                >
                                    {phrase}
                                </div>
                            )
                        })}
                    </div>
                    {valittuFraasi && (
                        <button className="btn" onClick={handleMoveToSummary} style={{ marginTop: '1rem', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>
                            Siirrä valittu teksti tulosteeseen
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default Tyottomyysturva;