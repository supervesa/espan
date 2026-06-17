// --- src/components/admin/AdminStudio.jsx ---
import React, { useState } from 'react';
import { FileText, List, Activity, Sparkles, Database, MessageSquare, AlertCircle } from 'lucide-react'; 
import { Calendar as CalendarIcon } from 'lucide-react';
import AvailabilityManager from './AvailabilityManager';

// Modernit hallintapaneelit
import SectionsManager from './SectionsManager';
import SignalsManager from './SignalsManager';
import PhrasesManager from './PhrasesManager'; 
import TyottomyysturvaManager from './TyottomyysturvaManager'; // <-- TUOTU SISÄÄN TÄSSÄ

// Vanhat paneelit (Legacy)
import AdminWorkspace from './AdminWorkspace'; 
import ServicesAdmin from './ServicesAdmin';
import ImportPanel from './ImportPanel';

const AdminStudio = () => {
    // Aloitetaan uudesta Fraasikirjastosta
    const [activeTab, setActiveTab] = useState('phrases');

    const tabs = [
        { id: 'workspace', label: 'Työtila (Vanha)', icon: FileText },
        { id: 'phrases', label: 'Fraasit (Teemat)', icon: MessageSquare }, 
        { id: 'sections', label: 'Lomakerakenne', icon: List },
        { id: 'tyottomyysturva', label: 'Työttömyysturva', icon: AlertCircle }, // <-- UUSI NAPPULA LISÄTTY
        { id: 'availability', label: 'Ajanvaraus', icon: CalendarIcon }, 
        { id: 'signals', label: 'Signaalikirjasto', icon: Activity },
        { id: 'ai_rules', label: 'Palveluohjaukset', icon: Sparkles },
        { id: 'import', label: 'Massatuonti', icon: Database }
    ];

    return (
        <div className="app-container">
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="text-2xl fw-bold text-primary" style={{ marginBottom: '0.5rem' }}>
                    Admin Studio
                </h1>
                <p className="text-base text-secondary">
                    Järjestelmän uusi hallintakeskus ohjaustyön lomakkeille, signaaleille ja tekoälysäännöille.
                </p>
            </div>

            {/* Ikonipohjainen navigaatio */}
            <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                borderBottom: '2px solid var(--color-border)',
                marginBottom: '2rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem'
            }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="text-base fw-semibold"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1.25rem',
                                backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                border: 'none',
                                borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
                                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: '-2px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Aktiivisen välilehden renderöinti */}
            <div className="admin-content-area">
                
                {/* VANHA TYÖTILA (Legacy) */}
                {activeTab === 'workspace' && <AdminWorkspace />}
                
                {/* UUDET MODERNI PANEELIT */}
                {activeTab === 'phrases' && <PhrasesManager />}
                {activeTab === 'sections' && <SectionsManager />}
                {activeTab === 'signals' && <SignalsManager />}
                {activeTab === 'tyottomyysturva' && <TyottomyysturvaManager />} {/* <-- RENDERÖINTI LISÄTTY */}
                
                {/* VANHAT KOMPONENTIT PAIKOILLAAN */}
                {activeTab === 'ai_rules' && <div className="animation-fade-in"><ServicesAdmin /></div>}
                {activeTab === 'import' && <div className="main-grid-single animation-fade-in"><ImportPanel /></div>}

                {activeTab === 'availability' && <AvailabilityManager />}

            </div>
        </div>
    );
};

export default AdminStudio;