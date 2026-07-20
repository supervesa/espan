// --- src/components/signals/SignalContext.jsx ---
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';

export const SignalContext = createContext(null);

const normalize = (str) => {
    if (!str) return '';
    const s = str.trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const SignalProvider = ({ children, activeSignals = {}, actions = {} }) => {
    // 1. LISÄTTY uudet taulut alkutilaan
    const [dbData, setDbData] = useState({ 
        signals: [], 
        phrases: [], 
        sections: [],
        variables: [],
        rules: [],
        knowledgeBase: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // 2. LISÄTTY kolme uutta Supabase-hakua samaan eräajoon
                const [sig, phr, sec, vars, rulesData, kb] = await Promise.all([
                    supabase.from('system_signals').select('*'),
                    supabase.from('phrases').select('phrase_key, short_title, section_id'),
                    supabase.from('sections').select('id, title'),
                    supabase.from('variables').select('*'),
                    supabase.from('business_rules').select('*'),
                    supabase.from('knowledge_base').select('*').eq('category', 'Vakiotekstit')
                ]);
                
                setDbData({ 
                    signals: sig.data || [], 
                    phrases: phr.data || [], 
                    sections: sec.data || [],
                    variables: vars.data || [],           // UUSI
                    rules: rulesData.data || [],          // UUSI
                    knowledgeBase: kb.data || []          // UUSI
                });
            } catch (err) {
                console.error("Virhe globaalissa signaalidatan haussa:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const dictionary = useMemo(() => {
        // TÄMÄ ON KOSKEMATON - Vanha logiikka toimii kuten ennenkin
        const dict = {};
        const sectionMap = {};
        dbData.sections.forEach(s => { sectionMap[s.id] = s.title; });

        dbData.signals.forEach(s => {
            const cat = s.category || 'Muut';
            if (!dict[cat]) dict[cat] = { title: normalize(cat), options: [] };
            dict[cat].options.push({ key: s.signal_key, label: normalize(s.label), desc: s.description });
        });

        dbData.phrases.forEach(p => {
            const catName = sectionMap[p.section_id] || 'Lomakevalinnat';
            if (!dict[catName]) dict[catName] = { title: normalize(catName), options: [] };
            if (!dict[catName].options.find(o => o.key === p.phrase_key)) {
                dict[catName].options.push({ 
                    key: p.phrase_key, 
                    label: normalize(p.short_title || p.phrase_key), 
                    desc: null 
                });
            }
        });
        return dict;
    }, [dbData]);

    const getSignalInfo = useCallback((key) => {
        // TÄMÄ ON KOSKEMATON
        if (key.startsWith('AI_')) {
            const parts = key.split('_');
            return { label: normalize(parts[parts.length - 1]), cat: 'Tekoäly', isAi: true };
        }
        for (const cat in dictionary) {
            const found = dictionary[cat].options.find(o => o.key === key);
            if (found) return { ...found, cat: dictionary[cat].title };
        }
        return { label: normalize(key.replace(/_/g, ' ')), cat: 'Muut', isAi: false };
    }, [dictionary]);

    const value = useMemo(() => ({
        dictionary,
        getSignalInfo,
        activeSignals, 
        actions,       
        loading,
        // 3. LISÄTTY: Viedään uudet globaalit datat ulos Contextista
        variables: dbData.variables,
        rules: dbData.rules,
        knowledgeBase: dbData.knowledgeBase
    }), [dictionary, getSignalInfo, activeSignals, actions, loading, dbData.variables, dbData.rules, dbData.knowledgeBase]);

    return (
        <SignalContext.Provider value={value}>
            {children}
        </SignalContext.Provider>
    );
};