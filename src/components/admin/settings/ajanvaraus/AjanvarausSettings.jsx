import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient';

import Card from '../../../common/Card';
import AlertBox from '../../../common/AlertBox';
import RangeSlider from '../../../common/RangeSlider';
import { Shield, Clock, GitMerge, Info, CalendarOff } from 'lucide-react';

import AjanvarausPoikkeukset from './AjanvarausPoikkeukset';

const AjanvarausSettings = () => {
    const [expertId, setExpertId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Oletusarvot, jotka vastaavat Ajanvaraus-ohjeistuksen linjauksia
    const defaultSettings = {
        ahkysuoja_aktiivinen: true,
        pyhat_paivat: [],
        lykkays_toleranssi_pv: 14,
        kestot_perus: { alkuhaastattelu: 60, aktivointi: 45, normi: 45 },
        kesto_tuttu_asiakas: 30,
        kirjaus_puskuri_minuutit: 15,
        liedennys_jarjestys: ['taydentava', 'aktivointi'],
        lukitse_alkuhaastattelu: true,
        hatavara_paivat: { taso_1: 5, viimeinen: 1 },
        poikkeus_asetukset: { tasaus: true, purku_viikot: 1 }
    };

    const [settings, setSettings] = useState(defaultSettings);

    const viikonpaivat = [
        { id: 1, label: 'Ma' },
        { id: 2, label: 'Ti' },
        { id: 3, label: 'Ke' },
        { id: 4, label: 'To' },
        { id: 5, label: 'Pe' }
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                setExpertId(currentExpertId);

                const { data, error } = await supabase.schema('espan')
                    .from('settings_ajanvaraus')
                    .select('*')
                    .eq('asiantuntija_id', currentExpertId)
                    .maybeSingle(); 

                if (data && !error) {
                    // KORJAUS: Varmistetaan, että JSONB-kentällä on aina oletusarvot, vaikka kanta palauttaisi null
                    setSettings({ 
                        ...defaultSettings, 
                        ...data,
                        poikkeus_asetukset: { 
                            tasaus: true, 
                            purku_viikot: 1, 
                            ...(data.poikkeus_asetukset || {}) 
                        }
                    });
                } else {
                    console.log("Asetuksia ei löytynyt, käytetään oletuksia.");
                }
            } catch (err) {
                console.error("Virhe asetusten haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const saveSettingToDB = async (field, value) => {
        if (!expertId) return;
        try {
            await supabase.schema('espan')
                .from('settings_ajanvaraus')
                .upsert({ 
                    asiantuntija_id: expertId, 
                    [field]: value, 
                    updated_at: new Date().toISOString() 
                }, { onConflict: 'asiantuntija_id' });
        } catch (e) {
            console.error("Virhe asetuksen tallennuksessa:", e);
        }
    };

    const handleSettingsChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
        saveSettingToDB(field, value);
    };

    const handleNestedSettingsChange = (parentField, childField, value) => {
        setSettings(prev => {
            const updatedParent = { ...(prev[parentField] || {}), [childField]: value };
            saveSettingToDB(parentField, updatedParent);
            return { ...prev, [parentField]: updatedParent };
        });
    };

    const togglePyhaPaiva = (dayId) => {
        setSettings(prev => {
            const currentList = prev.pyhat_paivat || [];
            const isSelected = currentList.includes(dayId);
            const newList = isSelected 
                ? currentList.filter(id => id !== dayId) 
                : [...currentList, dayId].sort();
            
            saveSettingToDB('pyhat_paivat', newList);
            return { ...prev, pyhat_paivat: newList };
        });
    };

    if (loading) {
        return <div className="p-4 text-center text-secondary">Ladataan asiantuntijan asetuksia...</div>;
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            
            <Card title="Viikkorytmi & Kuormitus" icon={Shield} variant="default">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <div>
                        <label className="modern-checkbox-label" style={{ marginBottom: 0 }}>
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={settings.ahkysuoja_aktiivinen}
                                onChange={(e) => handleSettingsChange('ahkysuoja_aktiivinen', e?.target?.checked ?? e)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="fw-semibold text-primary text-sm">Ähkysuoja: Pysäytä kun tavoite on täynnä</span>
                                <span className="text-xs text-secondary lh-tight mt-1">Kun kuluvan viikon tavoitemäärä saavutetaan, assistentti ohjaa uudet perusasiakkaat seuraaville viikoille.</span>
                            </div>
                        </label>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 -0.5rem' }} />

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <label className="text-sm fw-semibold text-primary mb-0">Sallittu lykkäystoleranssi</label>
                            <span className="stat-value text-primary font-mono">{settings.lykkays_toleranssi_pv} vrk</span>
                        </div>
                        <RangeSlider 
                            min={3} max={14} step={1}
                            value={settings.lykkays_toleranssi_pv} 
                            onChange={(e) => handleSettingsChange('lykkays_toleranssi_pv', parseInt(e?.target?.value ?? e))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }} className="text-xs text-secondary fw-medium">
                            <span>Kireä (3 pv)</span>
                            <span>Rento (14 pv)</span>
                        </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 -0.5rem' }} />

                    <div>
                        <label className="text-sm fw-semibold text-primary mb-2 block">Suojatut "Pyhät päivät"</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {viikonpaivat.map(day => (
                                <button
                                    key={day.id}
                                    onClick={() => togglePyhaPaiva(day.id)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 4px',
                                        border: '1px solid',
                                        borderColor: settings.pyhat_paivat.includes(day.id) ? '#3b82f6' : '#cbd5e1',
                                        backgroundColor: settings.pyhat_paivat.includes(day.id) ? '#eff6ff' : '#fff',
                                        color: settings.pyhat_paivat.includes(day.id) ? '#1d4ed8' : '#64748b',
                                        borderRadius: '6px',
                                        fontWeight: settings.pyhat_paivat.includes(day.id) ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-secondary lh-tight mt-2 block">Valitsemasi päivät on lukittu. Niille ehdotetaan aikaa vain absoluuttisessa hätätilassa (46 §).</span>
                    </div>

                </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <Card title="Kestot & Kirjausajat" icon={Clock} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1 text-xs">Alkuhaastattelu</label>
                                <select className="modern-select" value={settings.kestot_perus?.alkuhaastattelu} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'alkuhaastattelu', parseInt(e?.target?.value ?? e))}>
                                    <option value={45}>45 min</option><option value={60}>60 min</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1 text-xs">Aktivointi</label>
                                <select className="modern-select" value={settings.kestot_perus?.aktivointi} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'aktivointi', parseInt(e?.target?.value ?? e))}>
                                    <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1 text-xs">Täydentävät</label>
                                <select className="modern-select" value={settings.kestot_perus?.normi} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'normi', parseInt(e?.target?.value ?? e))}>
                                    <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1">Tuttu asiakas -lyhennys</label>
                                <select className="modern-select" value={settings.kesto_tuttu_asiakas} onChange={(e) => handleSettingsChange('kesto_tuttu_asiakas', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                    <option value={0}>Pois käytöstä</option>
                                    <option value={15}>15 min</option>
                                    <option value={30}>30 min</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1">Kirjausaika (Puskuri)</label>
                                <select className="modern-select" value={settings.kirjaus_puskuri_minuutit} onChange={(e) => handleSettingsChange('kirjaus_puskuri_minuutit', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                    <option value={0}>Ei puskuria</option>
                                    <option value={10}>10 min</option>
                                    <option value={15}>15 min</option>
                                    <option value={30}>30 min</option>
                                </select>
                            </div>
                        </div>

                        <AlertBox type="info" icon={Info}>
                            <span className="fw-bold block mb-1">Tulkkisuojaus on aina aktiivinen</span>
                            Jos asiakas tarvitsee tulkkia, järjestelmä lisää automaattisesti <strong>+{settings.tulkki_lisa_minuutit} min</strong> peruskestoon ja ohittaa tutun asiakkaan lyhennyksen.
                        </AlertBox>

                    </div>
                </Card>

                <Card title="Kompromissien vesiputous (Liedennys)" icon={GitMerge} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        <div>
                            <label className="text-sm fw-semibold text-primary mb-1 block">Lokeroiden lainausjärjestys (Hätätilanteessa)</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>1</span> Täydentävät
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>2</span> Aktivointi
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="modern-checkbox-label" style={{ marginBottom: 0 }}>
                                <input 
                                    type="checkbox" 
                                    className="modern-checkbox"
                                    checked={settings.lukitse_alkuhaastattelu}
                                    onChange={(e) => handleSettingsChange('lukitse_alkuhaastattelu', e?.target?.checked ?? e)}
                                />
                                <span className="fw-semibold text-primary text-sm">Lukitse alkuhaastattelut (Älä lainaa näitä)</span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1 text-xs">1. Hätävarapäivä</label>
                                <select className="modern-select" value={settings.hatavara_paivat?.taso_1} onChange={(e) => handleNestedSettingsChange('hatavara_paivat', 'taso_1', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                    {viikonpaivat.map(d => <option key={`h1-${d.id}`} value={d.id}>{d.label}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="icon-label mb-1 text-xs">Vihoviimeinen hätävara</label>
                                <select className="modern-select" value={settings.hatavara_paivat?.viimeinen} onChange={(e) => handleNestedSettingsChange('hatavara_paivat', 'viimeinen', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                    {viikonpaivat.map(d => <option key={`h2-${d.id}`} value={d.id}>{d.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

            </div>

            <div style={{ gridColumn: '1 / -1' }}>
                <AlertBox type="warning" icon={CalendarOff}>
                    <span className="fw-bold block mb-1">Poikkeustilojen synkronointi on automaattista</span>
                    Järjestelmä lukee lomat, juhlapyhät ja tuurausviikot automaattisesti kalenteristasi (Locations-data). Tuurausviikoilla kalenterisi lukitaan omilta asiakkailta (pl. 46 §), ja lomat pysäyttävät lykkäysviiveen laskennan. 
                </AlertBox>
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
                <AjanvarausPoikkeukset 
                    isBalancingEnabled={settings.poikkeus_asetukset?.tasaus ?? true}
                    spreadWeeks={settings.poikkeus_asetukset?.purku_viikot ?? 1}
                    onChange={(childField, value) => handleNestedSettingsChange('poikkeus_asetukset', childField, value)}
                />
            </div>
            
        </div>
    );
};

export default AjanvarausSettings;