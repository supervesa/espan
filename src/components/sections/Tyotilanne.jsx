// --- src/components/sections/Tyotilanne.jsx ---
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import { planData } from '../../data/planData'; // LISÄTTY: Tuodaan planData injektiota varten

// --- APUFUNKTIOT PÄIVÄMÄÄRILLE ---
const parseFinnishDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (s.includes('T')) return new Date(s);
    if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return null;
};

const toISODate = (val) => {
    const d = parseFinnishDate(val);
    if (!d || isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const calculateMonthsDifference = (startDate) => {
    if (!startDate) return 0;
    const start = parseFinnishDate(startDate);
    if (!start) return 0;
    const now = new Date();
    const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, diff);
};

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const currentSectionState = state[UI_KEY] || {};

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

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

                // --- TAIKATEMPPU: INJEKTOIDAAN UUDET FRAASIT PLANDATAAN ---
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
                // --------------------------------------------------------

                setPhrases(enrichedPhrases);
            } catch (err) {
                console.error("Virhe Tyotilanne-haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- TILANHALLINTA PÄIVÄMÄÄRILLE ---
    const [serviceDates, setServiceDates] = useState({ start: "", end: "" });
    const [calculations, setCalculations] = useState({ duration: 0, remaining: 0 });
    const [pasteArea, setPasteArea] = useState("");
    const isCommitting = useRef(false);

    const updateLocalCalculations = useCallback((start, end) => {
        if (!start || !end) {
             setCalculations({ duration: 0, remaining: 0 });
             return { durationDays: 0, daysUntilEnd: 0 };
        }
        const s = new Date(start);
        const e = new Date(end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const durationDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
        const daysUntilEnd = Math.ceil((e - today) / (1000 * 60 * 60 * 24));

        setCalculations({ duration: durationDays, remaining: daysUntilEnd });
        return { durationDays, daysUntilEnd };
    }, []);

    useEffect(() => {
        if (!isCommitting.current) {
            const alk = toISODate(currentSectionState.palvelu_alku);
            const lop = toISODate(currentSectionState.palvelu_loppu);
            setServiceDates({ start: alk, end: lop });
            updateLocalCalculations(alk, lop);
        }
    }, [currentSectionState.palvelu_alku, currentSectionState.palvelu_loppu, updateLocalCalculations]);

    const commitDates = (start, end) => {
        isCommitting.current = true;
        const safeStart = toISODate(start);
        const safeEnd = toISODate(end);

        onUpdateVariable(UI_KEY, 'palvelu_alku', safeStart);
        onUpdateVariable(UI_KEY, 'palvelu_loppu', safeEnd);

        const { durationDays, daysUntilEnd } = updateLocalCalculations(safeStart, safeEnd);

        if (safeStart && safeEnd) {
            const s = new Date(safeStart);
            const e = new Date(safeEnd);
            const startFi = s.toLocaleDateString('fi-FI');
            const endFi = e.toLocaleDateString('fi-FI');
            
            onUpdateVariable(UI_KEY, 'palvelu_yli_1kk', durationDays >= 30);
            onUpdateVariable(UI_KEY, 'palvelu_paattymassa_1kk', daysUntilEnd <= 31 && daysUntilEnd > 0);

            let printText = `. Palvelun ajankohta: ${startFi}–${endFi}.`;
            if (durationDays >= 30) printText += ` Kyseessä on yli kuukauden kestävä palvelu (46 §).`;
            onUpdateCustomText(UI_KEY, printText);
        } else {
            onUpdateCustomText(UI_KEY, "");
            onUpdateVariable(UI_KEY, 'palvelu_yli_1kk', false);
            onUpdateVariable(UI_KEY, 'palvelu_paattymassa_1kk', false);
        }
        setTimeout(() => { isCommitting.current = false; }, 800);
    };

    const handleDateChange = (type, value) => {
        const newDates = { ...serviceDates, [type]: value };
        setServiceDates(newDates);
        commitDates(newDates.start, newDates.end);
    };

    const handlePasteChange = (val) => {
        setPasteArea(val);
        const rangeMatch = val.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (rangeMatch) {
            const s = toISODate(rangeMatch[1]);
            const e = toISODate(rangeMatch[2]);
            if (s && e) {
                setServiceDates({ start: s, end: e });
                commitDates(s, e);
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

    if (loading) return <div className="section-container">Ladataan työtilannetta...</div>;

    const showsServiceBox = currentSectionState.palkkatuki || currentSectionState.tyokokeilu || currentSectionState.tyovoimakoulutus;

    return (
        <section className="section-container">
            <h2 className="section-title">Asiakkaan työtilanne</h2>
            
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
                <div className="subsection" style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                    <h3 className="subsection-title">Palvelun ajankohta (46 §)</h3>
                    
                    <div className="info-row" style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="paste-dates">Pikasyöttö (Liitä esim. 1.1.2025-30.6.2025):</label>
                        <input 
                            id="paste-dates"
                            type="text" 
                            className="modern-select"
                            placeholder="Liitä päivämääräväli tähän..."
                            value={pasteArea}
                            onChange={(e) => handlePasteChange(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label htmlFor="palvelu-alkaa">Alkaa:</label>
                            <input 
                                id="palvelu-alkaa"
                                type="date" 
                                className="modern-select" 
                                value={serviceDates.start} 
                                onChange={(e) => handleDateChange('start', e.target.value)} 
                            />
                        </div>
                        <div>
                            <label htmlFor="palvelu-paattyy">Päättyy:</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    id="palvelu-paattyy"
                                    type="date" 
                                    className="modern-select" 
                                    value={serviceDates.end} 
                                    onChange={(e) => handleDateChange('end', e.target.value)} 
                                />
                                {serviceDates.end && (
                                    <button className="btn--secondary" onClick={() => handleDateChange('end', "")} style={{ color: 'var(--color-danger)', padding: '0 10px' }}>X</button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="smart-analysis-box" style={{ marginTop: '1.5rem', backgroundColor: '#ffffff', border: '1px solid var(--color-border)' }}>
                        <div className="smart-analysis-grid" style={{ padding: '10px' }}>
                            <div className="smart-analysis-column">
                                <p className="smart-analysis-title">PALVELUN KESTO</p>
                                <strong>{calculations.duration} päivää</strong>
                                <span style={{ fontSize: '0.8rem', color: calculations.duration >= 30 ? 'var(--color-success)' : 'inherit', display: 'block' }}>
                                    {calculations.duration >= 30 ? "✓ Yli 1 kk (32 § poikkeus)" : "Alle 1 kk"}
                                </span>
                            </div>
                            <div className="smart-analysis-column" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
                                <p className="smart-analysis-title">PÄÄTTYMISEEN</p>
                                <strong style={{ color: calculations.remaining <= 31 && calculations.remaining > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                    {calculations.remaining} päivää
                                </strong>
                                <span style={{ fontSize: '0.8rem', display: 'block' }}>
                                    {calculations.remaining <= 31 && calculations.remaining > 0 ? "⚠️ Varaa 46 § työnhakukeskustelu!" : "Sykli normaali"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="custom-text-container" style={{ marginTop: '1.5rem' }}>
                <label htmlFor={`custom-text-${UI_KEY}`}>Suunnitelmaan tulostuva teksti:</label>
                <textarea
                    id={`custom-text-${UI_KEY}`}
                    rows="3"
                    className="form-input"
                    value={state[`custom-${UI_KEY}`] || ''}
                    onChange={(e) => onUpdateCustomText(UI_KEY, e.target.value)}
                    placeholder="Päivämäärät ilmestyvät tänne automaattisesti..."
                />
            </div>

            <div className="guidance-box a-tmt-guidance" style={{ marginTop: '1.5rem' }}>
                <p>A-TMT suositus: <strong>{aTmtRecommendation.status}</strong> ({aTmtRecommendation.months} kk)</p>
            </div>
        </section>
    );
};

export default Tyotilanne;