// --- src/components/admin/AvailabilityManager.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Button from '../common/Button';
import { Link, Copy } from 'lucide-react';

// Omat lapsikomponentit ja tyylit
import AvailabilityHeader from './AvailabilityManager/AvailabilityHeader';
import LocationPlanner from './LocationPlanner'; 
import ExpertCalendar from './AvailabilityManager/ExpertCalendar';
import AvailabilityForms from './AvailabilityManager/AvailabilityForms'; 
import JourneyManager from './journey/JourneyManager';
import './AvailabilityManager/AvailabilityManager.css';

// UUSI: Tuodaan kuittien hookki tänne ylätasolle!
import { useJourneyManager } from '../../hooks/useJourneyManager';

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const formatDateLocal = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

const AvailabilityManager = () => {
    
    // 1. TILANHALLINTA
    const [activeView, setActiveView] = useState('locations'); // 'locations' | 'journeys'
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    
    const [rules, setRules] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [dailyLocations, setDailyLocations] = useState([]);
    
    // TÄHÄN LISÄTTY: Kaukoliikenteen suositusten tila
    const [longDistanceJourneys, setLongDistanceJourneys] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [ledgerBalance, setLedgerBalance] = useState(0);
    const [availableBankDays, setAvailableBankDays] = useState([]); // UUSI: Vapaiden pankkipäivien taulukko FIFO-logiikkaa varten
    const [nationalHolidays, setNationalHolidays] = useState([]);
    const [settings, setSettings] = useState({
        target_office_percent: 50,
        thursday_office_rate: 100,
        monday_always_remote: true,
        friday_max_presence_per_month: 1,
        primary_office_name: 'Malminkatu',
        thursday_office_name: 'Viipurinkatu'
    });

    const webCalUrl = `webcal://espan-api.netlify.app/functions/webcal?expert_id=${EXPERT_ID}`;

    // UUSI: Kutsutaan hookkia tässä pääkomponentissa!
    const { 
        pendingReceipts, 
        approvedReceipts,
        loading: journeyLoading, // Nimettiin uudelleen jottei mene sekaisin kalenterin 'loading' kanssa
        approveReceipt, 
        rejectReceipt,
        refreshReceipts,
        fetchApprovedReceipts,
        addVirtualReceipt
    } = useJourneyManager();

    // 2. DATAN HAKU
    useEffect(() => { fetchData(); }, [currentWeekStart]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const queryStart = formatDateLocal(addDays(currentWeekStart, -7)); 
            const queryEnd = formatDateLocal(addDays(currentWeekStart, 45));
            const todayStr = formatDateLocal(new Date());

            // TÄHÄN LISÄTTY: v_kaukoliikenne_suositukset lisätty hakuun (longDistRes)
            // MUUTETTU: ledgerRes hakee nyt kaikki kentät (*), jotta linked_earned_id saadaan käsittelyyn
            const [rulesRes, excRes, locRes, setRes, ledgerRes, holidayRes, longDistRes] = await Promise.all([
                supabase.schema('espan').from('expert_availability_rules').select('*').eq('expert_id', EXPERT_ID).order('day_of_week').order('start_time'),
                supabase.schema('espan').from('availability').select('*').eq('expert_id', EXPERT_ID).gte('start_time', `${queryStart} 00:00:00`).lte('start_time', `${queryEnd} 23:59:59`).order('start_time'),
                supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', EXPERT_ID).gte('date', queryStart).lte('date', queryEnd),
                supabase.schema('espan').from('expert_location_settings').select('*').eq('expert_id', EXPERT_ID).maybeSingle(),
                supabase.schema('espan').from('expert_remote_bank_ledger').select('*').eq('expert_id', EXPERT_ID).gt('expiration_date', todayStr),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', queryStart).lte('date', queryEnd),
                supabase.schema('espan').from('v_kaukoliikenne_suositukset').select('*').gte('date', queryStart).lte('date', queryEnd)
            ]);

            setRules(rulesRes.data || []);
            setExceptions(excRes.data || []);
            setDailyLocations(locRes.data || []);
            if (setRes.data) setSettings(setRes.data);
            setNationalHolidays(holidayRes.data || []);
            
            // TÄHÄN LISÄTTY: Datan tallennus tilaan
            setLongDistanceJourneys(longDistRes.data || []);

            if (ledgerRes.data) {
                const balance = ledgerRes.data.reduce((sum, row) => sum + row.transaction_type, 0);
                setLedgerBalance(balance);

                // FIFO-LOGIIKKA: Suodatetaan jo käytetyt ansaittujen päivien ID:t
                const usedLinkedIds = ledgerRes.data
                    .filter(row => row.transaction_type === -1 && row.linked_earned_id)
                    .map(row => row.linked_earned_id);

                // Eristetään vapaat ansaitsupäivät ja järjestetään ne kronologisesti (vanhin ensin)
                const availableDays = ledgerRes.data
                    .filter(row => row.transaction_type === 1 && !usedLinkedIds.includes(row.id))
                    .sort((a, b) => new Date(a.earned_date || a.created_at) - new Date(b.earned_date || b.created_at));

                setAvailableBankDays(availableDays);
            }
        } catch (error) { 
            console.error("Virhe tiedonhaussa:", error); 
        } finally { 
            setLoading(false); 
        }
    };

    // Yksittäiset tallennusfunktiot alikomponenteille
    const handleSettingsChange = async (field, value) => {
        const updatedSettings = { ...settings, [field]: value };
        setSettings(updatedSettings);
        try {
            await supabase.schema('espan').from('expert_location_settings').update({ [field]: value, updated_at: new Date().toISOString() }).eq('expert_id', EXPERT_ID);
        } catch (e) { console.error(e); }
    };

    const handleOptimizeCalendar = async () => {
        try {
            const response = await fetch('/.netlify/functions/optimize-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expert_id: EXPERT_ID }) });
            if (!response.ok) throw new Error('Palvelin palautti virheen.');
            alert("Automaatti suoritettu onnistuneesti!");
            fetchData(); 
        } catch (e) { console.error(e); alert("Optimointi epäonnistui. Tarkista konsoli."); }
    };

    const handleLockCurrentWeek = async () => {
        try {
            const weekDays = [0, 1, 2, 3, 4].map(i => addDays(currentWeekStart, i));
            const updates = weekDays.map(async (d) => {
                const dStr = formatDateLocal(d);
                const loc = dailyLocations.find(l => l.date === dStr);
                if (loc && loc.is_auto_generated) return supabase.schema('espan').from('expert_daily_locations').update({ is_auto_generated: false }).eq('id', loc.id);
                return Promise.resolve();
            });
            await Promise.all(updates);
            alert("Tämän viikon ehdotukset lukittu virallisiksi työskentelypaikoiksi.");
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleResetSuggestions = async () => {
        if (!window.confirm("Haluatko varmasti pyyhkiä kaikki automaattisesti luodut haamuehdotukset?")) return;
        try { await supabase.schema('espan').from('expert_daily_locations').delete().eq('expert_id', EXPERT_ID).eq('is_auto_generated', true); fetchData(); } catch (e) { console.error(e); }
    };

    // Apufunktiot yläpalkin synkronointiin
    const changeWeek = (offset) => {
        setCurrentWeekStart(prev => addDays(prev, offset * 7));
    };

    const jumpToCurrentWeek = () => {
        setCurrentWeekStart(getMonday(new Date()));
    };

    // 3. KÄYTTÖLIITTYMÄN RENDERÖINTI
    return (
        <div className="availability-manager">
            
            <AvailabilityHeader 
                activeView={activeView}
                onViewChange={setActiveView}
                currentWeekStart={currentWeekStart}
                onPreviousWeek={() => changeWeek(-1)}
                onNextWeek={() => changeWeek(1)}
                onResetToCurrentWeek={jumpToCurrentWeek}
                pendingReceiptsCount={pendingReceipts.length} // UUSI: Välitetään odottavien kuittien määrä yläpalkille
            />

            <div className="availability-manager__content">
                {activeView === 'locations' ? (
                    <div className="view-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                                <Link size={20} />
                                <span className="text-sm fw-bold">Tietoturvallinen WebCAL-syöte ulkoiseen kalenteriisi:</span>
                            </div>
                            <input type="text" readOnly value={webCalUrl} className="font-mono text-xs text-secondary" style={{ flex: 1, background: 'var(--color-background)', border: '1px solid var(--color-border)', padding: '0.4rem', borderRadius: '4px' }} />
                            <Button variant="secondary" size="sm" icon={Copy} onClick={() => { navigator.clipboard.writeText(webCalUrl); alert('Kalenterilinkki kopioitu!'); }}>Kopioi linkki</Button>
                        </div>

                        <LocationPlanner 
                            currentWeekStart={currentWeekStart}
                            dailyLocations={dailyLocations}
                            exceptions={exceptions}
                            nationalHolidays={nationalHolidays}
                            settings={settings}
                            ledgerBalance={ledgerBalance}
                            onSettingsChange={handleSettingsChange}
                            onOptimize={handleOptimizeCalendar}
                            onLockWeek={handleLockCurrentWeek}
                            onResetSuggestions={handleResetSuggestions}
                            longDistanceJourneys={longDistanceJourneys} // TÄHÄN LISÄTTY prop-välitys
                        />

                        <ExpertCalendar 
                            expertId={EXPERT_ID}
                            currentWeekStart={currentWeekStart}
                            dailyLocations={dailyLocations}
                            exceptions={exceptions}
                            rules={rules}
                            nationalHolidays={nationalHolidays}
                            settings={settings}
                            ledgerBalance={ledgerBalance}
                            availableBankDays={availableBankDays} // UUSI: Välitetään taulukko kalenterille linkitystä varten
                            fetchData={fetchData}
                        />

                        <AvailabilityForms 
                            expertId={EXPERT_ID} 
                            rules={rules} 
                            exceptions={exceptions} 
                            fetchData={fetchData} 
                        />

                    </div>
                ) : (
                    <div className="view-fade-in">
                        <JourneyManager 
                            currentWeekStart={currentWeekStart}
                            dailyLocations={dailyLocations}
                            exceptions={exceptions}
                            nationalHolidays={nationalHolidays}
                            settings={settings}
                            arriveDayBefore={false}
                            // UUSI: Syötetään kaikki Hookin arvot propseina alas!
                            pendingReceipts={pendingReceipts}
                            approvedReceipts={approvedReceipts}
                            loading={journeyLoading}
                            approveReceipt={approveReceipt}
                            rejectReceipt={rejectReceipt}
                            refreshReceipts={refreshReceipts}
                            fetchApprovedReceipts={fetchApprovedReceipts}
                            addVirtualReceipt={addVirtualReceipt}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AvailabilityManager;