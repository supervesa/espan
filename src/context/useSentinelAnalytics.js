import { supabase } from '../utils/supabaseClient';
import { STATE_MUUTTUJAT } from '../data/constants';

// KORJATTU IMPORT: Haetaan hooks-kansiosta!
import { getAlueJaToimipiste } from '../hooks/usePostinumero';

const getWeekData = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week };
};

export const useSentinelAnalytics = () => {
    const logPlanCopied = async (state, asiantuntijaId) => {
        if (!asiantuntijaId) {
            console.warn("Sentinel Analytics: Ei asiantuntija-ID:tä, ohitetaan tilastointi.");
            return;
        }

        // --- 1. ULTRA-ANONYYMI SORMENJÄLKI (Syntymävuoden loppu + Työhaun aloituspäivä) ---
        let sigBirth = "xx";
        const syntymaVuosiRaa = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                             || state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']
                             || state?.asiakas?.syntymavuosi;
                             
        if (syntymaVuosiRaa) {
            const vuosiStr = String(syntymaVuosiRaa).replace(/\D/g, ''); 
            if (vuosiStr.length >= 2) {
                sigBirth = vuosiStr.slice(-2); 
            }
        }

        let sigStartDay = "xx";
        const thInfo = state?.suunnitelman_perustiedot?.tyonhaku_alkanut;
        const rawStartStr = state?.suunnitelman_perustiedot?.TH_ALKU_PVM 
                         || thInfo?.oletus 
                         || thInfo?.value 
                         || JSON.stringify(thInfo?.muuttujat || {});
                         
        const dateMatch = String(rawStartStr).match(/\b(\d{1,2})\.\d{1,2}\.\d{4}\b/);
        if (dateMatch && dateMatch[1]) {
            sigStartDay = dateMatch[1].padStart(2, '0'); 
        }

        const planSignature = `${sigBirth}${sigStartDay}`;
        const lastSignature = sessionStorage.getItem('espan_last_logged_signature');

        if (lastSignature === planSignature) {
            console.log(`ℹ️ Sentinel: Sormenjälki [${planSignature}] jo tilastoitu. Ohitetaan tuplatallennus.`);
            return; 
        }

        try {
            // --- 2. Laske ikäryhmä ---
            let ikaryhma = 'Tuntematon';
            if (syntymaVuosiRaa) {
                const vuosiNum = parseInt(String(syntymaVuosiRaa).replace(/\D/g, ''), 10);
                if (!isNaN(vuosiNum)) {
                    const ika = new Date().getFullYear() - vuosiNum;
                    if (ika < 18) ikaryhma = '< 18';
                    else if (ika <= 24) ikaryhma = '18-24';
                    else if (ika <= 29) ikaryhma = '25-29';
                    else if (ika <= 49) ikaryhma = '30-49';
                    else ikaryhma = '50+';
                }
            }

            // --- 3. Päättele alue postinumeron perusteella ---
            const postinro = state?.asiakas?.postinumero;
            const { alue } = getAlueJaToimipiste(postinro);

            // --- 4. Laske aikalaatikot ---
            const now = new Date();
            const currentWeek = getWeekData(now);

            const future = new Date();
            future.setDate(future.getDate() + (13 * 7));
            const futureWeek = getWeekData(future);

            // --- 5. Lähetä tietokantaan ---
            const upsertCounter = async (year, week, isEraantyva) => {
                const { data: existing } = await supabase
                    .schema('espan')
                    .from('weekly_counters')
                    .select('*')
                    .eq('vuosi', year)
                    .eq('viikko', week)
                    .eq('asiantuntija_id', asiantuntijaId)
                    .eq('ikaryhma', ikaryhma)
                    .eq('alue', alue) // UUSI: Lokeroidaan myös alueen mukaan!
                    .maybeSingle();

                if (existing) {
                    const updates = isEraantyva
                        ? { eraantyvat_suunnitelmat: (existing.eraantyvat_suunnitelmat || 0) + 1 }
                        : { tehdyt_suunnitelmat: (existing.tehdyt_suunnitelmat || 0) + 1 };
                    await supabase.schema('espan').from('weekly_counters').update(updates).eq('id', existing.id);
                } else {
                    const newRow = {
                        vuosi: year,
                        viikko: week,
                        asiantuntija_id: asiantuntijaId,
                        ikaryhma: ikaryhma,
                        alue: alue, // UUSI: Uuden sarakkeen tallennus
                        tehdyt_suunnitelmat: isEraantyva ? 0 : 1,
                        eraantyvat_suunnitelmat: isEraantyva ? 1 : 0
                    };
                    await supabase.schema('espan').from('weekly_counters').insert([newRow]);
                }
            };

            await Promise.all([
                upsertCounter(currentWeek.year, currentWeek.week, false),
                upsertCounter(futureWeek.year, futureWeek.week, true)
            ]);

            sessionStorage.setItem('espan_last_logged_signature', planSignature);

            const paivanTavoite = parseInt(localStorage.getItem('espan_paivan_tyot') || '0', 10) + 1;
            localStorage.setItem('espan_paivan_tyot', paivanTavoite);

            console.log(`✅ Sentinel: Tilastot päivitetty (Alue: ${alue}, Sormenjälki: ${planSignature})`);

        } catch (err) {
            console.error("❌ Sentinel Analytics Virhe:", err);
        }
    };

    return { logPlanCopied };
};