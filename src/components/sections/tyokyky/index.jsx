import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { Activity, BrainCircuit, FileText } from 'lucide-react';

import TyokykyPaaarvio from './TyokykyPaaarvio';
import ToimenpiteetJaPalvelut from './ToimenpiteetJaPalvelut';
import KeskusteluJaAi from './KeskusteluJaAi';
import { useTyokykySummary } from './useTyokykySummary';
import CopyButton from '../../common/CopyButton';

const TyokykyOsio = ({ state, actions }) => {
    const DB_TYOKYKY_SECTION_ID = '5b48f731-fc8d-4a00-894e-ac7104f6b422'; 
    const { onUpdateCustomText } = actions;
    
    const lastScrapedTextRef = useRef('');

    const [dbData, setDbData] = useState({
        paavalinnat: [],
        palveluohjaukset: [],
        toimenpiteet: [], 
        kysymysKategoriat: {}
    });
    
    const [isLoading, setIsLoading] = useState(true);

    // 1. DATA-HAKU SUPABASESTA
    useEffect(() => {
        const fetchTyokykyData = async () => {
            setIsLoading(true);
            try {
                const [phrasesRes, varsRes] = await Promise.all([
                    supabase.from('phrases').select('*').eq('section_id', DB_TYOKYKY_SECTION_ID),
                    supabase.from('variables').select('*')
                ]);

                if (phrasesRes.error) throw phrasesRes.error;

                const phrasesData = phrasesRes.data || [];
                const variablesData = varsRes.data || [];

                const formatPhrase = (p) => {
                    const myVars = variablesData.filter(v => v.phrase_id === p.id);
                    
                    const parsedVars = myVars.length > 0 
                        ? myVars.reduce((acc, v) => {
                            let options = [];
                            try { if (v.options) options = JSON.parse(v.options); } catch(e) {}
                            acc[v.variable_key] = { tyyppi: v.input_type, oletus: v.default_value, vaihtoehdot: options };
                            return acc;
                        }, {}) 
                        : null;

                    supabase.from('system_signals').upsert({
                        signal_key: 'tyokyky_oma_arvio_matala',
                        label: 'Oma arvio työkyvystä matala (≤ 5)',
                        category: 'Työkyky',
                        description: 'Asiakas on arvioinut oman työkykynsä matalaksi (arvosana 5 tai alle 0-10 asteikolla).'
                    }, { onConflict: 'signal_key' }).then();

                    return {
                        ...p,
                        avainsana: p.phrase_key,
                        teksti: p.base_text,
                        lyhyt: p.short_title,
                        muuttujat: parsedVars
                    };
                };

                const paavalinnat = phrasesData.filter(p => p.grouping_key === 'tyokyky_paavalinta').map(formatPhrase);
                const palveluohjaukset = phrasesData.filter(p => p.grouping_key === 'tyokyky_palveluohjaus').map(formatPhrase);
                const toimenpiteet = phrasesData.filter(p => p.grouping_key === 'tyokyky_toimenpide' || p.grouping_key === 'toimenpide').map(formatPhrase);

                let kategoriat = {};
                try {
                    const { data: questionsData, error: qError } = await supabase
                        .from('assessment_questions')
                        .select('*')
                        .eq('is_active', true)
                        .order('order_index');

                    if (!qError && questionsData) {
                        questionsData.forEach(q => {
                            if (!kategoriat[q.category]) kategoriat[q.category] = [];
                            kategoriat[q.category].push({
                                id: q.question_key,
                                teksti: q.question_text,
                                tyyppi: q.input_type,
                                vaihtoehdot: q.options
                            });
                        });
                    }
                } catch (err) {
                    console.log("Kysymystaulua ei löydetty.");
                }

                setDbData({ paavalinnat, palveluohjaukset, toimenpiteet, kysymysKategoriat: kategoriat });
                
            } catch (error) {
                console.error("Virhe Työkyky-datan latauksessa:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTyokykyData();
    }, []);

    // 2. SCRAPER-ADAPTERIN DATAN TUONTI
    useEffect(() => {
        const scrapedText = state['custom-tyokyky'];
        if (scrapedText && scrapedText !== lastScrapedTextRef.current) {
            lastScrapedTextRef.current = scrapedText; 
            const nykyinenSuojattu = state['custom-tyokyky_lisatieto'] || '';
            if (!nykyinenSuojattu.includes(scrapedText)) {
                onUpdateCustomText('tyokyky_lisatieto', nykyinenSuojattu ? `${nykyinenSuojattu}\n\n--- Tuotu tekstistä ---\n${scrapedText}` : scrapedText);
            }
            setTimeout(() => onUpdateCustomText('tyokyky', ''), 100);
        }
    }, [state['custom-tyokyky'], state['custom-tyokyky_lisatieto'], onUpdateCustomText]);

    // 3. MUUTTUJIEN MÄÄRITTELY ENNEN HOOK-KUTSUA
    const arvioKysymykset = dbData.kysymysKategoriat['Asiakkaan arvio'] || [];
    const muuKeskustelu = Object.keys(dbData.kysymysKategoriat)
        .filter(k => k !== 'Asiakkaan arvio')
        .reduce((obj, key) => { obj[key] = dbData.kysymysKategoriat[key]; return obj; }, {});

    const summaryText = useTyokykySummary(
        state, 
        [...dbData.paavalinnat, ...dbData.palveluohjaukset, ...dbData.toimenpiteet],
        arvioKysymykset
    );

    const handleUseSummary = () => { if (summaryText) onUpdateCustomText('tyokyky_lopullinen', summaryText); };

    // 4. RENDERÖINTI
    if (isLoading) {
        return (
            <section className="section-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
                    <Activity className="animate-pulse" /> Ladataan Työkyky-osiota...
                </div>
            </section>
        );
    }

    const paavalintaTila = state['custom-tyokyky_paavalinta'];
    const showToimenpiteet = paavalintaTila === 'tyokyky_alentunut' || paavalintaTila === 'tyokyky_selvityksessa';

    return (
        <section className="section-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="smart-analysis-box" style={{ marginBottom: '1.5rem' }}>
                <div className="smart-analysis-header"><BrainCircuit size={20} /> Älykäs Työkyky-moduuli</div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
                    Tämä moduuli on yhdistetty sääntömoottoriin. Kun kirjaat tänne toimenpiteitä, järjestelmä huomioi ne automaattisesti.
                </p>
            </div>

            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={22} color="var(--color-primary)" /> Työkyky
            </h2>
            
            <TyokykyPaaarvio 
                state={state} 
                actions={actions} 
                paavalinnat={dbData.paavalinnat} 
                arvioKysymykset={arvioKysymykset} 
            />

            {showToimenpiteet && (
                <ToimenpiteetJaPalvelut 
                    state={state} 
                    actions={actions} 
                    toimenpiteet={dbData.toimenpiteet} 
                    palveluohjaukset={dbData.palveluohjaukset} 
                />
            )}

            <KeskusteluJaAi 
                state={state} 
                actions={actions} 
                kysymysKategoriat={muuKeskustelu} 
            />

            <div className="subsection" style={{ marginTop: '2rem', borderTop: '2px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <h3 className="subsection-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} /> Lopullinen kirjaus
                </h3>
                
                {summaryText && (
                    <div className="summary-preview" style={{ marginBottom: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Automaattisesti muodostuva teksti:</h4>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                            {summaryText}
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button onClick={handleUseSummary} className="btn-neg" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                                ↓ Kopioi teksti alla olevaan laatikkoon
                            </button>
                            <CopyButton textToCopy={summaryText} />
                        </div>
                    </div>
                )}

                <div className="custom-text-container">
                    <label className="custom-text-label" htmlFor="custom-tyokyky-lopullinen">Lisätiedot / Koonti:</label>
                    <textarea 
                        id="custom-tyokyky-lopullinen"
                        rows="4" 
                        value={state['custom-tyokyky_lopullinen'] || ''} 
                        onChange={(e) => onUpdateCustomText('tyokyky_lopullinen', e.target.value)} 
                    />
                </div>
            </div>
        </section>
    );
};

export default TyokykyOsio;