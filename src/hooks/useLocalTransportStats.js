// --- src/hooks/useLocalTransportStats.js ---
import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const formatDateStr = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

export const useLocalTransportStats = ({ 
    currentWeekStart, 
    dailyLocations, 
    exceptions, 
    nationalHolidays, 
    settings 
}) => {
    
    const ticketPrice = settings?.bus_ticket_price_eur || 8.06;

    // 1. KULUVAN VIIKON ENNUSTE (Vain 5 päivää)
    const forecast = useMemo(() => {
        if (!currentWeekStart) return null;

        let officeDaysCount = 0;
        
        for (let d = 0; d < 5; d++) {
            const currentDay = new Date(currentWeekStart);
            currentDay.setDate(currentWeekStart.getDate() + d);
            const dStr = formatDateStr(currentDay);

            const isBlockedDay = exceptions?.some(e => 
                e.is_blocked && e.meeting_type === 'estetty' && e.start_time.substring(0, 10) === dStr
            );
            const isHolidayDay = nationalHolidays?.some(h => h.date === dStr);

            if (!isBlockedDay && !isHolidayDay) {
                const loc = dailyLocations?.find(l => l.date === dStr);
                if (loc?.location_type === 'lahityo') {
                    officeDaysCount += 1;
                }
            }
        }

        let tulo = 0, vali = 0, lahto = 0, localTickets = 0;
        
        if (officeDaysCount >= 2) {
            tulo = 1;
            vali = (officeDaysCount - 2) * 2;
            lahto = 1;
            localTickets = (officeDaysCount - 1) * 2;
        }

        return {
            officeDaysCount,
            localTickets,
            localCost: localTickets * ticketPrice,
            tulo,
            vali,
            lahto,
            ticketPrice
        };
    }, [currentWeekStart, dailyLocations, exceptions, nationalHolidays, settings, ticketPrice]);

    // 2. HINNASTON HAKU SUPABASESTA (Ajetaan kerran)
    const [dbPrices, setDbPrices] = useState([]);
    
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                // KORJATTU: Lisätty .schema('espan')
                const { data, error } = await supabase
                    .schema('espan')
                    .from('ticket_prices')
                    .select('*');
                
                if (error) throw error;
                
                if (data) {
                    // Muutetaan kanta-data suoraan algoritmin ymmärtämään muotoon
                    const formattedPrices = data.map(row => ({
                        name: row.trip_count ? `${row.trip_count} matkan sarjalippu` : `${row.validity_days}pv Kausilippu`,
                        type: row.ticket_type,
                        trips: row.trip_count || Infinity,
                        days: row.validity_days,
                        price: Number(row.price_eur)
                    }));
                    setDbPrices(formattedPrices);
                }
            } catch (err) {
                console.error("Virhe hinnaston haussa:", err);
            }
        };

        fetchPrices();
    }, []);

    // 3. ÄLYKÄS SÄÄSTÖTUTKA (28 pv optimointi todellisella aikavälillä)
    const optimization = useMemo(() => {
        if (!currentWeekStart || dbPrices.length === 0) return null;
        
        let total28DayTrips = 0;
        let firstTicketDay = null;
        let lastTicketDay = null;

        for (let w = 0; w < 4; w++) {
            let weeklyOfficeDays = 0;
            let weekFirstOfficeDay = null;
            let weekLastOfficeDay = null;

            for (let d = 0; d < 5; d++) {
                const dayIndex = w * 7 + d;
                const date = new Date(currentWeekStart);
                date.setDate(date.getDate() + dayIndex);
                const dStr = formatDateStr(date);

                const isBlockedDay = exceptions?.some(e => 
                    e.is_blocked && e.meeting_type === 'estetty' && e.start_time.substring(0, 10) === dStr
                );
                const isHolidayDay = nationalHolidays?.some(h => h.date === dStr);

                if (!isBlockedDay && !isHolidayDay) {
                    const loc = dailyLocations?.find(l => l.date === dStr);
                    if (loc?.location_type === 'lahityo') {
                        weeklyOfficeDays += 1;
                        if (weekFirstOfficeDay === null) weekFirstOfficeDay = dayIndex;
                        weekLastOfficeDay = dayIndex;
                    }
                }
            }
            
            if (weeklyOfficeDays >= 2) {
                const tripsThisWeek = (weeklyOfficeDays - 1) * 2;
                total28DayTrips += tripsThisWeek;
                
                if (firstTicketDay === null) firstTicketDay = weekFirstOfficeDay;
                lastTicketDay = weekLastOfficeDay;
            }
        }

        const singleTicketsCost = total28DayTrips * ticketPrice;
        const spanDays = firstTicketDay !== null ? (lastTicketDay - firstTicketDay + 1) : 0;
        let recommended = { name: 'Yksittäisliput kuitilla', price: singleTicketsCost };

        if (total28DayTrips > 0) {
            // Vertaillaan Supabasesta haettuihin tuotteisiin
            const validOptions = dbPrices.filter(p => p.days >= spanDays && p.trips >= total28DayTrips);
            
            validOptions.forEach(opt => {
                if (opt.price < recommended.price) {
                    recommended = opt;
                }
            });
        }

        return {
            total28DayTrips,
            singleTicketsCost,
            recommended,
            savings: singleTicketsCost - recommended.price
        };
    }, [currentWeekStart, dailyLocations, exceptions, nationalHolidays, ticketPrice, dbPrices]);


    // 4. EDELLISEN VIIKON TOTEUMA (Historiadata Supabasesta)
    const [historicalData, setHistoricalData] = useState({
        ticketCount: 0,
        totalCost: 0,
        priceTrendInfo: null,
        loading: false,
        error: null
    });

    useEffect(() => {
        if (!currentWeekStart) return;
        let isMounted = true;

        const fetchHistoricalData = async () => {
            setHistoricalData(prev => ({ ...prev, loading: true }));
            try {
                // Lasketaan edellisen viikon aikaikkuna (7 päivää taaksepäin nykyviikon alusta)
                const prevWeekStart = new Date(currentWeekStart);
                prevWeekStart.setDate(prevWeekStart.getDate() - 7);
                
                const startStr = prevWeekStart.toISOString();
                const endStr = currentWeekStart.toISOString();

                // KORJATTU: Lisätty .schema('espan')
                const { data, error } = await supabase
                    .schema('espan')
                    .from('expert_ticket_receipts')
                    .select('total_price, ai_metadata')
                    .eq('status', 'approved')
                    .contains('keywords', ['korsisaari'])
                    .gte('departure_time', startStr)
                    .lt('departure_time', endStr);

                if (error) throw error;

                if (isMounted && data) {
                    const ticketCount = data.length;
                    const totalCost = data.reduce((sum, row) => sum + Number(row.total_price), 0);
                    
                    // Katsotaan onko tekoäly jättänyt metatietoihin hintatrendejä tai poikkeamia
                    let aiMessage = null;
                    const receiptWithInsights = data.find(r => r.ai_metadata && (r.ai_metadata.priceTrendInfo || r.ai_metadata.anomalyInfo));
                    if (receiptWithInsights) {
                        aiMessage = receiptWithInsights.ai_metadata.priceTrendInfo || receiptWithInsights.ai_metadata.anomalyInfo;
                    }

                    setHistoricalData({
                        ticketCount,
                        totalCost,
                        priceTrendInfo: aiMessage,
                        loading: false,
                        error: null
                    });
                }
            } catch (error) {
                if(isMounted) setHistoricalData(prev => ({ ...prev, loading: false, error: error.message }));
            }
        };

        fetchHistoricalData();
        return () => { isMounted = false; };
    }, [currentWeekStart]);

    return { forecast, optimization, historicalData };
};