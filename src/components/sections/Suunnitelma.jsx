import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Zap, CheckSquare, FileText, Activity, Briefcase, GraduationCap, HeartPulse, ArrowDownCircle, Rocket, AlertTriangle, UserPlus } from 'lucide-react';
import Palveluohjaus from './Palveluohjaus';
import Tyonhakuprofiili from './Tyonhakuprofiili';

const Suunnitelma = ({ state, actions }) => {
    const DB_SUUNNITELMA = 'd76dd312-1d0d-442e-bc6a-aefea2a655f8';
    const UI_KEY = 'suunnitelma'; 

    const [dbPhrases, setDbPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadedServices, setLoadedServices] = useState([]);

    const rawValinnat = state[UI_KEY];
    const valinnat = useMemo(() => {
        if (Array.isArray(rawValinnat)) {
            return rawValinnat.reduce((acc, key) => ({ ...acc, [key]: true }), {});
        }
        return rawValinnat || {};
    }, [rawValinnat]);

    const customText = state[`custom-${UI_KEY}`] || '';
    const signals = state.signals || {};

    const prevTextRef = useRef(null);
    const prevIdsRef = useRef(null);

    // 1. DATAN HAKU
    useEffect(() => {
        const fetchSuunnitelmaPhrases = async () => {
            try {
                const [phrasesRes, triggersRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_SUUNNITELMA),
                    supabase.from('phrase_triggers').select('*')
                ]);
                if (phrasesRes.error) throw phrasesRes.error;

                const rawPhrases = phrasesRes.data || [];
                const rawTriggers = triggersRes.data || [];

                const formattedPhrases = rawPhrases.map(p => ({
                    id: p.phrase_key,
                    avainsana: p.phrase_key,
                    teksti: p.base_text,
                    lyhenne: p.short_title,
                    ryhma: p.grouping_key,
                    priority: p.priority_score,
                    triggerit: rawTriggers.filter(t => t.phrase_id === p.id)
                }));
                setDbPhrases(formattedPhrases);
            } catch (err) {
                console.error("Virhe Suunnitelma-haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSuunnitelmaPhrases();
    }, []);

    const handleTogglePhrase = (id, isChecked) => {
        const newValinnat = { ...valinnat };
        if (isChecked) { newValinnat[id] = true; if (actions.setSignal) actions.setSignal(id, true); } 
        else { delete newValinnat[id]; if (actions.setSignal) actions.setSignal(id, false); }
        
        if (actions.updateSectionData) actions.updateSectionData(UI_KEY, newValinnat);
        else if (actions.updateSection) actions.updateSection(UI_KEY, newValinnat);
    };

    const handleTogglePath = (phrasesToToggle) => {
        const newValinnat = { ...valinnat };
        phrasesToToggle.forEach(p => { newValinnat[p.id] = true; if (actions.setSignal) actions.setSignal(p.id, true); });
        if (actions.updateSectionData) actions.updateSectionData(UI_KEY, newValinnat);
        else if (actions.updateSection) actions.updateSection(UI_KEY, newValinnat);
    };

    const handleCustomTextChange = (e) => actions.onUpdateCustomText(UI_KEY, e.target.value);

    // --- ÄLYKÄS KOONTI: Yhdistää suunnitelmafraasit, palvelut ja velvoittavuuden lainsäädännön ---
    const activeServices = useMemo(() => loadedServices.filter(service => valinnat[service.id]), [loadedServices, valinnat]);
    
    // Suodatetaan palvelut niiden tyypin mukaan
    const hardServices = activeServices.filter(s => s.hard_service);
    const referralServices = activeServices.filter(s => s.requires_referral);

    const generatedText = useMemo(() => {
        const activePhrases = dbPhrases.filter(phrase => valinnat[phrase.id]);
        activePhrases.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));

        const tyokokeiluKesto = state.palkkatuki?.tyokokeilu_kesto_kk || 'X';
        const phraseTexts = activePhrases.map(phrase => phrase.teksti.replace(/\[KESTO_KK\]/g, tyokokeiluKesto));
        const serviceTexts = activeServices.map(service => service.plan_text);

        let finalTexts = [...phraseTexts, ...serviceTexts];

        // LISÄTÄÄN JURIDINEN VAROITUS, JOS HARD_SERVICE VALITTU
        if (hardServices.length > 0) {
            const hardTitles = hardServices.map(s => s.title).join(' ja ');
            finalTexts.push(`HUOMIO: Asiakkaalle on suunnitelmassa asetettu velvoittava palvelu (${hardTitles}). Palvelusta kieltäytyminen tai sen keskeyttäminen ilman pätevää syytä voi johtaa työttömyysturvalain mukaiseen seuraamukseen. Työnhakuvelvollisuutta voidaan mahdollisesti alentaa palvelun keston ajaksi.`);
        }

        return finalTexts.join('\n\n');
    }, [dbPhrases, valinnat, state.palkkatuki, activeServices, hardServices]);

    const handleMoveText = () => {
        if (!generatedText) return;
        const combinedText = customText ? `${generatedText}\n\n${customText}` : generatedText;
        actions.onUpdateCustomText(UI_KEY, combinedText);
    };

    // 3. Synkronointi Master-profiiliin
    useEffect(() => {
        const currentText = customText || generatedText;
        const valitutIdList = Object.keys(valinnat).filter(k => valinnat[k]);
        
        if (prevTextRef.current !== currentText) {
            actions.onUpdateAsiakas('lopullinen_suunnitelma_teksti', currentText);
            prevTextRef.current = currentText;
        }
        if (prevIdsRef.current !== JSON.stringify(valitutIdList)) {
            actions.onUpdateAsiakas('valitut_palvelut_id', valitutIdList);
            prevIdsRef.current = JSON.stringify(valitutIdList);
        }
    }, [customText, generatedText, valinnat, actions]);

    const displaySignals = useMemo(() => Object.entries(signals).filter(([key, value]) => value && !key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)), [signals]);

    const strategyPaths = useMemo(() => {
        const paths = {
            'A': { title: 'Työ edellä', icon: <Briefcase size={16} />, phrases: [] },
            'B': { title: 'Koulutus edellä', icon: <GraduationCap size={16} />, phrases: [] },
            'C': { title: 'Työkyky ja tuki', icon: <HeartPulse size={16} />, phrases: [] },
            'Y': { title: 'Yrittäjyys', icon: <Rocket size={16} />, phrases: [] }
        };

        dbPhrases.forEach(phrase => {
            if (phrase.triggerit && phrase.triggerit.length > 0) {
                phrase.triggerit.forEach(t => {
                    if (signals[t.signal_key]) {
                        const path = paths[t.strategy_path];
                        if (path && !path.phrases.find(p => p.id === phrase.id)) path.phrases.push(phrase);
                    }
                });
            }
        });
        return paths;
    }, [dbPhrases, signals]);

    const groupedPhrases = useMemo(() => {
        const groups = {};
        dbPhrases.forEach(p => {
            const key = p.ryhma || 'muut';
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [dbPhrases]);

    if (loading) return <div className="section-container">Ladataan suunnitelman fraaseja...</div>;

    return (
        <div className="section-container">
            <h2 className="section-title"><CheckSquare size={24} /> Työllistymissuunnitelman kokoaminen</h2>

            <Tyonhakuprofiili state={state} actions={actions} />

            <div className="thv-resolution-hub">
                <div className="thv-resolution-header"><Zap size={20} /> Älykäs Ratkaisukeskus</div>
                <div className="thv-resolution-grid">
                    <div className="thv-resolution-column">
                        <h4 className="thv-column-title">Havaitut signaalit</h4>
                        {displaySignals.length > 0 ? (
                            <ul className="thv-resolution-signals">{displaySignals.map(([key]) => <li key={key}>{key.replace(/_/g, ' ')}</li>)}</ul>
                        ) : <p className="thv-resolution-info">Ei vahvoja signaaleja.</p>}
                    </div>
                    <div className="thv-resolution-column" style={{ flex: '2', display: 'flex', gap: '1rem' }}>
                        {Object.entries(strategyPaths).map(([key, pathData]) => pathData.phrases.length > 0 && (
                            <div key={key} className="thv-strategy-card">
                                <h5>{pathData.icon} {pathData.title}</h5>
                                <ul>{pathData.phrases.map(p => <li key={p.id}>{p.lyhenne}</li>)}</ul>
                                <button className="thv-action-button" onClick={() => handleTogglePath(pathData.phrases)}>
                                    Valitse polku {key}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <Palveluohjaus state={state} actions={actions} onServicesLoaded={setLoadedServices} />
            </div>

            {/* --- UUSI OSIO: LÄHETTEET (Näytetään vain, jos vaaditaan) --- */}
            {referralServices.length > 0 && (
                <div className="referral-container" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f0fdfa', border: '2px solid #0d9488', borderRadius: '8px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#0f766e', marginBottom: '1rem', marginTop: 0 }}>
                        <UserPlus size={22} /> Generoitavat lähetteet ammattilaisille
                    </h3>
                    <p style={{ color: '#115e59', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        Valitsemasi palvelut vaativat tarkan lähetteen. Järjestelmä on tuonut pohjalle automaattisesti 33 § -edellytysten arvion pohjatiedoksi.
                    </p>

                    {referralServices.map(s => {
                        const refKey = `lahete_${s.id}`;
                        // Taika tapahtuu tässä: Tuodaan 33 § arvio suoraan lähetteeseen!
                        const edellytyksetText = state['custom-edellytykset'] ? state['custom-edellytykset'] : 'Tietoa ei kirjattu 33 § -osioon.';
                        const defaultText = `TAUSTATIEDOT JA LÄHTÖTILANNE (33 § ARVIO):\n----------------------------------------\n${edellytyksetText}\n\nASIANTUNTIJAN KYSYMYS TAI TILAUS PALVELUNTUOTTAJALLE:\n----------------------------------------\n`;
                        const currentRefText = state[`custom-${refKey}`] !== undefined ? state[`custom-${refKey}`] : defaultText;

                        return (
                            <div key={s.id} style={{ marginBottom: '1.5rem', backgroundColor: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <h4 style={{ marginBottom: '0.5rem', color: '#0f766e', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s.title}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', backgroundColor: '#ccfbf1', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Tilaus/Lähete</span>
                                </h4>
                                <textarea 
                                    className="form-input" 
                                    rows="12" 
                                    value={currentRefText} 
                                    onChange={(e) => actions.onUpdateCustomText(refKey, e.target.value)} 
                                    style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', backgroundColor: '#fafafa', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            {/* ------------------------------------------------------------- */}

            <div className="questions-container">
                <h3 style={{ marginBottom: '1.5rem' }}>Käsiohjaus (Kaikki toimenpiteet)</h3>
                {Object.entries(groupedPhrases).map(([group, phrases]) => (
                    <div key={group} style={{ marginBottom: '1.5rem' }}>
                        <h4 className="subsection-title">{group.charAt(0).toUpperCase() + group.slice(1).replace(/_/g, ' ')}</h4>
                        {phrases.map(phrase => (
                            <label key={phrase.id} className="custom-checkbox-row">
                                <input type="checkbox" className="modern-checkbox" checked={!!valinnat[phrase.id]} onChange={(e) => handleTogglePhrase(phrase.id, e.target.checked)} />
                                <span>{phrase.lyhenne}</span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>

            <div className="thv-locked-text-container">
                <div className="thv-locked-text-header">
                    <span><FileText size={16} /> Suunnitelmaluonnos</span>
                    {generatedText && <button onClick={handleMoveText} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}><ArrowDownCircle size={14} /> Siirrä muokattavaksi</button>}
                </div>
                <div className="thv-locked-text-body" style={{ whiteSpace: 'pre-line' }}>{generatedText || <em>Valitse toimenpiteitä yläpuolelta...</em>}</div>
            </div>

            <div className="custom-text-container" style={{ marginTop: '1.5rem' }}>
                <label htmlFor="suunnitelma-custom-text" className="custom-text-label" style={{ fontWeight: 'bold' }}>
                    Omat lisäykset ja tarkennukset (Tämä teksti tulostuu lopulliseen suunnitelmaan):
                </label>
                <textarea id="suunnitelma-custom-text" className="form-input" rows="6" value={customText} onChange={handleCustomTextChange} placeholder="Kirjoita tähän vapaata tekstiä..." style={{ marginTop: '0.5rem', resize: 'vertical' }} />
            </div>
        </div>
    );
};

export default Suunnitelma;