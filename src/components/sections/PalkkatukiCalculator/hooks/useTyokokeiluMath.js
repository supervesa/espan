// --- src/components/sections/PalkkatukiCalculator/hooks/useTyokokeiluMath.js ---
import { useMemo, useEffect } from 'react';
import { parseAnyDate } from '../utils';

export const useTyokokeiluMath = (ika, ptState, onUpdatePalkkatuki) => {
    useEffect(() => {
        const handleRadio = (event) => {
            const payload = event.detail;
            if (payload && payload.tyyppi === "tyokokeilu" && payload.alku && payload.loppu) {
                onUpdatePalkkatuki('suunniteltu_tk_alku', payload.alku);
                onUpdatePalkkatuki('suunniteltu_tk_loppu', payload.loppu);
            } else {
                onUpdatePalkkatuki('suunniteltu_tk_alku', null);
                onUpdatePalkkatuki('suunniteltu_tk_loppu', null);
            }
        };
        window.addEventListener('palvelu_ajankohta_paivitetty', handleRadio);
        return () => window.removeEventListener('palvelu_ajankohta_paivitetty', handleRadio);
    }, [onUpdatePalkkatuki]);

    const tkText = ptState.tyokokeilu_historia || '';
    const isUnder25 = ika !== null && ika < 25;

    const tkCalc = useMemo(() => {
        const regex = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
        let match;
        const periods = [];
        let totalDays = 0;
        let latestEndDate = null;

        while ((match = regex.exec(tkText)) !== null) {
            const start = parseAnyDate(match[1]);
            const end = parseAnyDate(match[2]);
            if (start && end && end >= start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
                totalDays += diffDays;
                
                if (!latestEndDate || end > latestEndDate) {
                    latestEndDate = end;
                }
                periods.push({ startStr: match[1], endStr: match[2], days: diffDays });
            }
        }

        const usePlanned = ptState.huomioi_suunniteltu_tk !== false;
        if (usePlanned && ptState.suunniteltu_tk_alku && ptState.suunniteltu_tk_loppu) {
            const pStart = parseAnyDate(ptState.suunniteltu_tk_alku);
            const pEnd = parseAnyDate(ptState.suunniteltu_tk_loppu);

            if (pStart && pEnd && pEnd >= pStart) {
                const diffDays = Math.ceil(Math.abs(pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
                totalDays += diffDays;
                
                if (!latestEndDate || pEnd > latestEndDate) {
                    latestEndDate = pEnd;
                }
            }
        }

        const now = new Date();
        let gapDays = 0;
        let isReset = false;

        if (latestEndDate) {
            const gapTime = Math.max(0, now - latestEndDate);
            gapDays = Math.ceil(gapTime / (1000 * 60 * 60 * 24));
            const requiredGap = isUnder25 ? 90 : 365;
            if (gapDays >= requiredGap) {
                isReset = true;
                totalDays = 0; 
            }
        }

        const maxDays = 180;
        const remainingDays = Math.max(0, maxDays - totalDays);
        const remainingMonths = Math.floor(remainingDays / 30); 
        
        return {
            periods,
            isReset,
            remainingMonths,
            isMaxedOut: remainingMonths <= 0 && !isReset
        };
    }, [tkText, isUnder25, ptState.suunniteltu_tk_alku, ptState.suunniteltu_tk_loppu, ptState.huomioi_suunniteltu_tk]);

    useEffect(() => {
        if (ptState.tyokokeilu_kesto_kk !== tkCalc.remainingMonths) {
            onUpdatePalkkatuki('tyokokeilu_kesto_kk', tkCalc.remainingMonths);
        }
    }, [tkCalc.remainingMonths, ptState.tyokokeilu_kesto_kk, onUpdatePalkkatuki]);

    useEffect(() => {
        if (!tkCalc.isMaxedOut && ptState.kirjaa_tyokokeilu_esto) {
            onUpdatePalkkatuki('kirjaa_tyokokeilu_esto', false);
        }
    }, [tkCalc.isMaxedOut, ptState.kirjaa_tyokokeilu_esto, onUpdatePalkkatuki]);

    return { tkCalc, isUnder25 };
};