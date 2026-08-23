// --- src/components/sections/PalkkatukiCalculator/hooks/useTyokokeiluMath.js ---
import { useMemo, useEffect } from 'react';

const parseSafeDate = (dateStr) => {
    let str = typeof dateStr === 'object' ? (dateStr?.value || dateStr?.oletus || String(dateStr)) : dateStr;
    if (!str) return null;
    
    if (typeof str === 'string' && str.includes('.')) {
        const p = str.split('.');
        if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
    }
    
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

export const useTyokokeiluMath = (state, ika, ptState, actions) => {
    const { onUpdatePalkkatuki, onAddSignal, onRemoveSignal } = actions || {};

    useEffect(() => {
        const handleRadio = (event) => {
            const payload = event.detail;
            if (payload && payload.tyyppi === "tyokokeilu" && payload.alku && payload.loppu) {
                if (onUpdatePalkkatuki) {
                    onUpdatePalkkatuki('suunniteltu_tk_alku', payload.alku);
                    onUpdatePalkkatuki('suunniteltu_tk_loppu', payload.loppu);
                }
            } else {
                if (onUpdatePalkkatuki) {
                    onUpdatePalkkatuki('suunniteltu_tk_alku', null);
                    onUpdatePalkkatuki('suunniteltu_tk_loppu', null);
                }
            }
        };
        window.addEventListener('palvelu_ajankohta_paivitetty', handleRadio);
        return () => window.removeEventListener('palvelu_ajankohta_paivitetty', handleRadio);
    }, [onUpdatePalkkatuki]);

    const tkText = ptState?.tyokokeilu_historia || '';
    const isUnder25 = ika !== null && ika < 25;

    const tkCalc = useMemo(() => {
        let totalMonths = 0;
        let totalLeftoverDays = 0;
        let latestEndDate = null;
        const periods = [];
        const processedSignatures = new Set(); // Apumuuttuja duplikaattien estoon

        const now = new Date();
        const twoYearsAgo = new Date();
        twoYearsAgo.setMonth(now.getMonth() - 24); 

        // Keskitetty funktio yhden jakson prosessointiin
        const addPeriod = (startStr, endStr, source) => {
            const start = parseSafeDate(startStr);
            const end = parseSafeDate(endStr);
            
            if (!start || !end || end < start) return;
            if (end < twoYearsAgo) return;

            // Estetään täsmälleen samojen aikavälien tuplalaskenta
            const signature = `${start.getTime()}-${end.getTime()}`;
            if (processedSignatures.has(signature)) return;
            processedSignatures.add(signature);

            // 1. Laske absoluuttiset kalenterikuukaudet
            let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            let leftoverDays = 0;

            // 2. Jos lopetuspäivä on aiemmin kuukaudessa kuin aloituspäivä (+1 sallii esim. 15.1.-14.2. olla tasan 1kk)
            if (end.getDate() + 1 < start.getDate()) {
                months -= 1;
                const tempDate = new Date(start);
                tempDate.setMonth(tempDate.getMonth() + months);
                leftoverDays = Math.round((end - tempDate) / (1000 * 60 * 60 * 24)) + 1; // Päivien heitto
            } else {
                leftoverDays = (end.getDate() - start.getDate()) + 1;
            }

            // 3. Tasataan yli 30 päivän "irtopäivät" kuukausiksi heti
            if (leftoverDays >= 30) {
                months += Math.floor(leftoverDays / 30);
                leftoverDays = leftoverDays % 30;
            }

            totalMonths += months;
            totalLeftoverDays += leftoverDays;

            // Seurataan nollaussääntöä varten vain menneitä tai käynnissä olevia kokeiluja
            if (end <= now) {
                if (!latestEndDate || end > latestEndDate) latestEndDate = end;
            }

            periods.push({ 
                startStr: typeof startStr === 'string' ? startStr : start.toLocaleDateString('fi-FI'), 
                endStr: typeof endStr === 'string' ? endStr : end.toLocaleDateString('fi-FI'), 
                months, 
                leftoverDays, 
                source 
            });
        };

        // 1. Käsitellään järjestelmän palvelut
        const services = state?.sessionServices || [];
        services.forEach((srv) => {
            if (srv?.entity_key === 'tyokokeilu') {
                addPeriod(srv?.data?.alku, srv?.data?.loppu, 'järjestelmä');
            }
        });

        // 2. Käsitellään manuaalinen tekstihistoria
        if (tkText) {
            const regex = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
            let match;
            while ((match = regex.exec(tkText)) !== null) {
                addPeriod(match[1], match[2], 'manuaalinen');
            }
        }

        // 3. Tarkistetaan nollaussääntö aiemmista jaksoista ennen suunniteltua jaksoa
        let isReset = false;
        if (latestEndDate) {
            const gapTime = Math.max(0, now - latestEndDate);
            const gapDays = Math.ceil(gapTime / (1000 * 60 * 60 * 24));
            const requiredGap = isUnder25 ? 90 : 365;
            
            if (gapDays >= requiredGap) {
                isReset = true;
                totalMonths = 0; 
                totalLeftoverDays = 0;
            }
        }

        // 4. Lisätään suunniteltu työkokeilu (nollauksen jälkeen, jos nollaus on tapahtunut)
        const usePlanned = ptState?.huomioi_suunniteltu_tk !== false;
        if (usePlanned && ptState?.suunniteltu_tk_alku && ptState?.suunniteltu_tk_loppu) {
            addPeriod(ptState.suunniteltu_tk_alku, ptState.suunniteltu_tk_loppu, 'suunniteltu');
        }

        // 5. Lopullinen summaus
        totalMonths += Math.floor(totalLeftoverDays / 30);
        
        const maxMonths = 6; 
        const remainingMonths = Math.max(0, maxMonths - totalMonths);

        return {
            periods,
            isReset,
            remainingMonths,
            isMaxedOut: remainingMonths <= 0 && !isReset
        };
    }, [tkText, isUnder25, ptState?.suunniteltu_tk_alku, ptState?.suunniteltu_tk_loppu, ptState?.huomioi_suunniteltu_tk, state?.sessionServices]);

    useEffect(() => {
        if (ptState?.tyokokeilu_kesto_kk !== tkCalc.remainingMonths) {
            if(typeof onUpdatePalkkatuki === 'function') {
                onUpdatePalkkatuki('tyokokeilu_kesto_kk', tkCalc.remainingMonths);
            }
        }
    }, [tkCalc.remainingMonths, ptState?.tyokokeilu_kesto_kk, onUpdatePalkkatuki]);

    useEffect(() => {
        if (!tkCalc.isMaxedOut && ptState?.kirjaa_tyokokeilu_esto) {
            if(typeof onUpdatePalkkatuki === 'function') {
                onUpdatePalkkatuki('kirjaa_tyokokeilu_esto', false);
            }
        }
    }, [tkCalc.isMaxedOut, ptState?.kirjaa_tyokokeilu_esto, onUpdatePalkkatuki]);

    useEffect(() => {
        if (!onAddSignal || !onRemoveSignal) return;

        if (tkCalc.isMaxedOut) {
            onAddSignal('sys_esto_tyokokeilu');
        } else {
            onRemoveSignal('sys_esto_tyokokeilu');
        }
    }, [tkCalc.isMaxedOut, onAddSignal, onRemoveSignal]);

    return { tkCalc, isUnder25 };
};