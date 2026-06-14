import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';

// 1. Viedään Context (jotta useSignal.js löytää sen)
export const SignalContext = createContext(null);

const normalize = (str) => {
    if (!str) return '';
    const s = str.trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

// 2. Viedään Provider (jotta App.js löytää sen)
export const SignalProvider = ({ children, activeSignals = {}, actions = {} }) => {
    const [dbData, setDbData] = useState({ signals: [], phrases: [], sections: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [sig, phr, sec] = await Promise.all([
                    supabase.from('system_signals').select('*'),
                    supabase.from('phrases').select('phrase_key, short_title, section_id'),
                    supabase.from('sections').select('id, title')
                ]);
                setDbData({ 
                    signals: sig.data || [], 
                    phrases: phr.data || [], 
                    sections: sec.data || [] 
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
        loading
    }), [dictionary, getSignalInfo, activeSignals, actions, loading]);

    return (
        <SignalContext.Provider value={value}>
            {children}
        </SignalContext.Provider>
    );
};