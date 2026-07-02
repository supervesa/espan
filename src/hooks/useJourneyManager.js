import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient'; 

const EXPERT_ID = '00000000-0000-0000-0000-000000000000';

export const useJourneyManager = () => {
    const [pendingReceipts, setPendingReceipts] = useState([]);
    const [loading, setLoading] = useState(true);

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

    // Haetaan data heti kun hook otetaan käyttöön
    useEffect(() => {
        fetchPendingReceipts();
    }, []);

    const approveReceipt = async (updatedReceipt) => {
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
            
            // Poistetaan hyväksytty kuitti paikallisesta jonosta
            setPendingReceipts(prev => prev.filter(r => r.id !== updatedReceipt.id));
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

            // Poistetaan hylätty kuitti paikallisesta jonosta
            setPendingReceipts(prev => prev.filter(r => r.id !== receiptId));
            return true;
        } catch (error) {
            console.error("Virhe kuitin hylkäämisessä:", error);
            return false;
        }
    };

    return {
        pendingReceipts,
        loading,
        approveReceipt,
        rejectReceipt,
        refreshReceipts: fetchPendingReceipts
    };
};