import React, { useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { BookOpen, AlertTriangle, Sparkles, CalendarClock, CheckCircle2, Info } from 'lucide-react';
import { ENTITY_DEFINITIONS } from '../../data/entityDefinitions';

const TuettuOpiskelu = ({ state, actions }) => {
    const { onUpdateCustomText, onUpdateVariable, onUpdateAsiakas, onAddSignal, onRemoveSignal } = actions;
    
    // --- LOKITUS: Seurataan taulukon tilaa ---
    useEffect(() => {
        if (state.sessionServices) {
            const studyRows = state.sessionServices.filter(s => s.category === 'opiskelu');
            if (studyRows.length > 0) {
                console.log("GM DEBUG: Opinnot taulukossa:", studyRows);
            }
        }
    }, [state.sessionServices]);

    // --- 1. DATAN LUKEMINEN TAULUKOSTA (Golden Master) ---
    const activeStudy = useMemo(() => 
        (state.sessionServices || []).find(s => s.category === 'opiskelu') || null,
    [state.sessionServices]);

    // Mapataan taulukon data muuttujiksi logiikkaa varten
    const aktiivinen = !!activeStudy;
    const tyyppi = activeStudy ? activeStudy.entity_key.replace('opiskelu_', '') : '';
    const opinnonNimi = activeStudy?.data?.nimi || '';
    const alkuPvm = activeStudy?.data?.alku || '';
    const loppuPvm = activeStudy?.data?.loppu || '';
    const perusopetus = activeStudy?.data?.perusopetus === true;
    const edellytysSuunnitelma = activeStudy?.data?.edellytys_suunnitelma === true;
    const edellytysSeuranta = activeStudy?.data?.edellytys_seuranta === true;

    // --- 2. TALLENNUSLOGIIKKA (Päivittää taulukkoa) ---
    const handleUpdate = (key, value) => {
        console.log(`GM ACTION: Päivitetään opinto - Kenttä: ${key}, Arvo:`, value);
        
        const currentServices = Array.isArray(state.sessionServices) ? [...state.sessionServices] : [];
        const studyIndex = currentServices.findIndex(s => s.category === 'opiskelu');

        let updatedServices = [...currentServices];

        if (key === 'aktiivinen') {
            if (value === true) {
                // Luodaan uusi opiskelurivi taulukkoon
                const newId = window.crypto.randomUUID();
                updatedServices.push({
                    id: newId,
                    entity_key: 'opiskelu_omaehtoinen',
                    category: 'opiskelu',
                    data: { alku: '', loppu: '', nimi: '', edellytys_suunnitelma: true },
                    meta: { source: 'manual', created_at: new Date().toISOString() }
                });
                console.log("GM EVENT: Uusi opintorivi luotu ID:llä", newId);
            } else {
                // Poistetaan opiskelurivi taulukosta
                updatedServices = updatedServices.filter(s => s.category !== 'opiskelu');
                console.log("GM EVENT: Opintorivi poistettu taulukosta");
            }
        } else if (activeStudy) {
            // Päivitetään olemassa olevaa opintoa
            const updatedStudy = { ...activeStudy };
            if (key === 'tyyppi') {
                updatedStudy.entity_key = `opiskelu_${value}`;
            } else {
                updatedStudy.data = { ...updatedStudy.data, [key]: value };
            }
            
            if (studyIndex > -1) {
                updatedServices[studyIndex] = updatedStudy;
            }
        }

        // TALLENNUS GLOBAALIIN TILAAN
        onUpdateVariable('global', 'sessionServices', updatedServices);
    };

    // --- LOGIIKKA JA SIGNAALIT ---

    useEffect(() => {
        const registerMySignals = async () => {
            const mySignals = [
                { signal_key: 'tuettu_opiskelu_omaehtoinen', label: 'Tuettu opiskelu: Omaehtoinen', category: 'Koulutus ja osaaminen', description: 'Asiakas osallistuu työttömyysetuudella tuettuun omaehtoiseen opiskeluun.' },
                { signal_key: 'tuettu_opiskelu_kotoutuja', label: 'Tuettu opiskelu: Kotoutuja', category: 'Koulutus ja osaaminen', description: 'Kotoutuja-asiakkaan omaehtoinen opiskelu.' },
                { signal_key: 'tuettu_opiskelu_lyhytkestoinen', label: 'Tuettu opiskelu: Lyhytkestoinen', category: 'Koulutus ja osaaminen', description: 'Lyhytkestoiset opinnot (max 6kk).' },
                { signal_key: 'tuettu_opiskelu_sivutoiminen', label: 'Tuettu opiskelu: Sivutoiminen', category: 'Koulutus ja osaaminen', description: 'Sivutoiminen opiskelu. Ei estä kokoaikatyön vastaanottamista.' }
            ];
            try { await supabase.from('system_signals').upsert(mySignals, { onConflict: 'signal_key' }); } catch (e) {}
        };
        registerMySignals();
    }, []);

    useEffect(() => {
        const allTypes = ['omaehtoinen', 'lyhytkestoinen', 'kotoutuja', 'sivutoiminen'];
        allTypes.forEach(t => { if (typeof onRemoveSignal === 'function') onRemoveSignal(`tuettu_opiskelu_${t}`); });

        if (aktiivinen && tyyppi) {
            if (typeof onAddSignal === 'function') onAddSignal(`tuettu_opiskelu_${tyyppi}`);
            if (typeof onUpdateAsiakas === 'function') onUpdateAsiakas('paa_asiallinen_toiminta', 'Opiskelija');
        }
    }, [aktiivinen, tyyppi, onAddSignal, onRemoveSignal, onUpdateAsiakas]); 

    const asiakasAlle25 = useMemo(() => {
        const sv = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!sv) return false;
        return (new Date().getFullYear() - parseInt(String(sv).replace(/\D/g, ''), 10)) < 25;
    }, [state.suunnitelman_perustiedot]);

    const calculateDuration = (start, end) => {
        if (!start || !end) return 0;
        try {
            const sParts = start.split('.');
            const eParts = end.split('.');
            const s = sParts.length === 3 ? new Date(sParts[2], sParts[1]-1, sParts[0]) : new Date(start);
            const e = eParts.length === 3 ? new Date(eParts[2], eParts[1]-1, eParts[0]) : new Date(end);
            const diff = Math.abs(e - s);
            return diff ? (Math.ceil(diff / (1000 * 60 * 60 * 24)) / 30).toFixed(1) : 0;
        } catch (e) { return 0; }
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
                                    <strong>Lain estävä edellytys (73 §):</strong> Asiakas on alle 25-vuotias. Omaehtoista tai lyhytkestoista opiskelua ei voida tukea.
                                </div>
                            </div>
                        </div>
                    )}

                    <h4 className="icon-label">1. Valitse opiskelun muoto</h4>
                    <div className="service-card-grid mb-6">
                        {['omaehtoinen', 'lyhytkestoinen', 'kotoutuja', 'sivutoiminen'].map(t => (
                            <div key={t} className={`service-card ${tyyppi === t ? 'service-card--selected' : ''} ${(t==='omaehtoinen' || t==='lyhytkestoinen') && asiakasAlle25 ? 'service-card--disabled' : ''}`}
                                 onClick={() => (!((t==='omaehtoinen' || t==='lyhytkestoinen') && asiakasAlle25)) && handleUpdate('tyyppi', t)}>
                                <h5 className="service-card-title">{tyyppiNames[t].replace(' opiskelun', '').replace(' opintojen', '')}</h5>
                                <p className="service-card-desc">{t === 'sivutoiminen' ? 'Ei ikärajaa.' : 'Vaatii 25v iän.'}</p>
                            </div>
                        ))}
                    </div>

                    {tyyppi && (
                        <>
                            <h4 className="icon-label">2. Koulutuksen tiedot ja ajankohta</h4>
                            <div className="card-inner mb-6">
                                <div className="flex-col-gap">
                                    <div>
                                        <label className="stat-label">Oppilaitos ja tutkinnon nimi</label>
                                        <input type="text" className="form-input" value={opinnonNimi} onChange={(e) => handleUpdate('nimi', e.target.value)} />
                                    </div>
                                    <div className="grid-cols-2-tight">
                                        <input type="text" className="form-input" placeholder="Alkaa" value={alkuPvm} onChange={(e) => handleUpdate('alku', e.target.value)} />
                                        <input type="text" className="form-input" placeholder="Päättyy" value={loppuPvm} onChange={(e) => handleUpdate('loppu', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {alkuPvm && loppuPvm && (
                                <div className="smart-analysis-box">
                                    <div className="smart-analysis-header"><CalendarClock size={20} /> Keston laskenta</div>
                                    <div className="smart-analysis-grid">
                                        <div className="smart-analysis-column">
                                            <p className="smart-analysis-title">KESTO</p>
                                            <strong className="stat-value-xl">{kestoKk} kk</strong>
                                        </div>
                                        <div className="smart-analysis-column">
                                            {warnings.length > 0 ? warnings.map((w, idx) => (
                                                <span key={idx} className="status-text--danger"><AlertTriangle size={16}/> {w}</span>
                                            )) : (
                                                <span className="status-text--success"><CheckCircle2 size={16}/> Lain puitteissa.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h4 className="icon-label">3. Edellytykset (75 §, 77 §)</h4>
                            <div className="card-inner flex-col-gap">
                                <label className="custom-checkbox-row">
                                    <input type="checkbox" checked={edellytysSuunnitelma} onChange={(e) => handleUpdate('edellytys_suunnitelma', e.target.checked)} />
                                    <span>Sovittu suunnitelmassa ennen aloitusta (75 §).</span>
                                </label>
                                <label className="custom-checkbox-row">
                                    <input type="checkbox" checked={edellytysSeuranta} onChange={(e) => handleUpdate('edellytys_seuranta', e.target.checked)} />
                                    <span>Seurannasta on sovittu (77 §).</span>
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