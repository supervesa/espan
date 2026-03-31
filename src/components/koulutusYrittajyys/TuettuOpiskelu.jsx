// --- src/components/koulutusYrittajyys/TuettuOpiskelu.jsx ---
import React, { useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { BookOpen, AlertTriangle, Sparkles, CalendarClock, CheckCircle2, Info } from 'lucide-react';

const TuettuOpiskelu = ({ state, actions }) => {
    const { onUpdateCustomText, onUpdateVariable, onUpdateAsiakas, onAddSignal, onRemoveSignal } = actions;
    
    useEffect(() => {
        const registerMySignals = async () => {
            const mySignals = [
                { signal_key: 'tuettu_opiskelu_omaehtoinen', label: 'Tuettu opiskelu: Omaehtoinen', category: 'Koulutus ja osaaminen', description: 'Asiakas osallistuu työttömyysetuudella tuettuun omaehtoiseen opiskeluun (max 24/48kk). Alentaa yleensä työnhakuvelvollisuutta.' },
                { signal_key: 'tuettu_opiskelu_kotoutuja', label: 'Tuettu opiskelu: Kotoutuja', category: 'Koulutus ja osaaminen', description: 'Kotoutuja-asiakkaan omaehtoinen opiskelu. Tukee kotoutumissuunnitelmaa. Alentaa yleensä työnhakuvelvollisuutta.' },
                { signal_key: 'tuettu_opiskelu_lyhytkestoinen', label: 'Tuettu opiskelu: Lyhytkestoinen', category: 'Koulutus ja osaaminen', description: 'Lyhytkestoiset opinnot (max 6kk). Pääsääntöisesti normaali työnhakuvelvollisuus (4 kpl/kk).' },
                { signal_key: 'tuettu_opiskelu_sivutoiminen', label: 'Tuettu opiskelu: Sivutoiminen', category: 'Koulutus ja osaaminen', description: 'Sivutoiminen opiskelu. Ei estä kokoaikatyön vastaanottamista. Normaali työnhakuvelvollisuus (4 kpl/kk).' }
            ];
            try { await supabase.from('system_signals').upsert(mySignals, { onConflict: 'signal_key' }); } catch (e) {}
        };
        registerMySignals();
    }, []);

    const aktiivinen = state['custom-tuettu_aktiivinen'] === true;
    const tyyppi = state['custom-tuettu_tyyppi'] || '';
    const opinnonNimi = state['custom-tuettu_opinnon_nimi'] || '';
    const alkuPvm = state['custom-tuettu_alku_pvm'] || '';
    const loppuPvm = state['custom-tuettu_loppu_pvm'] || '';
    const perusopetus = state['custom-tuettu_perusopetus'] === true;
    const edellytysSuunnitelma = state['custom-tuettu_edellytys_suunnitelma'] === true;
    const edellytysTarkoitus = state['custom-tuettu_edellytys_tarkoituksenmukaisuus'] === true;
    const edellytysSeuranta = state['custom-tuettu_edellytys_seuranta'] === true;

    const setGlobalSignal = (signalName, isActive) => {
        if (isActive) { if (typeof onAddSignal === 'function') onAddSignal(signalName); } 
        else { if (typeof onRemoveSignal === 'function') onRemoveSignal(signalName); }
    };

    useEffect(() => {
        const allTypes = ['omaehtoinen', 'lyhytkestoinen', 'kotoutuja', 'sivutoiminen'];
        allTypes.forEach(t => setGlobalSignal(`tuettu_opiskelu_${t}`, false));

        if (aktiivinen && tyyppi) {
            setGlobalSignal(`tuettu_opiskelu_${tyyppi}`, true);
            if (typeof onUpdateAsiakas === 'function') onUpdateAsiakas('paa_asiallinen_toiminta', 'Opiskelija');
        }
    }, [aktiivinen, tyyppi]); 

    useEffect(() => {
        if (aktiivinen && tyyppi && alkuPvm && loppuPvm) {
            window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { 
                detail: { alku: alkuPvm, loppu: loppuPvm, tyyppi: `tuettu_opiskelu_${tyyppi}` } 
            }));
        }
    }, [aktiivinen, tyyppi, alkuPvm, loppuPvm]);

    const asiakasAlle25 = useMemo(() => {
        const sv = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!sv) return false;
        return (new Date().getFullYear() - parseInt(String(sv).replace(/\D/g, ''), 10)) < 25;
    }, [state.suunnitelman_perustiedot]);

    const isKotoutuja = useMemo(() => {
        const taso = state['custom-kielitaso_suomi'] || '';
        const kieli = (state['custom-kielitaso_aidinkieli'] || '').toLowerCase();
        return ['A1.1', 'A1.2', 'A1.3', 'A2.1', 'A2.2'].includes(taso) || (kieli && kieli !== 'suomi' && kieli !== 'ruotsi');
    }, [state]);

    const handleUpdate = (key, value) => onUpdateCustomText(`tuettu_${key}`, value);

    const calculateDuration = (start, end) => {
        if (!start || !end) return 0;
        const diff = Math.abs(new Date(end) - new Date(start));
        return diff ? (Math.ceil(diff / (1000 * 60 * 60 * 24)) / 30).toFixed(1) : 0;
    };
    const kestoKk = calculateDuration(alkuPvm, loppuPvm);

    const warnings = [];
    if (tyyppi === 'lyhytkestoinen' && kestoKk > 6) warnings.push("Lyhytkestoinen opiskelu saa kestää enintään 6 kuukautta!");
    if (tyyppi === 'omaehtoinen') {
        const maxKk = perusopetus ? 48 : 24;
        if (kestoKk > maxKk) warnings.push(`Omaehtoisen opiskelun enimmäisaika on ylittynyt! (Sallittu: ${maxKk} kk, Suunniteltu: ${kestoKk} kk).`);
    }

    const tyyppiNames = { 'omaehtoinen': 'Omaehtoisen opiskelun', 'lyhytkestoinen': 'Lyhytkestoisten opintojen', 'kotoutuja': 'Kotoutujan opiskelun', 'sivutoiminen': 'Sivutoimisen opiskelun' };

    return (
        <div className="panel-gray mb-6 tuettu-opiskelu-panel">
            <h3 className="icon-heading">
                <BookOpen size={20} color="var(--color-primary)" /> 
                Työttömyysetuudella tuettu opiskelu
            </h3>

            <div className="card-inner-sm mb-6">
                <label className="custom-checkbox-row">
                    <input type="checkbox" checked={aktiivinen} onChange={(e) => handleUpdate('aktiivinen', e.target.checked)} />
                    <span className="font-semibold">Asiakkaan kanssa suunnitellaan opintojen tukemista työttömyysetuudella</span>
                </label>
            </div>

            {aktiivinen && (
                <div className="tuettu-content-wrapper">
                    
                    {asiakasAlle25 && (
                        <div className="alert-box alert-box--danger mb-6">
                            <div className="alert-box-content">
                                <AlertTriangle size={18} className="alert-box-icon" />
                                <div className="alert-box-text">
                                    <strong>Lain estävä edellytys (73 §):</strong> Asiakas on alle 25-vuotias. Omaehtoista tai lyhytkestoista opiskelua ei voida tukea työttömyysetuudella. Voit valita vain Sivutoimisen opiskelun.
                                </div>
                            </div>
                        </div>
                    )}

                    {isKotoutuja && (
                        <div className="alert-box alert-box--ai mb-6">
                            <div className="alert-box-content">
                                <Sparkles size={18} color="var(--color-ai)" className="alert-box-icon" />
                                <span className="alert-box-text" style={{ color: 'var(--color-info-dark)' }}>
                                    <strong>AI-Huomio:</strong> Asiakkaan kielitaidon perusteella kyseessä on todennäköisesti kotoutuja-asiakas. Harkitse "Kotoutujan omaehtoinen opiskelu" -vaihtoehtoa.
                                </span>
                            </div>
                        </div>
                    )}

                    <h4 className="icon-label">1. Valitse opiskelun muoto</h4>
                    <div className="service-card-grid mb-6">
                        <div className={`service-card ${tyyppi === 'omaehtoinen' ? 'service-card--selected' : ''} ${asiakasAlle25 ? 'service-card--disabled' : ''}`}
                             onClick={() => !asiakasAlle25 && handleUpdate('tyyppi', 'omaehtoinen')}>
                            <h5 className="service-card-title">Omaehtoinen opiskelu</h5>
                            <p className="service-card-desc">Kesto max 24 kk (Perusopetuksessa 48 kk). Edellyttää 25v ikää.</p>
                        </div>
                        <div className={`service-card ${tyyppi === 'lyhytkestoinen' ? 'service-card--selected' : ''} ${asiakasAlle25 ? 'service-card--disabled' : ''}`}
                             onClick={() => !asiakasAlle25 && handleUpdate('tyyppi', 'lyhytkestoinen')}>
                            <h5 className="service-card-title">Lyhytkestoiset opinnot</h5>
                            <p className="service-card-desc">Täydentävät opinnot. Kesto ehdoton max 6 kk. Edellyttää 25v ikää.</p>
                        </div>
                        <div className={`service-card ${tyyppi === 'kotoutuja' ? 'service-card--selected' : ''} ${isKotoutuja && tyyppi !== 'kotoutuja' ? 'service-card--suggested' : ''}`}
                             onClick={() => handleUpdate('tyyppi', 'kotoutuja')}>
                            <h5 className="service-card-title">Kotoutujan omaehtoinen</h5>
                            <p className="service-card-desc">Vaihtoehto kotoutumiskoulutukselle. Edistää kotoutumista.</p>
                        </div>
                        <div className={`service-card ${tyyppi === 'sivutoiminen' ? 'service-card--selected' : ''}`}
                             onClick={() => handleUpdate('tyyppi', 'sivutoiminen')}>
                            <h5 className="service-card-title">Sivutoiminen opiskelu</h5>
                            <p className="service-card-desc">Ei estä kokoaikatyön hakemista. Avoin kaikille (ei ikärajaa).</p>
                        </div>
                    </div>

                    {tyyppi && (
                        <div className="info-box info-box--blue mb-6">
                            <details className="accordion-item" style={{ border: 'none' }}>
                                <summary className="accordion-title accordion-title--blue">
                                    <div className="accordion-title-inner">
                                        <Info size={18} /> Näytä {tyyppiNames[tyyppi] || 'Opiskelun'} säännöt ja edellytykset
                                    </div>
                                </summary>
                                <div className="accordion-content mt-2">
                                    {tyyppi === 'lyhytkestoinen' && (
                                        <ul className="info-list">
                                            <li><strong>Laajuus:</strong> Opintojen laajuudella ei ole väliä.</li>
                                            <li><strong>Kesto:</strong> Ehdoton maksimi 6 kuukautta.</li>
                                            <li><strong className="text-primary">Nollautumisaika:</strong> Uusia opintoja voidaan tukea vasta, kun <strong>edellisten päättymisestä on kulunut vähintään 6 kuukautta</strong>.</li>
                                            <li><strong>Ikäraja:</strong> Asiakkaan on oltava vähintään 25-vuotias.</li>
                                        </ul>
                                    )}
                                    {tyyppi === 'sivutoiminen' && (
                                        <ul className="info-list">
                                            <li><strong>Laajuusperuste:</strong> Opinnot ovat laajuudeltaan vähäisiä (esim. alle 5 op / kk).</li>
                                            <li><strong className="text-primary">Työhistoriaperuste:</strong> Vaikka laajuus olisi suuri, opinnot ovat sivutoimisia, jos asiakas on opintojen aikana ollut <strong>vähintään 6 kuukautta vakiintuneesti kokoaikatyössä tai toiminut yrittäjänä</strong>.</li>
                                            <li><strong>Ikäraja:</strong> Ei ikärajaa.</li>
                                        </ul>
                                    )}
                                    {tyyppi === 'omaehtoinen' && (
                                        <ul className="info-list">
                                            <li><strong>Kesto:</strong> Enintään 24 kk (perusopetuksessa 48 kk).</li>
                                            <li><strong>Harkinta (73 §):</strong> Koulutustarve on oltava todellinen ja sen tulee parantaa työllistymismahdollisuuksia.</li>
                                            <li><strong>Ikäraja:</strong> Vähintään 25-vuotias.</li>
                                        </ul>
                                    )}
                                    {tyyppi === 'kotoutuja' && (
                                        <ul className="info-list">
                                            <li><strong>Edellytys:</strong> Koulutuksen tulee tukea kotoutumissuunnitelmaa ja kielen oppimista.</li>
                                            <li><strong>Harkinta:</strong> TE-toimiston kotoutumiskoulutusta tarkoituksenmukaisempi vaihtoehto.</li>
                                        </ul>
                                    )}
                                </div>
                            </details>
                        </div>
                    )}

                    {tyyppi && (
                        <>
                            <h4 className="icon-label">2. Koulutuksen tiedot ja ajankohta</h4>
                            <div className="card-inner mb-6">
                                <div className="flex-col-gap">
                                    <div>
                                        <label className="stat-label">Oppilaitos ja tutkinnon/kurssin nimi</label>
                                        <input type="text" className="form-input" value={opinnonNimi} onChange={(e) => handleUpdate('opinnon_nimi', e.target.value)} />
                                    </div>
                                    <div className="grid-cols-2-tight">
                                        <div>
                                            <label className="stat-label">Alkaa</label>
                                            <input type="date" className="form-input" value={alkuPvm} onChange={(e) => handleUpdate('alku_pvm', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="stat-label">Päättyy (Arvio)</label>
                                            <input type="date" className="form-input" value={loppuPvm} onChange={(e) => handleUpdate('loppu_pvm', e.target.value)} />
                                        </div>
                                    </div>
                                    {tyyppi === 'omaehtoinen' && (
                                        <label className="custom-checkbox-row bg-gray-50 mt-2">
                                            <input type="checkbox" checked={perusopetus} onChange={(e) => handleUpdate('perusopetus', e.target.checked)} />
                                            <span>Opintojen tavoitteena on perusopetuksen oppimäärän suorittaminen (nostaa tukiajan 48 kuukauteen, 76 §).</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {alkuPvm && loppuPvm && (
                                <div className="smart-analysis-box">
                                    <div className="smart-analysis-header"><CalendarClock size={20} /> Automaattinen keston laskenta</div>
                                    <div className="smart-analysis-grid">
                                        <div className="smart-analysis-column">
                                            <p className="smart-analysis-title">LASKETTU KESTO</p>
                                            <strong className="stat-value-xl">{kestoKk} kk</strong>
                                        </div>
                                        <div className="smart-analysis-column">
                                            <p className="smart-analysis-title">LAINMUKAISUUS</p>
                                            {warnings.length > 0 ? warnings.map((w, idx) => (
                                                <span key={idx} className="status-text--danger"><AlertTriangle size={16}/> {w}</span>
                                            )) : (
                                                <span className="status-text--success"><CheckCircle2 size={16}/> Kesto on lain rajoissa.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h4 className="icon-label">3. Edellytysten tarkistus (73 §, 75 §, 77 §)</h4>
                            <div className="card-inner flex-col-gap">
                                <label className="custom-checkbox-row">
                                    <input type="checkbox" checked={edellytysSuunnitelma} onChange={(e) => handleUpdate('edellytys_suunnitelma', e.target.checked)} />
                                    <span>Opiskelusta on sovittu tässä työllistymissuunnitelmassa <strong>ennen</strong> opintojen aloittamista (75 §).</span>
                                </label>
                                {tyyppi !== 'sivutoiminen' && (
                                    <label className="custom-checkbox-row">
                                        <input type="checkbox" checked={edellytysTarkoitus} onChange={(e) => handleUpdate('edellytys_tarkoituksenmukaisuus', e.target.checked)} />
                                        <span>Opiskelu parantaa olennaisesti ammattitaitoa ja työllistymismahdollisuuksia (73 §).</span>
                                    </label>
                                )}
                                <label className="custom-checkbox-row">
                                    <input type="checkbox" checked={edellytysSeuranta} onChange={(e) => handleUpdate('edellytys_seuranta', e.target.checked)} />
                                    <span>Opintojen etenemisen seurannasta on sovittu (Esim. 5 op / kk, 77 §).</span>
                                </label>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TuettuOpiskelu;