import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient';

// Yhteiset (Common) UI-komponentit
import Card from '../../../common/Card';
import Button from '../../../common/Button';
import AlertBox from '../../../common/AlertBox';
import RangeSlider from '../../../common/RangeSlider';

import { Sliders, Flag, Server, CalendarClock, Building2, AlertTriangle, Printer } from 'lucide-react';
import ReportModal from '../../ReportModal/index.jsx';

const LEGACY_ID = '00000000-0000-0000-0000-000000000000';

const CalendarSettings = () => {
    const [expertId, setExpertId] = useState(null);
    const [queryIds, setQueryIds] = useState([LEGACY_ID]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [settings, setSettings] = useState({
        target_office_percent: 50,
        monday_always_remote: true,
        thursday_office_rate: 100,
        friday_max_presence_per_month: 1,
        primary_office_name: 'Malminkatu',
        thursday_office_name: 'Viipurinkatu'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                setExpertId(currentExpertId);

                const qIds = [currentExpertId, LEGACY_ID];
                setQueryIds(qIds);

                const { data, error } = await supabase.schema('espan')
                    .from('expert_location_settings')
                    .select('*')
                    .in('expert_id', qIds);

                if (!error && data && data.length > 0) {
                    const activeSettings = data.find(s => s.expert_id === currentExpertId) || data[0];
                    setSettings({
                        target_office_percent: activeSettings.target_office_percent ?? 50,
                        monday_always_remote: activeSettings.monday_always_remote ?? true,
                        thursday_office_rate: activeSettings.thursday_office_rate ?? 100,
                        friday_max_presence_per_month: activeSettings.friday_max_presence_per_month ?? 1,
                        primary_office_name: activeSettings.primary_office_name || 'Malminkatu',
                        thursday_office_name: activeSettings.thursday_office_name || 'Viipurinkatu'
                    });
                }
            } catch (err) {
                console.error("Virhe asetusten haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSettingsChange = async (field, value) => {
        if (!expertId) return;
        
        const updatedSettings = { ...settings, [field]: value };
        setSettings(updatedSettings);

        try {
            await supabase.schema('espan')
                .from('expert_location_settings')
                .upsert({ 
                    expert_id: expertId, 
                    [field]: value, 
                    updated_at: new Date().toISOString() 
                }, { onConflict: 'expert_id' });
        } catch (e) {
            console.error("Virhe asetuksen tallennuksessa:", e);
        }
    };

    const handleSyncHolidays = async () => {
        setActionLoading(true);
        try {
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8888' : '';
            const response = await fetch(`${baseUrl}/.netlify/functions/sync-holidays`, { method: 'POST' });
            
            if (!response.ok) throw new Error('Palvelin palautti virheen.');
            
            const result = await response.json();
            alert(`Onnistui! ${result.message}`);
        } catch (error) {
            console.error(error);
            alert('Virhe pyhäpäivien päivityksessä. Varmista että Netlify Dev pyörii (portti 8888).');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOptimizeCalendar = async () => {
        if (!expertId) return;
        setActionLoading(true);
        try {
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8888' : '';
            const response = await fetch(`${baseUrl}/.netlify/functions/optimize-calendar`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ expert_id: expertId }) 
            });
            
            if (!response.ok) throw new Error('Palvelin palautti virheen.');
            alert("Tekoälyn optimointi suoritettu onnistuneesti!");
        } catch (e) { 
            console.error(e); 
            alert("Optimointi epäonnistui. Varmista että käynnistit projektin 'netlify dev' -komennolla."); 
        } finally {
            setActionLoading(false);
        }
    };

    const handleLockCurrentWeek = async () => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));

        setActionLoading(true);
        try {
            const datesToLock = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(monday);
                d.setDate(d.getDate() + i);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                datesToLock.push(d.toISOString().split('T')[0]);
            }

            const { data } = await supabase.schema('espan')
                .from('expert_daily_locations')
                .select('id')
                .in('expert_id', queryIds)
                .in('date', datesToLock)
                .eq('is_auto_generated', true);

            if (data && data.length > 0) {
                const idsToUpdate = data.map(l => l.id);
                await supabase.schema('espan')
                    .from('expert_daily_locations')
                    .update({ is_auto_generated: false })
                    .in('id', idsToUpdate);
                alert(`${data.length} ehdotusta lukittu onnistuneesti virallisiksi paikoiksi.`);
            } else {
                alert("Ei lukittavia automaattisia ehdotuksia kuluvalle viikolle.");
            }
        } catch (e) {
            console.error("Virhe viikon lukituksessa:", e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetSuggestions = async () => {
        if (!window.confirm("VAROITUS: Haluatko varmasti pyyhkiä kalenterista kaikki automaattisesti luodut haamuehdotukset? Tätä ei voi peruuttaa.")) return;
        setActionLoading(true);
        try { 
            await supabase.schema('espan')
                .from('expert_daily_locations')
                .delete()
                .in('expert_id', queryIds)
                .eq('is_auto_generated', true); 
            alert("Automaattiset ehdotukset nollattu!");
        } catch (e) { 
            console.error("Virhe nollauksessa:", e); 
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-secondary">Ladataan asetuksia...</div>;
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            
            {/* KORTTI 1: Työskentelyrytmi */}
            <Card title="Työskentelyrytmi ja Tavoitteet" icon={CalendarClock} variant="default">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Tavoiteprosentti */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <label className="text-sm fw-semibold text-primary mb-0">Lähityön minimitavoite (Koko jakso)</label>
                            <span className="stat-value text-primary font-mono">{settings.target_office_percent}%</span>
                        </div>
                        <RangeSlider 
                            min={0} max={100} step={5}
                            value={settings.target_office_percent} 
                            onChange={(e) => handleSettingsChange('target_office_percent', parseInt(e.target.value))}
                        />
                        <div className="text-xs text-secondary mt-1 lh-tight">
                            Säätää kuukausiseurannan ja optimointiajon raja-arvoa. Oletus on viraston säännönmukainen 50%.
                        </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 -0.5rem' }} />

                    {/* KORJAUS: Maanantai Kytkin käyttäen turvallista HTML:ää! */}
                    <div>
                        <label className="modern-checkbox-label" style={{ marginBottom: 0 }}>
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={settings.monday_always_remote}
                                onChange={() => handleSettingsChange('monday_always_remote', !settings.monday_always_remote)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="fw-semibold text-primary text-sm">Maanantait aina etänä</span>
                                <span className="text-xs text-secondary lh-tight mt-1">Automaatti pakottaa maanantain etäpäiväksi kaikissa skenaarioissa.</span>
                            </div>
                        </label>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 -0.5rem' }} />

                    {/* Torstain prosentti */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <label className="text-sm fw-semibold text-primary mb-0">Torstain kokousprosentti (Lähityöaste)</label>
                            <span className="stat-value text-primary font-mono">{settings.thursday_office_rate}%</span>
                        </div>
                        <RangeSlider 
                            min={0} max={100} step={25}
                            value={settings.thursday_office_rate} 
                            onChange={(e) => handleSettingsChange('thursday_office_rate', parseInt(e.target.value))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }} className="text-xs text-secondary fw-medium">
                            <span>Aina etänä</span>
                            <span>Joka toinen</span>
                            <span>Aina läsnä</span>
                        </div>
                    </div>

                    {/* Perjantain Joustovara */}
                    <div style={{ marginTop: '0.5rem' }}>
                        <label className="icon-label mb-1">Perjantain maksimilähityö</label>
                        <select 
                            className="modern-select" 
                            value={settings.friday_max_presence_per_month}
                            onChange={(e) => handleSettingsChange('friday_max_presence_per_month', parseInt(e.target.value))}
                            style={{ width: '100%' }}
                        >
                            <option value={0}>0 kertaa kuukaudessa (Aina etä)</option>
                            <option value={1}>1 kerta kuukaudessa (Sallii yhden matkaputken)</option>
                            <option value={2}>2 kertaa kuukaudessa</option>
                        </select>
                        <span className="text-xs text-secondary mt-1 lh-tight block">
                            Rajoittaa perjantain satunnaista lähityötä pitäen kiinni ns. pehmeästä saarekesuojasta.
                        </span>
                    </div>

                </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* KORTTI 2: Toimipisteet */}
                <Card title="Oletustoimipisteet" icon={Building2} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label className="icon-label mb-1">Pääasiallinen lähityöpaikka (Oletus)</label>
                            <select 
                                className="modern-select" 
                                value={settings.primary_office_name}
                                onChange={(e) => handleSettingsChange('primary_office_name', e.target.value)}
                            >
                                <option value="Malminkatu">Malminkatu (Suositeltu)</option>
                                <option value="Viipurinkatu">Viipurinkatu</option>
                                <option value="Itäkeskus">Itäkeskus</option>
                                <option value="Pasila">Pasila</option>
                            </select>
                        </div>
                        <div>
                            <label className="icon-label mb-1">Torstain kokousten toimipiste</label>
                            <select 
                                className="modern-select" 
                                value={settings.thursday_office_name}
                                onChange={(e) => handleSettingsChange('thursday_office_name', e.target.value)}
                            >
                                <option value="Viipurinkatu">Viipurinkatu (Suositeltu)</option>
                                <option value="Malminkatu">Malminkatu</option>
                                <option value="Itäkeskus">Itäkeskus</option>
                                <option value="Pasila">Pasila</option>
                            </select>
                        </div>

                        {/* Valmis InfoBox-komponentti! */}
                        <AlertBox type="info">
                            <span className="fw-bold block mb-1">Nollavelka-automatiikka aktiivinen</span>
                            Lomat ja pyhät poistetaan automaattisesti työpäivien kokonaismäärästä tavoitelaskennassa, eivätkä ne kerrytä asiantuntijalle etätyövelkaa tuleville viikoille.
                        </AlertBox>

                    </div>
                </Card>

                {/* KORTTI 3: Järjestelmän prosessit */}
                <Card title="Tekoäly ja Tausta-ajot" icon={Server} variant="bordered">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        
                        <Button variant="secondary" icon={Flag} onClick={handleSyncHolidays} disabled={actionLoading} fullWidth style={{ justifyContent: 'flex-start' }}>
                            Hae & Päivitä Suomen pyhäpäivät (API)
                        </Button>
                        <div className="text-xs text-secondary lh-tight ml-2 mb-2">
                            Synkronoi uudet kirkolliset ja kansalliset juhlapäivät automaattista poissulkemista varten.
                        </div>

                        <Button variant="primary" icon={Sliders} onClick={handleOptimizeCalendar} disabled={actionLoading} fullWidth style={{ justifyContent: 'flex-start' }}>
                            Optimoi kalenteri (Aja automaatio nyt)
                        </Button>
                        <div className="text-xs text-secondary lh-tight ml-2">
                            Laskee rullaavalla algoritmilla saarekkeettoman ja asiantuntijan jaksamiseen (tavoitearvoon) pohjautuvan runkosuunnitelman 6 kuukautta eteenpäin asettamiesi arvojen mukaisesti.
                        </div>

                        <div style={{ borderTop: '1px dashed var(--color-border)', margin: '0.5rem 0' }}></div>
                        
                        <Button variant="secondary" icon={Printer} onClick={() => setIsReportModalOpen(true)} fullWidth style={{ justifyContent: 'flex-start', backgroundColor: '#f1f5f9', color: '#0f172a' }}>
                            Lataa sijaintien seurantaraportti
                        </Button>

                    </div>
                </Card>
            </div>
            
            <ReportModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                expertId={expertId} 
            />
        </div>
    );
};

export default CalendarSettings;