import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { AlertCircle, Plus, Save, Loader2, X, Trash2 } from 'lucide-react';

const CATEGORIES = [
    { value: 'tt_ehdottomat', label: 'Vaihe 1: Ehdottomat edellytykset' },
    { value: 'tt_yleiset', label: 'Vaihe 2: Yleiset edellytykset' },
    { value: 'muut_tuet', label: 'Muut etuudet (Ghost-signaalit)' },
    { value: 'tt_lausuntopohjat', label: 'Lausuntopohjat (Tekstigeneraattori)' }
];

const IMPACT_OPTIONS = [
    { value: 'none', label: 'Neutraali (Ei vaikutusta lausuntoon)' },
    { value: 'critical', label: 'Kriittinen (Hylkäävä lausunto)' },
    { value: 'investigate', label: 'Selvitettävä (Selvityspyyntö lausuntoon)' }
];

const TyottomyysturvaManager = () => {
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedPhrase, setSelectedPhrase] = useState(null);
    const [formData, setFormData] = useState(null);
    const [savingForm, setSavingForm] = useState(false);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        fetchPhrases();
    }, []);

    const fetchPhrases = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('phrases')
                .select('*')
                .in('grouping_key', CATEGORIES.map(c => c.value))
                .order('grouping_key')
                .order('short_title');
            
            if (error) throw error;
            setPhrases(data || []);
        } catch (error) {
            console.error("Virhe TT-fraasien haussa:", error);
            alert("Virhe tietojen lataamisessa.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditPhrase = (phrase) => {
        setIsNew(false);
        setSelectedPhrase(phrase);
        
        // Puretaan metadata helposti muokattavaan muotoon
        let meta = {};
        try { meta = typeof phrase.metadata === 'string' ? JSON.parse(phrase.metadata) : (phrase.metadata || {}); } 
        catch (e) { meta = {}; }

        setFormData({ 
            ...phrase,
            signal_key: meta.signal_key || '',
            impact: meta.impact || 'none',
            syy_teksti: meta.syy_teksti || ''
        });
    };

    const handleCreateNew = () => {
        setIsNew(true);
        const newPhrase = {
            phrase_key: '',
            short_title: '',
            base_text: '',
            grouping_key: 'tt_yleiset',
            signal_key: '',
            impact: 'none',
            syy_teksti: '',
            priority_score: 50
        };
        setSelectedPhrase(newPhrase);
        setFormData(newPhrase);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveForm = async () => {
        if (!formData.phrase_key || !formData.short_title || !formData.grouping_key) {
            alert("Avainsana, Otsikko ja Kategoria ovat pakollisia kenttiä.");
            return;
        }

        setSavingForm(true);
        try {
            // Rakennetaan metadata-objekti takaisin kasaan
            const metadataObj = {};
            if (formData.signal_key) metadataObj.signal_key = formData.signal_key;
            if (formData.impact !== 'none') metadataObj.impact = formData.impact;
            if (formData.syy_teksti) metadataObj.syy_teksti = formData.syy_teksti;

            const payload = {
                id: isNew ? undefined : formData.id,
                phrase_key: formData.phrase_key,
                short_title: formData.short_title,
                base_text: formData.base_text,
                grouping_key: formData.grouping_key,
                priority_score: formData.priority_score,
                metadata: metadataObj,
                // Oletuksena TT-komponentti hakee Section ID:tä, mutta emme pakota sitä tässä ellemme tiedä oikeaa UUID:tä. 
                // Varmista että tämä riittää TT-komponentillesi (se hakee nykyään `in('grouping_key')` perusteella, mikä on ok).
            };

            const { error } = await supabase.from('phrases').upsert(payload);

            if (error) throw error;

            await fetchPhrases();
            setSelectedPhrase(null);
            setFormData(null);
            setIsNew(false);
        } catch (error) {
            console.error("Virhe tallennuksessa:", error);
            alert("Virhe tallennuksessa. Tarkista onko tunniste (phrase_key) uniikki.");
        } finally {
            setSavingForm(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Haluatko varmasti poistaa kohdan "${formData.short_title}"?`)) return;
        
        try {
            const { error } = await supabase.from('phrases').delete().eq('id', formData.id);
            if (error) throw error;
            
            await fetchPhrases();
            setSelectedPhrase(null);
            setFormData(null);
            setIsNew(false);
        } catch (error) {
            console.error("Virhe poistossa:", error);
            alert("Poisto epäonnistui.");
        }
    };

    return (
        <div className="grid-cols-2">
            {/* VASEN PALSTA: Lista työttömyysturvan lausekkeista */}
            <div className="flex-col-gap">
                <Card 
                    title="Työttömyysturvan kysymykset" 
                    icon={AlertCircle}
                    headerAction={
                        <Button variant="primary" size="sm" icon={Plus} onClick={handleCreateNew}>
                            Uusi kysymys
                        </Button>
                    }
                >
                    {loading ? (
                        <div className="text-center text-muted" style={{ padding: '2rem' }}>Ladataan...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {CATEGORIES.map(category => {
                                const catPhrases = phrases.filter(p => p.grouping_key === category.value);
                                if (catPhrases.length === 0) return null;
                                
                                return (
                                    <div key={category.value} style={{ marginBottom: '1rem' }}>
                                        <div className="text-xs fw-bold text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                                            {category.label}
                                        </div>
                                        {catPhrases.map(phrase => (
                                            <div 
                                                key={phrase.id}
                                                onClick={() => handleEditPhrase(phrase)}
                                                style={{
                                                    padding: '0.5rem',
                                                    backgroundColor: selectedPhrase?.id === phrase.id ? '#fffaf5' : 'var(--color-surface)',
                                                    border: `1px solid ${selectedPhrase?.id === phrase.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    marginBottom: '4px'
                                                }}
                                            >
                                                <div className="fw-semibold text-sm">{phrase.short_title}</div>
                                                <div className="text-xs text-muted font-mono">{phrase.phrase_key}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* OIKEA PALSTA: Muokkauspaneeli */}
            <div className="flex-col-gap">
                <Card title={!selectedPhrase ? "Tiedot" : (isNew ? "Uusi" : "Muokkaa")} variant="bordered">
                    {!selectedPhrase ? (
                        <div className="admin-empty-state" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="text-center text-secondary font-italic">Valitse kohta vasemmalta tai luo uusi.</p>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>Avainsana (uniikki)</label>
                                    <input 
                                        type="text" 
                                        className="font-mono text-sm" 
                                        value={formData.phrase_key} 
                                        onChange={(e) => handleFormChange('phrase_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>Kategoria (grouping_key)</label>
                                    <select 
                                        className="modern-select" 
                                        value={formData.grouping_key} 
                                        onChange={(e) => handleFormChange('grouping_key', e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    >
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>Otsikko ruudulla (short_title)</label>
                                <input 
                                    type="text" 
                                    className="modern-input" 
                                    value={formData.short_title} 
                                    onChange={(e) => handleFormChange('short_title', e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>Tuotettava teksti / Selite</label>
                                <textarea 
                                    className="modern-input text-sm" 
                                    value={formData.base_text || ''} 
                                    onChange={(e) => handleFormChange('base_text', e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 0, marginBottom: '1rem', textTransform: 'uppercase' }}>Älymoottorin asetukset (Metadata)</h4>
                                
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="text-sm fw-semibold" style={{ display: 'block', marginBottom: '0.25rem' }}>Kytke päälle signaali (valinnainen)</label>
                                    <input 
                                        type="text" 
                                        className="font-mono text-sm" 
                                        value={formData.signal_key} 
                                        onChange={(e) => handleFormChange('signal_key', e.target.value)}
                                        placeholder="esim. ETUUS_TOIMEENTULOTUKI"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                    <small className="text-muted">Tämä signaali lisätään asiakkaalle, kun asiantuntija klikkaa "Kyllä".</small>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="text-sm fw-semibold" style={{ display: 'block', marginBottom: '0.25rem' }}>Vaikutus lausuntoon</label>
                                    <select 
                                        className="modern-select" 
                                        value={formData.impact} 
                                        onChange={(e) => handleFormChange('impact', e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    >
                                        {IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>

                                {formData.impact === 'investigate' && (
                                    <div>
                                        <label className="text-sm fw-semibold" style={{ display: 'block', marginBottom: '0.25rem' }}>Selvityspyynnön tuloste</label>
                                        <input 
                                            type="text" 
                                            className="modern-input" 
                                            value={formData.syy_teksti} 
                                            onChange={(e) => handleFormChange('syy_teksti', e.target.value)}
                                            placeholder="esim. Päätoiminen yritystoiminta"
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                        />
                                        <small className="text-muted">Tämä teksti tulostuu luonnokseen ranskaisella viivalla.</small>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Button variant="primary" icon={savingForm ? Loader2 : Save} onClick={handleSaveForm} disabled={savingForm}>
                                        {savingForm ? 'Tallennetaan...' : 'Tallenna'}
                                    </Button>
                                    <Button variant="secondary" icon={X} onClick={() => setSelectedPhrase(null)} disabled={savingForm}>
                                        Peruuta
                                    </Button>
                                </div>
                                {!isNew && (
                                    <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={savingForm}>Poista</Button>
                                )}
                            </div>

                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default TyottomyysturvaManager;