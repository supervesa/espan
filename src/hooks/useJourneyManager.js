// --- src/hooks/useJourneyManager.js ---
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient'; 

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

export const useJourneyManager = () => {
    const [pendingReceipts, setPendingReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approvedReceipts, setApprovedReceipts] = useState([]);

    const fetchPendingReceipts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .select('*, expert_journeys(*)')
                .eq('expert_id', EXPERT_ID)
                .eq('status', 'pending')
                .order('email_received_at', { ascending: false });

            if (error) throw error;
            setPendingReceipts(data || []);
        } catch (error) {
            console.error("Virhe haettaessa kuitteja:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingReceipts();
    }, []);

    const fetchApprovedReceipts = async (startDate, endDate) => {
        try {
            const { data: legacyReceipts, error: legacyError } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .select('*, expert_journeys(*)')
                .eq('expert_id', EXPERT_ID)
                .eq('status', 'approved')
                .gte('departure_time', startDate)
                .lte('departure_time', endDate);

            if (legacyError) throw legacyError;

            const { data: journeys, error: journeyError } = await supabase
                .schema('espan')
                .from('expert_journeys')
                .select('*, expert_ticket_receipts(*)')
                .eq('expert_id', EXPERT_ID)
                .gte('departure_time', startDate)
                .lte('departure_time', endDate);

            if (journeyError) throw journeyError;

            const receiptMap = new Map();

            (legacyReceipts || []).forEach(receipt => {
                receiptMap.set(receipt.id, receipt);
            });

            (journeys || []).forEach(journey => {
                const parentReceipt = journey.expert_ticket_receipts;
                if (parentReceipt && parentReceipt.status === 'approved') {
                    if (!receiptMap.has(parentReceipt.id)) {
                        receiptMap.set(parentReceipt.id, { 
                            ...parentReceipt, 
                            expert_journeys: [journey] 
                        });
                    } else {
                        const existingReceipt = receiptMap.get(parentReceipt.id);
                        const hasJourney = existingReceipt.expert_journeys?.some(j => j.id === journey.id);
                        if (!hasJourney) {
                            existingReceipt.expert_journeys = [...(existingReceipt.expert_journeys || []), journey];
                        }
                    }
                }
            });

            const finalData = Array.from(receiptMap.values()).sort((a, b) => 
                new Date(a.departure_time) - new Date(b.departure_time)
            );

            setApprovedReceipts(finalData);
            return finalData;
        } catch (error) {
            console.error("Virhe haettaessa hyväksyttyjä kuitteja ja matkoja:", error);
            return [];
        }
    };

    const approveReceipt = async (updatedReceipt, newJourneys = null) => {
        try {
            const { error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .update({
                    status: 'approved',
                    total_price: updatedReceipt.total_price,
                    departure_time: updatedReceipt.departure_time,
                    route_info: updatedReceipt.route_info,
                    updated_at: new Date().toISOString()
                })
                .eq('id', updatedReceipt.id);

            if (error) throw error;

            let finalJourneys = [];

            if (newJourneys && newJourneys.length > 0) {
                await supabase.schema('espan').from('expert_journeys').delete().eq('receipt_id', updatedReceipt.id);
                
                const inserts = newJourneys.map(j => ({
                    expert_id: EXPERT_ID,
                    receipt_id: updatedReceipt.id,
                    departure_time: j.departure_time,
                    route_info: j.route_info,
                    direction: j.direction,
                    price: j.price ? Number(j.price) : 0.00 
                }));
                const { data: insertedJourneys } = await supabase.schema('espan').from('expert_journeys').insert(inserts).select();
                finalJourneys = insertedJourneys || [];
            } else {
                const { data: existingJourneys } = await supabase.schema('espan').from('expert_journeys').select('*').eq('receipt_id', updatedReceipt.id);
                
                if (!existingJourneys || existingJourneys.length === 0) {
                    const { data: inserted } = await supabase.schema('espan').from('expert_journeys').insert([{
                        expert_id: EXPERT_ID,
                        receipt_id: updatedReceipt.id,
                        departure_time: updatedReceipt.departure_time,
                        route_info: updatedReceipt.route_info,
                        direction: 'tuntematon',
                        price: updatedReceipt.total_price 
                    }]).select();
                    finalJourneys = inserted || [];
                } else {
                    finalJourneys = existingJourneys;
                }
            }
            
            const receiptWithJourneys = { ...updatedReceipt, status: 'approved', expert_journeys: finalJourneys };

            setPendingReceipts(prev => prev.filter(r => r.id !== updatedReceipt.id));
            setApprovedReceipts(prev => {
                const isAlreadyInApproved = prev.some(r => r.id === updatedReceipt.id);
                if (isAlreadyInApproved) {
                    return prev.map(r => r.id === updatedReceipt.id ? receiptWithJourneys : r);
                } else {
                    return [...prev, receiptWithJourneys];
                }
            });

            return true;
        } catch (error) {
            console.error("Virhe kuitin hyväksynnässä:", error);
            return false;
        }
    };

    const rejectReceipt = async (receiptId) => {
        try {
            const { error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .update({ 
                    status: 'rejected', 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', receiptId);

            if (error) throw error;

            setPendingReceipts(prev => prev.filter(r => r.id !== receiptId));
            setApprovedReceipts(prev => prev.filter(r => r.id !== receiptId));
            return true;
        } catch (error) {
            console.error("Virhe kuitin hylkäämisessä:", error);
            return false;
        }
    };

    const addVirtualReceipt = async (date, routeInfo, keywords) => {
        try {
            const newVirtualReceipt = {
                expert_id: EXPERT_ID,
                status: 'approved',
                departure_time: date,
                total_price: 0.00,
                route_info: routeInfo,
                keywords: keywords, 
                ai_metadata: { isVirtual: true, note: "Manuaalinen ohitus (Ei kulua)" },
                email_received_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .insert([newVirtualReceipt])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                const createdReceipt = data[0];
                
                const { data: journeyData } = await supabase
                    .schema('espan')
                    .from('expert_journeys')
                    .insert([{
                        expert_id: EXPERT_ID,
                        receipt_id: createdReceipt.id,
                        departure_time: date,
                        route_info: routeInfo,
                        direction: routeInfo.toLowerCase().includes('meno') ? 'meno' : 'paluu',
                        price: 0.00 
                    }])
                    .select();

                const finalReceipt = { ...createdReceipt, expert_journeys: journeyData || [] };
                setApprovedReceipts(prev => [...prev, finalReceipt]);
            }
            return true;
        } catch (error) {
            console.error("Virhe virtuaalikuitin lisäämisessä:", error);
            return false;
        }
    };

    return {
        pendingReceipts, 
        loading, 
        approveReceipt, 
        rejectReceipt, 
        refreshReceipts: fetchPendingReceipts, // KORJAUS ON TÄSSÄ!
        approvedReceipts, 
        fetchApprovedReceipts, 
        addVirtualReceipt
    };
};