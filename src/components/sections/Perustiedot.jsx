import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PhraseOption } from '../PhraseOption';
import { planData } from '../../data/planData';
import { aggregateSignalText } from '../../utils/textAggregator';
import { FileText, Sparkles, Check, MapPin } from 'lucide-react'; // MapPin lisätty

const Perustiedot = ({ state, actions }) => {
    const DB_PERUSTIEDOT = '33c681b0-4d06-4236-a63c-6f5675780fbb';
    const UI_KEY = 'suunnitelman_perustiedot';

    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const [includeAutoText, setIncludeAutoText] = useState(true);
    const [selectedExtras, setSelectedExtras] = useState([]);

    const { onSelect, onUpdateVariable, onUpdateCustomText, onUpdateAsiakas } = actions; // onUpdateAsiakas tuotu

    const transformVariables = (varsArray) => {
        if (!varsArray || varsArray.length === 0) return null;
        return varsArray.reduce((acc, curr) => {
            let opts = [];
            try { if (curr.options) opts = JSON.parse(curr.options); } catch (e) {}
            acc[curr.variable_key] = { tyyppi: curr.input_type, oletus: curr.default_value, vaihtoehdot: opts };
            return acc;
        }, {});
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_PERUSTIEDOT).order('created_at'),
                    supabase.from('variables').select('*')
                ]);
                const enriched = (phrasesRes.data || []).map(p => ({
                    ...p,
                    variables: (varsRes.data || []).filter(v => v.phrase_id === p.id)
                }));

                const section = planData.aihealueet.find(s => s.id === UI_KEY);
                if (section) {
                    enriched.forEach(dbP => {
                        if (dbP.grouping_key === 'ghost' || dbP.grouping_key === 'automaatti_tpl') return;
                        if (!section.fraasit.find(f => f.avainsana === dbP.phrase_key)) {
                            section.fraasit.push({
                                avainsana: dbP.phrase_key,
                                teksti: dbP.base_text,
                                lyhenne: dbP.short_title,
                                muuttujat: transformVariables(dbP.variables)
                            });
                        }
                    });
                }
                setPhrases(enriched);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    // --- KOONTILAATIKON LOGIIKKA ---
    const EXTRA_SIGNALS_MAP = useMemo(() => ({
        'ETUUS_ASUMISTUKI': { label: 'Asumistuki', text: 'asumistukea' },
        'ETUUS_TOIMEENTULOTUKI': { label: 'Toimeentulotuki', text: 'toimeentulotukea' },
        'ETUUS_SAIRAUSPAIVARAHA': { label: 'Sairauspäiväraha', text: 'sairauspäivärahaa' },
        'ETUUS_KOTIHOIDONTUKI': { label: 'Kotihoidon tuki', text: 'kotihoidon tukea' },
        'ETUUS_OPINTOTUKI': { label: 'Opintotuki', text: 'opintotukea' },
        'tt_etuus_yleistuki': { label: 'Yleistuki', text: 'yleistukea' }
    }), []);

    const autoData = useMemo(() => {
        const signals = state.signals || {};
        const activeKeys = Object.keys(signals).filter(k => signals[k]);
        
        const hasEtuus = activeKeys.includes('TT_HAKEE_ETUUTTA');
        const hasKokoaika = activeKeys.includes('TT_HAKEE_KOKOAIKATYOTA');
        const availableExtras = activeKeys.filter(k => EXTRA_SIGNALS_MAP[k]);

        let parts = [];
        if (hasEtuus) parts.push('työttömyysetuutta');
        if (hasKokoaika) parts.push('kokoaikatyötä');
        
        let baseText = parts.length > 0 ? `Asiakas hakee ${parts.join(' ja ')}.` : '';

        let extraText = '';
        if (selectedExtras.length > 0) {
            const extraWords = selectedExtras.map(k => EXTRA_SIGNALS_MAP[k]?.text).filter(Boolean);
            extraText = ` Asiakas saa ${extraWords.join(' ja ')}.`;
        }

        return {
            text: baseText + extraText,
            availableExtras,
            hasCoreSignals: parts.length > 0
        };
    }, [state.signals, selectedExtras, EXTRA_SIGNALS_MAP]);

    const toggleExtra = (sig) => {
        setSelectedExtras(prev => prev.includes(sig) ? prev.filter(k => k !== sig) : [...prev, sig]);
    };

    const handleMoveToText = () => {
        if (!autoData.text) return;
        const currentText = state[`custom-${UI_KEY}`] || '';
        const separator = currentText.trim() ? '\n\n' : ''; 
        onUpdateCustomText(UI_KEY, currentText + separator + autoData.text.trim());
        setIncludeAutoText(false); 
    };

  // --- POSTINUMERON KÄSITTELY ---
    const handlePostinumeroChange = (e) => {
        const oldVal = state?.asiakas?.postinumero || '';
        const val = e.target.value.replace(/\D/g, '').slice(0, 5);
        
        // 1. Tallennetaan arvo Ovimiestä varten
        if (onUpdateAsiakas) {
            onUpdateAsiakas('postinumero', val);
        }

        // 2. Signaalin hallinta
        if (actions.setSignal) {
            // A) Jos vanha arvo oli valmis (5 numeroa) ja sitä muutetaan, sammutetaan vanha haamusignaali
            if (oldVal.length === 5 && oldVal !== val) {
                actions.setSignal(`postinumero_${oldVal}`, false);
            }
            
            // B) Kun uusi arvo on tasan 5 numeroa pitkä, sytytetään se!
            if (val.length === 5) {
                actions.setSignal(`postinumero_${val}`, true);
            }
        }
    };

    if (loading) return <div className="section-container">Ladataan...</div>;

    return (
        <section className="section-container">
            <h2 className="section-title icon-heading">
                <FileText size={22} color="var(--color-primary)" /> Suunnitelman perustiedot
            </h2>

            {/* UUSI: OVIMIEHEN POSTINUMEROKENTTÄ */}
            <div style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                backgroundColor: 'var(--color-bg-light)', 
                borderRadius: '8px', 
                borderLeft: '4px solid var(--color-border)' 
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    <MapPin size={14} />
                    Postinumero (Tunnistetta varten, ei tulostu suunnitelmaan)
                </label>
                <input 
                    type="text" 
                    className="form-input text-mono text-sm" 
                    placeholder="Esim. 00100" 
                    value={state?.asiakas?.postinumero || ''} 
                    onChange={handlePostinumeroChange}
                    style={{ maxWidth: '150px' }}
                />
            </div>

            <div className="options-container">
                {phrases
                    .filter(p => p.grouping_key !== 'ghost' && p.grouping_key !== 'automaatti_tpl')
                    .map(phrase => (
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
                        isSelected={state[UI_KEY]?.[phrase.phrase_key]} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                    />
                ))}
            </div>

            {/* ÄLYKÄS KOONTILAATIKKO */}
            <div className="smart-analysis-box" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(139, 92, 246, 0.04)', borderColor: 'var(--color-ai)', borderStyle: 'dashed' }}>
                <div className="smart-analysis-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-ai)' }}>
                        <Sparkles size={16} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase' }}>Automaattinen koonti signaaleista</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--color-text)' }}>
                        <input 
                            type="checkbox" 
                            checked={includeAutoText} 
                            onChange={(e) => setIncludeAutoText(e.target.checked)} 
                            style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                        Näytä koonti
                    </label>
                </div>

                {includeAutoText && (
                    <>
                        <p style={{ margin: '0 0 12px 0', fontStyle: 'italic', fontSize: '0.95rem', color: '#4c1d95', minHeight: '1.5rem' }}>
                            {autoData.text || 'Ei aktiivisia työnhakusignaaleja tällä hetkellä.'}
                        </p>

                        {autoData.availableExtras.length > 0 && (
                            <div style={{ borderTop: '1px solid rgba(139, 92, 246, 0.2)', paddingTop: '12px', paddingBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#6d28d9', display: 'block', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                                    Löydetyt etuudet (Klikkaa lisätäksesi mukaan):
                                </span>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {autoData.availableExtras.map(sig => {
                                        const isSelected = selectedExtras.includes(sig);
                                        const label = EXTRA_SIGNALS_MAP[sig]?.label || sig;
                                        return (
                                            <button
                                                key={sig}
                                                onClick={() => toggleExtra(sig)}
                                                style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '16px',
                                                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(139, 92, 246, 0.3)'}`,
                                                    backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                                                    color: isSelected ? 'white' : '#6d28d9',
                                                    fontSize: '0.8rem',
                                                    fontWeight: isSelected ? '600' : '400',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {isSelected ? <Check size={12} /> : '+'} {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {autoData.text && (
                            <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                <button 
                                    className="btn btn--secondary" 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                    onClick={handleMoveToText}
                                >
                                    Siirrä tekstikenttään ↓
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="custom-text-container" style={{ marginTop: '1.5rem' }}>
                <textarea 
                    className="form-input"
                    rows="3" 
                    value={state[`custom-${UI_KEY}`] || ''} 
                    onChange={(e) => onUpdateCustomText(UI_KEY, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Perustiedot;