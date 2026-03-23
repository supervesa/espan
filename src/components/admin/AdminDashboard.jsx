import React, { useState } from 'react';
import ImportPanel from './ImportPanel';
import DataBrowser from './DataBrowser';
// import MessageTemplatesAdmin from './MessageTemplatesAdmin'; // Luodaan myöhemmin
// import KnowledgeBaseAdmin from './KnowledgeBaseAdmin'; // Luodaan myöhemmin

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('browser');

    return (
        <div className="sections-container" style={{ marginTop: '1rem' }}>
            
            <div className="tab-navigation" style={{ marginBottom: '0' }}>
                <button
                    className={`tab-button ${activeTab === 'browser' ? 'active' : ''}`}
                    onClick={() => setActiveTab('browser')}
                >
                    Selaa tietokantaa
                </button>
                <button
                    className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
                    onClick={() => setActiveTab('import')}
                >
                    Tuo dataa (Import)
                </button>
            </div>

            <div className="main-grid-single">
                {activeTab === 'import' && <ImportPanel />}
                {activeTab === 'browser' && <DataBrowser />}
            </div>
            
        </div>
    );
};

export default AdminDashboard;