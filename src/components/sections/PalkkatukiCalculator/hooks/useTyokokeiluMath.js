// --- src/components/sections/PalkkatukiCalculator/hooks/useTyokokeiluMath.js ---
import { useMemo, useEffect } from 'react';

// Panssaroitu päivämäärän lukija (estää Invalid Date -kaatumiset)
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

export const useTyokokeiluMath = (state, ika, ptState, onUpdatePalkkatuki) => {
    
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
        console.group('🔍 TYÖKOKEILUN LASKURI (DEBUG)');
        console.log('1. Saatu state.sessionServices koko taulukko:', state?.sessionServices);

        let totalDays = 0;
        let latestEndDate = null;
        const periods = [];

        const now = new Date();
        const twoYearsAgo = new Date();
        twoYearsAgo.setMonth(now.getMonth() - 24); 
        console.log(`2. Aikaraja (24kk taaksepäin): ${twoYearsAgo.toLocaleDateString('fi-FI')}`);

        // 1. HARAVOINTI: Järjestelmän muisti (KORJATTU POLKU)
        const services = state?.sessionServices || [];
        services.forEach((srv, index) => {
            const tyyppi = srv?.entity_key; // Korjattu avain
            console.log(`-> Tutkitaan taulukon riviä ${index} (Tyyppi: ${tyyppi}):`, srv);

            if (tyyppi === 'tyokokeilu') {
                // Korjattu reitti päivämääriin (data.alku)
                const start = parseSafeDate(srv?.data?.alku);
                const end = parseSafeDate(srv?.data?.loppu);
                
                console.log(`   🗓️ Parsitut päivät: Alku = ${start ? start.toLocaleDateString('fi-FI') : 'NULL'}, Loppu = ${end ? end.toLocaleDateString('fi-FI') : 'NULL'}`);

                if (start && end && end >= start) {
                    if (end >= twoYearsAgo) {
                        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
                        totalDays += diffDays;
                        
                        if (!latestEndDate || end > latestEndDate) {
                            latestEndDate = end;
                        }
                        periods.push({ startStr: srv.data.alku, endStr: srv.data.loppu, days: diffDays, source: 'järjestelmä' });
                        console.log(`   ✅ HYVÄKSYTTY! Lisättiin ${diffDays} päivää.`);
                    } else {
                        console.log(`   ❌ HYLÄTTY: Jakso päättynyt liian kauan sitten.`);
                    }
                } else {
                    console.log(`   ⚠️ VIRHE: Päivämäärät puuttuvat tai loppu on ennen alkua.`);
                }
            }
        });

        // 2. HYBRIDIMALLI: Manuaalinen historia (Tekstilaatikko)
        if (tkText) console.log('3. Manuaalista tekstiä löydetty:', tkText);
        const regex = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
        let match;
        while ((match = regex.exec(tkText)) !== null) {
            const start = parseSafeDate(match[1]);
            const end = parseSafeDate(match[2]);
            
            if (start && end && end >= start) {
                if (end >= twoYearsAgo) {
                    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1; 
                    totalDays += diffDays;
                    
                    if (!latestEndDate || end > latestEndDate) {
                        latestEndDate = end;
                    }
                    periods.push({ startStr: match[1], endStr: match[2], days: diffDays, source: 'manuaalinen' });
                    console.log(`   📝 HYVÄKSYTTY (Manuaalinen): Lisättiin ${diffDays} päivää.`);
                }
            }
        }

        // 3. SUUNNITELTU JAKSO (Juuri nyt tekeillä oleva radion kautta)
        const usePlanned = ptState.huomioi_suunniteltu_tk !== false;
        if (usePlanned && ptState.suunniteltu_tk_alku && ptState.suunniteltu_tk_loppu) {
            console.log('4. Suunniteltu jakso löydetty radion kautta.');
            const pStart = parseSafeDate(ptState.suunniteltu_tk_alku);
            const pEnd = parseSafeDate(ptState.suunniteltu_tk_loppu);

            if (pStart && pEnd && pEnd >= pStart) {
                const diffDays = Math.ceil(Math.abs(pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
                totalDays += diffDays;
                
                if (!latestEndDate || pEnd > latestEndDate) {
                    latestEndDate = pEnd;
                }
                console.log(`   🔮 HYVÄKSYTTY (Suunniteltu): Lisättiin ${diffDays} päivää.`);
            }
        }

        // 4. KOSKEMATON LOGIIKKA: Nollautuminen ja maksimiaika
        let gapDays = 0;
        let isReset = false;

        if (latestEndDate) {
            const gapTime = Math.max(0, now - latestEndDate);
            gapDays = Math.ceil(gapTime / (1000 * 60 * 60 * 24));
            const requiredGap = isUnder25 ? 90 : 365;
            
            console.log(`5. Nollaustarkistus: Päiviä viimeisen jakson lopusta = ${gapDays}. Vaatimus = ${requiredGap}`);

            if (gapDays >= requiredGap) {
                isReset = true;
                totalDays = 0; 
                console.log('   🔄 TULOS: LASKURI NOLLATTU!');
            }
        }

        const maxDays = 180;
        const remainingDays = Math.max(0, maxDays - totalDays);
        const remainingMonths = Math.floor(remainingDays / 30); 

        console.log(`6. LOPPUTULOS: Yhteensä päiviä = ${totalDays}, Jäljellä = ${remainingMonths} kk`);
        console.groupEnd();

        return {
            periods,
            isReset,
            remainingMonths,
            isMaxedOut: remainingMonths <= 0 && !isReset
        };
    }, [tkText, isUnder25, ptState.suunniteltu_tk_alku, ptState.suunniteltu_tk_loppu, ptState.huomioi_suunniteltu_tk, state?.sessionServices]);

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