// --- src/components/admin/SectionsManager.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Card from '../common/Card';
import Button from '../common/Button';
import SortableList from '../common/SortableList';
import { Plus, Save, Loader2, List as ListIcon, X } from 'lucide-react';

const SectionsManager = () => {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingOrder, setSavingOrder] = useState(false);
    const [hasOrderChanges, setHasOrderChanges] = useState(false);

    // Oikean palstan tilat
    const [selectedSection, setSelectedSection] = useState(null);
    const [formData, setFormData] = useState(null);
    const [savingForm, setSavingForm] = useState(false);

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .order('order_index');
            
            if (error) throw error;
            
            const formattedData = data.map(sec => ({
                ...sec,
                description: `Tunniste: ${sec.section_key} | Tyyppi: ${sec.ui_component_type}`,
                status: sec.is_multi_select 
                    ? { label: 'Monivalinta', type: 'primary' } 
                    : { label: 'Yksittäisvalinta', type: 'default' }
            }));

            setSections(formattedData);
        } catch (error) {
            console.error("Virhe osioiden haussa:", error);
            alert("Virhe tietojen lataamisessa.");
        } finally {
            setLoading(false);
        }
    };

    // JÄRJESTYKSEN HALLINTA
    const moveSection = (index, direction) => {
        const newSections = [...sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        const temp = newSections[index];
        newSections[index] = newSections[targetIndex];
        newSections[targetIndex] = temp;
        
        const updatedIndexes = newSections.map((sec, i) => ({ ...sec, order_index: i }));
        setSections(updatedIndexes);
        setHasOrderChanges(true);
    };

    const handleSaveOrder = async () => {
        setSavingOrder(true);
        try {
            const updates = sections.map(sec => ({
                id: sec.id,
                order_index: sec.order_index
            }));
            const { error } = await supabase.from('sections').upsert(updates, { onConflict: 'id' });
            if (error) throw error;
            setHasOrderChanges(false);
        } catch (error) {
            console.error("Virhe tallennuksessa:", error);
            alert("Virhe järjestyksen tallennuksessa.");
        } finally {
            setSavingOrder(false);
        }
    };

    // LOMAKKEEN HALLINTA (OIKEA PALSTA)
    const handleEditSection = (section) => {
        setSelectedSection(section);
        setFormData({ ...section }); // Kopioidaan data lomakkeen tilaan
    };

    const handleCreateNew = () => {
        const newSection = {
            id: undefined, // Uusi rivi
            title: '',
            section_key: '',
            is_multi_select: false,
            ui_component_type: 'standard',
            order_index: sections.length // Menee listan hännille
        };
        setSelectedSection(newSection);
        setFormData(newSection);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveForm = async () => {
        if (!formData.title || !formData.section_key) {
            alert("Otsikko ja tunniste ovat pakollisia kenttiä.");
            return;
        }

        setSavingForm(true);
        try {
            // Poistetaan UI:ta varten lisätyt apukentät ennen tallennusta
            const { description, status, ...dbData } = formData;

            const { data, error } = await supabase
                .from('sections')
                .upsert(dbData)
                .select();

            if (error) throw error;

            await fetchSections(); // Päivitetään lista vasemmalla
            setSelectedSection(null); // Suljetaan lomake
            setFormData(null);
        } catch (error) {
            console.error("Virhe osion tallennuksessa:", error);
            alert("Virhe tallennuksessa. Tarkista onko tunniste (section_key) jo käytössä.");
        } finally {
            setSavingForm(false);
        }
    };

    if (loading) {
        return <div className="text-center text-muted" style={{ padding: '3rem' }}>Ladataan lomakerakennetta...</div>;
    }

    return (
        <div className="grid-cols-2">
            {/* VASEN PALSTA: Järjestettävä lista */}
            <div className="flex-col-gap">
                <Card 
                    title="Asiantuntijan lomakerakenne" 
                    icon={ListIcon}
                    headerAction={
                        <Button 
                            variant="primary" 
                            size="sm" 
                            icon={savingOrder ? Loader2 : Save} 
                            disabled={!hasOrderChanges || savingOrder}
                            onClick={handleSaveOrder}
                        >
                            {savingOrder ? 'Tallennetaan...' : 'Tallenna järjestys'}
                        </Button>
                    }
                >
                    <p className="text-sm text-secondary mb-6">
                        Muuta osioiden esitysjärjestystä työntekijän näkymässä nuolinäppäimillä. 
                        Tämä vaikuttaa suoraan ohjausnäkymän järjestykseen.
                    </p>

                    <SortableList 
                        items={sections}
                        onMoveUp={(_, index) => moveSection(index, 'up')}
                        onMoveDown={(_, index) => moveSection(index, 'down')}
                        onEdit={handleEditSection}
                        keyField="id"
                        labelField="title"
                    />

                    <Button 
                        variant="secondary" 
                        icon={Plus} 
                        fullWidth 
                        style={{ marginTop: '1rem' }}
                        onClick={handleCreateNew}
                    >
                        Luo uusi osio
                    </Button>
                </Card>
            </div>

            {/* OIKEA PALSTA: Muokkauspaneeli */}
            <div className="flex-col-gap">
                <Card title={formData?.id ? "Muokkaa osiota" : (selectedSection ? "Uusi osio" : "Asetukset")} variant="bordered">
                    
                    {!selectedSection ? (
                        <div className="admin-empty-state" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="text-center text-secondary font-italic">
                                Valitse osio vasemmalta listalta muokataksesi sen asetuksia, tai luo täysin uusi osio.
                            </p>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                            
                            {/* Nimi */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Osion otsikko (Näkyy käyttäjälle)
                                </label>
                                <input 
                                    type="text" 
                                    className="modern-input" 
                                    value={formData.title} 
                                    onChange={(e) => handleFormChange('title', e.target.value)}
                                    placeholder="esim. Työkyky"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            {/* Tunniste (Key) */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Tietokantatunniste (section_key)
                                </label>
                                <input 
                                    type="text" 
                                    className="font-mono text-sm" 
                                    value={formData.section_key} 
                                    onChange={(e) => handleFormChange('section_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="esim. tyokyky"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#f9fafb' }}
                                />
                                <small className="text-muted">Käytä vain pieniä kirjaimia ja alaviivoja (esim. palkkatuki_osio).</small>
                            </div>

                            <hr style={{ borderTop: '1px dashed var(--color-border)', margin: '1.5rem 0' }} />

                            {/* Komponentin tyyppi */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    Käyttöliittymäkomponentti
                                </label>
                                <select 
                                    className="modern-select" 
                                    value={formData.ui_component_type || 'standard'}
                                    onChange={(e) => handleFormChange('ui_component_type', e.target.value)}
                                >
                                    <option value="standard">Standardi (Perusvalikko)</option>
                                    <option value="plugin_palkkatuki">Palkkatuki (Erikoisnäkymä)</option>
                                    <option value="plugin_tyokyky">Työkyky (Liukusäädin & Koonti)</option>
                                    <option value="plugin_tyottomyysturva">Työttömyysturva (THV-käsittely)</option>
                                    <option value="plugin_tyollistymisen_edellytykset">Työllistymisen edellytykset 33§</option>
                                </select>
                            </div>

                            {/* Monivalinta-toggle */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className="modern-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input 
                                        type="checkbox" 
                                        className="modern-checkbox" 
                                        checked={formData.is_multi_select}
                                        onChange={(e) => handleFormChange('is_multi_select', e.target.checked)}
                                    />
                                    <div>
                                        <div className="fw-semibold">Salli monivalinta</div>
                                        <div className="text-sm text-secondary">Voiko asiantuntija valita tästä osiosta useita fraaseja yhtä aikaa (esim. Ammattikortit).</div>
                                    </div>
                                </label>
                            </div>

                            {/* Toiminnot */}
                            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                                <Button 
                                    variant="primary" 
                                    icon={savingForm ? Loader2 : Save} 
                                    onClick={handleSaveForm}
                                    disabled={savingForm}
                                >
                                    {savingForm ? 'Tallennetaan...' : 'Tallenna osio'}
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    icon={X}
                                    onClick={() => setSelectedSection(null)}
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
    );
};

export default SectionsManager;