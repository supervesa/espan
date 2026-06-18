import React from 'react';
import { Briefcase, GraduationCap, CalendarClock, Layers, Info, Tag as TagIcon } from 'lucide-react';
import Tag from '../../../common/Tag';
import AlertBox from '../../../common/AlertBox';
import { ENTITY_DEFINITIONS } from '../../../../data/entityDefinitions'; // LISÄTTY SANAKIRJA

const Step2Results = ({ 
    aiResult, 
    finescoSector, setFinescoSector, 
    escoProfession, setEscoProfession, 
    tilaTyoton, aktiivisetPalvelut,
    activeTriggers, setActiveTriggers 
}) => {

    const {
        tyohistoria, suoritetut_koulutukset, tyokokeilut_pvm,
        vaihtoehtoiset_ammatit, koulutusehdotukset,
        nykyinen_opiskelija, nykyinen_yrittaja
    } = aiResult;

    return (
        <div className="grid-cols-2-tight">
            
            <div className="panel-ai-work">
                <label className="icon-label"><Briefcase size={16} /> Työ- ja palveluhistoria</label>
                <textarea className="form-input" rows="8" value={tyohistoria || ''} readOnly />
            </div>
            
            {/* KOULUTUSHISTORIA LISTANA */}
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
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: '5px' }}>Siirtyvät suoraan Koulutus-välilehdelle.</span>
                    </div>
                ) : (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei selkeitä tutkintoja havaittu.</p>
                )}
            </div>

            {/* AKTIIVISET PALVELUT LISTANA */}
            {aktiivisetPalvelut && aktiivisetPalvelut.length > 0 && (
                <div className="card-inner-sm" style={{ borderLeft: '4px solid var(--color-success)', marginBottom: '1rem', gridColumn: 'span 2', backgroundColor: '#f0fdf4' }}>
                    <label className="icon-label text-success"><CalendarClock size={16} /> Havaitut aktiiviset palvelut ja opinnot</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {aktiivisetPalvelut.map((srv, idx) => {
                            const def = ENTITY_DEFINITIONS[srv.entity_key];
                            return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <strong style={{ color: '#166534' }}>{def ? def.label : srv.entity_key}</strong>
                                        {srv.tarkenne && <span style={{ color: '#64748b', fontStyle: 'italic' }}>({srv.tarkenne})</span>}
                                    </div>
                                    <span style={{ backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '12px', color: '#166534', fontWeight: 'bold' }}>
                                        {srv.alku} – {srv.loppu}
                                    </span>
                                </div>
                            );
                        })}
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>Siirtyvät automaattisesti taulukoihin ja kalenteriavustajalle.</span>
                    </div>
                </div>
            )}

            {/* Työtön-status */}
            {tilaTyoton && (
                <div className="card-inner-sm" style={{ borderLeft: '4px solid var(--color-warning)', gridColumn: 'span 2' }}>
                    <label className="icon-label" style={{ color: '#b45309' }}><Layers size={16} /> Asiakkaan status</label>
                    <div style={{ marginTop: '0.5rem' }}><Tag type="warning">✓ Työtön työnhakija</Tag></div>
                </div>
            )}

            {tyokokeilut_pvm && (
                <div className="panel-ai-tk" style={{ gridColumn: 'span 2' }}>
                    <label className="icon-label"><CalendarClock size={16} /> Menneet työkokeilut (Palkkatukilaskuri)</label>
                    <textarea className="form-input text-mono" rows="2" value={tyokokeilut_pvm} readOnly />
                </div>
            )}

            {koulutusehdotukset?.length > 0 && (
                <div className="panel-ai-edu" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', gridColumn: 'span 2' }}>
                    <Info size={20} color="#b45309" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: '#b45309' }}>
                        <strong>Tekoäly ideoi {koulutusehdotukset.length} uutta koulutuspolkua.</strong> Nämä siirretään Koulutus-välilehdelle.
                    </span>
                </div>
            )}

            <div className="card-inner-sm">
                <label className="icon-label text-success"><Layers size={16} /> Tunnistettu ammattialue</label>
                {finescoSector && (
                    <div style={{ marginBottom: '1rem' }}>
                        <Tag type="primary" onRemove={() => setFinescoSector('')} customStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}>
                            {finescoSector}
                        </Tag>
                    </div>
                )}

                <label className="icon-label text-success" style={{ marginTop: finescoSector ? '0' : '0' }}><Briefcase size={16} /> Tavoiteammatti (ESCO)</label>
                {escoProfession ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <Tag type="success" onRemove={() => setEscoProfession('')}>
                            {escoProfession}
                        </Tag>
                        
                        {vaihtoehtoiset_ammatit?.length > 0 && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)' }}>
                                <span className="stat-label">Muut kiinnostuksen kohteet (Pelkkä ehdotus):</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                                    {vaihtoehtoiset_ammatit.map((alt, idx) => (
                                        <Tag key={idx} type="primary" customStyle={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                            {alt}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : <span className="stat-label" style={{ fontStyle: 'italic', marginBottom: '1rem', display: 'block' }}>Ei tunnistettu.</span>}

                {(nykyinen_opiskelija || nykyinen_yrittaja) && (
                    <AlertBox type="purple" customStyle={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)', color: '#6d28d9', marginTop: '1rem' }}>
                        Tekoäly havaitsi asiakkaan olevan tällä hetkellä: 
                        <strong>{nykyinen_opiskelija ? ' Opiskelija' : ''}</strong>
                        <strong>{nykyinen_opiskelija && nykyinen_yrittaja ? ' ja ' : ''}</strong>
                        <strong>{nykyinen_yrittaja ? ' Yrittäjä' : ''}</strong>. 
                        Tieto siirretään Työttömyysturva-osiolle.
                    </AlertBox>
                )}
            </div>

            <div className="card-inner-sm">
                <label className="icon-label text-primary"><TagIcon size={16} /> Automaattiset signaalit</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {activeTriggers.length > 0 ? activeTriggers.map((trigger, idx) => (
                        <Tag key={idx} type="primary" onRemove={() => setActiveTriggers(prev => prev.filter(t => t !== trigger))}>
                            {trigger}
                        </Tag>
                    )) : <span className="stat-label" style={{ fontStyle: 'italic' }}>Ei signaaleja.</span>}
                </div>
            </div>
            
        </div>
    );
};

export default Step2Results;