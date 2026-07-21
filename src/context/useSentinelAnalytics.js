import { supabase } from '../utils/supabaseClient';
import { STATE_MUUTTUJAT } from '../data/constants';
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

    // ==========================================
    // KEHITTÄJÄN KYTKIN
    // Vaihda 'false' kun sovellus menee tuotantoon.
    // ==========================================
    const IS_TEST_MODE = false; 

    const logPlanCopied = async (state, asiantuntijaId) => {
        if (!asiantuntijaId) {
            console.warn("Sentinel Analytics: Ei asiantuntija-ID:tä, ohitetaan tilastointi.");
            return;
        }

        // --- 1. SORMENJÄLKI JA ANTI-SPAM ---
        let sigBirth = "xx";
        const syntymaVuosiRaa = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                             || state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']
                             || state?.asiakas?.syntymavuosi;
                             
        if (syntymaVuosiRaa) {
            const vuosiStr = String(syntymaVuosiRaa).replace(/\D/g, ''); 
            if (vuosiStr.length >= 2) sigBirth = vuosiStr.slice(-2); 
        }

        let sigStartDay = "xx";
        const thInfo = state?.suunnitelman_perustiedot?.tyonhaku_alkanut;
        const rawStartStr = state?.suunnitelman_perustiedot?.TH_ALKU_PVM 
                         || thInfo?.oletus 
                         || thInfo?.value 
                         || JSON.stringify(thInfo?.muuttujat || {});
                         
        const dateMatch = String(rawStartStr).match(/\b(\d{1,2})\.\d{1,2}\.\d{4}\b/);
        if (dateMatch && dateMatch[1]) sigStartDay = dateMatch[1].padStart(2, '0'); 

        // Annetaan sormenjäljelle vain staattinen testiliite.
        // Nyt tuplaklikkauksen esto poimii mikrosekuntitason re-renderit kiinni myös testitilassa!
        const planSignature = IS_TEST_MODE 
            ? `TEST-${sigBirth}${sigStartDay}`
            : `${sigBirth}${sigStartDay}`;
            
        const lastSignature = sessionStorage.getItem('espan_last_logged_signature');

        if (lastSignature === planSignature) {
            console.log(`ℹ️ Sentinel: Sormenjälki [${planSignature}] jo tilastoitu sessiossa. Estetty tuplakutsu.`);
            return; 
        }

        try {
            // Lukitaan heti sormenjälki tähän hetkeen (estää samanaikaiset kilpapyynnöt)
            sessionStorage.setItem('espan_last_logged_signature', planSignature);

            // --- 2. PERUSTIEDOT ---
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

            const postinro = state?.asiakas?.postinumero;
            const { alue } = getAlueJaToimipiste(postinro);

            const now = new Date();
            const currentWeek = getWeekData(now);
            const future = new Date();
            future.setDate(future.getDate() + (13 * 7));
            const futureWeek = getWeekData(future);

            // --- 3. PALVELUOHJAUSTEN ANALYTIIKKA ---
            let extraPayload = {
                yhteensa: 0,
                lahetteet: 0,
                velvoittavat: 0,
                kategoriat: {},
                historiaTilat: {}
            };

            const selectedServiceIds = state?.asiakas?.valitut_palvelut_id || [];
            
            // KORJAUS 1: Suodatetaan pois Käsiohjauksen lyhyet tekstiavaimet (jätetään vain UUID-muotoiset)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const validUuids = selectedServiceIds.filter(id => uuidRegex.test(id));

           if (validUuids.length > 0) {
        const { data: services, error: serviceError } = await supabase
            .from('services')
            .select('category, requires_referral, hard_service')
            .in('id', validUuids);
                
                if (serviceError) console.error("Sentinel: Virhe palveluhaussa", serviceError);

                if (services && services.length > 0) {
                    extraPayload.yhteensa = services.length;
                    services.forEach(s => {
                        if (s.requires_referral) extraPayload.lahetteet++;
                        if (s.hard_service) extraPayload.velvoittavat++;
                        const cat = s.category || 'Muu';
                        extraPayload.kategoriat[cat] = (extraPayload.kategoriat[cat] || 0) + 1;
                    });
                }
            }

            const asiakkaanAiemmatPalvelut = state?.services || state?.sessionServices || [];
            const MERKITTAVAT_TILAT = ['alkanut', 'suoritettu', 'keskeytynyt', 'peruuntunut', 'ei soveltuva'];

            asiakkaanAiemmatPalvelut.forEach(srv => {
                if (srv.tila) {
                    const puhdistettuTila = srv.tila.trim().toLowerCase();
                    if (MERKITTAVAT_TILAT.includes(puhdistettuTila)) {
                        extraPayload.historiaTilat[puhdistettuTila] = (extraPayload.historiaTilat[puhdistettuTila] || 0) + 1;
                    }
                }
            });

            // --- 4. TALLENNUS TIETOKANTAAN ---
            const upsertCounter = async (year, week, isEraantyva, stats) => {
                const { data: existing, error: findError } = await supabase
                    .schema('espan')
                    .from('weekly_counters')
                    .select('*')
                    .eq('vuosi', year)
                    .eq('viikko', week)
                    .eq('asiantuntija_id', asiantuntijaId)
                    .eq('ikaryhma', ikaryhma)
                    .eq('alue', alue)
                    .eq('testi', IS_TEST_MODE) 
                    .maybeSingle();

                if (findError) {
                    console.error(`Sentinel: Virhe viikon ${week} haussa:`, findError);
                    return;
                }

                if (existing) {
                    let updates = {};
                    
                    if (isEraantyva) {
                        updates = { eraantyvat_suunnitelmat: (existing.eraantyvat_suunnitelmat || 0) + 1 };
                    } else {
                        updates = { tehdyt_suunnitelmat: (existing.tehdyt_suunnitelmat || 0) + 1 };
                        
                        if (stats) {
                            updates.ohjaukset_yhteensa = (existing.ohjaukset_yhteensa || 0) + stats.yhteensa;
                            updates.ohjaukset_lahete = (existing.ohjaukset_lahete || 0) + stats.lahetteet;
                            updates.ohjaukset_velvoittava = (existing.ohjaukset_velvoittava || 0) + stats.velvoittavat;
                            
                            const mergedCats = { ...(existing.kategoriat_tilasto || {}) };
                            Object.entries(stats.kategoriat).forEach(([cat, count]) => {
                                mergedCats[cat] = (mergedCats[cat] || 0) + count;
                            });
                            updates.kategoriat_tilasto = mergedCats;

                            const mergedTilat = { ...(existing.palvelu_tilat_tilasto || {}) };
                            Object.entries(stats.historiaTilat).forEach(([tila, count]) => {
                                mergedTilat[tila] = (mergedTilat[tila] || 0) + count;
                            });
                            updates.palvelu_tilat_tilasto = mergedTilat;
                        }
                    }
                    
                    const { error: updateError } = await supabase.schema('espan').from('weekly_counters').update(updates).eq('id', existing.id);
                    if (updateError) console.error("Sentinel Update Virhe:", updateError);
                
                } else {
                    let newRow = {
                        vuosi: year,
                        viikko: week,
                        asiantuntija_id: asiantuntijaId,
                        ikaryhma: ikaryhma,
                        alue: alue,
                        testi: IS_TEST_MODE, 
                        tehdyt_suunnitelmat: isEraantyva ? 0 : 1,
                        eraantyvat_suunnitelmat: isEraantyva ? 1 : 0
                    };
                    
                    if (!isEraantyva && stats) {
                        newRow.ohjaukset_yhteensa = stats.yhteensa;
                        newRow.ohjaukset_lahete = stats.lahetteet;
                        newRow.ohjaukset_velvoittava = stats.velvoittavat;
                        newRow.kategoriat_tilasto = stats.kategoriat;
                        newRow.palvelu_tilat_tilasto = stats.historiaTilat;
                    }
                    
                    const { error: insertError } = await supabase.schema('espan').from('weekly_counters').insert([newRow]);
                    if (insertError) console.error("Sentinel Insert Virhe:", insertError);
                }
            };

            await Promise.all([
                upsertCounter(currentWeek.year, currentWeek.week, false, extraPayload),
                upsertCounter(futureWeek.year, futureWeek.week, true, null)
            ]);

            const paivanTavoite = parseInt(localStorage.getItem('espan_paivan_tyot') || '0', 10) + 1;
            localStorage.setItem('espan_paivan_tyot', paivanTavoite);

            if (IS_TEST_MODE) {
                console.log(`🧪 Sentinel [TESTITILA]: Tilastot tallennettu testimerkillä. (Alue: ${alue})`);
            } else {
                console.log(`✅ Sentinel [TUOTANTO]: Tilastot tallennettu! (Alue: ${alue})`);
            }

        } catch (err) {
            console.error("❌ Sentinel Analytics Kriittinen Virhe:", err);
            // Vapautetaan sormenjälki, jos tilastointi epäonnistui fataalisti, jotta uudelleenyritys toimii
            sessionStorage.removeItem('espan_last_logged_signature');
        }
    };

    return { logPlanCopied };
};