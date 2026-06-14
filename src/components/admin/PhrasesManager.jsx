// --- src/components/admin/PhrasesManager.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { MessageSquare, Plus, Save, Loader2, X, Trash2 } from 'lucide-react';

const PhrasesManager = () => {
    // Teemojen (Sections) tilat
    const [sections, setSections] = useState([]);
    const [selectedSectionId, setSelectedSectionId] = useState(null);
    
    // Fraasien tilat
    const [phrases, setPhrases] = useState([]);
    const [loadingPhrases, setLoadingPhrases] = useState(false);
    
    // Muokkauslomakkeen tilat
    const [selectedPhrase, setSelectedPhrase] = useState(null);
    const [formData, setFormData] = useState(null);
    const [savingForm, setSavingForm] = useState(false);
    const [isNew, setIsNew] = useState(false);

    // 1. Ladataan osiot (Teemat) kerran alussa
    useEffect(() => {
        const fetchSections = async () => {
            try {
                const { data, error } = await supabase
                    .from('sections')
                    .select('id, title, section_key')
                    .order('order_index');
                
                if (error) throw error;
                setSections(data || []);
                
                // Valitaan automaattisesti ensimmäinen osio
                if (data && data.length > 0) {
                    setSelectedSectionId(data[0].id);
                }
            } catch (error) {
                console.error("Virhe osioiden haussa:", error);
            }
        };
        fetchSections();
    }, []);

    // 2. Ladataan fraasit AINA kun valittu osio vaihtuu (Lazy Loading!)
    useEffect(() => {
        if (!selectedSectionId) return;

        const fetchPhrases = async () => {
            setLoadingPhrases(true);
            setSelectedPhrase(null); // Suljetaan lomake teemaa vaihtaessa
            setFormData(null);
            
            try {
                const { data, error } = await supabase
                    .from('phrases')
                    .select('*')
                    .eq('section_id', selectedSectionId)
                    .order('short_title');
                
                if (error) throw error;
                setPhrases(data || []);
            } catch (error) {
                console.error("Virhe fraasien haussa:", error);
            } finally {
                setLoadingPhrases(false);
            }
        };

        fetchPhrases();
    }, [selectedSectionId]);

    // Lomakkeen toiminnot
    const handleEditPhrase = (phrase) => {
        setIsNew(false);
        setSelectedPhrase(phrase);
        setFormData({ ...phrase });
    };

    const handleCreateNew = () => {
        setIsNew(true);
        const newPhrase = {
            section_id: selectedSectionId,
            phrase_key: '',
            short_title: '',
            base_text: '',
            priority_score: 0
        };
        setSelectedPhrase(newPhrase);
        setFormData(newPhrase);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveForm = async () => {
        if (!formData.phrase_key || !formData.short_title || !formData.base_text) {
            alert("Avainsana, Otsikko ja Leipäteksti ovat pakollisia!");
            return;
        }

        setSavingForm(true);
        try {
            const { error } = await supabase
                .from('phrases')
                .upsert({
                    id: isNew ? undefined : formData.id,
                    section_id: formData.section_id,
                    phrase_key: formData.phrase_key,
                    short_title: formData.short_title,
                    base_text: formData.base_text,
                    priority_score: formData.priority_score || 0
                });

            if (error) throw error;

            // Päivitetään vain tämän osion lista
            const { data: updatedList } = await supabase
                .from('phrases')
                .select('*')
                .eq('section_id', selectedSectionId)
                .order('short_title');
            
            setPhrases(updatedList || []);
            setSelectedPhrase(null);
            setFormData(null);
            setIsNew(false);
            alert("Fraasi tallennettu!");
        } catch (error) {
            console.error("Virhe tallennuksessa:", error);
            alert("Tallennus epäonnistui. Tarkista onko tunniste jo käytössä.");
        } finally {
            setSavingForm(false);
        }
    };

    return (
        <div>
            {/* TEEMAN VALINTA (Yläpalkki) */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 className="text-lg fw-semibold text-primary" style={{ marginBottom: '1rem' }}>Valitse muokattava teema (Osio)</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {sections.map(sec => (
                        <Button 
                            key={sec.id}
                            variant={selectedSectionId === sec.id ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setSelectedSectionId(sec.id)}
                        >
                            {sec.title}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid-cols-2">
                {/* VASEN PALSTA: Valitun teeman fraasit */}
                <div className="flex-col-gap">
                    <Card 
                        title={`Fraasit (${phrases.length} kpl)`} 
                        icon={MessageSquare}
                        headerAction={
                            <Button variant="primary" size="sm" icon={Plus} onClick={handleCreateNew} disabled={!selectedSectionId}>
                                Uusi fraasi
                            </Button>
                        }
                    >
                        {loadingPhrases ? (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>Ladataan fraaseja...</div>
                        ) : phrases.length === 0 ? (
                            <div className="text-center text-muted" style={{ padding: '2rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)' }}>
                                Tässä osiossa ei ole vielä fraaseja.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {phrases.map(phrase => (
                                    <div 
                                        key={phrase.id}
                                        onClick={() => handleEditPhrase(phrase)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            backgroundColor: selectedPhrase?.id === phrase.id ? '#fffaf5' : 'var(--color-surface)',
                                            border: `1px solid ${selectedPhrase?.id === phrase.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            borderRadius: 'var(--border-radius)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseOver={(e) => {
                                            if (selectedPhrase?.id !== phrase.id) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)';
                                        }}
                                        onMouseOut={(e) => {
                                            if (selectedPhrase?.id !== phrase.id) e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                                        }}
                                    >
                                        <div className="fw-semibold text-base">{phrase.short_title}</div>
                                        <div className="text-sm font-mono text-secondary mt-1">{phrase.phrase_key}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* OIKEA PALSTA: Fraasin muokkaus */}
                <div className="flex-col-gap">
                    <Card title={!selectedPhrase ? "Fraasin tiedot" : (isNew ? "Uusi fraasi" : "Muokkaa fraasia")} variant="bordered">
                        
                        {!selectedPhrase ? (
                            <div className="admin-empty-state" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p className="text-center text-secondary font-italic">
                                    Valitse fraasi vasemmalta muokataksesi sitä.
                                </p>
                            </div>
                        ) : (
                            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                                
                                {/* Tunniste */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                        Avainsana / Tunniste (phrase_key)
                                    </label>
                                    <input 
                                        type="text" 
                                        className="font-mono text-sm" 
                                        value={formData.phrase_key} 
                                        onChange={(e) => handleFormChange('phrase_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        placeholder="esim. kortti_tulityo"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>

                                {/* Lyhyt otsikko */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                        Lyhyt otsikko (Näkyy työntekijälle)
                                    </label>
                                    <input 
                                        type="text" 
                                        className="modern-input" 
                                        value={formData.short_title} 
                                        onChange={(e) => handleFormChange('short_title', e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>

                                {/* Pääteksti */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                        Generoituva teksti asiakkaalle (base_text)
                                    </label>
                                    <textarea 
                                        className="modern-input text-sm" 
                                        value={formData.base_text} 
                                        onChange={(e) => handleFormChange('base_text', e.target.value)}
                                        rows={8}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', resize: 'vertical' }}
                                    />
                                </div>

                                {/* Prioriteetti */}
                                <div style={{ marginBottom: '2rem' }}>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                        Prioriteetti (Tekoälyn korostus, esim. 0 = normaali, 10 = kriittinen)
                                    </label>
                                    <input 
                                        type="number" 
                                        className="modern-input" 
                                        value={formData.priority_score || 0} 
                                        onChange={(e) => handleFormChange('priority_score', parseInt(e.target.value) || 0)}
                                        style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>

                                {/* Toiminnot */}
                                <div style={{ display: 'flex', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                                    <Button 
                                        variant="primary" 
                                        icon={savingForm ? Loader2 : Save} 
                                        onClick={handleSaveForm}
                                        disabled={savingForm}
                                    >
                                        {savingForm ? 'Tallennetaan...' : 'Tallenna fraasi'}
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        icon={X}
                                        onClick={() => setSelectedPhrase(null)}
                                        disabled={savingForm}
                                    >
                                        Peruuta
                                    </Button>
                                </div>

                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PhrasesManager;