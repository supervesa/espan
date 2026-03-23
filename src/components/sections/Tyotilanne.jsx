import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { PhraseOption } from '../PhraseOption';

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

// Pakottaa päivämäärän aina YYYY-MM-DD -muotoon muita komponentteja varten
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

const Tyotilanne = ({ state, actions, planData, knowledgeData }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyotilanne');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const sectionId = sectionData?.id; 
    const currentSectionState = state[sectionId] || {};

    // --- TILANHALLINTA ---
    const [serviceDates, setServiceDates] = useState({ start: "", end: "" });
    const [calculations, setCalculations] = useState({ duration: 0, remaining: 0 });
    const [pasteArea, setPasteArea] = useState("");
    const isCommitting = useRef(false);

    // --- PAIKALLINEN LASKENTA (Ei ikiliikkujaa!) ---
    const updateLocalCalculations = useCallback((start, end) => {
        // Jos jompikumpi päivämäärä puuttuu, nollataan kiltisti
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

    // --- SYNKRONOINTI GLOBAALISTA TILASTA ---
    useEffect(() => {
        if (!isCommitting.current) {
            // Muunnetaan globaalin tilan ehkä rikkinäinen data heti oikeaan muotoon
            const alk = toISODate(currentSectionState.palvelu_alku);
            const lop = toISODate(currentSectionState.palvelu_loppu);
            
            setServiceDates({ start: alk, end: lop });
            updateLocalCalculations(alk, lop);
        }
    }, [currentSectionState.palvelu_alku, currentSectionState.palvelu_loppu, updateLocalCalculations]);

    // --- TALLENNUS GLOBAALIIN TILAAN (Lähettää dataa eteenpäin) ---
    const commitDates = (start, end) => {
        isCommitting.current = true;
        
        // Varmistetaan, että globaaliin tilaan menee AINA standardoitu YYYY-MM-DD
        const safeStart = toISODate(start);
        const safeEnd = toISODate(end);

        onUpdateVariable(sectionId, 'palvelu_alku', safeStart);
        onUpdateVariable(sectionId, 'palvelu_loppu', safeEnd);

        // Päivitetään numerot heti, vaikka toinen pvm puuttuisi (nollaa laskurin)
        const { durationDays, daysUntilEnd } = updateLocalCalculations(safeStart, safeEnd);

        if (safeStart && safeEnd) {
            const s = new Date(safeStart);
            const e = new Date(safeEnd);
            const startFi = s.toLocaleDateString('fi-FI');
            const endFi = e.toLocaleDateString('fi-FI');
            
            // Signaalit muille (THV ja Aikatauluavustaja näkevät nämä)
            onUpdateVariable(sectionId, 'palvelu_yli_1kk', durationDays >= 30);
            onUpdateVariable(sectionId, 'palvelu_paattymassa_1kk', daysUntilEnd <= 31 && daysUntilEnd > 0);

            // Tulosteen teksti
            let printText = `. Palvelun ajankohta: ${startFi}–${endFi}.`;
            if (durationDays >= 30) {
                printText += ` Kyseessä on yli kuukauden kestävä palvelu (46 §).`;
            }
            onUpdateCustomText(sectionId, printText);
        } else {
            // Siivous, jos loppupäivä tai alkupäivä poistetaan
            onUpdateCustomText(sectionId, "");
            onUpdateVariable(sectionId, 'palvelu_yli_1kk', false);
            onUpdateVariable(sectionId, 'palvelu_paattymassa_1kk', false);
        }

        setTimeout(() => {
            isCommitting.current = false;
        }, 800);
    };

    const handleDateChange = (type, value) => {
        const newDates = { ...serviceDates, [type]: value };
        setServiceDates(newDates);
        commitDates(newDates.start, newDates.end);
    };

    // --- KORJATTU COPY-PASTE TOIMINTO ---
    const handlePasteChange = (val) => {
        setPasteArea(val);
        const rangeMatch = val.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        
        if (rangeMatch) {
            // Nyt syötetään tekstit sellaisenaan toISODate:lle (joka kutsuu parseFinnishDatea turvallisesti)
            const s = toISODate(rangeMatch[1]);
            const e = toISODate(rangeMatch[2]);

            if (s && e) {
                setServiceDates({ start: s, end: e });
                commitDates(s, e);
                setPasteArea(""); 
            }
        }
    };

    // --- A-TMT LOGIIKKA ---
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
        const selectedKeys = Object.keys(currentSectionState).filter(k => currentSectionState[k] === true);
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

    if (!sectionData) return null;

    const showsServiceBox = currentSectionState.palkkatuki || currentSectionState.tyokokeilu || currentSectionState.tyovoimakoulutus;

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            
            <div className="options-container">
                {sectionData.fraasit.map(phrase => (
                    <PhraseOption
                        key={phrase.avainsana}
                        phrase={phrase}
                        section={sectionData}
                        isSelected={currentSectionState[phrase.avainsana]}
                        onSelect={onSelect}
                        onUpdateVariable={onUpdateVariable}
                    />
                ))}
            </div>

            {showsServiceBox && (
                <div className="subsection" style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                    <h3 className="subsection-title">Palvelun ajankohta (46 §)</h3>
                    
                    {/* LISÄTTY LINTER-YHTEENSOPIVAT ID:T */}
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

                    {/* LASKURI AINA NÄKYVISSÄ, piilotusehdot revitty pois */}
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
                <label htmlFor={`custom-text-${sectionId}`}>Suunnitelmaan tulostuva teksti:</label>
                <textarea
                    id={`custom-text-${sectionId}`}
                    rows="3"
                    className="form-input"
                    value={state[`custom-${sectionId}`] || ''}
                    onChange={(e) => onUpdateCustomText(sectionId, e.target.value)}
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