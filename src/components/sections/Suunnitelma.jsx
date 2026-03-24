// --- src/components/sections/Suunnitelma.jsx ---
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Zap, CheckSquare, FileText, Activity, Briefcase, GraduationCap, HeartPulse, ArrowDownCircle } from 'lucide-react';
import Palveluohjaus from './Palveluohjaus';

const Suunnitelma = ({ state, actions }) => {
    const DB_SUUNNITELMA = 'd76dd312-1d0d-442e-bc6a-aefea2a655f8';

    const [dbPhrases, setDbPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadedServices, setLoadedServices] = useState([]);

    const rawValinnat = state.suunnitelma || {}; 
    const isArray = Array.isArray(rawValinnat);
    const customText = state['custom-suunnitelma'] || '';
    const signals = state.signals || {};

    // 1. DATAN HAKU
    useEffect(() => {
        const fetchSuunnitelmaPhrases = async () => {
            try {
                const [phrasesRes, triggersRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_SUUNNITELMA),
                    supabase.from('phrase_triggers').select('*')
                ]);

                if (phrasesRes.error) throw phrasesRes.error;
                if (triggersRes.error) throw triggersRes.error;

                const rawPhrases = phrasesRes.data || [];
                const rawTriggers = triggersRes.data || [];

                const formattedPhrases = rawPhrases.map(p => {
                    const matchingTriggers = rawTriggers.filter(t => t.phrase_id === p.id);
                    return {
                        id: p.phrase_key,
                        avainsana: p.phrase_key,
                        teksti: p.base_text,
                        lyhenne: p.short_title,
                        ryhma: p.grouping_key,
                        priority: p.priority_score,
                        triggerit: matchingTriggers 
                    };
                });

                setDbPhrases(formattedPhrases);
            } catch (err) {
                console.error("Virhe Suunnitelma-haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSuunnitelmaPhrases();
    }, []);

    const isSelected = (id) => isArray ? rawValinnat.includes(id) : !!rawValinnat[id];

    const handleTogglePhrase = (id, isChecked) => {
        if (actions.onUpdateSuunnitelma) {
            actions.onUpdateSuunnitelma(id, isChecked);
        } else if (actions.updateSectionData) {
            if (isArray) {
                const newList = isChecked ? [...rawValinnat, id] : rawValinnat.filter(i => i !== id);
                actions.updateSectionData('suunnitelma', newList);
            } else {
                actions.updateSectionData('suunnitelma', { ...rawValinnat, [id]: isChecked });
            }
        }
    };

    const handleCustomTextChange = (e) => {
        if (actions.onUpdateCustomText) actions.onUpdateCustomText('suunnitelma', e.target.value);
    };

    const generatedText = useMemo(() => {
        const activePhrases = dbPhrases.filter(phrase => isSelected(phrase.id));
        activePhrases.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));

        const tyokokeiluKesto = state.palkkatuki?.tyokokeilu_kesto_kk || 'X';
        const phraseTexts = activePhrases.map(phrase => phrase.teksti.replace(/\[KESTO_KK\]/g, tyokokeiluKesto));

        const activeServices = loadedServices.filter(service => isSelected(service.id));
        const serviceTexts = activeServices.map(service => service.plan_text);

        return [...phraseTexts, ...serviceTexts].join('\n\n');
    }, [dbPhrases, rawValinnat, isArray, state.palkkatuki, loadedServices]);

    const handleMoveText = () => {
        if (!generatedText) return;
        const combinedText = customText ? `${generatedText}\n\n${customText}` : generatedText;
        if (actions.onUpdateCustomText) actions.onUpdateCustomText('suunnitelma', combinedText);
    };

    const displaySignals = useMemo(() => Object.entries(signals).filter(([key, value]) => value && !key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)), [signals]);

    // --- UUSITTU STRATEGIAPOLKUJEN LOGIIKKA ---
    const strategyPaths = useMemo(() => {
        const paths = {
            'A': { title: 'Työ edellä', icon: <Briefcase size={16} />, phrases: [] },
            'B': { title: 'Koulutus edellä', icon: <GraduationCap size={16} />, phrases: [] },
            'C': { title: 'Työkyky ja tuki', icon: <HeartPulse size={16} />, phrases: [] }
        };

        // Luodaan dynaamiset signaalit, jotta tulkki ja heikko kielitaso aktivoivat koulutuspolun
        const activeSignals = { ...signals };
        
        // 1. Jos tarvitsee tulkkia, rinnastetaan se kielitaidon puutteeseen
        if (signals['osallistuu_tulkki']) {
            activeSignals['kielitaidon_puute'] = true;
            activeSignals['kielitaito_heikko'] = true;
        }

        // 2. Jos kielitaso on A1 tai A2, rinnastetaan se kielitaidon puutteeseen
        const hasLowLanguage = Object.keys(signals).some(key => 
            signals[key] && key.startsWith('language_fi_a')
        );
        if (hasLowLanguage) {
            activeSignals['kielitaidon_puute'] = true;
        }

        dbPhrases.forEach(phrase => {
            if (phrase.triggerit?.length > 0) {
                // Käytetään laajennettuja activeSignals-signaaleja vertailuun
                const matchingTriggers = phrase.triggerit.filter(t => activeSignals[t.signal_key]);
                
                if (matchingTriggers.length > 0) {
                    const matchedPathKeys = [...new Set(matchingTriggers.map(t => t.strategy_path))];
                    matchedPathKeys.forEach(pathKey => {
                        if (paths[pathKey] && !paths[pathKey].phrases.find(p => p.id === phrase.id)) {
                            paths[pathKey].phrases.push(phrase);
                        }
                    });
                }
            }
        });
        return paths;
    }, [dbPhrases, signals]);

    const groupedPhrases = useMemo(() => {
        const groups = {};
        dbPhrases.forEach(phrase => {
            const key = phrase.ryhma || 'muut';
            if (!groups[key]) groups[key] = [];
            groups[key].push(phrase);
        });
        return groups;
    }, [dbPhrases]);

    const formatGroupName = (key) => key === 'muut' ? 'Muut toimenpiteet' : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

    if (loading) return <div className="section-container">Ladataan suunnitelman fraaseja...</div>;

    return (
        <div className="section-container">
            <h2 className="section-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckSquare size={24} color="var(--color-primary)" />
                Työllistymissuunnitelman kokoaminen
            </h2>

            <div className="thv-resolution-hub">
                <div className="thv-resolution-header"><Zap size={20} /> Älykäs Ratkaisukeskus</div>
                <div className="thv-resolution-grid">
                    <div className="thv-resolution-column" style={{ flex: '0 0 30%' }}>
                        <h4 className="thv-column-title">Havaitut signaalit</h4>
                        {displaySignals.length > 0 ? (
                            <ul className="thv-resolution-signals">{displaySignals.map(([key]) => <li key={key}>{key.replace(/_/g, ' ')}</li>)}</ul>
                        ) : (
                            <p className="thv-resolution-info">Ei vahvoja signaaleja aiemmista osioista.</p>
                        )}
                    </div>
                    <div className="thv-resolution-column" style={{ flex: '1', display: 'flex', gap: '1rem' }}>
                        {Object.keys(strategyPaths).some(k => strategyPaths[k].phrases.length > 0) ? (
                            Object.entries(strategyPaths).map(([key, pathData]) => {
                                if (pathData.phrases.length === 0) return null;
                                return (
                                    <div key={key} style={{ flex: 1, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                                        <h5 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>{pathData.icon} {pathData.title}</h5>
                                        <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', flex: 1 }}>
                                            {pathData.phrases.map(p => <li key={`list-${p.id}`}>{p.lyhenne}</li>)}
                                        </ul>
                                        <button className="thv-action-button" onClick={() => pathData.phrases.forEach(p => { if (!isSelected(p.id)) handleTogglePhrase(p.id, true); })} style={{ backgroundColor: 'var(--color-primary)', width: '100%', justifyContent: 'center' }}>
                                            <Activity size={16} /> Valitse polku {key}
                                        </button>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p className="thv-resolution-info">Signaalit eivät vielä riitä polun automaattiseen muodostamiseen. Käytä manuaalista valintaa.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <Palveluohjaus state={state} actions={actions} onServicesLoaded={setLoadedServices} />
            </div>

            <div className="questions-container">
                <h3 style={{ marginBottom: '1.5rem' }}>Käsiohjaus (Kaikki toimenpiteet)</h3>
                {Object.keys(groupedPhrases).length > 0 ? (
                    Object.entries(groupedPhrases).map(([groupKey, phrasesInGroup]) => (
                        <div key={groupKey} style={{ marginBottom: '2rem' }}>
                            <h4 className="subsection-title" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{formatGroupName(groupKey)}</h4>
                            <div className="perustelut-valinnat">
                                {phrasesInGroup.map(phrase => (
                                    <label key={phrase.id} className="custom-checkbox-row">
                                        <input type="checkbox" className="modern-checkbox" checked={isSelected(phrase.id)} onChange={(e) => handleTogglePhrase(phrase.id, e.target.checked)} />
                                        <span>{phrase.lyhenne}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>
                        Tietokannasta ei löytynyt fraaseja.
                    </div>
                )}
            </div>

            <div className="thv-locked-text-container">
                <div className="thv-locked-text-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={16} /> Generoidun asiakirjan esikatselu</div>
                    {generatedText && (
                        <button onClick={handleMoveText} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s ease' }}>
                            <ArrowDownCircle size={14} /> Siirrä muokattavaksi
                        </button>
                    )}
                </div>
                <div className="thv-locked-text-body">
                    {generatedText ? generatedText : <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Valitse toimenpiteitä yläpuolelta nähdäksesi suunnitelman luonnoksen...</span>}
                </div>
            </div>

            <div className="custom-text-container" style={{ marginTop: '1.5rem' }}>
                <label htmlFor="suunnitelma-custom-text" className="custom-text-label" style={{ fontWeight: 'bold' }}>
                    Omat lisäykset ja tarkennukset (Tämä teksti tulostuu lopulliseen suunnitelmaan):
                </label>
                <textarea id="suunnitelma-custom-text" className="form-input" rows="6" value={customText} onChange={handleCustomTextChange} style={{ marginTop: '0.5rem', resize: 'vertical' }} />
            </div>
        </div>
    );
};

export default Suunnitelma;