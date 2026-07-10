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
        let originalDiffDays = 0;

        const syntymaVuosi = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                          || state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']; 

        if (syntymaVuosi) {
            const vuosiNum = parseInt(String(syntymaVuosi).replace(/\D/g, ''), 10);
            if (!isNaN(vuosiNum)) laskettuIka = new Date().getFullYear() - vuosiNum;
        }

        const startDate = parseSafeDate(thPvm); 
        const turvallinenAlkuPvm = startDate ? startDate.toLocaleDateString('fi-FI') : 'Ei tiedossa';
        const now = new Date();

        if (startDate) {
            const diffTime = Math.max(0, now - startDate);
            originalDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // --- KORJATTU LASKENTALOIKKA: Etsitään palvelut ja opinnot, jotka nollaavat laskurin ---
        let latestResetDate = startDate;
        let reason = null;

        // 1. Tarkistetaan Omaehtoinen opiskelu
        const services = state?.sessionServices || [];
        services.forEach((srv) => {
            if (srv?.entity_key === 'opiskelu_omaehtoinen') {
                const sLoppu = parseSafeDate(srv?.data?.loppu);
                if (sLoppu && (!latestResetDate || sLoppu > latestResetDate)) {
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
                // Varmistetaan että vuosi on järkevä (esim. 1950 - nykyhetki)
                if (!isNaN(vuosiNum) && vuosiNum > 1950 && vuosiNum <= now.getFullYear() + 1) {
                    // Oletetaan valmistumispäiväksi kevätlukukauden loppu (31.5.YYYY)
                    const valmPvm = new Date(vuosiNum, 4, 31); // 4 = toukokuu
                    // Jos päivämäärä on tulevaisuudessa, leikataan se tähän hetkeen
                    const actualValmPvm = valmPvm > now ? now : valmPvm;

                    if (!latestResetDate || actualValmPvm > latestResetDate) {
                        latestResetDate = actualValmPvm;
                        reason = `Valmistunut tutkintoon (${edu?.data?.tutkinto || 'Koulutus'}) toukokuussa ${vuosiNum}`;
                    }
                }
            }
        });

        // Käyttäjän käsin syöttämä nollauspvm (UI:ssa) ohittaa automaation
        const manualNollaus = parseSafeDate(ptState?.nollausPvm); 
        const activeStart = manualNollaus || latestResetDate;
        
        let acceptedDays = 0;
        let activeKestoTxt = 'Ei tiedossa';
        const isAutoReset = !manualNollaus && latestResetDate && startDate && latestResetDate > startDate;

        if (activeStart) {
            // Lasketaan uudet kertyneet päivät ja käännetään ne kauniiksi tekstiksi UI:ta varten
            const diffTimeActive = Math.max(0, now - activeStart);
            const daysFromActiveStart = Math.ceil(diffTimeActive / (1000 * 60 * 60 * 24));
            
            const vuodet = Math.floor(daysFromActiveStart / 365);
            const kuukaudet = Math.floor((daysFromActiveStart % 365) / 30);
            
            if (daysFromActiveStart > 0) {
                if (vuodet > 0) activeKestoTxt = `${vuodet} v ${kuukaudet} kk (${daysFromActiveStart} pv)`;
                else activeKestoTxt = `${kuukaudet} kk (${daysFromActiveStart} pv)`;
            } else {
                activeKestoTxt = '0 pv';
            }
            
            const vahennykset = parseInt(ptState?.vahennysPv, 10) || 0;
            acceptedDays = Math.max(0, daysFromActiveStart - vahennykset);
        }

        return { 
            ika: laskettuIka, 
            alkuperainenAlkuPvm: turvallinenAlkuPvm, 
            perusKestoPv: acceptedDays, // Välitetään hyväksytyt päivät
            perusKestoTxt: activeKestoTxt, // Näyttää nyt nollatun keston
            hyvaksytytPaivat: acceptedDays, 
            ehto24_28_tayttyy: acceptedDays >= 730, 
            ehto3kk_tayttyy: acceptedDays >= 91,
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

    // --- Älysignaalien lähettäminen globaaliin tilaan ---
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