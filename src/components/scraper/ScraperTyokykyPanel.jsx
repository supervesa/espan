// --- src/components/scraper/ScraperTyokykyPanel.jsx ---

import React from 'react';
import Checkbox from '../common/Checkbox';
import { Activity, X } from 'lucide-react';

const ScraperTyokykyPanel = ({ tyokykyData, onUpdate }) => {
    // Jos dataa ei ole uutettu ollenkaan, ei näytetä koko laatikkoa
    if (!tyokykyData || Object.keys(tyokykyData).length === 0) return null;

    const { paavalinta, alentuma_kuvaus, oma_arvio, toimenpiteet = [] } = tyokykyData;

    // Piilotetaan laatikko myös silloin, jos käyttäjä on ruksittanut kaikki tyhjäksi paneelista
    if (!paavalinta && !oma_arvio && toimenpiteet.length === 0) return null;

    // Apufunktio yksittäisen kentän päivittämiseen tilaan
    const updateField = (key, value) => {
        onUpdate({ ...tyokykyData, [key]: value });
    };

    // Toimenpiteiden ruksien hallinta
    const toggleToimenpide = (avainsana) => {
        const updatedList = toimenpiteet.filter(t => t.avainsana !== avainsana);
        updateField('toimenpiteet', updatedList);
    };

    // Toimenpiteen sisäisen muuttujan (esim. PVM) tekstikentän hallinta
    const updateToimenpideVar = (avainsana, varKey, value) => {
        const updatedList = toimenpiteet.map(t => {
            if (t.avainsana === avainsana) {
                return { ...t, muuttujat: { ...(t.muuttujat || {}), [varKey]: value } };
            }
            return t;
        });
        updateField('toimenpiteet', updatedList);
    };

    // Kaunistetaan tekniset avainsanat luettavaan muotoon UI:ssa
    const getPaavalintaLabel = (key) => {
        if (key === 'tyokyky_normaali') return 'Normaali';
        if (key === 'tyokyky_selvityksessa') return 'Vaatii selvitystä';
        if (key === 'tyokyky_alentunut') return 'Alentuma';
        return key;
    };

    return (
        <div className="card-inner" style={{ padding: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="var(--color-primary)" />
                Työkyky-havainnot
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* 1. PÄÄARVIO JA OMA ARVIO (VIEREKKÄIN) */}
                {(paavalinta || oma_arvio) && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {paavalinta && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '4px', flexGrow: 1 }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Pääarvio:</span>
                                <span style={{ fontSize: '0.9rem' }}>{getPaavalintaLabel(paavalinta)}</span>
                                <button 
                                    className="btn-tag-dismiss" 
                                    onClick={() => { updateField('paavalinta', null); updateField('alentuma_kuvaus', null); }} 
                                    style={{ marginLeft: 'auto' }}
                                    title="Poista valinta"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        
                        {oma_arvio && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Oma arvio:</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{oma_arvio} / 10</span>
                                <button 
                                    className="btn-tag-dismiss" 
                                    onClick={() => updateField('oma_arvio', null)} 
                                    style={{ marginLeft: '0.5rem' }}
                                    title="Poista arvio"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. ALENTUMAN KUVAUS (NÄKYY VAIN JOS TILA ON ALENTUNUT) */}
                {paavalinta === 'tyokyky_alentunut' && alentuma_kuvaus !== null && (
                    <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Alentuman kuvaus:</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={alentuma_kuvaus || ''} 
                            onChange={(e) => updateField('alentuma_kuvaus', e.target.value)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                    </div>
                )}

                {/* 3. LÖYTYNEET TOIMENPITEET JA PÄIVÄMÄÄRÄT */}
                {toimenpiteet.length > 0 && (
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Havaitut toimenpiteet:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {toimenpiteet.map(toim => (
                                <div key={toim.avainsana} style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                                    <Checkbox 
                                        label={toim.label}
                                        checked={true}
                                        onChange={() => toggleToimenpide(toim.avainsana)}
                                    />
                                    
                                    {toim.muuttujat && Object.keys(toim.muuttujat).map(varKey => (
                                        <div key={varKey} style={{ marginTop: '0.5rem', marginLeft: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>{varKey}:</span>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                value={toim.muuttujat[varKey] || ''}
                                                onChange={(e) => updateToimenpideVar(toim.avainsana, varKey, e.target.value)}
                                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.8rem', width: 'auto', flexGrow: 1 }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScraperTyokykyPanel;