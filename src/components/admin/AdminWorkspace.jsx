// --- src/components/admin/AdminWorkspace.jsx ---

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import AdminModal from './AdminModal';
import ImportPanel from './ImportPanel';
import ServicesAdmin from './ServicesAdmin';
import InfoSnippetModal from './InfoSnippetModal'; // <-- UUSI TUONTI
import { createNewItem } from './adminSupabaseService';

const AdminWorkspace = () => {
    const [activeTab, setActiveTab] = useState('services');
    const [loading, setLoading] = useState(true);
    
    // Tietokannan data
    const [sections, setSections] = useState([]);
    const [messages, setMessages] = useState([]);
    const [knowledge, setKnowledge] = useState([]);
    
    // UUDET TILAT SÄHKÖPOSTILINKEILLE JA SANAKIRJALLE
    const [snippets, setSnippets] = useState([]);
    const [triggerDictionary, setTriggerDictionary] = useState([]);

    // Valinnan ja modaalin tila
    const [selectedItem, setSelectedItem] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchAllData(true);
    }, []);

    const fetchAllData = async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        try {
            // Lisätty info_snippets ja phrase_triggers hakuihin!
            const [secRes, phraseRes, varRes, msgRes, knowRes, snipRes, trigRes] = await Promise.all([
                supabase.from('sections').select('*').order('order_index'),
                supabase.from('phrases').select('*'),
                supabase.from('variables').select('*'),
                supabase.from('message_templates').select('*').order('title'),
                supabase.from('knowledge_base').select('*').order('title'),
                supabase.from('info_snippets').select('*').order('label'),
                supabase.from('phrase_triggers').select('signal_key')
            ]);

            // RAKENNETAAN PUU JAVASCRIPTISSÄ
            if (secRes.data) {
                const phrasesData = phraseRes.data || [];
                const varsData = varRes.data || [];

                const builtSections = secRes.data.map(section => {
                    const sectionPhrases = phrasesData.filter(p => p.section_id === section.id);
                    const phrasesWithVars = sectionPhrases.map(phrase => ({
                        ...phrase,
                        variables: varsData.filter(v => v.phrase_id === phrase.id)
                    }));
                    return { ...section, phrases: phrasesWithVars };
                });
                
                setSections(builtSections);
            }

            if (msgRes.data) setMessages(msgRes.data);
            if (knowRes.data) setKnowledge(knowRes.data);
            if (snipRes.data) setSnippets(snipRes.data);

            // Rakennetaan uniikki sanakirja triggereistä
            if (trigRes.data) {
                const uniqueTriggers = [...new Set(trigRes.data.map(t => t.signal_key).filter(Boolean))].sort();
                setTriggerDictionary(uniqueTriggers);
            }

            // Päivitetään valittu kohde, jos se oli jo auki
            setSelectedItem(prev => {
                if (!prev) return null;
                
                if (prev.type === 'phrase' && phraseRes.data) {
                    const updatedPhrase = phraseRes.data.find(p => p.id === prev.data.id);
                    if (updatedPhrase) {
                        updatedPhrase.variables = varRes.data?.filter(v => v.phrase_id === updatedPhrase.id) || [];
                        return { ...prev, data: updatedPhrase };
                    }
                }
                if (prev.type === 'message' && msgRes.data) {
                    const updatedMsg = msgRes.data.find(m => m.id === prev.data.id);
                    if (updatedMsg) return { ...prev, data: updatedMsg };
                }
                if (prev.type === 'knowledge' && knowRes.data) {
                    const updatedKnow = knowRes.data.find(k => k.id === prev.data.id);
                    if (updatedKnow) return { ...prev, data: updatedKnow };
                }
                if (prev.type === 'snippet' && snipRes.data && prev.data !== 'new') {
                    const updatedSnip = snipRes.data.find(s => s.id === prev.data.id);
                    if (updatedSnip) return { ...prev, data: updatedSnip };
                }
                
                return prev;
            });

        } catch (error) {
            console.error("Virhe datan latauksessa:", error);
        }
        if (isInitialLoad) setLoading(false);
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
        fetchAllData(false); 
    };

    const handleAddNewItem = async (type, parentIdOrCategory) => {
        // INFO SNIPPETIN ERIKOISKÄSITTELY
        // Emme luo tyhjää riviä kantaan, vaan annamme InfoSnippetModalin hoitaa luonnin
        if (type === 'snippet') {
            setSelectedItem({ type: 'snippet', data: 'new' });
            setIsModalOpen(true);
            return;
        }

        let tableName = '';
        let defaultData = {};

        if (type === 'phrase') {
            tableName = 'phrases';
            defaultData = { section_id: parentIdOrCategory, phrase_key: 'uusi_fraasi_' + Date.now(), short_title: 'Uusi fraasi', base_text: '' };
        } else if (type === 'message') {
            tableName = 'message_templates';
            defaultData = { category: parentIdOrCategory, title: 'Uusi viestipohja', subject: '', template_body: '' };
        } else if (type === 'knowledge') {
            tableName = 'knowledge_base';
            defaultData = { category: parentIdOrCategory, title: 'Uusi ohje/linkki', content_text: '' };
        }

        const newItem = await createNewItem(tableName, defaultData);
        if (newItem) {
            await fetchAllData(false);
            setSelectedItem({ type, data: newItem });
            setIsModalOpen(true);
        } else {
            alert("Virhe uuden kohteen luonnissa!");
        }
    };

    if (loading) return <div className="section-container"><p>Ladataan hallintapaneelia...</p></div>;

    return (
        <div className="sections-container" style={{ marginTop: '1rem' }}>
            
            <div className="tab-navigation" style={{ marginBottom: '0' }}>
                <button className={`tab-button ${activeTab === 'workspace' ? 'active' : ''}`} onClick={() => setActiveTab('workspace')}>
                    Työtila (Jaettu ruutu)
                </button>
                <button className={`tab-button ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
                    Massatuonti (Import)
                </button>
                <button className={`tab-button ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>
                    Palveluohjaukset (AI)
                </button>
            </div>

            {activeTab === 'import' && <div className="main-grid-single"><ImportPanel /></div>}
            {activeTab === 'services' && <ServicesAdmin />}

            {activeTab === 'workspace' && (
                <div className="admin-workspace-grid">
                    
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
                                    <button className="btn btn--secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }} onClick={() => handleAddNewItem('phrase', section.id)}>
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
                                        <div key={msg.id} className={`admin-menu-item ${selectedItem?.data?.id === msg.id ? 'admin-menu-item--active' : ''}`} onClick={() => handleItemClick('message', msg)}>
                                            {msg.title}
                                        </div>
                                    ))}
                                    <button className="btn btn--secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }} onClick={() => handleAddNewItem('message', category)}>
                                        + Uusi viestipohja
                                    </button>
                                </div>
                            </details>
                        ))}

                        {/* UUSI OSIO: SÄHKÖPOSTIN LINKIT (INFO SNIPPETS) */}
                        <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Sähköpostin tietoiskut</h3>
                        <details className="discussion-accordion" open>
                            <summary>Linkit ja liitteet</summary>
                            <div className="discussion-content" style={{ padding: '0.5rem 0' }}>
                                {snippets.map(snippet => (
                                    <div 
                                        key={snippet.id}
                                        className={`admin-menu-item ${selectedItem?.data?.id === snippet.id ? 'admin-menu-item--active' : ''}`}
                                        onClick={() => handleItemClick('snippet', snippet)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <span>{snippet.label}</span>
                                        {/* Näytetään varoitus, jos linkkiä ei ole tarkistettu yli 6 kuukauteen */}
                                        {snippet.last_checked_at && (new Date() - new Date(snippet.last_checked_at)) > 15778463000 && (
                                            <span style={{ color: 'var(--color-danger)', fontSize: '0.7rem', fontWeight: 'bold' }}>!</span>
                                        )}
                                    </div>
                                ))}
                                <button className="btn btn--secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }} onClick={() => handleAddNewItem('snippet', null)}>
                                    + Uusi linkki
                                </button>
                            </div>
                        </details>

                        <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Tietopankki</h3>
                        {Object.keys(groupedKnowledge).map(category => (
                            <details key={category} className="discussion-accordion">
                                <summary>{category}</summary>
                                <div className="discussion-content" style={{ padding: '0.5rem 0' }}>
                                    {groupedKnowledge[category].map(item => (
                                        <div key={item.id} className={`admin-menu-item ${selectedItem?.data?.id === item.id ? 'admin-menu-item--active' : ''}`} onClick={() => handleItemClick('knowledge', item)}>
                                            {item.title}
                                        </div>
                                    ))}
                                    <button className="btn btn--secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem' }} onClick={() => handleAddNewItem('knowledge', category)}>
                                        + Uusi ohje/linkki
                                    </button>
                                </div>
                            </details>
                        ))}
                    </div>

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
                                            {selectedItem.type === 'phrase' && selectedItem.data.short_title}
                                            {selectedItem.type === 'message' && selectedItem.data.title}
                                            {selectedItem.type === 'knowledge' && selectedItem.data.title}
                                            {selectedItem.type === 'snippet' && selectedItem.data.label}
                                        </h2>
                                    </div>
                                    <button className="btn" onClick={() => setIsModalOpen(true)}>
                                        Muokkaa kohdetta
                                    </button>
                                </div>

                                {/* Esikatselu: Info Snippet */}
                                {selectedItem.type === 'snippet' && selectedItem.data !== 'new' && (
                                    <>
                                        <div><strong>Tunniste:</strong> {selectedItem.data.snippet_key}</div>
                                        <div><strong>Signaalit (Triggers):</strong> {selectedItem.data.triggers || <i style={{opacity: 0.5}}>Ei signaaleja</i>}</div>
                                        <div>
                                            <strong>Tarkistettu: </strong> 
                                            {selectedItem.data.last_checked_at ? new Date(selectedItem.data.last_checked_at).toLocaleDateString('fi-FI') : 'Ei tarkistettu'}
                                        </div>
                                        
                                        <h4 style={{marginTop: '1.5rem', marginBottom: '0.5rem'}}>Sähköpostiin tuleva teksti ja linkki:</h4>
                                        <div className="admin-preview-text" style={{ whiteSpace: 'pre-wrap' }}>{selectedItem.data.content}</div>

                                        <h4 style={{marginTop: '1.5rem', marginBottom: '0.5rem'}}>Tekoälyn ohjeistus:</h4>
                                        <div className="admin-preview-text" style={{backgroundColor: '#fffaf5', borderLeft: '3px solid var(--color-primary)'}}>
                                            {selectedItem.data.ai_description || <i>Ei erillistä ohjetta</i>}
                                        </div>
                                    </>
                                )}

                                {/* Esikatselu: Fraasi */}
                                {selectedItem.type === 'phrase' && (
                                    <>
                                        <div><strong>Avainsana:</strong> {selectedItem.data.phrase_key}</div>
                                        <div><strong>Prioriteetti:</strong> {selectedItem.data.priority_score}</div>
                                        <div className="admin-preview-text">{selectedItem.data.base_text}</div>
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
                                    <div className="admin-preview-text">{selectedItem.data.content_text}</div>
                                )}

                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Kaksikanavainen Modaali - Valitsee oikean komponentin tyypin mukaan */}
            {isModalOpen && selectedItem && (
                selectedItem.type === 'snippet' ? (
                    <InfoSnippetModal 
                        snippet={selectedItem.data}
                        triggerDictionary={triggerDictionary}
                        onClose={() => setIsModalOpen(false)} 
                        onSaveComplete={handleSaveComplete} 
                    />
                ) : (
                    <AdminModal 
                        item={selectedItem} 
                        sections={sections}
                        onClose={() => setIsModalOpen(false)} 
                        onSaveComplete={handleSaveComplete} 
                    />
                )
            )}

        </div>
    );
};

export default AdminWorkspace;