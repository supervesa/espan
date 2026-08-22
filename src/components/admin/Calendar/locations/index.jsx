import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient';
import Card from '../../../common/Card';
import { getMonthStart, getCalendarDays, parseDBDateLocal } from './utils/monthUtils';

import MonthHeader from './components/MonthHeader';
import MonthGrid from './components/MonthGrid';
import MonthSummary from './components/MonthSummary';

const LocationsPlanner = ({
    expertId,
    dailyLocations = [],
    exceptions = [],
    rules = [],
    nationalHolidays = [],
    settings = {},
    ledgerBalance = 0,
    availableBankDays = [],
    journeyPlans = [],
    actualJourneys = [], // UUSI: Otetaan vastaan äidiltä!
    onDateChange,
    fetchData
}) => {
    const [currentMonthStart, setCurrentMonthStart] = useState(() => getMonthStart(new Date()));
    
    useEffect(() => {
        if (onDateChange) onDateChange(currentMonthStart);
    }, [currentMonthStart, onDateChange]);

    const handleNextMonth = () => setCurrentMonthStart(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; });
    const handlePrevMonth = () => setCurrentMonthStart(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; });
    const handleToday = () => setCurrentMonthStart(getMonthStart(new Date()));

    const calendarDays = useMemo(() => getCalendarDays(currentMonthStart), [currentMonthStart]);

    const blockedDaysStrs = useMemo(() => {
        return exceptions
            .filter(e => e.is_blocked && String(e.meeting_type).trim().toLowerCase() === 'estetty')
            .map(e => e.start_time.substring(0, 10));
    }, [exceptions]);

    const holidayStrs = useMemo(() => {
        return nationalHolidays.map(h => {
            if (!h.date) return '';
            const d = new Date(h.date);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().split('T')[0];
        });
    }, [nationalHolidays]);

    const handleSetLocation = async (dateStr, type, name) => {
        if (!expertId) return;
        try {
            const existingLoc = dailyLocations.find(l => l.date === dateStr);
            if (existingLoc) await supabase.schema('espan').from('expert_daily_locations').delete().eq('id', existingLoc.id);

            if (type === 'eta_pankki') {
                const oldestAvailable = availableBankDays[0];
                if (!oldestAvailable) return alert("Virhe: Ei vapaita ansaittuja päiviä pankissa!");
                await supabase.schema('espan').from('expert_remote_bank_ledger').insert([{ expert_id: expertId, transaction_type: -1, used_date: dateStr, expiration_date: '2099-12-31', description: `Käytetty pankkipäivä (Korvaa ansion: ${oldestAvailable.earned_date})`, linked_earned_id: oldestAvailable.id }]);
            } 
            await supabase.schema('espan').from('expert_daily_locations').insert({ expert_id: expertId, date: dateStr, location_type: type, location_name: name, is_auto_generated: false });
            if (fetchData) fetchData(currentMonthStart);
        } catch (e) { console.error(e); }
    };

    const handleRemoveLocation = async (dateStr) => {
        const existingLoc = dailyLocations.find(l => l.date === dateStr);
        if (!existingLoc) return;
        try {
            if (existingLoc.location_type === 'eta_pankki') await supabase.schema('espan').from('expert_remote_bank_ledger').delete().eq('expert_id', expertId).eq('used_date', dateStr);
            await supabase.schema('espan').from('expert_daily_locations').delete().eq('id', existingLoc.id);
            if (fetchData) fetchData(currentMonthStart);
        } catch (e) { console.error(e); }
    };

    const handleToggleJourney = async (dateStr, hasExistingPlan) => {
        if (!expertId) return;
        try {
            if (hasExistingPlan) {
                const plan = journeyPlans.find(p => p.date === dateStr);
                if (plan) await supabase.schema('espan').from('expert_journey_plans').delete().eq('id', plan.id);
            } else {
                await supabase.schema('espan').from('expert_journey_plans').insert({ expert_id: expertId, date: dateStr });
            }
            if (fetchData) fetchData(currentMonthStart);
        } catch (e) { console.error(e); }
    };

    const handleSettingsChange = async (field, value) => {
        if (!expertId) return;
        try {
            await supabase.schema('espan').from('expert_location_settings').upsert({ expert_id: expertId, [field]: value, updated_at: new Date().toISOString() }, { onConflict: 'expert_id' });
            if (fetchData) fetchData(currentMonthStart);
        } catch (e) { console.error(e); }
    };

    const actions = { handleSetLocation, handleRemoveLocation, handleToggleJourney, handleSettingsChange };

    return (
        <Card title="Sijaintisuunnittelu (Makrotaso)" variant="default">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <MonthHeader currentMonthStart={currentMonthStart} onNext={handleNextMonth} onPrev={handlePrevMonth} onToday={handleToday} />
                  <MonthGrid 
    calendarDays={calendarDays} currentMonthStart={currentMonthStart}
    data={{ 
        dailyLocations, exceptions, nationalHolidays, journeyPlans, actualJourneys, // <-- Lisätty tähän!
        rules, settings, ledgerBalance, blockedDaysStrs, holidayStrs 
    }}
    actions={actions}
/>
                </div>
                <div>
                    <MonthSummary 
                        currentMonthStart={currentMonthStart} calendarDays={calendarDays} 
                        /* KORJAUS: Viedään availableBankDays alas! */
                        data={{ dailyLocations, exceptions, nationalHolidays, ledgerBalance, availableBankDays, settings, blockedDaysStrs, holidayStrs }} 
                        actions={actions}
                    />
                </div>
            </div>
        </Card>
    );
};
export default LocationsPlanner;