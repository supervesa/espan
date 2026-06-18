// --- src/components/sections/PalkkatukiCalculator/hooks/usePalkkatukiMath.js ---
import { useMemo, useEffect } from 'react';
import { STATE_MUUTTUJAT } from '../../../../data/constants';

// Panssaroitu päivämäärän lukija
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

// Kaivaa päivämäärän objektin sisältä välittämättä avaimen nimestä
const extractDateFromVariables = (muuttujatObj) => {
    if (!muuttujatObj || typeof muuttujatObj !== 'object') return null;
    for (const key in muuttujatObj) {
        const val = muuttujatObj[key];
        if (typeof val === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(val.trim())) {
            return val.trim();
        }
    }
    return null;
};

export const usePalkkatukiMath = (state, ptState, actions) => {
    const { onUpdatePalkkatuki, onAddSignal, onRemoveSignal } = actions || {};

    const { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy } = useMemo(() => {
        const thInfo = state?.suunnitelman_perustiedot?.tyonhaku_alkanut;
        let thPvm = state?.suunnitelman_perustiedot?.TH_ALKU_PVM;
        
        if (!thPvm && thInfo?.muuttujat) thPvm = extractDateFromVariables(thInfo.muuttujat);
        if (!thPvm) thPvm = thInfo?.muuttujat?.[STATE_MUUTTUJAT.TYONHAKU_ALKUPVM] || thInfo?.value || thInfo?.oletus;

        let laskettuIka = null;
        let originalDiffDays = 0;
        let originalKestoTxt = 'Ei tiedossa';

        const syntymaVuosi = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                          || state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']; 

        if (syntymaVuosi) {
            const vuosiNum = parseInt(String(syntymaVuosi).replace(/\D/g, ''), 10);
            if (!isNaN(vuosiNum)) laskettuIka = new Date().getFullYear() - vuosiNum;
        }

        const startDate = parseSafeDate(thPvm); 
        const turvallinenAlkuPvm = startDate ? startDate.toLocaleDateString('fi-FI') : 'Ei tiedossa';

        if (startDate) {
            const now = new Date();
            const diffTime = Math.max(0, now - startDate);
            originalDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const vuodet = Math.floor(originalDiffDays / 365);
            const kuukaudet = Math.floor((originalDiffDays % 365) / 30);
            if (vuodet > 0) originalKestoTxt = `${vuodet} v ${kuukaudet} kk (${originalDiffDays} pv)`;
            else originalKestoTxt = `${kuukaudet} kk (${originalDiffDays} pv)`;
        }

        const nollausPvm = parseSafeDate(ptState?.nollausPvm); 
        const activeStart = nollausPvm || startDate;
        
        let acceptedDays = 0;
        if (activeStart) {
            const now = new Date();
            const diffTimeActive = Math.max(0, now - activeStart);
            const daysFromActiveStart = Math.ceil(diffTimeActive / (1000 * 60 * 60 * 24));
            const daysIn28MonthWindow = Math.min(daysFromActiveStart, 852);
            
            let automaattisetVahennykset = 0;
            const services = state?.sessionServices || [];
            
            const tarkasteluAlku = new Date();
            tarkasteluAlku.setMonth(now.getMonth() - 28);
            const todellinenLaskentaAlku = activeStart > tarkasteluAlku ? activeStart : tarkasteluAlku;

            services.forEach((srv) => {
                const tyyppi = srv?.entity_key;
                if (tyyppi === 'opiskelu_omaehtoinen') {
                    const sAlku = parseSafeDate(srv?.data?.alku);
                    const sLoppu = parseSafeDate(srv?.data?.loppu);

                    if (sAlku && sLoppu && sLoppu >= sAlku) {
                        const clipAlku = sAlku < todellinenLaskentaAlku ? todellinenLaskentaAlku : sAlku;
                        const clipLoppu = sLoppu > now ? now : sLoppu;
                        if (clipLoppu >= clipAlku) {
                            const pituus = Math.ceil(Math.abs(clipLoppu - clipAlku) / (1000 * 60 * 60 * 24)) + 1;
                            automaattisetVahennykset += pituus;
                        }
                    }
                }
            });

            const vahennykset = parseInt(ptState?.vahennysPv, 10) || 0;
            acceptedDays = Math.max(0, daysIn28MonthWindow - vahennykset - automaattisetVahennykset);
        }

        return { 
            ika: laskettuIka, 
            alkuperainenAlkuPvm: turvallinenAlkuPvm, 
            perusKestoPv: originalDiffDays, 
            perusKestoTxt: originalKestoTxt, 
            hyvaksytytPaivat: acceptedDays, 
            ehto24_28_tayttyy: acceptedDays >= 730, 
            ehto3kk_tayttyy: acceptedDays >= 91 
        };
    }, [state?.suunnitelman_perustiedot, ptState?.nollausPvm, ptState?.vahennysPv, state?.sessionServices]);

    useEffect(() => {
        if (ptState?.ehto24_28_tayttyy !== ehto24_28_tayttyy) {
            if(typeof onUpdatePalkkatuki === 'function') {
                onUpdatePalkkatuki('ehto24_28_tayttyy', ehto24_28_tayttyy);
            }
        }
    }, [ehto24_28_tayttyy, ptState?.ehto24_28_tayttyy, onUpdatePalkkatuki]);

    // --- UUSI: Älysignaalien lähettäminen globaaliin tilaan ---
    useEffect(() => {
        if (!onAddSignal || !onRemoveSignal) return;

        if (ehto24_28_tayttyy) onAddSignal('sys_ehto_palkkatuki_24');
        else onRemoveSignal('sys_ehto_palkkatuki_24');

        const kuntaStr = state?.suunnitelman_perustiedot?.kotikunta?.muuttujat?.['[KUNTA]'] || '';
        const isHelsinki = kuntaStr.toLowerCase().includes('helsinki');

        if (ehto3kk_tayttyy && isHelsinki) onAddSignal('sys_ehto_helsinkilisa');
        else onRemoveSignal('sys_ehto_helsinkilisa');

    }, [ehto24_28_tayttyy, ehto3kk_tayttyy, state?.suunnitelman_perustiedot?.kotikunta, onAddSignal, onRemoveSignal]);

    return { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy };
};