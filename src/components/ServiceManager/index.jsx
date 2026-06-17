// src/components/ServiceManager/index.jsx
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { ENTITY_DEFINITIONS } from '../../data/entityDefinitions';
import { Layers, Plus, Trash2 } from 'lucide-react';

const ServiceManager = ({ state, actions, isOpen, onClose }) => {
    const services = Array.isArray(state.sessionServices) ? state.sessionServices : [];

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Hallitse istunnon palveluita" 
            icon={Layers}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Tässä listassa on kaikki tähän istuntoon tallennetut tapahtumat. 
                    Voit poistaa niitä tai lisätä uusia, jotka vaikuttavat yhteenvetoon.
                </p>

                {services.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {services.map(s => (
                            <div key={s.id} style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{ENTITY_DEFINITIONS[s.entity_key]?.label}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.data.alku} – {s.data.loppu}</div>
                                </div>
                                <button 
                                    onClick={() => actions.onUpdateVariable('global', 'sessionServices', services.filter(x => x.id !== s.id))}
                                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                        Ei vielä tallennettuja palveluita tässä istunnossa.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ServiceManager;