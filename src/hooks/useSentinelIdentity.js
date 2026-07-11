import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient'; 

export const useSentinelIdentity = () => {
    const [isReturning, setIsReturning] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const checkIdentity = useCallback(async (keys) => {
        if (!keys || !keys[0]) return { found: false };
        
        setIsChecking(true);
        try {
            const { data, error } = await supabase.functions.invoke('sentinel-identity', {
                body: { action: 'check', keys }
            });
            
            if (error) throw error;
            
            if (data?.isReturningCustomer && data?.matchedKey) {
                const fullKey = data.matchedKey;
                
                // --- PURATAAN 11 MERKIN REPPU ---
                const extractedSV = fullKey.slice(-4);
                const extractedViimeKayntiKk = fullKey.slice(-6, -4);
                const extractedKk = fullKey.slice(-8, -6);
                const extractedTapa = fullKey.slice(-11, -8);

                // --- 6 KK MATEMATIIKKA ---
                let requiresVisit = false;
                const currentMonth = new Date().getMonth() + 1; // 1-12
                if (extractedViimeKayntiKk !== 'XX') {
                    const lastVisitMonth = parseInt(extractedViimeKayntiKk, 10);
                    // Lasketaan kuukausien ero (huomioi vuoden vaihtumisen)
                    const diff = (currentMonth - lastVisitMonth + 12) % 12;
                    if (diff >= 6) {
                        requiresVisit = true;
                    }
                }

                setIsReturning(true);
                return { 
                    found: true, 
                    birthYear: extractedSV !== 'XXXX' ? extractedSV : null,
                    lastMonth: extractedKk !== 'XX' ? extractedKk : null,
                    lastVisitMonth: extractedViimeKayntiKk !== 'XX' ? extractedViimeKayntiKk : null,
                    lastTapa: extractedTapa !== 'XXX' ? extractedTapa : null,
                    requiresVisit: requiresVisit
                };
            }
            setIsReturning(false);
            return { found: false };
        } catch (err) {
            console.error("Sentinel Error:", err);
            return { found: false };
        } finally {
            setIsChecking(false);
        }
    }, []);

    const registerIdentity = useCallback(async (keys) => {
        if (!keys || !keys[0]) return;
        try {
            await supabase.functions.invoke('sentinel-identity', {
                body: { action: 'register', keys }
            });
        } catch (err) {
            console.error("Sentinel Register Error:", err);
        }
    }, []);

    return { checkIdentity, registerIdentity, isReturning, isChecking };
};