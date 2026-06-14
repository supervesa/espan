// --- src/components/admin/SignalsManager.jsx ---
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import DataTable from '../common/DataTable';
import { Plus, Save, Loader2, X, Search, Activity, Trash2 } from 'lucide-react';

const SignalsManager = () => {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Suodattimet
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Kaikki');

    // Oikean palstan tilat
    const [selectedSignal, setSelectedSignal] = useState(null);
    const [formData, setFormData] = useState(null);
    const [savingForm, setSavingForm] = useState(false);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        fetchSignals();
    }, []);

    const fetchSignals = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_signals')
                .select('*')
                .order('category')
                .order('label');
            
            if (error) throw error;
            setSignals(data || []);
        } catch (error) {
            console.error("Virhe signaalien haussa:", error);
            alert("Virhe tietojen lataamisessa.");
        } finally {
            setLoading(false);
        }
    };

    // Unikoiden kategorioiden poiminta pudotusvalikkoa varten
    const categories = useMemo(() => {
        const cats = new Set(signals.map(s => s.category).filter(Boolean));
        return ['Kaikki', ...Array.from(cats).sort()];
    }, [signals]);

    // Suodatettu data taulukkoa varten
    const filteredSignals = useMemo(() => {
        return signals.filter(sig => {
            const matchesSearch = (sig.label?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                                  (sig.signal_key?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesCat = filterCategory === 'Kaikki' || sig.category === filterCategory;
            return matchesSearch && matchesCat;
        });
    }, [signals, searchTerm, filterCategory]);

    // LOMAKKEEN HALLINTA
    const handleEditSignal = (signal) => {
        setIsNew(false);
        setSelectedSignal(signal);
        setFormData({ ...signal });
    };

    const handleCreateNew = () => {
        setIsNew(true);
        const newSignal = {
            signal_key: '',
            label: '',
            category: filterCategory !== 'Kaikki' ? filterCategory : '',
            description: ''
        };
        setSelectedSignal(newSignal);
        setFormData(newSignal);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveForm = async () => {
        if (!formData.signal_key || !formData.label || !formData.category) {
            alert("Tunniste, Nimi ja Kategoria ovat pakollisia kenttiä.");
            return;
        }

        setSavingForm(true);
        try {
            // Jos kyseessä on uusi, varmistetaan ettei avain ole jo käytössä
            if (isNew) {
                const { data: existing } = await supabase
                    .from('system_signals')
                    .select('signal_key')
                    .eq('signal_key', formData.signal_key)
                    .single();
                
                if (existing) {
                    alert("Tämä tunniste (signal_key) on jo käytössä! Valitse toinen.");
                    setSavingForm(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('system_signals')
                .upsert({
                    signal_key: formData.signal_key,
                    label: formData.label,
                    category: formData.category,
                    description: formData.description
                }, { onConflict: 'signal_key' }); // signal_key on primary key tai unique

            if (error) throw error;

            await fetchSignals();
            setSelectedSignal(null);
            setFormData(null);
            setIsNew(false);
        } catch (error) {
            console.error("Virhe tallennuksessa:", error);
            alert("Virhe signaalin tallennuksessa.");
        } finally {
            setSavingForm(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Haluatko varmasti poistaa signaalin "${formData.label}"?\nTämä voi rikkoa tekoälysääntöjä, jotka luottavat tähän signaaliin.`)) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('system_signals')
                .delete()
                .eq('signal_key', formData.signal_key);
                
            if (error) throw error;
            
            await fetchSignals();
            setSelectedSignal(null);
            setFormData(null);
            setIsNew(false);
        } catch (error) {
            console.error("Virhe poistossa:", error);
            alert("Virhe signaalin poistossa.");
        }
    };

    // Taulukon sarakkeet
    const columns = [
        {
            label: 'Nimi / Tunniste',
            render: (row) => (
                <div>
                    <div className="fw-semibold text-primary">{row.label}</div>
                    <div className="text-xs font-mono text-secondary mt-1">{row.signal_key}</div>
                </div>
            )
        },
        {
            label: 'Kategoria',
            render: (row) => <Badge variant="default">{row.category}</Badge>
        }
    ];

    return (
        <div className="grid-cols-2">
            {/* VASEN PALSTA: Signaalilista */}
            <div className="flex-col-gap">
                <Card 
                    title="Signaalikirjasto" 
                    icon={Activity}
                    headerAction={
                        <Button variant="primary" size="sm" icon={Plus} onClick={handleCreateNew}>
                            Uusi signaali
                        </Button>
                    }
                >
                    {/* Hakusuodattimet */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={16} className="text-secondary" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                type="text" 
                                placeholder="Etsi signaalia..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <select 
                                className="modern-select" 
                                value={filterCategory} 
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Datataulukko */}
                    {loading ? (
                        <div className="text-center text-muted" style={{ padding: '2rem' }}>Ladataan signaaleja...</div>
                    ) : (
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)' }}>
                            <DataTable 
                                columns={columns} 
                                data={filteredSignals} 
                                keyField="signal_key" 
                                onRowClick={handleEditSignal}
                                emptyMessage="Yhtään signaalia ei löytynyt hakuehdoilla."
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* OIKEA PALSTA: Muokkauspaneeli */}
            <div className="flex-col-gap">
                <Card title={!selectedSignal ? "Signaalin tiedot" : (isNew ? "Uusi signaali" : "Muokkaa signaalia")} variant="bordered">
                    
                    {!selectedSignal ? (
                        <div className="admin-empty-state" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="text-center text-secondary font-italic">
                                Valitse signaali vasemmalta listalta muokataksesi sitä, tai luo uusi.
                            </p>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                            
                            {/* Tunniste (Vain luku jos muokataan vanhaa) */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Tietokantatunniste (signal_key)
                                </label>
                                <input 
                                    type="text" 
                                    className="font-mono text-sm" 
                                    value={formData.signal_key} 
                                    onChange={(e) => isNew && handleFormChange('signal_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    disabled={!isNew}
                                    placeholder="esim. patevyys_tulityokortti"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: !isNew ? '#f9fafb' : '#fff' }}
                                />
                                {isNew && <small className="text-muted">Käytä vain pieniä kirjaimia ja alaviivoja. Ei voi muuttaa luonnin jälkeen.</small>}
                            </div>

                            {/* Nimi */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Näkyvä nimi (Label)
                                </label>
                                <input 
                                    type="text" 
                                    className="modern-input" 
                                    value={formData.label} 
                                    onChange={(e) => handleFormChange('label', e.target.value)}
                                    placeholder="esim. Tulityökortti"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            {/* Kategoria (Suositellaan olemassa olevan valintaa) */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Kategoria
                                </label>
                                <input 
                                    type="text" 
                                    list="categories-list"
                                    className="modern-input" 
                                    value={formData.category} 
                                    onChange={(e) => handleFormChange('category', e.target.value)}
                                    placeholder="Valitse tai kirjoita uusi kategoria"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                                <datalist id="categories-list">
                                    {categories.filter(c => c !== 'Kaikki').map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Kuvaus */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Kuvaus / Sisäinen muistio
                                </label>
                                <textarea 
                                    className="modern-input text-sm" 
                                    value={formData.description || ''} 
                                    onChange={(e) => handleFormChange('description', e.target.value)}
                                    rows={4}
                                    placeholder="Mihin tätä signaalia käytetään..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', resize: 'vertical' }}
                                />
                            </div>

                            {/* Toiminnot */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Button 
                                        variant="primary" 
                                        icon={savingForm ? Loader2 : Save} 
                                        onClick={handleSaveForm}
                                        disabled={savingForm}
                                    >
                                        {savingForm ? 'Tallennetaan...' : 'Tallenna signaali'}
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        icon={X}
                                        onClick={() => setSelectedSignal(null)}
                                        disabled={savingForm}
                                    >
                                        Peruuta
                                    </Button>
                                </div>
                                
                                {!isNew && (
                                    <Button 
                                        variant="danger" 
                                        icon={Trash2}
                                        onClick={handleDelete}
                                        disabled={savingForm}
                                    >
                                        Poista
                                    </Button>
                                )}
                            </div>

                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default SignalsManager;