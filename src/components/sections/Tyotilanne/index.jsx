import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { PhraseOption } from '../../PhraseOption';
import { Wand2, CalendarClock, Sparkles, Layers, Briefcase } from 'lucide-react'; 

import UraAnalyzer from './UraAnalyzer'; 
import TyotilanneNotes from './TyotilanneNotes';
import ATmtGuidance from './ATmtGuidance';

// --- UUDET 2.0 KOMPONENTIT JA LOGIIKKA ---
import PalveluSalkku from './PalveluSalkku';
import { generoiLausuntoTeksti } from './tyotilanneTekstiLogiikka';
import { useTyotilanneAnalytiikka } from '../../../hooks/analyticsSentinel/useTyotilanneAnalytiikka';

const Tyotilanne = ({ state, actions, knowledgeData }) => {
    const DB_TYOTILANNE = '41642216-1e1e-46d3-8091-67fc0d9d75f6';
    const UI_KEY = 'tyotilanne';
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    const currentSectionState = state[UI_KEY] || {};
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    const savedServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];

    // --- 1. TIETOJEN HAKU (Fraasit) ---
    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('phrases').select('*').eq('section_id', DB_TYOTILANNE).order('created_at');
            if (data) setPhrases(data);
            setLoading(false);
        };
        fetchData();
    }, []);

    // --- 2. YHTEENSOPIVUUS: Automaattinen raksien kytkentä ---
    // Säilytetään vanha logiikka: jos imuri tai salkku on saanut palvelun, kytketään ruksit päälle
    useEffect(() => {
        if (!phrases || phrases.length === 0) return;
        
        ['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus'].forEach(type => {
            const hasInGM = savedServices.some(s => s.entity_key === type);
            if (hasInGM) {
                const phrase = phrases.find(p => {
                    const text = (p.base_text || "").toLowerCase();
                    const key = (p.phrase_key || "").toLowerCase();
                    if (type === 'tyokokeilu') return text.includes('työkokeilu') || key.includes('kokeilu');
                    if (type === 'palkkatuki') return text.includes('palkkatuki') || key.includes('palkka');
                    if (type === 'tyovoimakoulutus') return text.includes('työvoimakoulutus') || text.includes('koulutus') || key.includes('voima');
                    return false;
                });

                if (phrase && !currentSectionState[phrase.phrase_key]) {
                    onSelect(UI_KEY, phrase.phrase_key, true);
                }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [savedServices, phrases]);

   // --- 3. ANALYTIIKKA (Live-seuranta) ---
    const analyticsData = useTyotilanneAnalytiikka(currentSectionState, savedServices);
    
    // KORJAUS IKILIIKKUJAAN: Jäädytetään objekti stringiksi, jotta vertailu koskee vain sisältöä
    const analyticsStr = JSON.stringify(analyticsData);
    
    useEffect(() => {
        // Tallennetaan vain, kun paketin data on aidosti muuttunut (esim. nollasta ykköseen)
        if (analyticsStr) {
            onUpdateVariable('global', 'analytics_tyotilanne_data', JSON.parse(analyticsStr));
        }
    }, [analyticsStr, onUpdateVariable]);

    // --- 4. TOIMINNOT (Palvelusalkun hallinta) ---
    const handleAddService = (newService) => {
        const updatedServices = [...savedServices, newService];
        onUpdateVariable('global', 'sessionServices', updatedServices);
        
        // Ylläpidetään vanhaa eventtiä, jos jokin muu koodin osa kuuntelee tätä
        if (newService.data?.loppu) {
            window.dispatchEvent(new CustomEvent('palvelu_ajankohta_paivitetty', { detail: { loppu: newService.data.loppu } }));
        }
    };

    const handleRemoveService = (id) => {
        const updatedServices = savedServices.filter(s => s.id !== id);
        onUpdateVariable('global', 'sessionServices', updatedServices);
    };

    // --- 5. TEKSTIGENERAATTORI JA VIENTI ---
    const generatedText = generoiLausuntoTeksti(savedServices);

    const handleUpdateText = (newText) => {
        // Uusi manuaalinen hallinta: ei rikota regexillä, vaan lisätään turvallisesti perään
        let currentText = state[`custom-${UI_KEY}`] || '';
        // Estetään saman tekstin tuplaantuminen peräkkäisillä painalluksilla
        if (currentText.includes(newText)) return;
        
        const updatedFullText = currentText ? `${currentText}\n\n${newText}` : newText;
        onUpdateCustomText(UI_KEY, updatedFullText);
    };

    // --- 6. TEKOÄLYN LÖYDÖT (Globaalista tilasta) ---
    const finescoAla = state.asiakas?.tavoiteammatti_finesco_ala;
    const escoNimi = state.asiakas?.tavoiteammatti_esco_nimi; 
    const tkHistoria = state.palkkatuki?.tyokokeilu_historia;

    if (loading) return <div className="section-container">Ladataan...</div>;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title thv-section-title">Asiakkaan työtilanne</h2>
                <button className="btn-ai" onClick={() => setIsAnalyzerOpen(true)}>
                    <Wand2 size={16} /> Tuo ja analysoi URA-historia
                </button>
            </div>

            {/* TEKOÄLYN VISUALISOINTI (URA-historia) */}
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

            {/* LAADULLISET FRAASIT (Asiakkaan tilanne) */}
            <div className="options-container mb-4">
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

            {/* UUSI PALVELUSALKKU JA HALLINTA */}
            <PalveluSalkku 
                sessionServices={savedServices}
                onAddService={handleAddService}
                onRemoveService={handleRemoveService}
                generatedText={generatedText}
                onUpdateText={handleUpdateText}
                analyticsData={analyticsData}
            />

            {/* VAPAA TEKSTI JA MUUT VANHAT KOMPONENTIT */}
            <div style={{ marginTop: '1.5rem' }}>
                <TyotilanneNotes customText={state[`custom-${UI_KEY}`]} onUpdateCustomText={onUpdateCustomText} uiKey={UI_KEY} actions={actions} phrases={phrases} />
            </div>
            
            <ATmtGuidance currentSectionState={currentSectionState} state={state} knowledgeData={knowledgeData} />
            
            <UraAnalyzer isOpen={isAnalyzerOpen} onClose={() => setIsAnalyzerOpen(false)} actions={actions} state={state} />
        </section>
    );
};

export default Tyotilanne;