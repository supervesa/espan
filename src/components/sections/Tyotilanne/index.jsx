import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { PhraseOption } from '../../PhraseOption';
import { planData } from '../../../data/planData';
import { Wand2, Sparkles, Briefcase, CalendarClock, Layers } from 'lucide-react'; 
import UraAnalyzer from './UraAnalyzer'; 
import TyotilanneNotes from './TyotilanneNotes';
import { toISODate } from '../../../utils/dateUtils';

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const currentSectionState = state[UI_KEY] || {};

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const ensureISO = (val) => {
        if (!val || typeof val !== 'string') return "";
        return val.includes('.') ? toISODate(val) : val;
    };

    const [serviceDates, setServiceDates] = useState({
        start: String(currentSectionState.palvelu_alku || state.asiakas?.palvelu_alku || ""),
        end: String(currentSectionState.palvelu_loppu || state.asiakas?.palvelu_loppu || "")
    });

    useEffect(() => {
        setServiceDates({
            start: String(currentSectionState.palvelu_alku || state.asiakas?.palvelu_alku || ""),
            end: String(currentSectionState.palvelu_loppu || state.asiakas?.palvelu_loppu || "")
        });
    }, [currentSectionState.palvelu_alku, currentSectionState.palvelu_loppu, state.asiakas?.palvelu_alku]);

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('phrases').select('*').eq('section_id', DB_TYOTILANNE).order('created_at');
            if (data) setPhrases(data);
            setLoading(false);
        };
        fetchData();
    }, []);

    const hasService = useMemo(() => {
        return Object.keys(currentSectionState).some(k => 
            (k.includes('tyokokeilu') || k.includes('palkkatuki') || k.includes('tyovoimakoulutus')) && currentSectionState[k]
        );
    }, [currentSectionState]);

    useEffect(() => {
        if (serviceDates.start && serviceDates.end) {
            let currentText = state[`custom-${UI_KEY}`] || '';
            currentText = currentText.replace(/(?:^|\n)Asiakas osallistuu .*? ajalla .*?(?:\.|$)/gi, '');
            let printText = `Asiakas osallistuu palveluun ajalla ${serviceDates.start}–${serviceDates.end}.`;
            let updatedText = currentText ? `${currentText.trim()}\n\n${printText}` : printText;
            if (state[`custom-${UI_KEY}`] !== updatedText.trim()) onUpdateCustomText(UI_KEY, updatedText.trim());
            window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { detail: { loppu: serviceDates.end } }));
        }
    }, [serviceDates]);

    if (loading) return <div className="section-container">Ladataan...</div>;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title">Asiakkaan työtilanne</h2>
                <button className="btn-ai" onClick={() => setIsAnalyzerOpen(true)}><Wand2 size={16} /> URA-historia</button>
            </div>

            <div className="options-container">
                {phrases.map(phrase => (
                    <PhraseOption
                        key={phrase.id}
                        phrase={{ ...phrase, avainsana: phrase.phrase_key, teksti: phrase.base_text, lyhenne: phrase.short_title }}
                        section={{ id: UI_KEY, monivalinta: true }}
                        isSelected={currentSectionState[phrase.phrase_key]}
                        onSelect={onSelect}
                    />
                ))}
            </div>

            {hasService && (
                <div className="panel-gray" style={{ marginTop: '1.5rem' }}>
                    <h3 className="subsection-title">Palvelun ajankohta</h3>
                    <div className="grid-cols-2-tight">
                        <input type="text" className="modern-select" placeholder="Alkaa" value={serviceDates.start} onChange={e => {
                            setServiceDates(prev => ({ ...prev, start: e.target.value }));
                            onUpdateVariable(UI_KEY, 'palvelu_alku', e.target.value);
                        }} />
                        <input type="text" className="modern-select" placeholder="Päättyy" value={serviceDates.end} onChange={e => {
                            setServiceDates(prev => ({ ...prev, end: e.target.value }));
                            onUpdateVariable(UI_KEY, 'palvelu_loppu', e.target.value);
                        }} />
                    </div>
                </div>
            )}

            <TyotilanneNotes customText={state[`custom-${UI_KEY}`]} onUpdateCustomText={onUpdateCustomText} uiKey={UI_KEY} actions={actions} phrases={phrases} />
            <UraAnalyzer isOpen={isAnalyzerOpen} onClose={() => setIsAnalyzerOpen(false)} actions={actions} state={state} />
        </section>
    );
};

export default Tyotilanne;