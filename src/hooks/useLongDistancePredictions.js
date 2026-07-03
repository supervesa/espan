// --- src/hooks/useLongDistancePredictions.js ---
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export const useLongDistancePredictions = (expertId) => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPredictions = async () => {
            setLoading(true);
            try {
                // KORJAUS: Lisätty .schema('espan') ennen .from()-kutsua!
                let query = supabase
                    .schema('espan')
                    .from('v_tulevat_matka_suositukset')
                    .select('*')
                    .order('tuleva_matkapaeiva', { ascending: true });

                if (expertId) {
                    query = query.eq('expert_id', expertId);
                }

                const { data, error } = await query;
                if (error) throw error;
                
                setPredictions(data || []);
            } catch (err) {
                console.error("Virhe haettaessa kaukoliikenteen ennusteita:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPredictions();
    }, [expertId]);

    return { predictions, loading };
};