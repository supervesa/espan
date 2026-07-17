import React, { useState } from 'react';
import Modal from '../common/Modal';
import { ENTITY_DEFINITIONS } from '../../data/entityDefinitions';
import { Layers, Trash2, GraduationCap, CalendarClock, Activity } from 'lucide-react';

const ServiceManager = ({ state, actions, isOpen, onClose }) => {
    // 1. Luetaan molemmat Golden Master -taulukot ja uusi asiantuntijapalveluiden taulukko
    const services = Array.isArray(state.sessionServices) ? state.sessionServices : [];
    const educations = Array.isArray(state.sessionEducations) ? state.sessionEducations : [];
    const asiantuntijapalvelut = Array.isArray(state.services) ? state.services : []; // UUSI LISÄYS

    // --- TOIMINNOT ---
    const handleRemoveService = (id) => {
        const updatedServices = services.filter(x => x.id !== id);
        actions.onUpdateVariable('global', 'sessionServices', updatedServices);
    };

    const handleRemoveEducation = (id) => {
        const updatedEdus = educations.filter(x => x.id !== id);
        actions.onUpdateVariable('global', 'sessionEducations', updatedEdus);
    };

    // UUSI LISÄYS: Asiantuntijapalveluiden poisto
    const handleRemoveAsiantuntijapalvelu = (id) => {
        const updatedAsiantuntija = asiantuntijapalvelut.filter(x => x.id !== id);
        actions.onUpdateVariable('global', 'services', updatedAsiantuntija);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Hallitse istunnon palveluita ja koulutuksia" 
            icon={Layers}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                    Tässä listassa on kaikki tähän istuntoon tallennetut tapahtumat ja tutkinnot. 
                    Voit poistaa niitä tarvittaessa, mikä päivittää yhteenvedon tekstit automaattisesti.
                </p>

                {/* --- UUSI OSIO: ASIANTUNTIJAPALVELUT (services) --- */}
                <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#0ea5e9' }}>
                        <Activity size={18} /> Asiantuntijapalvelut (Seuranta)
                    </h4>
                    {asiantuntijapalvelut.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {asiantuntijapalvelut.map(s => (
                                <div key={s.id} style={{ padding: '12px 15px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#0369a1' }}>
                                            {s.title || ENTITY_DEFINITIONS[s.definitionKey]?.label || 'Tuntematon palvelu'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#0ea5e9', marginTop: '4px' }}>
                                            Tila: <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{s.tila || 'Ohjattu'}</span> 
                                            {s.lisatieto && (
                                                <span style={{ display: 'block', marginTop: '2px', color: '#475569' }}>
                                                    Perustelu: {s.lisatieto}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveAsiantuntijapalvelu(s.id)}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}
                                        title="Poista palvelu"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}>
                            Ei tallennettuja asiantuntijapalveluita tässä istunnossa.
                        </div>
                    )}
                </div>

                {/* --- OSIO 1: AKTIIVISET PALVELUT (sessionServices) --- */}
                <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--color-primary)' }}>
                        <CalendarClock size={18} /> Aktiiviset palvelut ja opinnot
                    </h4>
                    {services.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {services.map(s => (
                                <div key={s.id} style={{ padding: '12px 15px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            {ENTITY_DEFINITIONS[s.entity_key]?.label || s.entity_key}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                            {s.data.alku} – {s.data.loppu} {s.data.nimi ? `(${s.data.nimi})` : ''}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveService(s.id)}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}
                                        title="Poista palvelu"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}>
                            Ei tallennettuja palveluita tässä istunnossa.
                        </div>
                    )}
                </div>

                {/* --- OSIO 2: KOULUTUSHISTORIA (sessionEducations) --- */}
                <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#10b981' }}>
                        <GraduationCap size={18} /> Saavutetut tutkinnot (Koulutushistoria)
                    </h4>
                    {educations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {educations.map(edu => (
                                <div key={edu.id} style={{ padding: '12px 15px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#065f46' }}>
                                            {edu.data.tutkinto}
                                        </div>
                                        {edu.data.vuosi && (
                                            <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '2px' }}>
                                                Valmistumisvuosi: {edu.data.vuosi}
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveEducation(edu.id)}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}
                                        title="Poista tutkinto"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}>
                            Ei tallennettuja aiempia tutkintoja tässä istunnossa.
                        </div>
                    )}
                </div>

            </div>
        </Modal>
    );
};

export default ServiceManager;