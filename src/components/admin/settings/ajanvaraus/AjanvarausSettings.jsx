import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient';

import Card from '../../../common/Card';
import AlertBox from '../../../common/AlertBox';
import RangeSlider from '../../../common/RangeSlider';
import { Shield, Clock, GitMerge, Info, CalendarOff, Zap } from 'lucide-react';

import AjanvarausPoikkeukset from './AjanvarausPoikkeukset';
// Tuodaan hiekkalaatikko
import AjanvarausSandbox from './AjanvarausSandbox';

const AjanvarausSettings = () => {
    const [expertId, setExpertId] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UUSI: Purkkaratkaisun tilamuuttuja näkymän vaihtoon
    const [showSandbox, setShowSandbox] = useState(false);

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
        return <div className="p-4 text-center text-secondary text-sm">Ladataan asiantuntijan asetuksia...</div>;
    }

    // UUSI: Jos showSandbox on totta, piirretään vain hiekkalaatikko
    if (showSandbox) {
        return (
            <div>
                <button 
                    onClick={() => setShowSandbox(false)} 
                    className="btn btn--secondary mb-4" 
                    style={{ marginBottom: '1.5rem' }}
                >
                    ← Palaa asetuksiin
                </button>
                <AjanvarausSandbox />
            </div>
        );
    }

    // MUUTEN piirretään normaali asetusnäkymä
    return (
        <div>
            {/* UUSI: Linkki erilliselle Hiekkalaatikko-sivulle (Purkkaratkaisu napilla) */}
            <div className="smart-analysis-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 className="text-lg fw-bold text-ai icon-heading" style={{ margin: 0 }}>
                        <Zap size={22} /> Assistentin Hiekkalaatikko (Testipenkki)
                    </h2>
                    <p className="text-sm text-secondary m-0 mt-1">
                        Siirry erilliselle testisivulle simuloimaan kalenteriruuhkia ja testaamaan tekoälyn kykyä noudattaa näitä asetuksia.
                    </p>
                </div>
                
                {/* Nappi muuttaa tilamuuttujan arvon todeksi */}
                <button 
                    onClick={() => setShowSandbox(true)} 
                    className="btn-ai"
                >
                    Avaa Hiekkalaatikko
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                
                <Card title="Viikkorytmi & Kuormitus" icon={Shield} variant="default">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        <div>
                            <label className="custom-checkbox-row">
                                <input 
                                    type="checkbox" 
                                    className="modern-checkbox"
                                    checked={settings.ahkysuoja_aktiivinen}
                                    onChange={(e) => handleSettingsChange('ahkysuoja_aktiivinen', e?.target?.checked ?? e)}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="text-sm fw-semibold text-primary">Ähkysuoja: Pysäytä kun tavoite on täynnä</span>
                                    <span className="text-xs text-secondary lh-tight mt-1">Kun kuluvan viikon tavoitemäärä saavutetaan, assistentti ohjaa uudet perusasiakkaat seuraaville viikoille.</span>
                                </div>
                            </label>
                        </div>

                        <hr />

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                <label className="text-sm fw-semibold text-primary mb-0">Sallittu lykkäystoleranssi</label>
                                <span className="stat-value">{settings.lykkays_toleranssi_pv} vrk</span>
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

                        <hr />

                        <div>
                            <label className="text-sm fw-semibold text-primary mb-2 block">Suojatut viikonpäivät (Fokus-päivät)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {viikonpaivat.map(day => (
                                    <button
                                        key={day.id}
                                        onClick={() => togglePyhaPaiva(day.id)}
                                        className={`chip ${settings.pyhat_paivat.includes(day.id) ? 'chip--active' : ''}`}
                                        style={{ flex: 1, justifyContent: 'center' }}
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
                                    <select className="modern-select text-sm" value={settings.kestot_perus?.alkuhaastattelu} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'alkuhaastattelu', parseInt(e?.target?.value ?? e))}>
                                        <option value={45}>45 min</option><option value={60}>60 min</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">Aktivointi</label>
                                    <select className="modern-select text-sm" value={settings.kestot_perus?.aktivointi} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'aktivointi', parseInt(e?.target?.value ?? e))}>
                                        <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">Täydentävät</label>
                                    <select className="modern-select text-sm" value={settings.kestot_perus?.normi} onChange={(e) => handleNestedSettingsChange('kestot_perus', 'normi', parseInt(e?.target?.value ?? e))}>
                                        <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">Tuttu asiakas -lyhennys</label>
                                    <select className="modern-select text-sm" value={settings.kesto_tuttu_asiakas} onChange={(e) => handleSettingsChange('kesto_tuttu_asiakas', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                        <option value={0}>Pois käytöstä</option>
                                        <option value={15}>15 min</option>
                                        <option value={30}>30 min</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">Kirjausaika (Puskuri)</label>
                                    <select className="modern-select text-sm" value={settings.kirjaus_puskuri_minuutit} onChange={(e) => handleSettingsChange('kirjaus_puskuri_minuutit', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                        <option value={0}>Ei puskuria</option>
                                        <option value={10}>10 min</option>
                                        <option value={15}>15 min</option>
                                        <option value={30}>30 min</option>
                                    </select>
                                </div>
                            </div>

                            <AlertBox type="info" icon={Info}>
                                <span className="fw-bold block mb-1 text-sm">Tulkkisuojaus on aina aktiivinen</span>
                                <span className="text-xs">Jos asiakas tarvitsee tulkkia, järjestelmä lisää automaattisesti <strong>+{settings.tulkki_lisa_minuutit} min</strong> peruskestoon ja ohittaa tutun asiakkaan lyhennyksen.</span>
                            </AlertBox>

                        </div>
                    </Card>

                    <Card title="Kompromissien vesiputous (Liedennys)" icon={GitMerge} variant="bordered">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            
                            <div>
                                <label className="text-sm fw-semibold text-primary mb-1 block">Lokeroiden lainausjärjestys (Hätätilanteessa)</label>
                                <div className="variables-container" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px' }}>
                                    <div className="text-xs text-secondary fw-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="tag">1</span> Täydentävät
                                    </div>
                                    <div className="text-xs text-secondary fw-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="tag">2</span> Aktivointi
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="custom-checkbox-row">
                                    <input 
                                        type="checkbox" 
                                        className="modern-checkbox"
                                        checked={settings.lukitse_alkuhaastattelu}
                                        onChange={(e) => handleSettingsChange('lukitse_alkuhaastattelu', e?.target?.checked ?? e)}
                                    />
                                    <span className="text-sm fw-semibold text-primary">Lukitse alkuhaastattelut (Älä lainaa näitä)</span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">1. Hätävarapäivä</label>
                                    <select className="modern-select text-sm" value={settings.hatavara_paivat?.taso_1} onChange={(e) => handleNestedSettingsChange('hatavara_paivat', 'taso_1', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                        {viikonpaivat.map(d => <option key={`h1-${d.id}`} value={d.id}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="icon-label mb-1 text-xs">Vihoviimeinen hätävara</label>
                                    <select className="modern-select text-sm" value={settings.hatavara_paivat?.viimeinen} onChange={(e) => handleNestedSettingsChange('hatavara_paivat', 'viimeinen', parseInt(e?.target?.value ?? e))} style={{ width: '100%' }}>
                                        {viikonpaivat.map(d => <option key={`h2-${d.id}`} value={d.id}>{d.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>

                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                    <AlertBox type="warning" icon={CalendarOff}>
                        <span className="fw-bold block mb-1 text-sm">Poikkeustilojen synkronointi on automaattista</span>
                        <span className="text-xs">Järjestelmä lukee lomat, juhlapyhät ja tuurausviikot automaattisesti kalenteristasi (Locations-data). Tuurausviikoilla kalenterisi lukitaan omilta asiakkailta (pl. 46 §), ja lomat pysäyttävät lykkäysviiveen laskennan.</span>
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
        </div>
    );
};

export default AjanvarausSettings;