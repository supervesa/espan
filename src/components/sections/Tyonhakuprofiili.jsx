// --- src/components/sections/Tyonhakuprofiili.jsx ---
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { planData } from '../../data/planData';
import { UserCircle, AlertTriangle, Calendar, FileText, ArrowRight, Lightbulb } from 'lucide-react';

const Tyonhakuprofiili = ({ state, actions }) => {
    const UI_KEY = 'tyonhakuprofiili';
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const selection = state[UI_KEY] || {};
    const isPoikkeus = selection?.avainsana === 'tm_profiili_vapautus';

    // === ÄLYKÄS TUTKA ===
    const signals = state?.signals || {};
    const hasLanguageBarrier = Object.keys(signals).some(key => key.includes('language') || key === 'osallistuu_tulkki');
    const hasDigitalBarrier = signals['puutteelliset_digitaidot'] || signals['ei_pankkitunnuksia'];
    const hasHealthBarrier = signals['tyokyky_alentunut'];

    const thvState = state?.tyonhakuvelvollisuus || {};
    const hasNoObligation = thvState.avainsana?.includes('ei_velvoitetta') || Number(thvState.muuttujat?.LKM) === 0;

    const isWorkingOrStudying = 
        state?.tyotilanne?.avainsana?.includes('kokoaikatyo') || 
        state?.koulutus?.avainsana?.includes('paatoiminen') ||
        state?.yrittajyys?.avainsana?.includes('paatoiminen_yrittaja');

    const needsAssistance = hasLanguageBarrier || hasDigitalBarrier || hasHealthBarrier;
    const isExempt = hasNoObligation || isWorkingOrStudying;
    // ====================

    // KORJATTU FUNKTIO: Ymmärtää Supabasen valmiiksi purkamat JSON-taulukot
    const transformVariables = (varsArray) => {
        if (!varsArray || varsArray.length === 0) return null;
        const transformed = {};
        varsArray.forEach(curr => {
            let parsedOptions = [];
            
            if (curr.options) {
                // Tässä se taika: Katsotaan onko Supabase jo purkanut sen Arrayksi!
                if (Array.isArray(curr.options)) {
                    parsedOptions = curr.options;
                } else if (typeof curr.options === 'string') {
                    try { 
                        let temp = JSON.parse(curr.options); 
                        if (typeof temp === 'string') temp = JSON.parse(temp);
                        if (Array.isArray(temp)) parsedOptions = temp;
                    } catch(e) { console.warn("Virhe valikkojen purussa:", e); }
                }
            }

            // Varmistetaan myös oletusarvon turvallinen purku
            let oletusArvo = '';
            if (curr.default_value !== null && curr.default_value !== undefined) {
                oletusArvo = String(curr.default_value).replace(/^"|"$/g, '');
            }

            transformed[curr.variable_key] = {
                tyyppi: curr.input_type,
                oletus: oletusArvo,
                vaihtoehdot: parsedOptions
            };
        });
        return transformed;
    };

    // 1. HAETAAN DATA JA PAKOTETAAN SE PÄÄMUISTIIN
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('grouping_key', 'tyonhakuprofiili').order('priority_score'),
                    supabase.from('variables').select('*')
                ]);

                if (phrasesRes.data) {
                    let sectionInPlanData = planData.aihealueet.find(s => s.id === UI_KEY);
                    if (!sectionInPlanData) {
                        sectionInPlanData = { id: UI_KEY, otsikko: 'Työnhakuprofiili', monivalinta: false, fraasit: [] };
                        planData.aihealueet.push(sectionInPlanData);
                    }
                    
                    const enrichedPhrases = phrasesRes.data.map(phrase => {
                        const phraseVars = varsRes.data ? varsRes.data.filter(v => v.phrase_id === phrase.id) : [];
                        const muuttujatObj = transformVariables(phraseVars);
                        
                        const exists = sectionInPlanData.fraasit.find(f => f.avainsana === phrase.phrase_key);
                        if (!exists) {
                            sectionInPlanData.fraasit.push({
                                avainsana: phrase.phrase_key,
                                teksti: phrase.base_text,
                                lyhenne: phrase.short_title,
                                muuttujat: muuttujatObj
                            });
                        }

                        return {
                            ...phrase,
                            avainsana: phrase.phrase_key,
                            teksti: phrase.base_text,
                            lyhenne: phrase.short_title,
                            muuttujat: muuttujatObj
                        };
                    });
                    setPhrases(enrichedPhrases);
                }
            } catch (error) { console.error("Virhe latauksessa:", error); }
            setLoading(false);
        };
        fetchData();
    }, []);

    // 2. MUODOSTETAAN ESIKATSELUTEKSTI
    const ehdotettuTeksti = useMemo(() => {
        if (!selection?.avainsana) return '';
        const selectedPhrase = phrases.find(p => p.phrase_key === selection.avainsana);
        if (!selectedPhrase) return '';

        let teksti = selectedPhrase.base_text;
        
        if (selectedPhrase.muuttujat) {
            Object.keys(selectedPhrase.muuttujat).forEach(key => {
                let val = '';
                if (selection.muuttujat && selection.muuttujat[key] !== undefined && selection.muuttujat[key] !== '') {
                    val = selection.muuttujat[key];
                } else {
                    val = selectedPhrase.muuttujat[key].oletus || '';
                }
                teksti = teksti.replace(`[${key}]`, val);
            });
        }
        return teksti;
    }, [selection, phrases]);

    // Käsittelijät
    const handleSiirraSuunnitelmaan = () => {
        if (!ehdotettuTeksti) return;
        const currentText = state['custom-suunnitelma'] || '';
        const newText = currentText ? `${ehdotettuTeksti}\n\n${currentText}` : ehdotettuTeksti;
        if (onUpdateCustomText) onUpdateCustomText('suunnitelma', newText);
    };

    const handlePoikkeusToggle = (soveltuu) => {
        if (soveltuu) {
            onSelect(UI_KEY, 'tm_profiili_vapautus', false);
        } else {
            onSelect(UI_KEY, 'tm_profiili_asiakas_tekee', false);
        }
    };

    const handleTilaSelect = (avainsana) => {
        onSelect(UI_KEY, avainsana, false);
    };

    if (loading) return <div className="section-container"><p style={{ color: 'var(--color-text-secondary)' }}>Ladataan profiilin asetuksia...</p></div>;

    const asiakasTekeePhrase = phrases.find(p => p.phrase_key === 'tm_profiili_asiakas_tekee');
    const vapautusPhrase = phrases.find(p => p.phrase_key === 'tm_profiili_vapautus');

    return (
        <section className="section-container" style={{ borderColor: 'var(--color-primary)', borderWidth: '2px', borderStyle: 'solid', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <h2 className="icon-heading" style={{ margin: 0, color: 'var(--color-primary)' }}>
                    <UserCircle size={28} />
                    Työnhakuprofiili (Lakisääteinen)
                </h2>
                <span className="tag" style={{ backgroundColor: 'rgba(255,107,0,0.1)', color: 'var(--color-primary)' }}>UUSI: 1.9. alkaen</span>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                Työnhakijalla on velvollisuus julkaista nimetön työnhakuprofiili Työmarkkinatorilla 15 arkipäivän kuluessa työnhaun alusta, ellei poikkeus täyty.
            </p>

            {/* PÄÄVALINTA: Poikkeus vai ei */}
            <div className="side-bordered-panel" style={{ borderLeftColor: isPoikkeus ? 'var(--color-warning)' : 'var(--color-border)' }}>
                
                {(needsAssistance || isExempt) && !isPoikkeus && (
                    <div className="alert-box alert-box--warning" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fffbeb', borderColor: '#f59e0b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            <Lightbulb size={20} /> Järjestelmän havainnot:
                        </div>
                        <span style={{ fontSize: '0.9rem', color: '#92400e' }}>
                            Harkitse "Poikkeus soveltuu" -vaihtoehdon valitsemista seuraavin perustein:
                        </span>
                        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.9rem', color: '#92400e' }}>
                            {hasNoObligation && <li>Työnhakuvelvollisuutta ei ole asetettu (lkm 0).</li>}
                            {hasHealthBarrier && <li>Asiakkaalla on alentunut työkyky.</li>}
                            {hasLanguageBarrier && <li>Asiakkaalla on merkintä heikosta kielitaidosta.</li>}
                            {hasDigitalBarrier && <li>Asiakkaalla on puutteelliset digitaidot tai puuttuva tunnistautuminen.</li>}
                            {isWorkingOrStudying && <li>Asiakas on ohjattu tai on jo työssä/opiskelemassa päätoimisesti.</li>}
                        </ul>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 className="icon-heading" style={{ margin: 0 }}>Vapautusperusteet</h3>
                    <div className="boolean-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            type="button"
                            className={!isPoikkeus ? 'selected' : ''} 
                            onClick={() => handlePoikkeusToggle(false)}
                        >Ei poikkeusta</button>
                        <button 
                            type="button"
                            className={isPoikkeus ? 'selected' : ''} 
                            onClick={() => handlePoikkeusToggle(true)}
                            style={{ backgroundColor: isPoikkeus ? '#f59e0b' : '', color: isPoikkeus ? 'white' : '' }}
                        >Poikkeus soveltuu</button>
                    </div>
                </div>

                {isPoikkeus && vapautusPhrase && (
                    <div style={{ marginTop: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Valitse virallinen peruste:</p>
                        <select 
                            className="form-input" 
                            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '0.75rem', borderRadius: '6px', width: '100%' }}
                            value={selection?.muuttujat?.POIKKEUS_SYY || ''}
                            onChange={(e) => onUpdateVariable(UI_KEY, 'tm_profiili_vapautus', 'POIKKEUS_SYY', e.target.value)}
                        >
                            <option value="">-- Valitse peruste --</option>
                            {vapautusPhrase.muuttujat?.POIKKEUS_SYY?.vaihtoehdot?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* NORMAALITILANNE: Profiilin tila */}
            {!isPoikkeus && (
                <div className="side-bordered-panel" style={{ marginTop: '1.5rem', borderLeftColor: selection?.avainsana === 'tm_profiili_viranomainen_tekee' ? 'var(--color-danger)' : 'var(--color-success)', animation: 'fadeIn 0.3s ease' }}>
                    <h3 className="icon-heading" style={{ margin: 0, marginBottom: '1rem' }}>Profiilin tilanne ja aikataulu</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_julkaistu' ? '2px solid var(--color-success)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_julkaistu'} onChange={() => handleTilaSelect('tm_profiili_julkaistu')} style={{ margin: 0 }} />
                            <span style={{ fontWeight: 600 }}>Jo julkaistu</span>
                        </label>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_asiakas_tekee' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_asiakas_tekee'} onChange={() => handleTilaSelect('tm_profiili_asiakas_tekee')} style={{ margin: 0 }} />
                            <span style={{ fontWeight: 600 }}>Asiakas tekee</span>
                        </label>
                        <label className="modern-checkbox-label" style={{ border: selection?.avainsana === 'tm_profiili_viranomainen_tekee' ? '2px solid var(--color-danger)' : '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center', cursor: 'pointer' }}>
                            <input type="radio" name="profiili_tila" checked={selection?.avainsana === 'tm_profiili_viranomainen_tekee'} onChange={() => handleTilaSelect('tm_profiili_viranomainen_tekee')} style={{ margin: 0 }} />
                            <span style={{ fontWeight: 600 }}>Viranomainen tekee</span>
                        </label>
                    </div>

                    {selection?.avainsana === 'tm_profiili_asiakas_tekee' && asiakasTekeePhrase && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', animation: 'fadeIn 0.2s ease' }}>
                            <Calendar size={20} color="var(--color-primary)" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aseta määräpäivä</label>
                                <input 
                                    type="text" 
                                    className="form-input text-mono" 
                                    placeholder={asiakasTekeePhrase.muuttujat?.PÄIVÄMÄÄRÄ?.oletus || "esim. 15.9.2026"}
                                    value={selection?.muuttujat?.PÄIVÄMÄÄRÄ !== undefined ? selection.muuttujat.PÄIVÄMÄÄRÄ : ''} 
                                    onChange={(e) => onUpdateVariable(UI_KEY, 'tm_profiili_asiakas_tekee', 'PÄIVÄMÄÄRÄ', e.target.value)} 
                                    style={{ maxWidth: '350px' }}
                                />
                            </div>
                        </div>
                    )}

                    {selection?.avainsana === 'tm_profiili_viranomainen_tekee' && (
                        <div className="alert-box alert-box--warning" style={{ backgroundColor: 'rgba(227, 74, 74, 0.05)', borderColor: 'rgba(227, 74, 74, 0.2)', animation: 'fadeIn 0.2s ease' }}>
                            <h4 style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <AlertTriangle size={18} /> Viranomaisen tekemän profiilin säännöt
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                                <li><strong>Vain nimettömiä tietoja:</strong> Ei työnantajaa tai oppilaitosta yksilöiviä tietoja.</li>
                                <li><strong>Sallitut tiedot:</strong> Olennainen työkokemus, koulutus, luvat, pätevyydet, työtoiveet ja kielitaito.</li>
                                <li><em>Huom: Laiminlyönnistä ei tule asettaa työttömyysturvaseuraamusta.</em></li>
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#eff6ff', borderRadius: 'var(--border-radius)', border: '1px dashed var(--color-primary)' }}>
                <h3 className="icon-heading" style={{ marginBottom: '1rem', color: '#1e40af' }}>
                    <FileText size={20} /> Generoitu kirjaus
                </h3>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: 'var(--color-text-primary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                    {ehdotettuTeksti || "Tee valinta yläpuolelta nähdäksesi tekstin."}
                </p>
                
                <button 
                    type="button"
                    className="btn" 
                    onClick={handleSiirraSuunnitelmaan}
                    disabled={!ehdotettuTeksti}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e40af', color: 'white', border: 'none', opacity: !ehdotettuTeksti ? 0.5 : 1 }}
                >
                    <ArrowRight size={18} /> Siirrä teksti suunnitelman lisätietoihin
                </button>
            </div>
        </section>
    );
};

export default Tyonhakuprofiili;