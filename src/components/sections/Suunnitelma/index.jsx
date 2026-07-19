import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { CheckSquare, AlertTriangle, UserPlus } from 'lucide-react';

// Kontekstit ja apufunktiot
import { useSignal } from '../../signals/useSignal';
import { useSmartText } from '../TyollistymisenEdellytykset/useSmartText'; 

// Kansion sisäiset komponentit
import Palveluohjaus from './Palveluohjaus';
import Tyonhakuprofiili from './Tyonhakuprofiili';
import SmartSuggestionBox from './SmartSuggestionBox'; // UUSI TUONTI

// Yleiset komponentit
import AlertBox from '../../common/AlertBox';
import Checkbox from '../../common/Checkbox';
import Card from '../../common/Card';
import SmartTextPreview from '../../common/SmartTextPreview';
import Accordion from '../../common/Accordion';

const Suunnitelma = ({ state, actions }) => {
    const DB_SUUNNITELMA = 'd76dd312-1d0d-442e-bc6a-aefea2a655f8';
    const UI_KEY = 'suunnitelma'; 

    const { activeSignals, actions: signalActions } = useSignal();
    const { buildKokoPalveluhistoriaText } = useSmartText();

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
    const prevTextRef = useRef(null);
    const prevIdsRef = useRef(null);

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
        const setSignalContext = signalActions?.setSignal || actions.setSignal;

        if (isChecked) { 
            newValinnat[id] = true; 
            if (setSignalContext) setSignalContext(id, true); 
        } else { 
            delete newValinnat[id]; 
            if (setSignalContext) setSignalContext(id, false); 
        }
        
        if (actions.updateSectionData) actions.updateSectionData(UI_KEY, newValinnat);
        else if (actions.updateSection) actions.updateSection(UI_KEY, newValinnat);
    };

    const handleTogglePath = (phrasesToToggle) => {
        const newValinnat = { ...valinnat };
        const setSignalContext = signalActions?.setSignal || actions.setSignal;

        phrasesToToggle.forEach(p => { 
            newValinnat[p.id] = true; 
            if (setSignalContext) setSignalContext(p.id, true); 
        });

        if (actions.updateSectionData) actions.updateSectionData(UI_KEY, newValinnat);
        else if (actions.updateSection) actions.updateSection(UI_KEY, newValinnat);
    };

    const handledSignals = useRef(new Set());
    useEffect(() => {
        Object.entries(activeSignals).forEach(([key, isActive]) => {
            if (isActive && !handledSignals.current.has(key)) {
                const matchingPhrase = dbPhrases.find(p => p.triggerit?.some(t => t.signal_key === key));
                if (matchingPhrase && !valinnat[matchingPhrase.id]) {
                    handleTogglePhrase(matchingPhrase.id, true);
                }
                handledSignals.current.add(key); 
            }
        });
        // eslint-disable-next-line
    }, [activeSignals, dbPhrases]);

    const activeServices = useMemo(() => loadedServices.filter(service => valinnat[service.id]), [loadedServices, valinnat]);
    const hardServices = activeServices.filter(s => s.hard_service);
    const referralServices = activeServices.filter(s => s.requires_referral);

    const generatedText = useMemo(() => {
        const activePhrases = dbPhrases.filter(phrase => valinnat[phrase.id]);
        activePhrases.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));

        const tyokokeiluKesto = state.palkkatuki?.tyokokeilu_kesto_kk || 'X';
        const phraseTexts = activePhrases.map(phrase => phrase.teksti.replace(/\[KESTO_KK\]/g, tyokokeiluKesto));
        const serviceTexts = activeServices.map(service => service.plan_text);

        let finalTexts = [...phraseTexts, ...serviceTexts];

        if (hardServices.length > 0) {
            const hardTitles = hardServices.map(s => s.title).join(' ja ');
            finalTexts.push(`HUOMIO: Asiakkaalle on suunnitelmassa asetettu velvoittava palvelu (${hardTitles}). Palvelusta kieltäytyminen tai sen keskeyttäminen ilman pätevää syytä voi johtaa työttömyysturvalain mukaiseen seuraamukseen. Työnhakuvelvollisuutta voidaan mahdollisesti alentaa palvelun keston ajaksi.`);
        }

        const jatkuvatPalvelut = (state.services || []).filter(s => ['alkanut', 'ohjattu'].includes(s.tila?.toLowerCase()));
        if (jatkuvatPalvelut.length > 0 && buildKokoPalveluhistoriaText) {
            finalTexts.push(`Asiakas jatkaa aiemmin sovituissa palveluissa:\n${buildKokoPalveluhistoriaText(jatkuvatPalvelut)}`);
        }

        return finalTexts.join('\n\n');
    }, [dbPhrases, valinnat, state.palkkatuki, activeServices, hardServices, state.services, buildKokoPalveluhistoriaText]);

    const handleMoveText = () => {
        if (!generatedText) return;
        const combinedText = customText ? `${generatedText}\n\n${customText}` : generatedText;
        actions.onUpdateCustomText(UI_KEY, combinedText);
    };

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
            <h2 className="icon-heading">
                <CheckSquare size={28} className="text-primary" /> 
                Työllistymissuunnitelman kokoaminen
            </h2>

            <div className="mb-6">
                <Tyonhakuprofiili state={state} actions={actions} />
            </div>

            {/* KOMPONENTOITU RATKAISUKESKUS */}
            <SmartSuggestionBox 
                activeSignals={activeSignals}
                dbPhrases={dbPhrases}
                onTogglePath={handleTogglePath}
            />

            <div className="mb-6">
                <Palveluohjaus state={state} actions={actions} onServicesLoaded={setLoadedServices} />
            </div>

            {hardServices.length > 0 && (
                <div className="mb-6">
                    <AlertBox variant="warning" icon={AlertTriangle} title="Velvoittava palvelu valittu">
                        Olet valinnut asiakkaalle velvoittavan palvelun. Palvelusta kieltäytyminen ilman pätevää syytä voi johtaa työttömyysturvalain mukaiseen seuraamukseen.
                    </AlertBox>
                </div>
            )}

            {referralServices.length > 0 && (
                <Card variant="info" title="Generoitavat lähetteet ammattilaisille" icon={UserPlus} className="mb-6">
                    <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Valitsemasi palvelut vaativat tarkan lähetteen. Järjestelmä on tuonut pohjalle automaattisesti 33 § -edellytysten arvion pohjatiedoksi.
                    </p>

                    {referralServices.map(s => {
                        const refKey = `lahete_${s.id}`;
                        const edellytyksetText = state['custom-edellytykset'] ? state['custom-edellytykset'] : 'Tietoa ei kirjattu 33 § -osioon.';
                        const defaultText = `TAUSTATIEDOT JA LÄHTÖTILANNE (33 § ARVIO):\n----------------------------------------\n${edellytyksetText}\n\nASIANTUNTIJAN KYSYMYS TAI TILAUS PALVELUNTUOTTAJALLE:\n----------------------------------------\n`;
                        const currentRefText = state[`custom-${refKey}`] !== undefined ? state[`custom-${refKey}`] : defaultText;

                        return (
                            <div key={s.id} className="card-inner-sm mb-6">
                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s.title}</span>
                                    <span className="tag tag--warning">Tilaus/Lähete</span>
                                </h4>
                                <textarea 
                                    className="text-mono" 
                                    rows="8" 
                                    value={currentRefText} 
                                    onChange={(e) => actions.onUpdateCustomText(refKey, e.target.value)} 
                                />
                            </div>
                        );
                    })}
                </Card>
            )}

            <div className="mb-6">
                <h3 className="icon-heading">Käsiohjaus (Kaikki toimenpiteet)</h3>
                
                <div className="flex-col-gap">
                    {Object.entries(groupedPhrases).map(([group, phrases]) => {
                        const hasSelections = phrases.some(phrase => valinnat[phrase.id]);

                        return (
                            <div key={group} className="card-inner" style={{ padding: '0.5rem 1.5rem' }}>
                                <Accordion 
                                    title={<span style={{ textTransform: 'capitalize', fontSize: '1.1rem' }}>{group.replace(/_/g, ' ')}</span>}
                                    defaultOpen={hasSelections}
                                >
                                    <div className="grid-cols-2-tight" style={{ marginTop: '0.5rem' }}>
                                        {phrases.map(phrase => (
                                            <Checkbox 
                                                key={phrase.id}
                                                label={phrase.lyhenne}
                                                checked={!!valinnat[phrase.id]} 
                                                onChange={(isChecked) => handleTogglePhrase(phrase.id, isChecked)} 
                                            />
                                        ))}
                                    </div>
                                </Accordion>
                            </div>
                        );
                    })}
                </div>
            </div>

            <SmartTextPreview 
                title="Suunnitelmaluonnos"
                text={generatedText}
                onMoveText={handleMoveText}
            />

            <div className="custom-text-container">
                <label htmlFor="suunnitelma-custom-text" className="icon-label">
                    Omat lisäykset ja tarkennukset
                </label>
                <p className="stat-label">Tämä teksti tulostuu lopulliseen suunnitelmaan</p>
                <textarea 
                    id="suunnitelma-custom-text" 
                    rows="8" 
                    value={customText} 
                    onChange={(e) => actions.onUpdateCustomText(UI_KEY, e.target.value)} 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    style={{ marginTop: '0.5rem', fontFamily: 'var(--font-sans)', lineHeight: '1.6' }}
                />
            </div>
        </div>
    );
};

export default Suunnitelma;