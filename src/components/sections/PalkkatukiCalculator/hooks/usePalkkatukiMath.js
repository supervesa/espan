// --- src/components/sections/PalkkatukiCalculator/hooks/usePalkkatukiMath.js ---
import { useMemo, useEffect } from 'react';
import { STATE_MUUTTUJAT } from '../../../../data/constants';
import { parseAnyDate } from '../utils';

export const usePalkkatukiMath = (state, ptState, onUpdatePalkkatuki) => {
    const { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy } = useMemo(() => {
        let laskettuIka = null;
        let originalDiffDays = 0;
        let originalKestoTxt = 'Ei tiedossa';

        const syntymaVuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                          || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']; 

        if (syntymaVuosi) {
            const vuosiNum = parseInt(String(syntymaVuosi).replace(/\D/g, ''), 10);
            if (!isNaN(vuosiNum)) {
                laskettuIka = new Date().getFullYear() - vuosiNum;
            }
        }

        const alkupvmStr = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.[STATE_MUUTTUJAT.TYONHAKU_ALKUPVM];
        const startDate = parseAnyDate(alkupvmStr);
        const now = new Date();
        
        if (startDate) {
            const diffTime = Math.max(0, now - startDate);
            originalDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const vuodet = Math.floor(originalDiffDays / 365);
            const kuukaudet = Math.floor((originalDiffDays % 365) / 30);
            if (vuodet > 0) originalKestoTxt = `${vuodet} v ${kuukaudet} kk (${originalDiffDays} pv)`;
            else originalKestoTxt = `${kuukaudet} kk (${originalDiffDays} pv)`;
        }

        const nollausPvm = parseAnyDate(ptState.nollausPvm);
        const activeStart = nollausPvm || startDate;
        
        let acceptedDays = 0;
        if (activeStart) {
            const diffTimeActive = Math.max(0, now - activeStart);
            const daysFromActiveStart = Math.ceil(diffTimeActive / (1000 * 60 * 60 * 24));
            const daysIn28MonthWindow = Math.min(daysFromActiveStart, 852);
            const vahennykset = parseInt(ptState.vahennysPv, 10) || 0;
            acceptedDays = Math.max(0, daysIn28MonthWindow - vahennykset);
        }

        return { ika: laskettuIka, alkuperainenAlkuPvm: alkupvmStr, perusKestoPv: originalDiffDays, perusKestoTxt: originalKestoTxt, hyvaksytytPaivat: acceptedDays, ehto24_28_tayttyy: acceptedDays >= 730, ehto3kk_tayttyy: acceptedDays >= 91 };
    }, [state.suunnitelman_perustiedot, ptState.nollausPvm, ptState.vahennysPv]);

    useEffect(() => {
        if (ptState.ehto24_28_tayttyy !== ehto24_28_tayttyy) {
            onUpdatePalkkatuki('ehto24_28_tayttyy', ehto24_28_tayttyy);
        }
    }, [ehto24_28_tayttyy, ptState.ehto24_28_tayttyy, onUpdatePalkkatuki]);

    return { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy };
};