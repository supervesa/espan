// --- src/components/sections/Suunnitelma/UraAnalyzer/Step2Results.jsx ---
import React, { useState } from 'react';
import { Briefcase, GraduationCap, CalendarClock, Layers, Info, Tag as TagIcon, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import Tag from '../../../common/Tag';
import AlertBox from '../../../common/AlertBox';
import { ENTITY_DEFINITIONS } from '../../../../data/entityDefinitions'; 

const Step2Results = ({ 
    aiResult, setAiResult, 
    finescoSector, setFinescoSector, 
    escoProfession, setEscoProfession, 
    tilaTyoton, aktiivisetPalvelut,
    activeTriggers, setActiveTriggers 
}) => {

    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [storyError, setStoryError] = useState(null);

    const { 
        tyohistoria, 
        suoritetut_koulutukset, 
        vaihtoehtoiset_ammatit, 
        koulutusehdotukset 
    } = aiResult;

    // VAIHE 2: PILVI (Sanallinen asiantuntija-arvio ja ideointi Geminillä)
    const handleGenerateStory = async () => {
        setIsGeneratingStory(true);
        setStoryError(null);
        try {
            // Vain anonyymi, paikallisesti pureskeltu data lähtee pilveen!
            const cleanPayload = {
                tyopaikat: tyohistoria, // Tämä sisältää Qwenin tekemän ranskalaisen viivan listan
                esco_pääammatti: escoProfession,
                koulutukset: suoritetut_koulutukset,
                palvelut: aktiivisetPalvelut,
                huomiot: activeTriggers
            };

            const response = await fetch('/.netlify/functions/analyze_ura_story', {
                method: 'POST',
                body: JSON.stringify(cleanPayload)
            });

            if (!response.ok) throw new Error("Yhteys pilven AI-rajapintaan epäonnistui.");
            const data = await response.json();
            
            // Geminin kirjoittama teksti korvaa Qwenin listauksen ja lisää uudet ideat
            setAiResult(prev => ({ 
                ...prev, 
                tyohistoria: data.tyohistoria,
                vaihtoehtoiset_ammatit: data.vaihtoehtoiset_ammatit,
                koulutusehdotukset: data.koulutusehdotukset
            }));

        } catch (e) {
            setStoryError(e.message);
        } finally {
            setIsGeneratingStory(false);
        }
    };

    return (
        <div className="grid-cols-2-tight">
            
            {/* VAIHE 2 - GEMINI KIRJOITTAA */}
            <div className="panel-ai-work" style={{ borderLeft: '4px solid var(--color-ai)', backgroundColor: '#faf5ff', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="icon-label text-ai" style={{ margin: 0 }}><Sparkles size={16} /> 2. Laadi sanallinen asiantuntija-arvio (Pilvi / Gemini)</label>
                    <button 
                        className="btn btn--secondary" 
                        onClick={handleGenerateStory} 
                        disabled={isGeneratingStory}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-ai)', borderColor: 'var(--color-ai-border)', backgroundColor: '#fff' }}
                    >
                        {isGeneratingStory ? <><Loader2 size={14} className="animate-spin"/> Generoidaan...</> : 'Tilaa yhteenveto ja ideat'}
                    </button>
                </div>
                
                <p className="text-xs text-secondary mb-3">Tilaamalla yhteenvedon lähetät yllä olevat, paikallisesti anonymisoidut faktat pilveen muotoiltavaksi sujuvaksi asiantuntijatekstiksi ja ideoitavaksi.</p>
                {storyError && <AlertBox type="danger" customStyle={{ padding: '0.5rem', marginBottom: '0.5rem' }}>{storyError}</AlertBox>}
                
                <textarea 
                    className="form-input" 
                    rows="8" 
                    value={tyohistoria || ''} 
                    onChange={e => setAiResult(prev => ({...prev, tyohistoria: e.target.value}))}
                    placeholder={isGeneratingStory ? "Gemini kirjoittaa..." : "Voit muokata paikallisen mallin palauttamaa listaa, tilata Geminiltä asiantuntija-arvion, tai kirjoittaa itse."}
                />
            </div>
            
            {/* KOULUTUSHISTORIA JA EHDOTUKSET */}
            <div className="panel-ai-edu" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label className="icon-label"><GraduationCap size={16} /> Suoritetut koulutukset</label>
                {suoritetut_koulutukset && suoritetut_koulutukset.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {suoritetut_koulutukset.map((edu, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                                <strong>{edu.tutkinto}</strong>
                                <span style={{ color: '#64748b' }}>{edu.vuosi}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei selkeitä tutkintoja havaittu.</p>
                )}

                {/* GEMININ KOULUTUSEHDOTUKSET */}
                {koulutusehdotukset && koulutusehdotukset.length > 0 && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                        <label className="icon-label" style={{ color: '#b45309' }}><Lightbulb size={16} /> Tekoälyn koulutusideat</label>
                        <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.85rem', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {koulutusehdotukset.map((ehdotus, idx) => (
                                <li key={idx}>{ehdotus}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* TAVOITEAMMATTI JA IDEAT */}
            <div className="card-inner-sm">
                <label className="icon-label text-success"><Briefcase size={16} /> Tavoiteammatti (ESCO)</label>
                {escoProfession ? (
                    <Tag type="success" onRemove={() => setEscoProfession('')}>{escoProfession}</Tag>
                ) : <span className="stat-label" style={{ fontStyle: 'italic' }}>Ei tunnistettu.</span>}
                
                {/* GEMININ VAIHTOEHTOISET AMMATIT */}
                {vaihtoehtoiset_ammatit && vaihtoehtoiset_ammatit.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-border)' }}>
                        <span className="stat-label mb-2 block">Vaihtoehtoiset urapolut (AI:n ideat):</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {vaihtoehtoiset_ammatit.map((alt, idx) => (
                                <Tag key={idx} type="primary" customStyle={{ backgroundColor: '#fff', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    {alt}
                                </Tag>
                            ))}
                        </div>
                    </div>
                )}

                {/* Status työtön */}
                {tilaTyoton && (
                    <div style={{ marginTop: '1rem' }}>
                        <Tag type="warning" onRemove={() => {}}>Työtön työnhakija</Tag>
                    </div>
                )}
            </div>

            {/* AKTIIVISET PALVELUT */}
            {aktiivisetPalvelut && aktiivisetPalvelut.length > 0 && (
                <div className="card-inner-sm" style={{ borderLeft: '4px solid var(--color-success)', gridColumn: 'span 2', backgroundColor: '#f0fdf4' }}>
                    <label className="icon-label text-success"><CalendarClock size={16} /> Havaitut aktiiviset palvelut ja opinnot</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {aktiivisetPalvelut.map((srv, idx) => {
                            const def = ENTITY_DEFINITIONS[srv.entity_key];
                            return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <strong style={{ color: '#166534' }}>{def ? def.label : srv.entity_key}</strong>
                                        {/* KORJAUS: srv.tarkenne -> srv.data?.tarkenne */}
                                        {srv.data?.tarkenne && <span style={{ color: '#64748b', fontStyle: 'italic' }}>({srv.data.tarkenne})</span>}
                                    </div>
                                    <span style={{ backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '12px', color: '#166534', fontWeight: 'bold' }}>
                                        {/* KORJAUS: srv.alku ja srv.loppu -> srv.data?.alku ja srv.data?.loppu */}
                                        {srv.data?.alku} – {srv.data?.loppu}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* AMMATILLISET HUOMIOT */}
            <div className="card-inner-sm" style={{ gridColumn: 'span 2' }}>
                <label className="icon-label text-primary"><TagIcon size={16} /> Ammatilliset huomiot (Paikallinen AI)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {activeTriggers.length > 0 ? activeTriggers.map((trigger, idx) => (
                        <Tag key={idx} type="primary" onRemove={() => setActiveTriggers(prev => prev.filter(t => t !== trigger))}>{trigger}</Tag>
                    )) : <span className="stat-label" style={{ fontStyle: 'italic' }}>Tekoäly ei tehnyt erityishuomioita.</span>}
                </div>
            </div>
            
        </div>
    );
};

export default Step2Results;