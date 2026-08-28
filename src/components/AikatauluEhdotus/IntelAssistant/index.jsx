// src/components/AikatauluEhdotus/IntelAssistant/index.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { Bot } from 'lucide-react';

import { analyzeSchedule } from './IntelEngine';
import IntelUI from './IntelUI';

const IntelAssistant = ({ 
    suggestion, 
    onApply,
    basket = [], 
    clientType = 'normi', 
    is46 = false, 
    needsInterpreter = false, 
    isFamiliar = false,
    expertLocations = [],
    clientVaultData = {} // 🟢 Asiakkaan repusta tuodut kestot 
}) => {
    const [settings, setSettings] = useState(null);
    const [universalData, setUniversalData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                
                // 1. Haetaan asetukset
                const { data: setsData, error: setsErr } = await supabase.schema('espan')
                    .from('settings_ajanvaraus')
                    .select('*')
                    .eq('asiantuntija_id', currentExpertId)
                    .maybeSingle();

                if (setsData && !setsErr) {
                    setSettings(setsData);

                    // 2. HOLVI 2: Haetaan Universaali kestoanalytiikka (viimeiset 6 kk) JOS asetus sallii
                    if (setsData.automaatio?.ajanhallinta?.salli_dynaamiset_kestot) {
                        const d = new Date();
                        d.setMonth(d.getMonth() - 6);
                        const cutoffDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                        const { data: uniData } = await supabase.schema('espan')
                            .from('universaali_kesto_analytiikka')
                            .select('kategoria, kesto_min')
                            .eq('asiantuntija_id', currentExpertId)
                            .gte('kuukausi_vuosi', cutoffDateStr);

                        if (uniData) setUniversalData(uniData);
                    }
                }
            } catch (e) {
                console.error("IntelAssistant: Virhe datan haussa", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analysis = useMemo(() => {
        if (!settings) return null;
        return analyzeSchedule({
            settings, basket, suggestion, clientType, is46, 
            needsInterpreter, isFamiliar, expertLocations,
            clientVaultData, universalData
        });
    }, [settings, basket, suggestion, clientType, is46, needsInterpreter, isFamiliar, expertLocations, clientVaultData, universalData]);

    if (!suggestion) return null;

    if (loading) {
        return (
            <div style={{ padding: '1rem', border: '1px dashed var(--color-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={20} className="text-ai" style={{ animation: 'pulse 1.5s infinite' }} />
                <span className="text-xs text-secondary">Assistentti asentaa ohjelmistoja ja holvidataa...</span>
            </div>
        );
    }

    return (
        <IntelUI 
            suggestion={suggestion}
            onApply={onApply}
            basket={basket}
            analysis={analysis}
        />
    );
};

export default IntelAssistant;