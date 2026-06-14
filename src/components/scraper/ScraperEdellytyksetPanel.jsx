// --- src/components/scraper/ScraperEdellytyksetPanel.jsx ---

import React from 'react';
import { Target, X, CheckCircle2 } from 'lucide-react';
import Tag from '../common/Tag';
import Checkbox from '../common/Checkbox';

const ScraperEdellytyksetPanel = ({ edellytyksetData, onUpdate }) => {
    if (!edellytyksetData || Object.keys(edellytyksetData).length === 0) return null;

    const { escoNimi, finescoAla, vaihtoehtoisetAlat, activeTags, selections } = edellytyksetData;

    const hasData = 
        escoNimi || 
        finescoAla || 
        vaihtoehtoisetAlat.length > 0 ||
        activeTags.tavoitteet.length > 0 || 
        activeTags.markkina.length > 0 || 
        activeTags.elamantila.length > 0 ||
        selections.vireilla || 
        selections.hylatty;

    if (!hasData) return null;

    // Poistaa yksittäisen tagin (checkbox)
    const toggleTag = (category, tagId) => {
        const currentList = activeTags[category] || [];
        const newList = currentList.filter(t => t.id !== tagId);
        
        onUpdate({
            ...edellytyksetData,
            activeTags: {
                ...activeTags,
                [category]: newList
            }
        });
    };

    // Poistaa tekstikentän (ammatti)
    const clearField = (key) => {
        onUpdate({ ...edellytyksetData, [key]: null });
    };

    // Apukomponentti listojen piirtämiseen
    const TagCategoryList = ({ title, category }) => {
        const items = activeTags[category] || [];
        if (items.length === 0) return null;

        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>{title}:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {items.map(tag => (
                        <div key={tag.id} style={{ display: 'flex', alignItems: 'center', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                            <Checkbox 
                                label={tag.label}
                                checked={true}
                                onChange={() => toggleTag(category, tag.id)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="card-inner" style={{ padding: '1rem', borderLeft: '4px solid #8B5CF6' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={18} color="#8B5CF6" />
                Edellytysten arviointi (Havaitut)
            </h4>

            {/* ESCO ja AMMATTIALAT */}
            {(escoNimi || finescoAla) && (
                <div style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px dashed #8B5CF6', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: '#8B5CF6' }}>Tavoiteammatit:</span>
                    
                    {escoNimi && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <CheckCircle2 size={14} color="var(--color-success)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>ESCO:</span>
                            <span style={{ fontSize: '0.85rem' }}>{escoNimi}</span>
                            <button className="btn-tag-dismiss" onClick={() => clearField('escoNimi')} style={{ marginLeft: 'auto' }}><X size={14} /></button>
                        </div>
                    )}
                    
                    {finescoAla && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={14} color="var(--color-success)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Toimiala:</span>
                            <span style={{ fontSize: '0.85rem' }}>{finescoAla}</span>
                            <button className="btn-tag-dismiss" onClick={() => clearField('finescoAla')} style={{ marginLeft: 'auto' }}><X size={14} /></button>
                        </div>
                    )}
                </div>
            )}

            {/* VAIHTOEHTOISET ALAT (Chippeinä) */}
            {vaihtoehtoisetAlat.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Vaihtoehtoiset tavoitteet:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {vaihtoehtoisetAlat.map(ala => (
                            <Tag 
                                key={ala.id} 
                                type="primary" 
                                onRemove={() => onUpdate({
                                    ...edellytyksetData, 
                                    vaihtoehtoisetAlat: vaihtoehtoisetAlat.filter(a => a.id !== ala.id)
                                })}
                            >
                                {ala.nimi}
                            </Tag>
                        ))}
                    </div>
                </div>
            )}

            {/* TÄGIT / LAATIKOIDEN VALINNAT */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <TagCategoryList title="Vahvuudet (Tavoitteet)" category="tavoitteet" />
                <TagCategoryList title="Markkinaesteet" category="markkina" />
                <TagCategoryList title="Elämäntilanne-esteet" category="elamantila" />
            </div>

            {/* ETUUDET */}
            {(selections.vireilla || selections.hylatty) && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                    {selections.vireilla && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                            <span><strong>Vireillä:</strong> {selections.vireilla.label}</span>
                            <button className="btn-tag-dismiss" onClick={() => onUpdate({...edellytyksetData, selections: {...selections, vireilla: null}})}><X size={14} /></button>
                        </div>
                    )}
                    {selections.hylatty && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span><strong>Hylätty:</strong> {selections.hylatty.label}</span>
                            <button className="btn-tag-dismiss" onClick={() => onUpdate({...edellytyksetData, selections: {...selections, hylatty: null}})}><X size={14} /></button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScraperEdellytyksetPanel;