// --- src/hooks/useLocalTransportStats.js ---
import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const formatDateStr = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

// Palkkapäivä-algoritmi (14. pv tai edeltävä perjantai)
const getAdjustedSalaryDay = (year, month) => {
    const d = new Date(year, month, 14);
    const day = d.getDay(); // 0 = Sunnuntai, 6 = Lauantai
    if (day === 6) d.setDate(13); // Perjantai
    if (day === 0) d.setDate(12); // Perjantai
    return d;
};

// Jakson rajojen laskenta (Kuukausi tai Palkkakausi)
const getPeriod = (baseDate, useSalary) => {
    if (!useSalary) {
        const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        return { start, end };
    } else {
        const currentMonthSalaryDay = getAdjustedSalaryDay(baseDate.getFullYear(), baseDate.getMonth());
        if (baseDate < currentMonthSalaryDay) {
            const prevMonthSalaryDay = getAdjustedSalaryDay(baseDate.getFullYear(), baseDate.getMonth() - 1);
            const end = new Date(currentMonthSalaryDay);
            end.setDate(end.getDate() - 1);
            return { start: prevMonthSalaryDay, end };
        } else {
            const nextMonthSalaryDay = getAdjustedSalaryDay(baseDate.getFullYear(), baseDate.getMonth() + 1);
            const end = new Date(nextMonthSalaryDay);
            end.setDate(end.getDate() - 1);
            return { start: currentMonthSalaryDay, end };
        }
    }
};

export const useLocalTransportStats = ({ 
    currentWeekStart, 
    dailyLocations, 
    exceptions, 
    nationalHolidays, 
    settings,
    arriveDayBefore,
    useSalaryPeriod // UUSI: Tieto käytetäänkö palkkakautta
}) => {
    
    const ticketPrice = settings?.bus_ticket_price_eur || 8.06;
    const weekStartKey = currentWeekStart 
        ? new Date(currentWeekStart).toISOString().split('T')[0] 
        : null;

    // 1. KULUVAN VIIKON ENNUSTE
    const forecast = useMemo(() => {
        if (!currentWeekStart) return null;

        let officeDaysCount = 0;
        let firstOfficeDate = null;
        let lastOfficeDate = null;
        
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
                    if (!firstOfficeDate) firstOfficeDate = new Date(currentDay);
                    lastOfficeDate = new Date(currentDay);
                }
            }
        }

        let firstTravelDate = firstOfficeDate ? new Date(firstOfficeDate) : null;
        if (arriveDayBefore && firstTravelDate) {
            firstTravelDate.setDate(firstTravelDate.getDate() - 1);
        }
        let lastTravelDate = lastOfficeDate ? new Date(lastOfficeDate) : null;

        let tulo = 0, vali = 0, lahto = 0, localTickets = 0;
        
        if (arriveDayBefore && officeDaysCount > 0) {
            if (officeDaysCount === 1) {
                tulo = 1;
                vali = 0;
                lahto = 0;
                localTickets = 1;
            } else {
                tulo = 2;
                vali = (officeDaysCount - 2) * 2;
                lahto = 1;
                localTickets = ((officeDaysCount - 1) * 2) + 1;
            }
        } else if (officeDaysCount >= 2) {
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
            ticketPrice,
            firstTravelDate: firstTravelDate ? firstTravelDate.toISOString() : null,
            lastTravelDate: lastTravelDate ? lastTravelDate.toISOString() : null
        };
    }, [currentWeekStart, dailyLocations, exceptions, nationalHolidays, settings, ticketPrice, arriveDayBefore]);

    const [dbPrices, setDbPrices] = useState([]);
    
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const { data, error } = await supabase
                    .schema('espan')
                    .from('ticket_prices')
                    .select('*');
                
                if (error) throw error;
                
                if (data) {
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

    // 2. ÄLYKÄS SÄÄSTÖTUTKA (Reppuongelma / Knapsack & Palkkakausi)
    const optimization = useMemo(() => {
        if (!currentWeekStart || dbPrices.length === 0) return null;

        const { start: periodStart, end: periodEnd } = getPeriod(new Date(currentWeekStart), useSalaryPeriod);
        
        let totalPeriodTrips = 0;
        let firstTicketDate = null;
        let lastTicketDate = null;

        // Apumuuttujat viikkojen sisäiseen laskentaan
        let currentWeekOfficeDays = 0;
        let currentWeekFirstOffice = null;
        let currentWeekLastOffice = null;

        const processWeek = (isFirstWeekOfPeriod) => {
            if (currentWeekOfficeDays > 0) {
                let tripsThisWeek = 0;
                let actualFirstDay = currentWeekFirstOffice;

                if (isFirstWeekOfPeriod && arriveDayBefore) {
                    tripsThisWeek = currentWeekOfficeDays === 1 ? 1 : ((currentWeekOfficeDays - 1) * 2) + 1;
                    actualFirstDay = new Date(currentWeekFirstOffice);
                    actualFirstDay.setDate(actualFirstDay.getDate() - 1);
                } else if (currentWeekOfficeDays >= 2) {
                    tripsThisWeek = (currentWeekOfficeDays - 1) * 2;
                }

                if (tripsThisWeek > 0) {
                    totalPeriodTrips += tripsThisWeek;
                    if (!firstTicketDate) firstTicketDate = actualFirstDay;
                    lastTicketDate = currentWeekLastOffice;
                }
            }
            currentWeekOfficeDays = 0;
            currentWeekFirstOffice = null;
            currentWeekLastOffice = null;
        };

        const iterDate = new Date(periodStart);
        let isFirstWeek = true;

        while (iterDate <= periodEnd) {
            const dStr = formatDateStr(iterDate);
            const dayOfWeek = iterDate.getDay(); 

            const isBlockedDay = exceptions?.some(e =>
                e.is_blocked && e.meeting_type === 'estetty' && e.start_time.substring(0, 10) === dStr
            );
            const isHolidayDay = nationalHolidays?.some(h => h.date === dStr);

            if (!isBlockedDay && !isHolidayDay && dayOfWeek !== 0 && dayOfWeek !== 6) {
                const loc = dailyLocations?.find(l => l.date === dStr);
                if (loc?.location_type === 'lahityo') {
                    currentWeekOfficeDays += 1;
                    if (!currentWeekFirstOffice) currentWeekFirstOffice = new Date(iterDate);
                    currentWeekLastOffice = new Date(iterDate);
                }
            }

            // Päätetään viikko aina sunnuntaihin tai jakson loppuun
            if (dayOfWeek === 0 || iterDate.getTime() === periodEnd.getTime()) {
                processWeek(isFirstWeek);
                isFirstWeek = false;
            }

            iterDate.setDate(iterDate.getDate() + 1);
        }

        const singleTicketsCost = totalPeriodTrips * ticketPrice;
        let spanDays = 0;
        if (firstTicketDate && lastTicketDate) {
            spanDays = Math.ceil((lastTicketDate - firstTicketDate) / (1000 * 60 * 60 * 24)) + 1;
        }

        // --- KNAPSACK-ALGORITMI (Reppuongelma) ---
        let baskets = [];
        
        // 1. Vaihtoehto: Vain yksittäislippuja
        baskets.push({
            id: 'single',
            description: `${totalPeriodTrips}x Yksittäislippu`,
            cost: singleTicketsCost
        });

        if (totalPeriodTrips > 0) {
            const validOptions = dbPrices.filter(p => p.days >= spanDays);
            
            validOptions.forEach(opt => {
                if (opt.type === 'kausi') {
                    // 2. Vaihtoehto: Kausilippu (kattaa kaiken)
                    baskets.push({
                        id: `kausi_${opt.name}`,
                        description: `1x ${opt.name}`,
                        cost: opt.price
                    });
                } else if (opt.type === 'sarja') {
                    // 3. Vaihtoehto: Sarjalippu + Yksittäiset lisäliput (Combo)
                    if (opt.trips < totalPeriodTrips) {
                        const singlesNeeded = totalPeriodTrips - opt.trips;
                        baskets.push({
                            id: `sarja_singles_${opt.name}`,
                            description: `1x ${opt.name} + ${singlesNeeded}x Yksittäislippu`,
                            cost: opt.price + (singlesNeeded * ticketPrice)
                        });
                    }
                    // 4. Vaihtoehto: Useampi sama sarjalippu (esim. 2x 10-matkan)
                    const neededCount = Math.ceil(totalPeriodTrips / opt.trips);
                    if (neededCount * opt.trips >= totalPeriodTrips) {
                        const desc = neededCount === 1 ? `1x ${opt.name}` : `${neededCount}x ${opt.name}`;
                        baskets.push({
                            id: `sarja_mult_${opt.name}`,
                            description: desc,
                            cost: neededCount * opt.price
                        });
                    }
                }
            });
        }

        // Järjestetään korit hinnan mukaan halvimmasta kalleimpaan
        baskets.sort((a, b) => a.cost - b.cost);

        // Poistetaan tuplat nimikkeistä (esim. jos 1x sarja riittää, se ei tulosta comboa)
        const uniqueBaskets = [];
        const seenDesc = new Set();
        baskets.forEach(b => {
            if (!seenDesc.has(b.description)) {
                seenDesc.add(b.description);
                uniqueBaskets.push(b);
            }
        });

        const recommended = uniqueBaskets[0] || baskets[0];

        // Jakson nimikkeet UI:ta varten
        const pStartStr = `${periodStart.getDate()}.${periodStart.getMonth() + 1}.`;
        const pEndStr = `${periodEnd.getDate()}.${periodEnd.getMonth() + 1}.`;
        
        // Luodaan "Heinäkuu" tai "Palkkakausi" otsikko
        const monthName = periodStart.toLocaleString('fi-FI', { month: 'long' });
        const periodLabel = useSalaryPeriod 
            ? 'Palkkakausi' 
            : monthName.charAt(0).toUpperCase() + monthName.slice(1);

        return {
            total28DayTrips: totalPeriodTrips,
            singleTicketsCost,
            recommended,
            savings: singleTicketsCost - recommended.cost,
            periodLabel,
            periodStartStr: pStartStr,
            periodEndStr: pEndStr,
            allBaskets: uniqueBaskets
        };
    }, [currentWeekStart, dailyLocations, exceptions, nationalHolidays, ticketPrice, dbPrices, arriveDayBefore, useSalaryPeriod]);

    const [historicalData, setHistoricalData] = useState({
        ticketCount: 0,
        totalCost: 0,
        priceTrendInfo: null,
        loading: false,
        error: null
    });

    useEffect(() => {
        if (!weekStartKey) return;
        let isMounted = true;

        const fetchHistoricalData = async () => {
            setHistoricalData(prev => ({ ...prev, loading: true }));
            try {
                const prevWeekStart = new Date(weekStartKey);
                prevWeekStart.setDate(prevWeekStart.getDate() - 7);
                
                const startStr = prevWeekStart.toISOString();
                const endStr = new Date(weekStartKey).toISOString();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekStartKey]);

    return { forecast, optimization, historicalData };
};