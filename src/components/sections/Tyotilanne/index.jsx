// --- src/components/sections/Tyotilanne/index.jsx ---
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { PhraseOption } from '../../PhraseOption';
import { planData } from '../../../data/planData';
import { Wand2, Sparkles, Briefcase, CalendarClock, Layers } from 'lucide-react'; 
import UraAnalyzer from './UraAnalyzer'; 
import TyotilanneNotes from './TyotilanneNotes';
import ATmtGuidance from './ATmtGuidance';
import { toISODate } from '../../../utils/dateUtils';

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const currentSectionState = state[UI_KEY] || {};

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pasteArea, setPasteArea] = useState("");

    // APUFUNKTIO: Varmistaa että päivämäärä on aina YYYY-MM-DD
    const ensureISO = (dateStr) => {
        if (!dateStr) return "";
        return dateStr.includes('.') ? toISODate(dateStr) : dateStr;
    };

    const [serviceDates, setServiceDates] = useState({
        start: ensureISO(currentSectionState.palvelu_alku || state.asiakas?.palvelu_alku),
        end: ensureISO(currentSectionState.palvelu_loppu || state.asiakas?.palvelu_loppu)
    });

    useEffect(() => {
        if (state.asiakas?.palvelu_alku || state.asiakas?.palvelu_loppu) {
            setServiceDates({
                start: ensureISO(state.asiakas?.palvelu_alku),
                end: ensureISO(state.asiakas?.palvelu_loppu)
            });
        }
    }, [state.asiakas?.palvelu_alku, state.asiakas?.palvelu_loppu]);

    const transformVariables = (varsArray) => {
        if (!varsArray || !Array.isArray(varsArray) || varsArray.length === 0) return null;
        return varsArray.reduce((acc, curr) => {
            let parsedOptions = [];
            try {
                if (curr.options) {
                    parsedOptions = JSON.parse(curr.options);
                    if (typeof parsedOptions === 'string') parsedOptions = JSON.parse(parsedOptions);
                }
            } catch (e) {}
            acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: curr.default_value, vaihtoehdot: parsedOptions };
            return acc;
        }, {});
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_TYOTILANNE).order('created_at'),
                    supabase.from('variables').select('*')
                ]);

                if (phrasesRes.error) throw phrasesRes.error;

                const enrichedPhrases = (phrasesRes.data || []).map(phrase => ({
                    ...phrase,
                    variables: (varsRes.data || []).filter(v => v.phrase_id === phrase.id)
                }));

                const sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
                if (sectionInPlanData) {
                    enrichedPhrases.forEach(dbPhrase => {
                        if (!sectionInPlanData.fraasit.find(f => f.avainsana === dbPhrase.phrase_key)) {
                            sectionInPlanData.fraasit.push({
                                avainsana: dbPhrase.phrase_key,
                                teksti: dbPhrase.base_text,
                                lyhenne: dbPhrase.short_title,
                                muuttujat: transformVariables(dbPhrase.variables)
                            });
                        }
                    });
                }
                setPhrases(enrichedPhrases);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const dynamicKeys = useMemo(() => ({
        tyokokeilu: phrases.find(p => p.teksti?.toLowerCase().includes('työkokeilu'))?.avainsana,
        palkkatuki: phrases.find(p => p.teksti?.toLowerCase().includes('palkkatuki'))?.avainsana,
        tyovoimakoulutus: phrases.find(p => p.teksti?.toLowerCase().includes('työvoimakoulutus') || p.teksti?.toLowerCase().includes('työvoimakoulutukseen'))?.avainsana
    }), [phrases]);

    const hasTyokokeilu = useMemo(() => Object.keys(currentSectionState).some(k => 
        (k.includes('tyokokeilu') || (dynamicKeys.tyokokeilu && k === dynamicKeys.tyokokeilu)) && currentSectionState[k]
    ), [currentSectionState, dynamicKeys]);

    const hasPalkkatuki = useMemo(() => Object.keys(currentSectionState).some(k => 
        (k.includes('palkkatuki') || (dynamicKeys.palkkatuki && k === dynamicKeys.palkkatuki)) && currentSectionState[k]
    ), [currentSectionState, dynamicKeys]);

    const hasTyovoimakoulutus = useMemo(() => Object.keys(currentSectionState).some(k => 
        (k.includes('tyovoimakoulutus') || (dynamicKeys.tyovoimakoulutus && k === dynamicKeys.tyovoimakoulutus)) && currentSectionState[k]
    ), [currentSectionState, dynamicKeys]);

    const calculations = useMemo(() => {
        if (!serviceDates.start || !serviceDates.end) return { duration: 0, remaining: 0 };
        const s = new Date(serviceDates.start);
        const e = new Date(serviceDates.end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
            duration: Math.ceil((e - s) / (1000 * 60 * 60 * 24)),
            remaining: Math.ceil((e - today) / (1000 * 60 * 60 * 24))
        };
    }, [serviceDates]);

    const updateServiceText = (startStr, endStr) => {
        const safeStart = toISODate(startStr);
        const safeEnd = toISODate(endStr);
        let currentText = state[`custom-${UI_KEY}`] || '';
        
        currentText = currentText.replace(/Asiakkaan työtilanne\s*\n\s*Asiakas on (työkokeilussa|palkkatuetussa työssä|opiskelee työvoimakoulutuksessa)\.?/gi, '');
        currentText = currentText.replace(/(?:^|\n)Asiakas on (työkokeilussa|palkkatuetussa työssä|opiskelee työvoimakoulutuksessa)\.?/gi, '');

        const regex = /(?:\n\n)?Asiakas osallistuu (työllisyyttä edistävään palveluun|työkokeiluun|palkkatukityöhön|työvoimakoulutukseen) ajalla \d{1,2}\.\d{1,2}\.\d{4}–\d{1,2}\.\d{1,2}\.\d{4}\.( Kyseessä on yli kuukauden kestävä palvelu \(46 §\)\.)?/g;

        if (safeStart && safeEnd) {
            const s = new Date(safeStart);
            const e = new Date(safeEnd);
            const durationDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
            
            onUpdateVariable(UI_KEY, 'palvelu_yli_1kk', durationDays >= 30);

            let palvelunNimi = "työllisyyttä edistävään palveluun";
            if (hasTyokokeilu) palvelunNimi = "työkokeiluun";
            else if (hasPalkkatuki) palvelunNimi = "palkkatukityöhön";
            else if (hasTyovoimakoulutus) palvelunNimi = "työvoimakoulutukseen";
            
            let printText = `Asiakas osallistuu ${palvelunNimi} ajalla ${s.toLocaleDateString('fi-FI')}–${e.toLocaleDateString('fi-FI')}.`;
            if (durationDays >= 30) printText += ` Kyseessä on yli kuukauden kestävä palvelu (46 §).`;
            
            let updatedText = currentText;
            if (regex.test(currentText)) {
                updatedText = currentText.replace(regex, printText);
            } else {
                updatedText = currentText ? `${currentText}\n\n${printText}` : printText;
            }
            
            updatedText = updatedText.replace(/\n{3,}/g, '\n\n').trim();

            if (state[`custom-${UI_KEY}`] !== updatedText) onUpdateCustomText(UI_KEY, updatedText);
        } else {
            onUpdateVariable(UI_KEY, 'palvelu_yli_1kk', false);
            let updatedText = currentText.replace(regex, '').trim();
            updatedText = updatedText.replace(/\n{3,}/g, '\n\n').trim();
            if (state[`custom-${UI_KEY}`] !== updatedText) onUpdateCustomText(UI_KEY, updatedText);
        }
    };

    const lastDispatched = useRef("");

    useEffect(() => {
        updateServiceText(serviceDates.start, serviceDates.end);
        if (serviceDates.start && serviceDates.end) {
            let pTyyppi = hasTyokokeilu ? "tyokokeilu" : hasPalkkatuki ? "palkkatuki" : hasTyovoimakoulutus ? "tyovoimakoulutus" : "tuntematon";
            const payloadStr = JSON.stringify({ alku: serviceDates.start, loppu: serviceDates.end, tyyppi: pTyyppi });
            if (lastDispatched.current !== payloadStr) {
                lastDispatched.current = payloadStr;
                window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { detail: JSON.parse(payloadStr) }));
            }
        }
    }, [serviceDates.start, serviceDates.end, hasTyokokeilu, hasPalkkatuki, hasTyovoimakoulutus]);

    const handleDateChange = (type, value) => {
        const newDates = { ...serviceDates, [type]: value };
        setServiceDates(newDates);
        const key = type === 'start' ? 'palvelu_alku' : 'palvelu_loppu';
        onUpdateVariable(UI_KEY, key, value);
        if (typeof actions.onUpdateAsiakas === 'function') actions.onUpdateAsiakas(key, value);
    };

    const handlePasteChange = (val) => {
        setPasteArea(val);
        const rangeMatch = val.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (rangeMatch) {
            const s = toISODate(rangeMatch[1]);
            const e = toISODate(rangeMatch[2]);
            if (s && e) {
                setServiceDates({ start: s, end: e });
                onUpdateVariable(UI_KEY, 'palvelu_alku', s);
                onUpdateVariable(UI_KEY, 'palvelu_loppu', e);
                if (typeof actions.onUpdateAsiakas === 'function') {
                    actions.onUpdateAsiakas('palvelu_alku', s);
                    actions.onUpdateAsiakas('palvelu_loppu', e);
                }
                setPasteArea(""); 
            }
        }
    };

    const finescoAla = state.asiakas?.tavoiteammatti_finesco_ala;
    const escoNimi = state.asiakas?.tavoiteammatti_esco_nimi; 
    const tkHistoria = state.palkkatuki?.tyokokeilu_historia;
    
    if (loading) return <div className="section-container">Ladataan työtilannetta...</div>;

    const showsServiceBox = hasTyokokeilu || hasPalkkatuki || hasTyovoimakoulutus;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title thv-section-title">Asiakkaan työtilanne</h2>
                <button className="btn-ai" onClick={() => setIsAnalyzerOpen(true)}>
                    <Wand2 size={16} /> Tuo ja analysoi URA-historia
                </button>
            </div>

            {(finescoAla || escoNimi || tkHistoria) && (
                <div className="panel-gray" style={{ backgroundColor: 'var(--color-ai-bg)', borderColor: 'var(--color-ai-border)', animation: 'fadeIn 0.3s ease-out' }}>
                    <label className="icon-label" style={{ marginBottom: '1rem' }}><Sparkles size={18} color="var(--color-ai)" /> AI-analyysin tulokset (URA-historia)</label>
                    <div className="grid-cols-2-tight">
                        {finescoAla && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}><Layers size={14} /> Ammattiala (Finesco)</label>
                                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{finescoAla}</span>
                            </div>
                        )}
                        {escoNimi && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}><Briefcase size={14} /> Tavoiteammatti (ESCO)</label>
                                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{escoNimi}</span>
                            </div>
                        )}
                        {tkHistoria && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-info-text)', marginBottom: '0.25rem' }}><CalendarClock size={14} /> Työkokeilut</label>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-info-dark)' }}>Siirretty {tkHistoria.split('\n').filter(l => l.trim().length > 0).length} jaksoa Palkkatukilaskuriin!</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="options-container">
                {phrases.map(phrase => (
                    <PhraseOption
                        key={phrase.id}
                        phrase={{ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title, muuttujat: transformVariables(phrase.variables) }}
                        section={{ id: UI_KEY, monivalinta: true }}
                        isSelected={currentSectionState[phrase.phrase_key]}
                        onSelect={onSelect}
                        onUpdateVariable={onUpdateVariable}
                    />
                ))}
            </div>

            {showsServiceBox && (
                <div className="panel-gray">
                    <h3 className="subsection-title">Palvelun ajankohta (46 §)</h3>
                    <div className="flex-col-gap mb-6">
                        <label htmlFor="paste-dates" className="stat-label">Pikasyöttö (Liitä esim. 1.1.2025-30.6.2025):</label>
                        <input id="paste-dates" type="text" className="modern-select text-mono" placeholder="Liitä päivämääräväli tähän..." value={pasteArea} onChange={(e) => handlePasteChange(e.target.value)} />
                    </div>
                    <div className="grid-cols-2-tight">
                        <div>
                            <label htmlFor="palvelu-alkaa" className="stat-label">Alkaa:</label>
                            <input id="palvelu-alkaa" type="date" className="modern-select" value={serviceDates.start} onChange={(e) => handleDateChange('start', e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="palvelu-paattyy" className="stat-label">Päättyy:</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input id="palvelu-paattyy" type="date" className="modern-select" value={serviceDates.end} onChange={(e) => handleDateChange('end', e.target.value)} />
                                {serviceDates.end && <button className="btn-clear" onClick={() => handleDateChange('end', "")}>X</button>}
                            </div>
                        </div>
                    </div>
                    <div className="card-inner" style={{ marginTop: '1.5rem', padding: '1rem' }}>
                        <div className="smart-analysis-grid">
                            <div className="smart-analysis-column">
                                <p className="smart-analysis-title">PALVELUN KESTO</p>
                                <strong className="stat-value">{calculations.duration} päivää</strong>
                            </div>
                            <div className="smart-analysis-column">
                                <p className="smart-analysis-title">PÄÄTTYMISEEN</p>
                                <strong className={`stat-value ${calculations.remaining <= 31 && calculations.remaining > 0 ? 'text-danger' : ''}`}>{calculations.remaining} päivää</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <TyotilanneNotes 
                customText={state[`custom-${UI_KEY}`]} 
                onUpdateCustomText={onUpdateCustomText} 
                uiKey={UI_KEY} 
                actions={actions}
                dynamicKeys={dynamicKeys} 
                phrases={phrases} 
            />
            
            <ATmtGuidance currentSectionState={currentSectionState} state={state} knowledgeData={knowledgeData} />
            
            <UraAnalyzer 
                isOpen={isAnalyzerOpen} 
                onClose={() => setIsAnalyzerOpen(false)} 
                actions={actions} 
                state={state} 
                dynamicKeys={dynamicKeys} 
            />
        </section>
    );
};

export default Tyotilanne;