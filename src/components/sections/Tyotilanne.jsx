// --- src/components/sections/Tyotilanne.jsx ---
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import { planData } from '../../data/planData';
import { Wand2, Sparkles, Briefcase, CalendarClock } from 'lucide-react'; 
import UraAnalyzerModal from './UraAnalyzerModal';

// Tuodaan siirretyt päivämäärätyökalut:
import { parseFinnishDate, toISODate, calculateMonthsDifference } from '../../utils/dateUtils';

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const currentSectionState = state[UI_KEY] || {};

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pasteArea, setPasteArea] = useState("");

    const [serviceDates, setServiceDates] = useState({
        start: currentSectionState.palvelu_alku || state.asiakas?.palvelu_alku || "",
        end: currentSectionState.palvelu_loppu || state.asiakas?.palvelu_loppu || ""
    });

    const transformVariables = (varsArray) => {
        if (!varsArray || !Array.isArray(varsArray) || varsArray.length === 0) return null;
        const transformed = varsArray.reduce((acc, curr) => {
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
        return Object.keys(transformed).length > 0 ? transformed : null;
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
                        const exists = sectionInPlanData.fraasit.find(f => f.avainsana === dbPhrase.phrase_key);
                        if (!exists) {
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
                console.error("Virhe Tyotilanne-haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const calculations = useMemo(() => {
        if (!serviceDates.start || !serviceDates.end) return { duration: 0, remaining: 0, yli1kk: false, paattymassa1kk: false };
        const s = new Date(serviceDates.start);
        const e = new Date(serviceDates.end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const durationDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
        const daysUntilEnd = Math.ceil((e - today) / (1000 * 60 * 60 * 24));
        
        return {
            duration: durationDays,
            remaining: daysUntilEnd,
            yli1kk: durationDays >= 30,
            paattymassa1kk: daysUntilEnd <= 31 && daysUntilEnd > 0
        };
    }, [serviceDates]);


    // === RADIOLÄHETIN ===
    useEffect(() => {
        if (serviceDates.start && serviceDates.end) {
            let palveluTyyppi = "tuntematon";
            if (currentSectionState.tyokokeilu) palveluTyyppi = "tyokokeilu";
            if (currentSectionState.palkkatuki) palveluTyyppi = "palkkatuki";
            if (currentSectionState.tyovoimakoulutus) palveluTyyppi = "tyovoimakoulutus";

            const payload = {
                alku: serviceDates.start,
                loppu: serviceDates.end,
                tyyppi: palveluTyyppi
            };
            window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { detail: payload }));
        }
    }, [serviceDates.start, serviceDates.end, currentSectionState.tyokokeilu, currentSectionState.palkkatuki, currentSectionState.tyovoimakoulutus]);


    const handleDateChange = (type, value) => {
        setServiceDates(prev => ({ ...prev, [type]: value }));
        
        const key = type === 'start' ? 'palvelu_alku' : 'palvelu_loppu';
        onUpdateVariable(UI_KEY, key, value);
        if (typeof actions.onUpdateAsiakas === 'function') {
            actions.onUpdateAsiakas(key, value);
        }
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

    const aTmtGuide = useMemo(() => {
        const guide = {};
        if (knowledgeData) {
            knowledgeData.filter(k => k.category === 'A-TMT Ohjeet').forEach(item => {
                guide[item.phrase_key || item.title] = {
                    aTmtStatus: item.metadata?.aTmtStatus,
                    description: item.content_text,
                    priority: item.metadata?.priority || 0
                };
            });
        }
        return guide;
    }, [knowledgeData]);

    const aTmtRecommendation = useMemo(() => {
        const selectedKeys = Object.keys(currentSectionState).filter(k => 
            currentSectionState[k] === true || (typeof currentSectionState[k] === 'object' && currentSectionState[k] !== null)
        );
        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        let highestPriority = -1;
        let recommendedKey = null;

        selectedKeys.forEach(key => {
            const guide = aTmtGuide[key];
            if (guide && guide.priority > highestPriority) {
                highestPriority = guide.priority;
                recommendedKey = key;
            }
        });

        return {
            status: aTmtGuide[recommendedKey]?.aTmtStatus || "Ei määritetty",
            months: calculateMonthsDifference(tyonhakuAlkanut)
        };
    }, [currentSectionState, state.suunnitelman_perustiedot, aTmtGuide]);


    const escoNimi = state.asiakas?.tavoiteammatti_esco_nimi; 
    const tkHistoria = state.palkkatuki?.tyokokeilu_historia;
    
    if (loading) return <div className="section-container">Ladataan työtilannetta...</div>;

    const showsServiceBox = currentSectionState.palkkatuki || currentSectionState.tyokokeilu || currentSectionState.tyovoimakoulutus;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title thv-section-title">Asiakkaan työtilanne</h2>
                <button 
                    className="btn-ai" 
                    onClick={() => setIsAnalyzerOpen(true)}
                >
                    <Wand2 size={16} /> Tuo ja analysoi URA-historia
                </button>
            </div>

            {(escoNimi || tkHistoria) && (
                <div className="panel-gray" style={{ backgroundColor: 'var(--color-ai-bg)', borderColor: 'var(--color-ai-border)', animation: 'fadeIn 0.3s ease-out' }}>
                    <label className="icon-label" style={{ marginBottom: '1rem' }}>
                        <Sparkles size={18} color="var(--color-ai)" /> AI-analyysin tulokset (URA-historia)
                    </label>

                    <div className="grid-cols-2-tight">
                        {escoNimi && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}>
                                    <Briefcase size={14} /> Tavoiteammatti (ESCO)
                                </label>
                                <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{escoNimi}</span>
                            </div>
                        )}

                        {tkHistoria && (
                            <div className="card-inner-sm">
                                <label className="icon-label" style={{ fontSize: '0.8rem', color: 'var(--color-info-text)', marginBottom: '0.25rem' }}>
                                    <CalendarClock size={14} /> Työkokeilut
                                </label>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-info-dark)' }}>
                                    Siirretty {tkHistoria.split('\n').filter(l => l.trim().length > 0).length} jaksoa Palkkatukilaskuriin!
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="options-container">
                {phrases.map(phrase => (
                    <PhraseOption
                        key={phrase.id}
                        phrase={{
                            ...phrase,
                            avainsana: phrase.phrase_key,
                            teksti: phrase.base_text,
                            lyhenne: phrase.short_title,
                            muuttujat: transformVariables(phrase.variables)
                        }}
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
                        <input 
                            id="paste-dates"
                            type="text" 
                            className="modern-select text-mono"
                            placeholder="Liitä päivämääräväli tähän..."
                            value={pasteArea}
                            onChange={(e) => handlePasteChange(e.target.value)}
                        />
                    </div>

                    <div className="grid-cols-2-tight">
                        <div>
                            <label htmlFor="palvelu-alkaa" className="stat-label">Alkaa:</label>
                            <input 
                                id="palvelu-alkaa"
                                type="date" 
                                className="modern-select" 
                                value={serviceDates.start} 
                                onChange={(e) => handleDateChange('start', e.target.value)} 
                            />
                        </div>
                        <div>
                            <label htmlFor="palvelu-paattyy" className="stat-label">Päättyy:</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    id="palvelu-paattyy"
                                    type="date" 
                                    className="modern-select" 
                                    value={serviceDates.end} 
                                    onChange={(e) => handleDateChange('end', e.target.value)} 
                                />
                                {serviceDates.end && (
                                    <button className="btn-clear" onClick={() => handleDateChange('end', "")} title="Tyhjennä päättymispäivä">X</button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card-inner" style={{ marginTop: '1.5rem', padding: '1rem' }}>
                        <div className="smart-analysis-grid">
                            <div className="smart-analysis-column">
                                <p className="smart-analysis-title">PALVELUN KESTO</p>
                                <strong className="stat-value">{calculations.duration} päivää</strong>
                                <span className={`stat-label ${calculations.duration >= 30 ? 'text-success' : ''}`}>
                                    {calculations.duration >= 30 ? "✓ Yli 1 kk (32 § poikkeus)" : "Alle 1 kk"}
                                </span>
                            </div>
                            <div className="smart-analysis-column">
                                <p className="smart-analysis-title">PÄÄTTYMISEEN</p>
                                <strong className={`stat-value ${calculations.remaining <= 31 && calculations.remaining > 0 ? 'text-danger' : ''}`}>
                                    {calculations.remaining} päivää
                                </strong>
                                <span className="stat-label">
                                    {calculations.remaining <= 31 && calculations.remaining > 0 ? "⚠️ Varaa 46 § työnhakukeskustelu!" : "Sykli normaali"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="custom-text-container">
                <label htmlFor={`custom-text-${UI_KEY}`} className="stat-label">Vapaat lisätiedot:</label>
                <textarea
                    id={`custom-text-${UI_KEY}`}
                    rows="3"
                    className="form-input"
                    value={state[`custom-${UI_KEY}`] || ''}
                    onChange={(e) => onUpdateCustomText(UI_KEY, e.target.value)}
                    placeholder="Kirjaa tähän mahdolliset lisätiedot..."
                />
            </div>

            <div className="guidance-box a-tmt-guidance">
                <p>A-TMT suositus: <strong className="recommended-status">{aTmtRecommendation.status}</strong> ({aTmtRecommendation.months} kk)</p>
            </div>
            
<UraAnalyzerModal 
                isOpen={isAnalyzerOpen} 
                onClose={() => setIsAnalyzerOpen(false)} 
                actions={actions} 
                state={state} 
            />
            
        </section>
    );
};

export default Tyotilanne;