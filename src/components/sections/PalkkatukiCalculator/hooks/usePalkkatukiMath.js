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

    const { 
        ika, 
        alkuperainenAlkuPvm, 
        perusKestoPv, 
        perusKestoTxt, 
        hyvaksytytPaivat, 
        ehto24_28_tayttyy, 
        ehto3kk_tayttyy,
        activeStartTxt,
        resetReason,
        isAutoReset
    } = useMemo(() => {
        const thInfo = state?.suunnitelman_perustiedot?.tyonhaku_alkanut;
        let thPvm = state?.suunnitelman_perustiedot?.TH_ALKU_PVM;
        
        if (!thPvm && thInfo?.muuttujat) thPvm = extractDateFromVariables(thInfo.muuttujat);
        if (!thPvm) thPvm = thInfo?.muuttujat?.[STATE_MUUTTUJAT.TYONHAKU_ALKUPVM] || thInfo?.value || thInfo?.oletus;

        let laskettuIka = null;

        const syntymaVuosi = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                          || state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']; 

        if (syntymaVuosi) {
            const vuosiNum = parseInt(String(syntymaVuosi).replace(/\D/g, ''), 10);
            if (!isNaN(vuosiNum)) laskettuIka = new Date().getFullYear() - vuosiNum;
        }

        const startDate = parseSafeDate(thPvm); 
        const turvallinenAlkuPvm = startDate ? startDate.toLocaleDateString('fi-FI') : 'Ei tiedossa';
        
        // Nollataan nykyhetken kellonaika heti, jotta kesä- ja talviajan tunnit eivät sotke päivävertailua
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let latestResetDate = startDate;
        let reason = null;

        // 1. Tarkistetaan Omaehtoinen opiskelu
        const services = state?.sessionServices || [];
        services.forEach((srv) => {
            if (srv?.entity_key === 'opiskelu_omaehtoinen') {
                const sLoppu = parseSafeDate(srv?.data?.loppu);
                if (sLoppu && (!latestResetDate || sLoppu > latestResetDate)) {
                    sLoppu.setHours(0, 0, 0, 0);
                    latestResetDate = sLoppu;
                    reason = `Omaehtoinen opiskelu päättynyt ${sLoppu.toLocaleDateString('fi-FI')}`;
                }
            }
        });

        // 2. Tarkistetaan muut saavutetut tutkinnot (Koulutushistoriasta)
        const educations = state?.sessionEducations || [];
        educations.forEach((edu) => {
            const vuosiStr = edu?.data?.vuosi;
            if (vuosiStr) {
                const vuosiNum = parseInt(String(vuosiStr).replace(/\D/g, ''), 10);
                if (!isNaN(vuosiNum) && vuosiNum > 1950 && vuosiNum <= now.getFullYear() + 1) {
                    const valmPvm = new Date(vuosiNum, 4, 31); 
                    valmPvm.setHours(0, 0, 0, 0);
                    const actualValmPvm = valmPvm > now ? now : valmPvm;

                    if (!latestResetDate || actualValmPvm > latestResetDate) {
                        latestResetDate = actualValmPvm;
                        reason = `Valmistunut tutkintoon (${edu?.data?.tutkinto || 'Koulutus'}) toukokuussa ${vuosiNum}`;
                    }
                }
            }
        });

        const manualNollaus = parseSafeDate(ptState?.nollausPvm); 
        if (manualNollaus) manualNollaus.setHours(0, 0, 0, 0);

        const activeStart = manualNollaus || latestResetDate;
        const isAutoReset = !manualNollaus && latestResetDate && startDate && latestResetDate > startDate;
        
        let acceptedDays = 0;
        let activeKestoTxt = 'Ei tiedossa';
        let ehto24 = false;
        let ehto3 = false;

        if (activeStart) {
            // Huomioidaan sallitut katkopäivät siirtämällä laskennan alkupistettä kalenterissa
            const vahennykset = parseInt(ptState?.vahennysPv, 10) || 0;
            const effectiveStartDate = new Date(activeStart);
            effectiveStartDate.setDate(effectiveStartDate.getDate() + vahennykset);

            // Rajapyykkien luominen nykypäivästä taaksepäin
            const target3Months = new Date(now);
            target3Months.setMonth(target3Months.getMonth() - 3);

            const target24Months = new Date(now);
            target24Months.setFullYear(target24Months.getFullYear() - 2);

            // Täyttyvätkö ehdot? (Alkupäivä + vähennykset on kalenterissa yhtä vanha tai vanhempi kuin rajapyykki)
            ehto3 = effectiveStartDate <= target3Months;
            ehto24 = effectiveStartDate <= target24Months;

            // Käyttöliittymän selkoteksti "X v Y kk (Z pv)" ja kokonaispäivien laskenta
            const diffTimeActive = Math.max(0, now - activeStart);
            const daysFromActiveStart = Math.round(diffTimeActive / (1000 * 60 * 60 * 24));
            acceptedDays = Math.max(0, daysFromActiveStart - vahennykset);

            if (daysFromActiveStart > 0) {
                let years = now.getFullYear() - activeStart.getFullYear();
                let months = now.getMonth() - activeStart.getMonth();

                // Jos nykypäivä on kalenterissa ennen aloituspäivää (esim. 10. pvm vs 15. pvm), 
                // kuukausi ei ole vielä täysi, joten vähennetään 1.
                if (now.getDate() < activeStart.getDate()) {
                    months -= 1;
                }
                if (months < 0) {
                    years -= 1;
                    months += 12;
                }
                
                if (years > 0) {
                    activeKestoTxt = `${years} v ${months} kk (${acceptedDays} pv)`;
                } else {
                    activeKestoTxt = `${months} kk (${acceptedDays} pv)`;
                }
            } else {
                activeKestoTxt = '0 pv';
            }
        }

        return { 
            ika: laskettuIka, 
            alkuperainenAlkuPvm: turvallinenAlkuPvm, 
            perusKestoPv: acceptedDays,
            perusKestoTxt: activeKestoTxt,
            hyvaksytytPaivat: acceptedDays, 
            ehto24_28_tayttyy: ehto24, 
            ehto3kk_tayttyy: ehto3,
            activeStartTxt: activeStart ? activeStart.toLocaleDateString('fi-FI') : 'Ei tiedossa',
            resetReason: reason,
            isAutoReset: isAutoReset
        };
    }, [state?.suunnitelman_perustiedot, ptState?.nollausPvm, ptState?.vahennysPv, state?.sessionServices, state?.sessionEducations]);

    useEffect(() => {
        if (ptState?.ehto24_28_tayttyy !== ehto24_28_tayttyy) {
            if(typeof onUpdatePalkkatuki === 'function') {
                onUpdatePalkkatuki('ehto24_28_tayttyy', ehto24_28_tayttyy);
            }
        }
    }, [ehto24_28_tayttyy, ptState?.ehto24_28_tayttyy, onUpdatePalkkatuki]);

    useEffect(() => {
        if (!onAddSignal || !onRemoveSignal) return;

        if (ehto24_28_tayttyy) onAddSignal('sys_ehto_palkkatuki_24');
        else onRemoveSignal('sys_ehto_palkkatuki_24');

        const kuntaStr = state?.suunnitelman_perustiedot?.kotikunta?.muuttujat?.['[KUNTA]'] || '';
        const isHelsinki = kuntaStr.toLowerCase().includes('helsinki');

        if (ehto3kk_tayttyy && isHelsinki) onAddSignal('sys_ehto_helsinkilisa');
        else onRemoveSignal('sys_ehto_helsinkilisa');

    }, [ehto24_28_tayttyy, ehto3kk_tayttyy, state?.suunnitelman_perustiedot?.kotikunta, onAddSignal, onRemoveSignal]);

    return { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy, activeStartTxt, resetReason, isAutoReset };
};