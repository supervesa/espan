import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Button from '../../common/Button';
import { CalendarDays, Map, Settings, CalendarCheck } from 'lucide-react'; 

import Calendar from './index';
import LocationsPlanner from './locations/index.jsx'; 
import CalendarSettings from '../settings/Calendar/CalendarSettings'; 
// UUSI: Tuodaan uusi asetuspaneeli
import AjanvarausSettings from '../settings/ajanvaraus/AjanvarausSettings'; 

const CalendarManager = () => {
    // 1. TILANHALLINTA
    const [activeView, setActiveView] = useState('calendar'); 

    const experts = [
        { id: '85a812b3-5956-42ad-8e49-e1e673ba5f7d', first_name: 'Testi', last_name: 'Asiantuntija (85a8...)' }
    ];
    
    const [selectedExpertId, setSelectedExpertId] = useState(experts[0].id);
    const LEGACY_ID = '00000000-0000-0000-0000-000000000000';
    
    // TULEVAISUUDENKESTÄVÄ NAVIGAATIO
    const navTabs = [
        { id: 'calendar', label: 'Kalenteri', icon: CalendarDays },
        { id: 'locations', label: 'Sijaintisuunnittelu', icon: Map },
        { id: 'settings', label: 'Sijaintiasetukset', icon: Settings },
        { id: 'ajanvaraus_settings', label: 'Ajanvarausasetukset', icon: CalendarCheck } // <-- Täällä uusi oma tabi!
    ];

    const [settings, setSettings] = useState({
        primary_office_name: 'Malminkatu',     
        thursday_office_name: 'Viipurinkatu',  
        thursday_office_rate: 100,
        friday_max_presence_per_month: 1,
        target_office_percent: 50,
        monday_always_remote: true
    });

    const [dailyLocations, setDailyLocations] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [rules, setRules] = useState([]);
    const [nationalHolidays, setNationalHolidays] = useState([]);
    const [ledgerBalance, setLedgerBalance] = useState(0);
    const [availableBankDays, setAvailableBankDays] = useState([]);
    const [icsEvents, setIcsEvents] = useState([]);
    const [journeyPlans, setJourneyPlans] = useState([]);
    const [actualJourneys, setActualJourneys] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [currentWeekStart, setCurrentWeekStart] = useState(null);

    // 2. DATANHAKU
    const fetchData = useCallback(async (weekStart) => {
        if (!selectedExpertId || !weekStart) return;
        setLoading(true);
        setCurrentWeekStart(weekStart);
        
        const queryExpertIds = [selectedExpertId, LEGACY_ID];
        
        try {
            const fetchStart = new Date(weekStart);
            fetchStart.setDate(fetchStart.getDate() - 14); 
            const startStr = fetchStart.toISOString().split('T')[0];

            const fetchEnd = new Date(weekStart);
            fetchEnd.setDate(fetchEnd.getDate() + 45); 
            const endStr = fetchEnd.toISOString().split('T')[0];

            const [
                { data: locData },
                { data: excData },
                { data: rulesData },
                { data: holidaysData },
                { data: ledgerData },
                { data: icsData },
                { data: planData },
                { data: actualJourneysData },
                { data: settingsData }
            ] = await Promise.all([
                supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gte('date', startStr).lte('date', endStr),
                supabase.schema('espan').from('availability').select('*').in('expert_id', queryExpertIds).gte('start_time', `${startStr} 00:00:00`).lte('start_time', `${endStr} 23:59:59`),
                supabase.schema('espan').from('expert_availability_rules').select('*').in('expert_id', queryExpertIds),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', startStr).lte('date', endStr), 
                supabase.schema('espan').from('expert_remote_bank_ledger').select('*').in('expert_id', queryExpertIds),
                supabase.schema('espan').from('ics_events').select('*').in('expert_id', queryExpertIds).gte('start_time', `${startStr} 00:00:00`).lte('start_time', `${endStr} 23:59:59`).or('is_cancelled.eq.false,is_cancelled.is.null'),
                supabase.schema('espan').from('expert_journey_plans').select('*').in('expert_id', queryExpertIds).gte('date', startStr).lte('date', endStr),
                supabase.schema('espan').from('expert_journeys').select('*').in('expert_id', queryExpertIds).gte('departure_time', `${startStr} 00:00:00`).lte('departure_time', `${endStr} 23:59:59`),
                supabase.schema('espan').from('expert_location_settings').select('*').in('expert_id', queryExpertIds)
            ]);

            if (locData) setDailyLocations(locData);
            if (excData) setExceptions(excData);
            if (rulesData) setRules(rulesData);
            if (holidaysData) setNationalHolidays(holidaysData); 
            if (icsData) setIcsEvents(icsData);
            if (planData) setJourneyPlans(planData);
            if (actualJourneysData) setActualJourneys(actualJourneysData);
            
            if (settingsData && settingsData.length > 0) {
                const activeSettings = settingsData.find(s => s.expert_id === selectedExpertId) || settingsData[0];
                setSettings(prev => ({ ...prev, ...activeSettings }));
            }

            if (ledgerData) {
                const balance = ledgerData.reduce((sum, row) => sum + row.transaction_type, 0);
                setLedgerBalance(balance);
                
                const usedLinkedIds = ledgerData.filter(r => r.transaction_type === -1 && r.linked_earned_id).map(r => r.linked_earned_id);
                const available = ledgerData.filter(r => r.transaction_type === 1 && !usedLinkedIds.includes(r.id)).sort((a, b) => new Date(a.earned_date) - new Date(b.earned_date));
                setAvailableBankDays(available);
            } else {
                setLedgerBalance(0);
                setAvailableBankDays([]);
            }

        } catch (err) {
            console.error("Virhe kalenteridatan haussa:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedExpertId]);

    // 3. APUFUNKTIO NÄKYMIEN RENDERÖINTIIN
    const renderActiveContent = () => {
        // Alkuperäinen sijaintiasetukset
        if (activeView === 'settings') {
            return <CalendarSettings />;
        }

        // UUSI: Ajanvarausasetusten itsenäinen näkymä
        if (activeView === 'ajanvaraus_settings') {
            return <AjanvarausSettings />;
        }

        // Muut näkymät vaativat, että asiantuntija on valittu
        if (!selectedExpertId) {
            return (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
                    Valitse asiantuntija yläpuolelta nähdäksesi tiedot.
                </div>
            );
        }

        if (activeView === 'calendar') {
            return (
                <Calendar 
                    expertId={selectedExpertId} 
                    queryExpertIds={[selectedExpertId, LEGACY_ID]}
                    dailyLocations={dailyLocations} exceptions={exceptions} rules={rules}
                    nationalHolidays={nationalHolidays} settings={settings}
                    ledgerBalance={ledgerBalance} availableBankDays={availableBankDays}
                    icsEvents={icsEvents} 
                    onDateChange={fetchData} 
                    fetchData={() => fetchData(currentWeekStart)} 
                />
            );
        }

        if (activeView === 'locations') {
            return (
                <LocationsPlanner 
                    expertId={selectedExpertId} 
                    queryExpertIds={[selectedExpertId, LEGACY_ID]}
                    dailyLocations={dailyLocations} exceptions={exceptions} rules={rules}
                    nationalHolidays={nationalHolidays} settings={settings}
                    ledgerBalance={ledgerBalance} availableBankDays={availableBankDays}
                    journeyPlans={journeyPlans} actualJourneys={actualJourneys} 
                    onDateChange={fetchData} 
                    fetchData={() => fetchData(currentWeekStart)} 
                />
            );
        }

        return null;
    };

    // 4. PÄÄNÄKYMÄN PALAUTUS
    return (
        <div>
            {/* Yläpalkki (Näkymän vaihto ja Asiantuntija) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                
                {/* Vasen reuna: Dynaamiset välilehdet */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    {navTabs.map(tab => (
                        <Button 
                            key={tab.id}
                            variant={activeView === tab.id ? 'primary' : 'secondary'} 
                            icon={tab.icon} 
                            onClick={() => setActiveView(tab.id)} 
                            style={{ border: 'none', boxShadow: activeView === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
                
                {/* Oikea reuna: Asiantuntija */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {loading && <span className="text-sm text-secondary">Ladataan tietoja...</span>}
                    <select 
                        className="modern-input" 
                        value={selectedExpertId} 
                        onChange={(e) => setSelectedExpertId(e.target.value)} 
                        style={{ minWidth: '200px' }}
                    >
                        {experts.map(exp => (
                            <option key={exp.id} value={exp.id}>{exp.first_name} {exp.last_name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Sisältöalue animaatiolla */}
            <div className="view-fade-in">
                {renderActiveContent()}
            </div>
        </div>
    );
};

export default CalendarManager;