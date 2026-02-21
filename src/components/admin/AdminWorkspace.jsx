import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import AdminModal from './AdminModal';
import ImportPanel from './ImportPanel';
import { createNewItem } from './adminSupabaseService';

const AdminWorkspace = () => {
    const [activeTab, setActiveTab] = useState('workspace');
    const [loading, setLoading] = useState(true);
    
    // Tietokannan data
    const [sections, setSections] = useState([]);
    const [messages, setMessages] = useState([]);
    const [knowledge, setKnowledge] = useState([]);

    // Valinnan ja modaalin tila
    const [selectedItem, setSelectedItem] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [secRes, msgRes, knowRes] = await Promise.all([
                supabase.from('sections').select('*, phrases (*, variables (*))').order('order_index'),
                supabase.from('message_templates').select('*').order('title'),
                supabase.from('knowledge_base').select('*').order('title')
            ]);

            if (secRes.data) setSections(secRes.data);
            if (msgRes.data) setMessages(msgRes.data);
            if (knowRes.data) setKnowledge(knowRes.data);
        } catch (error) {
            console.error("Virhe datan latauksessa:", error);
        }
        setLoading(false);
    };

    const groupBy = (array, key) => array.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});

    const groupedMessages = groupBy(messages, 'category');
    const groupedKnowledge = groupBy(knowledge, 'category');

    const handleItemClick = (type, data) => {
        setSelectedItem({ type, data });
    };

    const handleSaveComplete = () => {
        setIsModalOpen(false);
        fetchAllData(); 
        setSelectedItem(null); 
    };

    // --- UNIVERSAALI UUDEN KOHTEEN LUONTI ---
    const handleAddNewItem = async (type, parentIdOrCategory) => {
        let tableName = '';
        let defaultData = {};

        if (type === 'phrase') {
            tableName = 'phrases';
            defaultData = {
                section_id: parentIdOrCategory,
                phrase_key: 'uusi_fraasi_' + Date.now(),
                short_title: 'Uusi fraasi',
                base_text: ''
            };
        } else if (type === 'message') {
            tableName = 'message_templates';
            defaultData = {
                category: parentIdOrCategory,
                title: 'Uusi viestipohja',
                subject: '',
                template_body: ''
            };
        } else if (type === 'knowledge') {
            tableName = 'knowledge_base';
            defaultData = {
                category: parentIdOrCategory,
                title: 'Uusi ohje/linkki',
                content_text: ''
            };
        }

        const newItem = await createNewItem(tableName, defaultData);
        if (newItem) {
            await fetchAllData();
            setSelectedItem({ type, data: newItem });
            setIsModalOpen(true);
        } else {
            alert("Virhe uuden kohteen luonnissa!");
        }
    };

    if (loading) return <div className="section-container"><p>Ladataan hallintapaneelia...</p></div>;

    return (
        <div className="sections-container" style={{ marginTop: '1rem' }}>
            
            {/* Ylänavigaatio */}
            <div className="tab-navigation" style={{ marginBottom: '0' }}>
                <button
                    className={`tab-button ${activeTab === 'workspace' ? 'active' : ''}`}
                    onClick={() => setActiveTab('workspace')}
                >
                    Työtila (Jaettu ruutu)
                </button>
                <button
                    className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
                    onClick={() => setActiveTab('import')}
                >
                    Massatuonti (Import)
                </button>
            </div>

            {activeTab === 'import' && <div className="main-grid-single"><ImportPanel /></div>}

            {activeTab === 'workspace' && (
                <div className="admin-workspace-grid">
                    
                    {/* VASEN SARAKE: Navigaatiopuu */}
                    <div className="admin-sidebar">
                        
                        <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Lomakerakenne</h3>
                        {sections.map(section => (
                            <details key={section.id} className="discussion-accordion">
                                <summary>{section.title}</summary>
                                <div className="discussion-content" style={{ padding: '0.5rem 0' }}>
                                    {section.phrases?.map(phrase => (
                                        <div 
                                            key={phrase.id}
                                            className={`admin-menu-item ${selectedItem?.data?.id === phrase.id ? 'admin-menu-item--active' : ''}`}
                                            onClick={() => handleItemClick('phrase', phrase)}
                                        >
                                            {phrase.short_title}
                                        </div>
                                    ))}
                                    <button 
                                        className="btn btn--secondary" 
                                        style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }}
                                        onClick={() => handleAddNewItem('phrase', section.id)}
                                    >
                                        + Uusi fraasi
                                    </button>
                                </div>
                            </details>
                        ))}

                        <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Viestipohjat</h3>
                        {Object.keys(groupedMessages).map(category => (
                            <details key={category} className="discussion-accordion">
                                <summary>{category}</summary>
                                <div className="discussion-content" style={{ padding: '0.5rem 0' }}>
                                    {groupedMessages[category].map(msg => (
                                        <div 
                                            key={msg.id}
                                            className={`admin-menu-item ${selectedItem?.data?.id === msg.id ? 'admin-menu-item--active' : ''}`}
                                            onClick={() => handleItemClick('message', msg)}
                                        >
                                            {msg.title}
                                        </div>
                                    ))}
                                    <button 
                                        className="btn btn--secondary" 
                                        style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }}
                                        onClick={() => handleAddNewItem('message', category)}
                                    >
                                        + Uusi viestipohja
                                    </button>
                                </div>
                            </details>
                        ))}

                        <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Tietopankki</h3>
                        {Object.keys(groupedKnowledge).map(category => (
                            <details key={category} className="discussion-accordion">
                                <summary>{category}</summary>
                                <div className="discussion-content" style={{ padding: '0.5rem 0' }}>
                                    {groupedKnowledge[category].map(item => (
                                        <div 
                                            key={item.id}
                                            className={`admin-menu-item ${selectedItem?.data?.id === item.id ? 'admin-menu-item--active' : ''}`}
                                            onClick={() => handleItemClick('knowledge', item)}
                                        >
                                            {item.title}
                                        </div>
                                    ))}
                                    <button 
                                        className="btn btn--secondary" 
                                        style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }}
                                        onClick={() => handleAddNewItem('knowledge', category)}
                                    >
                                        + Uusi ohje/linkki
                                    </button>
                                </div>
                            </details>
                        ))}
                    </div>

                    {/* OIKEA SARAKE: Esikatselu */}
                    <div className="admin-preview">
                        {!selectedItem ? (
                            <div className="admin-empty-state">
                                <span style={{ fontSize: '2rem', marginBottom: '1rem' }}>👈</span>
                                Valitse muokattava kohde vasemmalta valikosta.
                            </div>
                        ) : (
                            <div className="admin-preview-card">
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <span className="tag tag--pending" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                                            Tyyppi: {selectedItem.type.toUpperCase()}
                                        </span>
                                        <h2 style={{ margin: 0 }}>
                                            {selectedItem.type === 'phrase' ? selectedItem.data.short_title : selectedItem.data.title}
                                        </h2>
                                    </div>
                                    <button className="btn" onClick={() => setIsModalOpen(true)}>
                                        Muokkaa kohdetta
                                    </button>
                                </div>

                                {/* Esikatselu: Fraasi */}
                                {selectedItem.type === 'phrase' && (
                                    <>
                                        <div><strong>Avainsana:</strong> {selectedItem.data.phrase_key}</div>
                                        <div><strong>Prioriteetti:</strong> {selectedItem.data.priority_score}</div>
                                        <div className="admin-preview-text">{selectedItem.data.base_text}</div>
                                        
                                        {selectedItem.data.variables?.length > 0 && (
                                            <div style={{ marginTop: '1.5rem' }}>
                                                <strong>Sisältää muuttujat:</strong>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    {selectedItem.data.variables.map(v => (
                                                        <span key={v.id} className="chip chip--warning">[{v.variable_key}] : {v.input_type}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Esikatselu: Viestipohja */}
                                {selectedItem.type === 'message' && (
                                    <>
                                        <div><strong>Otsikko (Subject):</strong> {selectedItem.data.subject || <i>Ei otsikkoa</i>}</div>
                                        <div className="admin-preview-text">{selectedItem.data.template_body}</div>
                                    </>
                                )}

                                {/* Esikatselu: Tietopankki */}
                                {selectedItem.type === 'knowledge' && (
                                    <>
                                        <div className="admin-preview-text">{selectedItem.data.content_text}</div>
                                    </>
                                )}

                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Kaksikanavainen Modaali */}
            {isModalOpen && selectedItem && (
                <AdminModal 
                    item={selectedItem} 
                    sections={sections}
                    onClose={() => setIsModalOpen(false)} 
                    onSaveComplete={handleSaveComplete} 
                />
            )}

        </div>
    );
};

export default AdminWorkspace;