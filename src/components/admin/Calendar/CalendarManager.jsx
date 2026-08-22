import React, { useState, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Calendar from './index';

const CalendarManager = () => {
    // Vain Oikea asiantuntija on enää valittavissa käyttöliittymässä
    const experts = [
        { id: '85a812b3-5956-42ad-8e49-e1e673ba5f7d', first_name: 'Testi', last_name: 'Asiantuntija (85a8...)' }
    ];
    
    const [selectedExpertId, setSelectedExpertId] = useState(experts[0].id);
    
    // Määritellään vanha "Legacy ID", jota vanha kalenteri käyttää
    const LEGACY_ID = '00000000-0000-0000-0000-000000000000';
    
    const settings = {
        primary_office_name: 'Malminkatu',     
        thursday_office_name: 'Viipurinkatu',  
        thursday_office_rate: 1                
    };

    const [dailyLocations, setDailyLocations] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [rules, setRules] = useState([]);
    const [nationalHolidays, setNationalHolidays] = useState([]);
    const [ledgerBalance, setLedgerBalance] = useState(0);
    const [availableBankDays, setAvailableBankDays] = useState([]);
    const [icsEvents, setIcsEvents] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [currentWeekStart, setCurrentWeekStart] = useState(null);

    const fetchData = useCallback(async (weekStart) => {
        if (!selectedExpertId || !weekStart) return;
        setLoading(true);
        setCurrentWeekStart(weekStart);
        
        // Taulukko ID:istä, joilla dataa haetaan (Uusi + Vanha)
        const queryExpertIds = [selectedExpertId, LEGACY_ID];
        
        try {
            const startStr = weekStart.toISOString().split('T')[0];
            const end = new Date(weekStart);
            end.setDate(end.getDate() + 6);
            const endStr = end.toISOString().split('T')[0];

            // Käytetään .in('expert_id', queryExpertIds) hakuja .eq sijaan!
            const [
                { data: locData },
                { data: excData },
                { data: rulesData },
                { data: holidaysData },
                { data: ledgerData },
                { data: icsData }
            ] = await Promise.all([
                supabase.schema('espan').from('expert_daily_locations').select('*').in('expert_id', queryExpertIds).gte('date', startStr).lte('date', endStr),
                supabase.schema('espan').from('availability').select('*').in('expert_id', queryExpertIds).gte('start_time', `${startStr} 00:00:00`).lte('start_time', `${endStr} 23:59:59`),
                supabase.schema('espan').from('expert_availability_rules').select('*').in('expert_id', queryExpertIds),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', startStr).lte('date', endStr), 
                supabase.schema('espan').from('expert_remote_bank_ledger').select('*').in('expert_id', queryExpertIds),
                supabase.schema('espan').from('ics_events').select('*').in('expert_id', queryExpertIds).gte('start_time', `${startStr} 00:00:00`).lte('start_time', `${endStr} 23:59:59`).or('is_cancelled.eq.false,is_cancelled.is.null')
            ]);

            if (locData) setDailyLocations(locData);
            if (excData) setExceptions(excData);
            if (rulesData) setRules(rulesData);
            if (holidaysData) setNationalHolidays(holidaysData); 
            if (icsData) setIcsEvents(icsData);
            
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

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label className="fw-bold text-primary">Valitse asiantuntija:</label>
                <select 
                    className="modern-input" 
                    value={selectedExpertId} 
                    onChange={(e) => setSelectedExpertId(e.target.value)}
                    style={{ minWidth: '250px' }}
                >
                    {experts.map(exp => (
                        <option key={exp.id} value={exp.id}>
                            {exp.first_name} {exp.last_name}
                        </option>
                    ))}
                </select>
                {loading && <span className="text-sm text-secondary">Ladataan tietoja...</span>}
            </div>

            {selectedExpertId ? (
                <Calendar 
                    expertId={selectedExpertId}
                    queryExpertIds={[selectedExpertId, LEGACY_ID]} // Lähetetään molemmat ID:t alas, jotta kalenteri osaa poistaa tarvittaessa vanhoja merkintöjä
                    dailyLocations={dailyLocations}
                    exceptions={exceptions}
                    rules={rules}
                    nationalHolidays={nationalHolidays}
                    settings={settings}
                    ledgerBalance={ledgerBalance}
                    availableBankDays={availableBankDays}
                    icsEvents={icsEvents}
                    onDateChange={fetchData} 
                    fetchData={() => fetchData(currentWeekStart)} 
                />
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
                    Valitse asiantuntija yläpuolelta nähdäksesi kalenterin.
                </div>
            )}
        </div>
    );
};

export default CalendarManager;