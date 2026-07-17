import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';

// Apufunktio viikon ja vuoden laskentaan
const getWeekData = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week };
};

export const usePlanCalculator = (asiantuntijaId) => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreportedPlans, setUnreportedPlans] = useState(0);
    const [ageDistribution, setAgeDistribution] = useState([]);
    const [areaDistribution, setAreaDistribution] = useState([]); // Uusi tila alueille
    const [currentWeekTotal, setCurrentWeekTotal] = useState(0); // UUSI: Viikkosaldo

    const fetchData = useCallback(async () => {
        if (!asiantuntijaId) return;
        setLoading(true);

        try {
            // 1. Hae Power BI -historia
            const { data: snapData, error: snapErr } = await supabase
                .schema('espan')
                .from('powerbi_snapshots')
                .select('*')
                .eq('asiantuntija_id', asiantuntijaId)
                .order('created_at', { ascending: false });

            if (snapErr) throw snapErr;
            setSnapshots(snapData || []);

            const lastSnapshotDate = snapData?.length > 0 
                ? snapData[0].created_at 
                : new Date(0).toISOString();

            // 2. Hae Espanin sisällä tehdyt suunnitelmat edellisen raportin JÄLKEEN (Tutkaa varten)
            const { data: counterData, error: countErr } = await supabase
                .schema('espan')
                .from('weekly_counters')
                .select('tehdyt_suunnitelmat')
                .eq('asiantuntija_id', asiantuntijaId)
                .gte('created_at', lastSnapshotDate);

            if (countErr) throw countErr;

            const totalUnreported = counterData.reduce((sum, row) => sum + (row.tehdyt_suunnitelmat || 0), 0);
            setUnreportedPlans(totalUnreported);

            // 3. Hae KAIKKI ikäryhmä- ja aluekirjaukset jakaumia varten (+ vuosi ja viikko!)
            const { data: distData, error: distErr } = await supabase
                .schema('espan')
                .from('weekly_counters')
                .select('ikaryhma, alue, tehdyt_suunnitelmat, vuosi, viikko') 
                .eq('asiantuntija_id', asiantuntijaId);

            if (!distErr && distData) {
                const ageDist = {};
                const areaDist = {};
                
                // Määritetään kuluva hetki viikkosaldon laskua varten
                const now = new Date();
                const currentWeek = getWeekData(now);
                let viikkoSaldo = 0;
                
                distData.forEach(row => {
                    // LASKETAAN KULUVAN VIIKON SALDO
                    if (row.vuosi === currentWeek.year && row.viikko === currentWeek.week) {
                        viikkoSaldo += (row.tehdyt_suunnitelmat || 0);
                    }

                    // Ikäryhmät
                    const ageGroup = row.ikaryhma || 'Ei määritelty';
                    ageDist[ageGroup] = (ageDist[ageGroup] || 0) + (row.tehdyt_suunnitelmat || 0);

                    // Alueet
                    const areaGroup = row.alue || 'Tuntematon';
                    areaDist[areaGroup] = (areaDist[areaGroup] || 0) + (row.tehdyt_suunnitelmat || 0);
                });
                
                setCurrentWeekTotal(viikkoSaldo); // Tallennetaan tilaan

                // Koostetaan ja järjestetään ikäryhmät
                const compiledAgeStats = Object.keys(ageDist)
                    .map(k => ({ name: k, count: ageDist[k] }))
                    .filter(item => item.count > 0)
                    .sort((a, b) => b.count - a.count);
                setAgeDistribution(compiledAgeStats);

                // Koostetaan ja järjestetään alueet täsmälleen samalla lailla
                const compiledAreaStats = Object.keys(areaDist)
                    .map(k => ({ name: k, count: areaDist[k] }))
                    .filter(item => item.count > 0)
                    .sort((a, b) => b.count - a.count);
                setAreaDistribution(compiledAreaStats);
            }

        } catch (error) {
            console.error('Virhe PlanCalculator-datan haussa:', error);
        } finally {
            setLoading(false);
        }
    }, [asiantuntijaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveSnapshot = async (payload) => {
        try {
            const { error } = await supabase
                .schema('espan')
                .from('powerbi_snapshots')
                .insert([{
                    ...payload,
                    asiantuntija_id: asiantuntijaId,
                    espan_omat_tehdyt: unreportedPlans
                }]);

            if (error) throw error;
            
            await fetchData(); 
            return { success: true };
        } catch (error) {
            console.error('Virhe tallennettaessa Power BI -raporttia:', error);
            return { success: false, error };
        }
    };

    // Palautetaan myös uusi currentWeekTotal käyttöön
    return { snapshots, loading, unreportedPlans, ageDistribution, areaDistribution, currentWeekTotal, saveSnapshot };
};