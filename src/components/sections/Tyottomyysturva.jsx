import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { AlertCircle, CheckCircle, FileText, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import PhraseQuestionList from '../common/PhraseQuestionList';

const Tyottomyysturva = ({ state, actions }) => {
    const { onUpdateTyottomyysturva, onUpdateCustomText, onAddSignal, onRemoveSignal } = actions;
    const answers = state.tyottomyysturva?.answers || {};
    
    const [kysymykset, setKysymykset] = useState({ tt_ehdottomat: [], tt_yleiset: [], muut_tuet: [] });
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const { data } = await supabase.from('phrases')
                .select('*')
                .in('grouping_key', ['tt_ehdottomat', 'tt_yleiset', 'muut_tuet', 'tt_lausuntopohjat'])
                .order('priority_score', { ascending: false });
            
            if (data) {
                const grouped = { tt_ehdottomat: [], tt_yleiset: [], muut_tuet: [] };
                const temps = {};
                data.forEach(q => {
                    if (q.grouping_key === 'tt_lausuntopohjat') temps[q.phrase_key] = q.base_text;
                    else grouped[q.grouping_key]?.push(q);
                });
                setKysymykset(grouped);
                setTemplates(temps);
            }
            setLoading(false);
        };
        fetchAll();
    }, []);

    const asiakasAlle25 = useMemo(() => {
        const sv = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!sv) return false;
        return (new Date().getFullYear() - parseInt(String(sv).replace(/\D/g, ''), 10)) < 25;
    }, [state.suunnitelman_perustiedot]);

    const shouldShow = (q) => {
        const meta = q.metadata || {};
        if (meta.condition === 'alle25' && !asiakasAlle25) return false;
        if (meta.logic && answers[meta.logic.show_if] !== meta.logic.equals) return false;
        return true;
    };

    const handleAnswerChange = (q, value) => {
        onUpdateTyottomyysturva('updateKysymys', { id: q.phrase_key, value });
        if (q.metadata?.signal_key) {
            if (value === true) onAddSignal(q.metadata.signal_key);
            else onRemoveSignal(q.metadata.signal_key);
        }
    };

    const analysis = useMemo(() => {
        const res = { criticalFail: false, investigate: [], answered: 0, required: 0, isReady: false };
        const relevant = [...kysymykset.tt_ehdottomat, ...kysymykset.tt_yleiset].filter(shouldShow);
        res.required = relevant.length;
        relevant.forEach(q => {
            const ans = answers[q.phrase_key];
            if (ans !== undefined) res.answered++;
            if (ans === false && q.metadata?.impact === 'critical') res.criticalFail = true;
            if (ans === true && q.metadata?.impact === 'investigate') res.investigate.push(q.metadata.syy_teksti || q.short_title);
        });
        res.isReady = res.criticalFail || (res.required > 0 && res.answered === res.required);
        return res;
    }, [kysymykset, answers, asiakasAlle25]);

    const handleGenerateText = () => {
        let finalOutput = "";
        if (analysis.criticalFail) finalOutput = templates['tt_pohja_hylkaava'] || "";
        else if (analysis.investigate.length > 0) {
            const base = templates['tt_pohja_selvitys'] || "";
            const list = analysis.investigate.map(item => `- ${item}`).join('\n');
            finalOutput = `${base}\n${list}`;
        } else if (analysis.isReady) finalOutput = templates['tt_pohja_hyvaksytty'] || "";
        onUpdateCustomText('tyottomyysturva', finalOutput);
    };

    return (
        <section className="section-container">
            <h2 className="icon-heading"><AlertCircle size={24} color="var(--color-primary)" /> Työttömyysturva</h2>

            {/* VAIHE 1 */}
            <div className="side-bordered-panel" style={{ borderLeftColor: analysis.criticalFail ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                <span className="tag" style={{ marginBottom: '1rem' }}>VAIHE 1: EHDOTTOMAT</span>
                <PhraseQuestionList 
                    questions={kysymykset.tt_ehdottomat} 
                    answers={answers} 
                    onAnswerChange={handleAnswerChange} 
                />
            </div>

            {/* MUUT ETUUDET */}
            <div className="side-bordered-panel" style={{ borderLeftColor: 'var(--color-ai)', backgroundColor: 'rgba(139, 92, 246, 0.03)' }}>
                <span className="tag" style={{ marginBottom: '1rem', backgroundColor: 'var(--color-ai)', color: 'white' }}>ASIAKKAAN MUUT ETUUDET</span>
                <PhraseQuestionList 
                    questions={kysymykset.muut_tuet} 
                    answers={answers} 
                    onAnswerChange={handleAnswerChange} 
                />
            </div>

            {/* VAIHE 2 */}
            {!analysis.criticalFail && (
                <div className="side-bordered-panel" style={{ borderLeftColor: analysis.investigate.length > 0 ? 'var(--color-warning)' : 'var(--color-success)', marginTop: '1.5rem' }}>
                    <span className="tag" style={{ marginBottom: '1rem', backgroundColor: 'var(--color-text-secondary)', color: 'white' }}>VAIHE 2: YLEISET EDELLYTYKSET</span>
                    <PhraseQuestionList 
                        questions={kysymykset.tt_yleiset} 
                        answers={answers} 
                        onAnswerChange={handleAnswerChange} 
                        filterFn={shouldShow}
                    />
                </div>
            )}

            {/* ANALYYSI */}
            <div className="smart-analysis-box" style={{ marginTop: '2rem' }}>
                <div className="smart-analysis-header">
                    <Sparkles size={18} color="var(--color-info-text)" /> 
                    <span>Älykäs analyysi</span>
                </div>
                <div className="smart-analysis-grid">
                    <div className="smart-analysis-column">
                        <p className="smart-analysis-title">Tilannekuva</p>
                        <div style={{ fontSize: '0.875rem' }}>
                            {!analysis.isReady ? (
                                <span className="tag--pending">Vastaa kysymyksiin ({analysis.answered} / {analysis.required})</span>
                            ) : analysis.criticalFail ? (
                                <span className="text-danger" style={{ fontWeight: 600 }}>Hylkäävä lausunto suositeltu</span>
                            ) : analysis.investigate.length > 0 ? (
                                <span className="text-warning" style={{ fontWeight: 600 }}>Selvityspyyntö suositeltu</span>
                            ) : (
                                <span className="text-success" style={{ fontWeight: 600 }}>Kaikki kunnossa</span>
                            )}
                        </div>
                    </div>
                    <div className="smart-analysis-column">
                        <p className="smart-analysis-title">Toimenpide</p>
                        <button 
                            className="btn btn--secondary" 
                            style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                            onClick={handleGenerateText} 
                            disabled={!analysis.isReady}
                        >
                            <ArrowRight size={14} /> Päivitä lausuntoluonnos
                        </button>
                    </div>
                </div>
            </div>

            <div className="custom-text-container">
                <label className="stat-label"><FileText size={14} /> Ratkaisukeskuksen teksti</label>
                <textarea 
                    className="form-input" 
                    rows="5" 
                    value={state['custom-tyottomyysturva'] || ''} 
                    onChange={(e) => onUpdateCustomText('tyottomyysturva', e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Tyottomyysturva;