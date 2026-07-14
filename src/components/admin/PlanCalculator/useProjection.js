import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';

export const useProjection = (asiantuntijaId) => {
    const [projectionData, setProjectionData] = useState([]);
    const [projectionLoading, setProjectionLoading] = useState(true);

    const fetchProjection = useCallback(async () => {
        if (!asiantuntijaId) return;
        setProjectionLoading(true);

        try {
            const { data, error } = await supabase
                .schema('espan')
                .from('v_tyottomyysturva_seuranta')
                .select('*')
                .eq('asiantuntija_id', asiantuntijaId)
                .order('horisontti_viikko', { ascending: true });

            if (error) throw error;
            setProjectionData(data || []);

        } catch (error) {
            console.error('Virhe 16 viikon projektion haussa:', error);
        } finally {
            setProjectionLoading(false);
        }
    }, [asiantuntijaId]);

    useEffect(() => {
        fetchProjection();
    }, [fetchProjection]);

    return { projectionData, projectionLoading };
};