import React, { useState, useMemo, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, FileText, Sparkles, ArrowRight } from 'lucide-react';

// ==========================================
// 1. KYSYMYSPATTERISTON MÄÄRITTELY
// ==========================================

const EHDOTTOMAT_KYSYMYKSET = [
    { id: "rekisteroitynyt", teksti: "Työnhakija on rekisteröitynyt työnhakijaksi / ilmoittanut muutoksesta." },
    { id: "hakee_kokoaikatyota", teksti: "Työnhakija hakee kokoaikatyötä." },
    { id: "hakee_etuutta", teksti: "Työnhakija hakee työttömyysetuutta." }
];

const YLEISET_KYSYMYKSET = [
    { id: "estava_lausunto", teksti: "Onko työnhakijalla aiemmin ollut voimassa työssäolovelvoite tai muu estävä lausunto?", syyTeksti: "Aiempi työssäolovelvoite tai estävä lausunto" },
    { id: "tyosuhde_voimassa", teksti: "Onko työnhakijalla työsuhde voimassa?", syyTeksti: "Voimassa oleva työsuhde" },
    { id: "yritystoiminta_perhe", teksti: "Onko työnhakijalla tai hänen perheenjäsenellään yritystoimintaa?", syyTeksti: "Oma tai perheen yritystoiminta" },
    { id: "opiskelija", teksti: "Onko työnhakija opiskelija?", syyTeksti: "Opinnot" },
    { id: "omassa_tyossa", teksti: "Työllistyykö työnhakija omassa työssä?", syyTeksti: "Omassa työssä työllistyminen" },
    { id: "palkaton_tyo", teksti: "Työskenteleekö työnhakija palkattomasti tai onko hän palkattomassa harjoittelussa?", syyTeksti: "Palkaton työ tai harjoittelu" },
    { id: "paattynyt_2kk", teksti: "Onko työsuhde päättynyt viim. 2 kk aikana (muu syy kuin tu-ta tai määräaikaisuus)?", syyTeksti: "Työsuhteen päättyminen viim. 2 kk aikana" },
    { id: "alle25_tutkinto_laiminlyonti", teksti: "Puuttuuko ammatillisia valmiuksia antava tutkinto tai onko koulutushakuvelvoite laiminlyöty?", ehto: "alle25", syyTeksti: "Koulutushakuvelvoite (Alle 25v)" },
    { id: "suomen_kansalainen", teksti: "Onko asiakas Suomen kansalainen?", neutraali: true },
    { id: "ei_kansalainen_este", teksti: "Onko olemassa jokin este rekisteröityä työnhakijaksi?", ehto: { id: "suomen_kansalainen", arvo: false }, syyTeksti: "Esteet rekisteröitymiselle (Ei kansalainen)" }
];

// ==========================================
// 2. PÄÄKOMPONENTTI
// ==========================================

const Tyottomyysturva = ({ state, actions }) => {
    const { onUpdateTyottomyysturva, onUpdateCustomText } = actions;
    const ttState = state.tyottomyysturva || {};
    const answers = ttState.answers || {};

    // --- APUMUUTTUJAT JA LASKENTA ---

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

    // Vaihe 1: Ehdottomien edellytysten tarkistus
    const kaikkiEhdottomatVastattu = EHDOTTOMAT_KYSYMYKSET.every(q => answers[q.id] !== undefined);
    const kaikkiEhdottomatToteutuu = EHDOTTOMAT_KYSYMYKSET.every(q => answers[q.id] === true);
    const ehdotonEiValittu = EHDOTTOMAT_KYSYMYKSET.some(q => answers[q.id] === false);

    // Vaihe 2: Yleisten edellytysten tarkistus (haetaan ne asiat, joihin on vastattu "Kyllä" -> vaatii selvitystä)
    const selvitettavatAsiat = useMemo(() => {
        const selvitettavat = [];
        YLEISET_KYSYMYKSET.forEach(q => {
            // Ohitetaan ehtojen taakse piilotetut kysymykset
            if (q.ehto === "alle25" && !asiakasAlle25) return;
            if (typeof q.ehto === 'object' && answers[q.ehto.id] !== q.ehto.arvo) return;
            
            // Suomen kansalainen on vain reitittävä kysymys, ei aiheuta sellaisenaan selvitystä
            if (q.neutraali) return;

            // Jos yleiseen kysymykseen vastataan "Kyllä", se vaatii yleensä selvitystä
            if (answers[q.id] === true) {
                selvitettavat.push(q.syyTeksti);
            }
        });
        return selvitettavat;
    }, [answers, asiakasAlle25]);

    const showUnder25Warning = asiakasAlle25 && answers['alle25_tutkinto_laiminlyonti'] === true;

    // --- TILA- JA TEKSTIPÄIVITYKSET ---

    const handleAnswerChange = (id, value) => {
        onUpdateTyottomyysturva('updateKysymys', { id, value });
        if (ttState[`ai_tunnistus_${id}`]) {
            onUpdateTyottomyysturva(`ai_tunnistus_${id}`, false);
        }
    };

    const handleGenerateText = () => {
        let ehdotettuTeksti = "";

        if (ehdotonEiValittu) {
            ehdotettuTeksti = "Työttömyysetuuden ehdottomat edellytykset eivät täyty. Työnhakijan tilanne lausutaan työnhakijan ilmoituksen mukaan.";
        } else if (kaikkiEhdottomatToteutuu && selvitettavatAsiat.length > 0) {
            ehdotettuTeksti = `Työttömyysturvaoikeuden edellytyksiä selvitetään.\n\nSelvityspyyntö tehdään seuraavista asioista:\n- ${selvitettavatAsiat.join('\n- ')}\n\nSelvityspyynnön alkupäivä: ${ttState.selvitysAlkupvm || '[Lisää päivämäärä]'}`;
        } else if (kaikkiEhdottomatToteutuu && selvitettavatAsiat.length === 0) {
            ehdotettuTeksti = "Työttömyysetuuden ehdottomat ja yleiset edellytykset täyttyvät.\nAutomaattilausunto tarkistettu ja oikeellinen / Lausunto T001 annettu.\nAlkupäivä: Työnhaun ensimmäinen voimassaolopäivä.";
        } else {
            ehdotettuTeksti = "Lomakkeen täyttö on kesken. Vastaa kaikkiin edellytyksiin saadaksesi tarkan tulosteen.";
        }

        // Lisätään olemassa olevan tekstin perään
        const currentText = state['custom-tyottomyysturva'] || '';
        const newText = currentText ? `${currentText}\n\n${ehdotettuTeksti}` : ehdotettuTeksti;
        onUpdateCustomText('tyottomyysturva', newText);
    };

    // Apukomponentti Kyllä/Ei napeille
    const BooleanButtons = ({ questionId, currentAnswer }) => (
        <div className="boolean-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
                className={currentAnswer === true ? 'selected' : ''} 
                onClick={() => handleAnswerChange(questionId, true)}
            >
                Kyllä
            </button>
            <button 
                className={currentAnswer === false ? 'selected' : ''} 
                onClick={() => handleAnswerChange(questionId, false)}
                style={{
                    backgroundColor: currentAnswer === false ? '#475569' : '',
                    color: currentAnswer === false ? 'white' : ''
                }}
            >
                Ei
            </button>
        </div>
    );

    return (
        <section className="section-container">
            <h2 className="section-title icon-heading">
                <AlertCircle size={24} /> Työttömyysturvan edellytykset
            </h2>

            <div className="alert-box" style={{ backgroundColor: 'var(--color-surface)', marginBottom: '2rem', border: '1px solid var(--color-border)' }}>
                <p className="stat-label">Taustatiedot:</p>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><b>Työtilanne-osio:</b> {tyotilanneInfo}</p>
                {asiakasAlle25 && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-warning)', fontWeight: 600 }}>Asiakas on alle 25-vuotias</p>}
            </div>

            {/* VAIHE 1: EHDOTTOMAT EDELLYTYKSET */}
            <div className="side-bordered-panel" style={{ borderLeftColor: ehdotonEiValittu ? 'var(--color-danger)' : (kaikkiEhdottomatToteutuu ? 'var(--color-success)' : 'var(--color-primary)') }}>
                <h3 className="icon-heading">
                    <span className="tag" style={{ marginRight: '0.5rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>Vaihe 1</span>
                    Ehdottomat edellytykset
                </h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Kaikkiin on vastattava "Kyllä", jotta prosessi etenee yleisiin edellytyksiin.</p>

                <div className="flex-col-gap" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {EHDOTTOMAT_KYSYMYKSET.map(q => (
                        <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--color-border)' }}>
                            <label style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                {q.teksti}
                            </label>
                            <BooleanButtons questionId={q.id} currentAnswer={answers[q.id]} />
                        </div>
                    ))}
                </div>

                {ehdotonEiValittu && (
                    <div className="alert-box alert-box--danger" style={{ marginTop: '1.5rem' }}>
                        <div className="alert-box-content">
                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span className="alert-box-text">
                                <strong>Ehdoton edellytys ei täyty.</strong><br/>
                                Työnhakijan tilanne lausutaan työnhakijan ilmoituksen mukaan tai tehdään selvityspyyntö. Yleisiä edellytyksiä ei tarvitse tarkistaa.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* VAIHE 2: YLEISET EDELLYTYKSET */}
            {kaikkiEhdottomatToteutuu && (
                <div className="side-bordered-panel" style={{ borderLeftColor: selvitettavatAsiat.length > 0 ? 'var(--color-warning)' : 'var(--color-success)', animation: 'fadeIn 0.3s ease-out' }}>
                    <h3 className="icon-heading">
                        <span className="tag" style={{ marginRight: '0.5rem', backgroundColor: 'var(--color-text-secondary)', color: 'white' }}>Vaihe 2</span>
                        Yleiset edellytykset
                    </h3>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Tarkista onko seuraavissa asioissa työttömyysetuutta estäviä tekijöitä.</p>

                    {showUnder25Warning && (
                        <div className="alert-box alert-box--warning" style={{ marginBottom: '1.5rem' }}>
                            <div className="alert-box-content">
                                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span className="alert-box-text">
                                    <strong>HUOM: Tutkintoa vailla oleva alle 25v!</strong><br/>
                                    Tarkista koulutushakuvelvoitteen täyttyminen mahdollisten menetysten (esim. 5 kk odotusaika) varalta.
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="flex-col-gap" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {YLEISET_KYSYMYKSET.map(q => {
                            // Ehtojen tarkistus näyttämiselle
                            if (q.ehto === "alle25" && !asiakasAlle25) return null;
                            if (typeof q.ehto === 'object' && answers[q.ehto.id] !== q.ehto.arvo) return null;

                            return (
                                <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--color-border)' }}>
                                    <label style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                        {q.teksti}
                                    </label>
                                    <BooleanButtons questionId={q.id} currentAnswer={answers[q.id]} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* RATKAISUKESKUS (Analyysi) */}
            <div className="smart-analysis-box" style={{ marginTop: '2rem' }}>
                <div className="smart-analysis-header">
                    <Sparkles size={20} /> Järjestelmän analyysi & Ohjeistus
                </div>
                
                <div className="smart-analysis-grid">
                    <div className="smart-analysis-column">
                        <p className="smart-analysis-title">TILANNEKARTTA</p>
                        
                        {!kaikkiEhdottomatVastattu ? (
                            <div style={{ color: 'var(--color-text-secondary)' }}>Vastaa kaikkiin edellytyksiin saadaksesi tilannekuvan.</div>
                        ) : ehdotonEiValittu ? (
                            <div className="status-text--danger">
                                <AlertTriangle size={18} /> Ehdottomat edellytykset eivät täyty
                            </div>
                        ) : selvitettavatAsiat.length > 0 ? (
                            <div>
                                <div style={{ color: 'var(--color-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                    <AlertTriangle size={18} /> Selvitystä vaativat asiat ({selvitettavatAsiat.length}):
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                                    {selvitettavatAsiat.map((syy, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{syy}</li>)}
                                </ul>
                            </div>
                        ) : (
                            <div className="status-text--success">
                                <CheckCircle size={18} /> Kaikki edellytykset kunnossa. Ei esteitä.
                            </div>
                        )}
                    </div>

                    <div className="smart-analysis-column">
                        <p className="smart-analysis-title">TOIMENPIDESUOSITUS</p>
                        
                        {!kaikkiEhdottomatVastattu ? (
                            <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Odottaa syötteitä...</span>
                        ) : ehdotonEiValittu || selvitettavatAsiat.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-warning)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                                    <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#b45309' }}>Tee selvityspyyntö ja/tai kuuleminen.</strong>
                                    Käytä URA-järjestelmän valtakunnallisia selvityspyyntöpohjia ja yksilöi pyyntö asiakkaan tilanteen mukaan.
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label htmlFor="selvitys-alkupvm" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Selvityspyynnön alkupäivä:</label>
                                    <input 
                                        type="text" 
                                        id="selvitys-alkupvm" 
                                        className="form-input text-mono" 
                                        placeholder="esim. 1.1.2025 tai työnhaun alku"
                                        value={ttState.selvitysAlkupvm || ''}
                                        onChange={(e) => onUpdateTyottomyysturva('selvitysAlkupvm', e.target.value)}
                                        style={{ maxWidth: '250px' }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-success)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-success)' }}>Anna lausunto T001</strong>
                                Tarkasta onko automaattilausunto annettu ja oikein. Jos ei, anna lausunto T001. Lausunnon alkupäivä on työnhaun ensimmäinen voimassaolopäivä.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* LOPULLINEN TULOSTE */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                <h3 className="icon-heading" style={{ marginBottom: '1rem' }}>
                    <FileText size={20} /> Tuloste asiakirjaan
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button 
                        className="btn btn--secondary" 
                        onClick={handleGenerateText}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <ArrowRight size={16} /> Kirjoita ratkaisukeskuksen suositus tekstikenttään
                    </button>

                    <textarea 
                        className="form-input"
                        rows="6" 
                        placeholder="Lopullinen asiateksti työttömyysturvasta tulostuu tähän..." 
                        value={state['custom-tyottomyysturva'] || ''} 
                        onChange={(e) => onUpdateCustomText('tyottomyysturva', e.target.value)} 
                        style={{ fontSize: '0.95rem', lineHeight: 1.5 }}
                    />
                </div>
            </div>

        </section>
    );
};

export default Tyottomyysturva;