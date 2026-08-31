// --- src/components/sections/Suunnitelma/Tyonhakuprofiili.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { 
    UserCircle, Lightbulb, AlertTriangle, CalendarDays, 
    CheckCircle, Copy, Check, MessageSquare, Info, Sparkles, Send, Loader2
} from 'lucide-react';
import { planData } from '../../../data/planData'; 

// Common-komponentit
import Button from '../../common/Button';
import AlertBox from '../../common/AlertBox';
import Modal from '../../common/Modal';
import Accordion from '../../common/Accordion';

const transformVariables = (varsArray) => {
    if (!varsArray || varsArray.length === 0) return null;
    return varsArray.reduce((acc, curr) => {
        let parsedOptions = [];
        try {
            if (Array.isArray(curr.options)) parsedOptions = curr.options;
            else if (typeof curr.options === 'string') {
                let temp = JSON.parse(curr.options);
                parsedOptions = typeof temp === 'string' ? JSON.parse(temp) : temp;
            }
        } catch(e) {}

        let cleanDefault = curr.default_value;
        if (typeof cleanDefault === 'string' && cleanDefault.startsWith('"') && cleanDefault.endsWith('"')) {
            cleanDefault = cleanDefault.slice(1, -1);
        }

        acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: cleanDefault, vaihtoehdot: parsedOptions };
        return acc;
    }, {});
};

const Tyonhakuprofiili = ({ state, actions }) => {
    const UI_KEY = 'tyonhakuprofiili';
    const { onUpdateVariable, onSelect, onAddSignal } = actions;
    
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const selection = state[UI_KEY] || {};
    const isPoikkeus = selection?.avainsana === 'tm_profiili_vapautus';

    // === ÄLYKÄS TUTKA (Signaalit ja Tila) ===
    const signals = state?.signals || {};
    const hasLanguageBarrier = Object.keys(signals).some(key => key.includes('language') || key === 'osallistuu_tulkki');
    const hasDigitalBarrier = signals['puutteelliset_digitaidot'] || signals['ei_pankkitunnuksia'];
    const hasHealthBarrier = signals['tyokyky_alentunut'];

    const thvState = state?.tyonhakuvelvollisuus || {};
    const hasNoObligation = thvState.avainsana?.includes('ei_velvoitetta') || Number(thvState.muuttujat?.LKM) === 0;

    const isWorkingOrStudying = 
        state?.tyotilanne?.avainsana?.includes('kokoaikatyo') || 
        state?.koulutus?.avainsana?.includes('paatoiminen') ||
        state?.yrittajyys?.avainsana?.includes('paatoiminen_yrittaja');

    const needsAssistance = hasLanguageBarrier || hasDigitalBarrier || hasHealthBarrier;
    const isExempt = hasNoObligation || isWorkingOrStudying;

    // === VIESTIKESKUKSEN JA MODAALIN TILAT ===
    const [viestit, setViestit] = useState({ muistutus: '', ilmoitus: '' });
    const [copiedStates, setCopiedStates] = useState({ muistutus: false, ilmoitus: false, profiili: false });
    const [modalData, setModalData] = useState({ isOpen: false, type: '', title: '', actionText: '', signalKey: '' });

    // === PROFIILIGENERAATTORIN TILAT ===
    const [genEsco, setGenEsco] = useState('');
    const [genTaidot, setGenTaidot] = useState('');
    const [genLuvat, setGenLuvat] = useState('');
    const [genEsittely, setGenEsittely] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // ==========================================
    // 1. DATAN LATAUS JA TULOSTEEN SILTA
    // ==========================================
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('grouping_key', 'tyonhakuprofiili').order('priority_score'),
                    supabase.from('variables').select('*')
                ]);

                if (phrasesRes.data) {
                    const enrichedPhrases = phrasesRes.data.map(phrase => {
                        const phraseVars = varsRes.data ? varsRes.data.filter(v => v.phrase_id === phrase.id) : [];
                        return { ...phrase, avainsana: phrase.phrase_key, muuttujat: transformVariables(phraseVars) };
                    });
                    setPhrases(enrichedPhrases);

                    // TULOSTUKSEN SILTA (planData injektio)
                    let sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
                    if (!sectionInPlanData) {
                        sectionInPlanData = { id: UI_KEY, otsikko: 'Työnhakuprofiili', monivalinta: false, fraasit: [] };
                        planData.aihealueet.push(sectionInPlanData);
                    }
                    enrichedPhrases.forEach(dbPhrase => {
                        if (!sectionInPlanData.fraasit.find(f => f.avainsana === dbPhrase.avainsana)) {
                            sectionInPlanData.fraasit.push({
                                avainsana: dbPhrase.avainsana, teksti: dbPhrase.base_text, lyhenne: dbPhrase.short_title, muuttujat: dbPhrase.muuttujat
                            });
                        }
                    });
                }

                // Haetaan Puzzlet (Viestipohjat)
                const puzzleIds = ['f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002'];
                const { data: bps } = await supabase.from('puzzle_blueprints').select('puzzle_id, piece_id, order_index').in('puzzle_id', puzzleIds).order('order_index', { ascending: true });

                if (bps && bps.length > 0) {
                    const pieceIds = bps.map(bp => bp.piece_id);
                    const { data: pieces } = await supabase.from('puzzle_pieces').select('id, content').in('id', pieceIds);
                    const piecesMap = pieces.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.content }), {});
                    
                    let muistutusTxt = '', ilmoitusTxt = '';
                    bps.filter(bp => bp.puzzle_id === 'f0000000-0000-0000-0000-000000000001').forEach(bp => muistutusTxt += (piecesMap[bp.piece_id] || '') + '\n\n');
                    bps.filter(bp => bp.puzzle_id === 'f0000000-0000-0000-0000-000000000002').forEach(bp => ilmoitusTxt += (piecesMap[bp.piece_id] || '') + '\n\n');

                    const expertName = 'Asiantuntija';
                    setViestit({
                        muistutus: muistutusTxt.replace(/{expertName}/g, expertName).trim(),
                        ilmoitus: ilmoitusTxt.replace(/{expertName}/g, expertName).trim()
                    });
                }
            } catch (error) { console.error("Virhe latauksessa:", error); }
            setLoading(false);
        };
        fetchData();
    }, []);

    // ==========================================
    // 2. ÄLYKÄS DATAN POIMINTA ESCO-GENERAATTORIIN
    // ==========================================
    useEffect(() => {
        // A. Ammatit (Pääammatti + Vaihtoehtoiset)
        let ammatit = [];
        if (state.asiakas?.tavoiteammatti_esco_nimi) ammatit.push(state.asiakas.tavoiteammatti_esco_nimi);
        try {
            const altAmmatit = JSON.parse(state['custom-vaihtoehtoiset_ammatit'] || "[]");
            altAmmatit.forEach(a => ammatit.push(a.nimi));
        } catch(e) {}
        setGenEsco(ammatit.join(', '));

        // B. Taidot (ESCO-taidot)
        try {
            const escoTaidot = JSON.parse(state['custom-valitut_esco_taidot'] || "[]");
            setGenTaidot(escoTaidot.map(t => `• ${t}`).join('\n'));
        } catch(e) {}

        // C. Kortit ja Luvat (Signaalit)
        let luvat = [];
        Object.keys(signals).forEach(key => {
            if (key.startsWith('patevyys_')) {
                let name = key.replace('patevyys_', '').replace(/_/g, ' ');
                name = name.charAt(0).toUpperCase() + name.slice(1);
                luvat.push(name);
            }
        });
        setGenLuvat(luvat.join(', '));

    }, [state.asiakas, state['custom-vaihtoehtoiset_ammatit'], state['custom-valitut_esco_taidot'], signals]);

    // ==========================================
    // 3. KÄSITTELIJÄT JA MODAALI
    // ==========================================
    const handlePoikkeusToggle = (soveltuu) => {
        const uusiAvainsana = soveltuu ? 'tm_profiili_vapautus' : 'tm_profiili_asiakas_tekee';
        onSelect(UI_KEY, uusiAvainsana, false, { ...selection, avainsana: uusiAvainsana });
    };

    const handleTilaSelect = (avainsana) => {
        onSelect(UI_KEY, avainsana, false, { ...selection, avainsana: avainsana });
    };

    const handleSmartCopy = (type, text, modalConfig) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedStates(prev => ({ ...prev, [type]: true }));
            setTimeout(() => setCopiedStates(prev => ({ ...prev, [type]: false })), 2000);
            if (modalConfig) setModalData({ isOpen: true, ...modalConfig });
        });
    };

    const handleAcceptModal = () => {
        if (onAddSignal && modalData.signalKey) {
            onAddSignal(modalData.signalKey);
        }
        if (modalData.type === 'ilmoitus') {
            handleTilaSelect('tm_profiili_julkaistu');
        }
        setModalData({ isOpen: false, type: '', title: '', actionText: '', signalKey: '' });
    };

    // ==========================================
    // 4. TEKOÄLYN MYYNTIPUHE (GENERAATTORI)
    // ==========================================
    const handleGenerateAIPitch = async () => {
        setIsGenerating(true);
        setGenEsittely('Generoidaan anonyymiä profiilia...');
        
        try {
            const response = await fetch('/.netlify/functions/generateProfile', {
                method: 'POST',
                body: JSON.stringify({
                    ammatit: genEsco,
                    taidot: genTaidot,
                    luvat: genLuvat
                })
            });

            if (response.ok) {
                const data = await response.json();
                const avainsanatText = data.avainsanat && data.avainsanat.length > 0 ? `\n\n*Avainsanat: ${data.avainsanat.join(', ')}*` : '';
                const finalPitch = `**${data.otsikko}**\n\n${data.esittelyteksti}${avainsanatText}`;
                setGenEsittely(finalPitch);
            } else {
                setGenEsittely('Virhe generoinnissa. Yritä uudelleen.');
            }
        } catch (error) {
            console.error("AI Generointi virhe:", error);
            setGenEsittely('Yhteysvirhe. Tekoälyyn ei saatu yhteyttä.');
        } finally {
            setIsGenerating(false);
        }
    };

    const valmisProfiiliTeksti = useMemo(() => {
        if (!genEsco && !genTaidot && !genLuvat && !genEsittely) return '';
        let profiili = `**Osaaminen ja ammattitaito**\n${genEsco || '-'}\n\n`;
        if (genTaidot) profiili += `**Erityisosaaminen**\n${genTaidot}\n\n`;
        profiili += `**Koulutus, luvat ja kortit**\n${genLuvat || '-'}\n\n**Esittely**\n${genEsittely || '-'}`;
        return profiili;
    }, [genEsco, genTaidot, genLuvat, genEsittely]);


    if (loading) return <div className="section-container"><p className="text-secondary">Ladataan profiilin asetuksia...</p></div>;

    const asiakasTekeePhrase = phrases.find(p => p.avainsana === 'tm_profiili_asiakas_tekee');
    const vapautusPhrase = phrases.find(p => p.avainsana === 'tm_profiili_vapautus');

    return (
        <section className="section-container">
            {/* LAKI-INFO */}
            <AlertBox type="info" customStyle={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Info size={20} className="text-primary" />
                    <div>
                        <strong className="text-primary block" style={{ marginBottom: '0.25rem' }}>Huom! Lakimuutos 1.1.2026</strong>
                        <span className="text-sm">Työnhakuprofiilin laatiminen Työmarkkinatorille on pakollista, mutta sen julkaiseminen <strong>ei täytä</strong> kuukausittaista työnhakuvelvollisuutta (THV).</span>
                    </div>
                </div>
            </AlertBox>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="icon-heading" style={{ margin: 0 }}>
                    <UserCircle size={28} className="text-primary" />
                    Työnhakuprofiili (Lakisääteinen)
                </h2>
                <div className="boolean-buttons">
                    <button type="button" className={!isPoikkeus ? 'selected' : ''} onClick={() => handlePoikkeusToggle(false)}>Lakisääteinen</button>
                    <button type="button" className={isPoikkeus ? 'selected' : ''} onClick={() => handlePoikkeusToggle(true)} style={{ backgroundColor: isPoikkeus ? 'var(--color-warning)' : '', color: isPoikkeus ? 'white' : '' }}>Poikkeus soveltuu</button>
                </div>
            </div>

            {/* --- POIKKEUS SOVELTUU --- */}
            {isPoikkeus && (
                <div className="side-bordered-panel" style={{ borderLeftColor: 'var(--color-warning)', animation: 'fadeIn 0.3s ease' }}>
                    <h3 className="text-lg fw-semibold" style={{ marginBottom: '1rem' }}>Vapautuksen kirjaus</h3>
                    {vapautusPhrase && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="text-sm fw-semibold block" style={{ marginBottom: '0.5rem' }}>Valitse virallinen peruste:</label>
                            <select 
                                className="modern-select" 
                                value={selection?.muuttujat?.POIKKEUS_SYY || ''}
                                onChange={(e) => onUpdateVariable(UI_KEY, 'tm_profiili_vapautus', 'POIKKEUS_SYY', e.target.value)}
                            >
                                <option value="">-- Valitse peruste --</option>
                                {vapautusPhrase.muuttujat?.POIKKEUS_SYY?.vaihtoehdot?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* --- NORMAALI TILA (Ei poikkeusta) --- */}
            {!isPoikkeus && (
                <div className="side-bordered-panel" style={{ borderLeftColor: selection?.avainsana === 'tm_profiili_viranomainen_tekee' ? 'var(--color-ai)' : 'var(--color-success)', animation: 'fadeIn 0.3s ease' }}>
                    
                    {/* Älykäs tutka */}
                    {(needsAssistance || isExempt) && (
                        <AlertBox type="warning" customStyle={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                <Lightbulb size={18} /> Järjestelmän havainnot:
                            </div>
                            <span className="text-sm">Harkitse "Poikkeus soveltuu" -vaihtoehdon valitsemista yläpuolelta seuraavin perustein:</span>
                            <ul className="text-sm" style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                {hasNoObligation && <li>Työnhakuvelvollisuutta ei ole asetettu (lkm 0).</li>}
                                {hasHealthBarrier && <li>Asiakkaalla on alentunut työkyky.</li>}
                                {hasLanguageBarrier && <li>Asiakkaalla on merkintä heikosta kielitaidosta.</li>}
                                {hasDigitalBarrier && <li>Asiakkaalla on puutteelliset digitaidot tai puuttuva tunnistautuminen.</li>}
                                {isWorkingOrStudying && <li>Asiakas on ohjattu tai on jo työssä/opiskelemassa päätoimisesti.</li>}
                            </ul>
                        </AlertBox>
                    )}

                    <h3 className="text-lg fw-semibold" style={{ marginBottom: '1rem' }}>Profiilin tilanne ja vastuu</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_julkaistu' ? '2px solid var(--color-success)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_julkaistu'} onChange={() => handleTilaSelect('tm_profiili_julkaistu')} style={{ margin: 0 }} />
                            <span className="fw-semibold text-center">Jo julkaistu<br/><small className="text-muted fw-normal">(Kunnossa)</small></span>
                        </label>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_asiakas_tekee' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_asiakas_tekee'} onChange={() => handleTilaSelect('tm_profiili_asiakas_tekee')} style={{ margin: 0 }} />
                            <span className="fw-semibold text-center text-primary">Asiakas tekee<br/><small className="text-muted fw-normal text-primary">(Myyntitila)</small></span>
                        </label>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_viranomainen_tekee' ? '2px solid var(--color-ai)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_viranomainen_tekee'} onChange={() => handleTilaSelect('tm_profiili_viranomainen_tekee')} style={{ margin: 0 }} />
                            <span className="fw-semibold text-center text-ai">Viranomainen tekee<br/><small className="text-muted fw-normal text-ai">(Generaattori)</small></span>
                        </label>
                    </div>

                    {/* === SKENAARIO A: ASIAKAS TEKEE (Myyntitila) === */}
                    {selection?.avainsana === 'tm_profiili_asiakas_tekee' && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            {asiakasTekeePhrase && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 'var(--border-radius)', marginBottom: '1.5rem' }}>
                                    <CalendarDays size={20} className="text-primary" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                                        <label className="text-sm fw-semibold">Aseta määräpäivä suunnitelmaan</label>
                                        <input 
                                            type="text" 
                                            className="form-input text-mono" 
                                            placeholder={asiakasTekeePhrase.muuttujat?.PÄIVÄMÄÄRÄ?.oletus || "15 arkipäivän kuluessa"}
                                            value={selection?.muuttujat?.PÄIVÄMÄÄRÄ !== undefined ? selection.muuttujat.PÄIVÄMÄÄRÄ : ''} 
                                            onChange={(e) => onUpdateVariable(UI_KEY, 'tm_profiili_asiakas_tekee', 'PÄIVÄMÄÄRÄ', e.target.value)} 
                                            style={{ maxWidth: '350px' }}
                                        />
                                    </div>
                                </div>
                            )}

                            <Accordion title="Myyntiargumentit asiakkaalle (Miksi profiili kannattaa tehdä?)" defaultOpen={false}>
                                <ul className="text-sm text-slate-700" style={{ paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <li><strong>Piilotyöpaikat:</strong> Työnantajat voivat olla suoraan yhteydessä ja tarjota paikkoja, joita ei ole julkisessa haussa.</li>
                                    <li><strong>Anonyymiys:</strong> Profiili on nimetön, ellet itse lisää sinne some-linkkejä. Osaamisesi puhuu puolestasi.</li>
                                    <li><strong>Osuvammat ehdotukset:</strong> Mitä tarkemmin kuvaat osaamistasi, sitä paremmin järjestelmä ehdottaa sinulle sopivia paikkoja.</li>
                                    <li><strong>Kansainvälisyys (EURES):</strong> Voit laajentaa profiilisi näkymään koko Euroopan alueelle.</li>
                                </ul>
                            </Accordion>

                            <div className="ai-workspace" style={{ marginTop: '1.5rem' }}>
                                <h4 className="icon-label"><MessageSquare size={18} /> Asiakasviestintä (Pikakaista)</h4>
                                <p className="text-sm text-secondary mb-4">Lähetä asiakkaalle kannustava muistutus profiilin laatimisesta.</p>
                                
                                <div className="ai-preview-box text-sm">
                                    {viestit.muistutus || "Ladataan viestipohjaa..."}
                                </div>
                                
                                <Button 
                                    variant="primary" 
                                    icon={copiedStates.muistutus ? Check : Copy}
                                    onClick={() => handleSmartCopy('muistutus', viestit.muistutus, {
                                        type: 'muistutus',
                                        title: 'Lisätäänkö toimenpide?',
                                        actionText: 'Kyllä, lisää toimenpide',
                                        signalKey: 'toimi_tm_profiili_laadinta'
                                    })}
                                    style={{ backgroundColor: copiedStates.muistutus ? 'var(--color-success)' : '' }}
                                >
                                    {copiedStates.muistutus ? 'Kopioitu leikepöydälle!' : 'Kopioi muistutusviesti'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* === SKENAARIO B: VIRANOMAINEN TEKEE (Generaattori) === */}
                    {selection?.avainsana === 'tm_profiili_viranomainen_tekee' && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <AlertBox type="warning" customStyle={{ backgroundColor: 'rgba(227, 74, 74, 0.05)', borderColor: 'rgba(227, 74, 74, 0.2)', marginBottom: '1.5rem' }}>
                                <h4 className="text-danger icon-label" style={{ margin: 0 }}><AlertTriangle size={18} /> Viranomaisen tekemän profiilin säännöt</h4>
                                <ul className="text-sm text-slate-700" style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                                    <li><strong>Vain nimettömiä tietoja:</strong> Ei työnantajaa tai oppilaitosta yksilöiviä tietoja.</li>
                                    <li><strong>Sallitut tiedot:</strong> Olennainen työkokemus, koulutus, luvat, pätevyydet, työtoiveet ja kielitaito.</li>
                                </ul>
                            </AlertBox>

                            <div className="panel-ai-work">
                                <h4 className="icon-label text-ai"><Sparkles size={18} /> Anonyymi Profiiligeneraattori</h4>
                                <p className="text-sm text-secondary">Järjestelmä on poiminut tiedot asiakkaan ESCO-ammatin, taitojen ja lupakorttien perusteella. Täydennä tarvittaessa ja generoi esittely.</p>
                                
                                <div className="split-textarea-container" style={{ flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                    <div>
                                        <label className="text-sm fw-semibold block mb-2">Pääosaaminen (ESCO-ammatit)</label>
                                        <input type="text" className="form-input text-primary fw-medium" placeholder="Esim. Autonasentaja, Parturi-kampaaja" value={genEsco} onChange={e => setGenEsco(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-sm fw-semibold block mb-2">Erityisosaaminen (ESCO-taidot)</label>
                                        <textarea className="form-input text-sm text-secondary" rows="2" value={genTaidot} onChange={e => setGenTaidot(e.target.value)} placeholder="• Osaaminen 1&#10;• Osaaminen 2" />
                                    </div>
                                    <div>
                                        <label className="text-sm fw-semibold block mb-2">Kortit, luvat ja pätevyydet</label>
                                        <input type="text" className="form-input text-success fw-medium" placeholder="Esim. Työturvallisuuskortti, B-ajokortti" value={genLuvat} onChange={e => setGenLuvat(e.target.value)} />
                                    </div>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                            <label className="text-sm fw-semibold block mb-0 text-ai">Tekoälyn generoima esittely (Myyntipuhe)</label>
                                            <Button variant="secondary" size="sm" onClick={handleGenerateAIPitch} disabled={isGenerating} icon={isGenerating ? Loader2 : Sparkles} style={{ color: 'var(--color-ai)', borderColor: 'var(--color-ai-border)' }}>
                                                {isGenerating ? 'Generoidaan...' : 'Generoi'}
                                            </Button>
                                        </div>
                                        <textarea className="form-input" rows="4" style={{ borderLeft: '3px solid var(--color-ai)' }} placeholder="Paina 'Generoi' luodaksesi tekstin..." value={genEsittely} onChange={e => setGenEsittely(e.target.value)}></textarea>
                                    </div>
                                </div>

                                {/* Generoitu lopputulos kopioitavaksi */}
                                {valmisProfiiliTeksti && (
                                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--color-border)' }}>
                                        <h4 className="text-sm fw-semibold mb-2">Valmis anonyymi profiili (Kopioi Työmarkkinatorille):</h4>
                                        <div className="ai-preview-box text-sm font-mono" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: 'var(--color-text-primary)' }}>
                                            {valmisProfiiliTeksti}
                                        </div>
                                        <Button 
                                            variant="secondary" 
                                            icon={copiedStates.profiili ? Check : Copy}
                                            onClick={() => {
                                                navigator.clipboard.writeText(valmisProfiiliTeksti);
                                                setCopiedStates(prev => ({ ...prev, profiili: true }));
                                                setTimeout(() => setCopiedStates(prev => ({ ...prev, profiili: false })), 2000);
                                            }}
                                        >
                                            {copiedStates.profiili ? 'Kopioitu!' : 'Kopioi profiiliteksti'}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Jälkimarkkinointi (Ilmoitus) */}
                            <div className="ai-workspace" style={{ marginTop: '1.5rem', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                                <h4 className="icon-label text-success"><Send size={18} /> Asiakasviestintä (Jälkimarkkinointi)</h4>
                                <p className="text-sm text-secondary mb-4">Kun olet julkaissut profiilin, muista lähettää lakisääteinen ilmoitus asiakkaalle.</p>
                                
                                <div className="ai-preview-box text-sm" style={{ backgroundColor: '#ffffff', borderColor: '#bbf7d0', color: 'var(--color-text-primary)' }}>
                                    {viestit.ilmoitus || "Ladataan viestipohjaa..."}
                                </div>
                                
                                <Button 
                                    variant="primary" 
                                    icon={copiedStates.ilmoitus ? Check : Copy}
                                    onClick={() => handleSmartCopy('ilmoitus', viestit.ilmoitus, {
                                        type: 'ilmoitus',
                                        title: 'Päivitetäänkö profiilin tila?',
                                        actionText: 'Kyllä, merkitse julkaistuksi',
                                        signalKey: 'toimi_tm_profiili_ilmoitus'
                                    })}
                                    style={{ backgroundColor: copiedStates.ilmoitus ? 'var(--color-success)' : 'var(--color-success)', borderColor: 'var(--color-success)' }}
                                >
                                    {copiedStates.ilmoitus ? 'Kopioitu leikepöydälle!' : 'Kopioi lakisääteinen ilmoitus'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ÄLYKÄS POP-UP MODAALI */}
            <Modal 
                isOpen={modalData.isOpen} 
                onClose={() => setModalData({ isOpen: false, type: '', title: '', actionText: '', signalKey: '' })}
                title={modalData.title}
                icon={CheckCircle}
                maxWidth="550px"
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p className="text-base" style={{ marginBottom: '1.5rem' }}>
                        Kopioit viestin onnistuneesti leikepöydälle. Haluatko, että järjestelmä päivittää asiakkaan suunnitelmaa tämän perusteella?
                    </p>
                    <AlertBox type="info" customStyle={{ marginBottom: '1.5rem' }}>
                        Tämä valinta auttaa pitämään suunnitelman ajan tasalla ja säästää sinulta manuaalisen kirjaamisen vaivan.
                    </AlertBox>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={() => setModalData({ isOpen: false, type: '', title: '', actionText: '', signalKey: '' })}>
                            Ei, pelkkä kopiointi riittää
                        </Button>
                        <Button variant="primary" onClick={handleAcceptModal}>
                            {modalData.actionText}
                        </Button>
                    </div>
                </div>
            </Modal>
        </section>
    );
};

export default Tyonhakuprofiili;