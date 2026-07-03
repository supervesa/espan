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
                .select('*')
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
            const { data, error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .select('*')
                .eq('expert_id', EXPERT_ID)
                .eq('status', 'approved')
                .gte('departure_time', startDate)
                .lte('departure_time', endDate)
                .order('departure_time', { ascending: true });

            if (error) throw error;
            setApprovedReceipts(data || []);
            return data || [];
        } catch (error) {
            console.error("Virhe haettaessa hyväksyttyjä kuitteja:", error);
            return [];
        }
    };

    const approveReceipt = async (updatedReceipt) => {
        try {
            const { error } = await supabase
                .schema('espan')
                .from('expert_ticket_receipts')
                .update({
                    status: 'approved',
                    total_price: updatedReceipt.total_price,
                    departure_time: updatedReceipt.departure_time, // Tämä päivittää päivämäärän
                    route_info: updatedReceipt.route_info,
                    updated_at: new Date().toISOString()
                })
                .eq('id', updatedReceipt.id);

            if (error) throw error;
            
            // KORJAUS MUOKKAUSTA VARTEN: 
            // 1. Poistetaan pending-jonosta jos oli siellä
            setPendingReceipts(prev => prev.filter(r => r.id !== updatedReceipt.id));
            
            // 2. Päivitetään tai lisätään approved-listaan ilman tuplia
            setApprovedReceipts(prev => {
                const isAlreadyInApproved = prev.some(r => r.id === updatedReceipt.id);
                if (isAlreadyInApproved) {
                    // Jos kuittia vain muokattiin, päivitetään se listassa (jotta päivämäärä/hinta vaihtuu ruudulla)
                    return prev.map(r => r.id === updatedReceipt.id ? { ...updatedReceipt, status: 'approved' } : r);
                } else {
                    // Jos siirrettiin pending -> approved
                    return [...prev, { ...updatedReceipt, status: 'approved' }];
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

            // Poistetaan molemmista paikallisista listoista (jos esim. perutaan jo hyväksytty)
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
                setApprovedReceipts(prev => [...prev, data[0]]);
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
        refreshReceipts: fetchPendingReceipts,
        approvedReceipts,
        fetchApprovedReceipts,
        addVirtualReceipt
    };
};