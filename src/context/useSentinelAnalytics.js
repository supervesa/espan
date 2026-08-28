import { supabase } from '../utils/supabaseClient';
import { STATE_MUUTTUJAT } from '../data/constants';
import { getAlueJaToimipiste } from '../hooks/usePostinumero';
// 1. TUODAAN HOOK TAKAISIN
import { useTyotilanneAnalytiikka } from '../hooks/analyticsSentinel/useTyotilanneAnalytiikka';

const getWeekData = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week };
};

export const useSentinelAnalytics = (lomakeState = {}) => {

    // 2. 🎯 TÄSSÄ ON RATKAISU: Osoitetaan suoraan oikeisiin kansioihin!
    // Tyotilanne.jsx tallentaa ruksit kansioon 'tyotilanne', ei minnekään muualle.
    const tyotilanneRuksit = lomakeState?.tyotilanne || {};
    const tyotilannePalvelut = lomakeState?.sessionServices || lomakeState?.services || [];

    // Annetaan hookin tehdä laskenta lennosta puhtaalla datalla
    const profiiliData = useTyotilanneAnalytiikka(tyotilanneRuksit, tyotilannePalvelut);

    const logPlanCopied = async (state, asiantuntijaId, isTestMode = false) => {
        
        if (!asiantuntijaId) {
            console.error("❌ Sentinel Analytics: Asiantuntija-ID puuttuu propseista! Tilastointi peruttu.");
            return;
        }

        // --- SORMENJÄLKI JA ANTI-SPAM ---
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

        const planSignature = `${sigBirth}${sigStartDay}`;
        const lastSignature = sessionStorage.getItem('espan_last_logged_signature');

        if (lastSignature === planSignature && !isTestMode) {
            console.log(`ℹ️ Sentinel: Sormenjälki [${planSignature}] jo tilastoitu sessiossa. Estetty tuplakutsu.`);
            return; 
        }

        try {
            if (!isTestMode) {
                sessionStorage.setItem('espan_last_logged_signature', planSignature);
            }

            // --- PERUSTIEDOT ---
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

            // --- PALVELUOHJAUSTEN ANALYTIIKKA ---
            let extraPayload = {
                yhteensa: 0,
                lahetteet: 0,
                velvoittavat: 0,
                kategoriat: {},
                historiaTilat: {}
            };

            let rawServiceIds = [];
            if (Array.isArray(state?.asiakas?.valitut_palvelut_id)) {
                rawServiceIds = [...state?.asiakas?.valitut_palvelut_id];
            }
            const suunnitelmaValinnat = state?.suunnitelma;
            if (Array.isArray(suunnitelmaValinnat)) {
                rawServiceIds = [...rawServiceIds, ...suunnitelmaValinnat];
            } else if (typeof suunnitelmaValinnat === 'object' && suunnitelmaValinnat !== null) {
                rawServiceIds = [...rawServiceIds, ...Object.keys(suunnitelmaValinnat)];
            }

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const validUuids = [...new Set(rawServiceIds.filter(id => typeof id === 'string' && uuidRegex.test(id)))];

            if (validUuids.length > 0) {
                const { data: services, error: serviceError } = await supabase
                    .schema('public') 
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

            // --- TALLENNUS TIETOKANTAAN (UPSERT) ---
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
                    .eq('testi', isTestMode) 
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
                            Object.entries(stats.kategoriat).forEach(([cat, count]) => mergedCats[cat] = (mergedCats[cat] || 0) + count);
                            updates.kategoriat_tilasto = mergedCats;

                            const mergedTilat = { ...(existing.palvelu_tilat_tilasto || {}) };
                            Object.entries(stats.historiaTilat).forEach(([tila, count]) => mergedTilat[tila] = (mergedTilat[tila] || 0) + count);
                            updates.palvelu_tilat_tilasto = mergedTilat;

                            // 🎯 PROFIILIDATAN YHDISTÄMINEN 
                            const mergedProfiili = { ...(existing.asiakas_profiilit_tilasto || {}) };
                            
                            if (!mergedProfiili.paastatus) mergedProfiili.paastatus = {};
                            const validStatus = profiiliData?.paastatus || 'tuntematon';
                            mergedProfiili.paastatus[validStatus] = (mergedProfiili.paastatus[validStatus] || 0) + 1;

                            if (!mergedProfiili.historia_vuodet) mergedProfiili.historia_vuodet = {};
                            Object.entries(profiiliData?.historia_vuodet || {}).forEach(([palvelu, vuodet]) => {
                                if (!mergedProfiili.historia_vuodet[palvelu]) mergedProfiili.historia_vuodet[palvelu] = {};
                                Object.entries(vuodet).forEach(([vuosi, count]) => {
                                    mergedProfiili.historia_vuodet[palvelu][vuosi] = (mergedProfiili.historia_vuodet[palvelu][vuosi] || 0) + count;
                                });
                            });

                            mergedProfiili.aktiiviset_kpl = (mergedProfiili.aktiiviset_kpl || 0) + (profiiliData?.aktiiviset_kpl || 0);
                            mergedProfiili.tulevat_kpl = (mergedProfiili.tulevat_kpl || 0) + (profiiliData?.tulevat_kpl || 0);

                            updates.asiakas_profiilit_tilasto = mergedProfiili;
                        }
                    }
                    
                    await supabase.schema('espan').from('weekly_counters').update(updates).eq('id', existing.id);
                
                } else {
                    let newRow = {
                        vuosi: year,
                        viikko: week,
                        asiantuntija_id: asiantuntijaId,
                        ikaryhma: ikaryhma,
                        alue: alue,
                        testi: isTestMode, 
                        tehdyt_suunnitelmat: isEraantyva ? 0 : 1,
                        eraantyvat_suunnitelmat: isEraantyva ? 1 : 0
                    };
                    
                    if (!isEraantyva && stats) {
                        newRow.ohjaukset_yhteensa = stats.yhteensa;
                        newRow.ohjaukset_lahete = stats.lahetteet;
                        newRow.ohjaukset_velvoittava = stats.velvoittavat;
                        newRow.kategoriat_tilasto = stats.kategoriat;
                        newRow.palvelu_tilat_tilasto = stats.historiaTilat;
                        
                        // 🎯 PROFIILIDATAN ENSIMMÄINEN LISÄYS
                        newRow.asiakas_profiilit_tilasto = {
                            paastatus: { [profiiliData?.paastatus || 'tuntematon']: 1 },
                            historia_vuodet: profiiliData?.historia_vuodet || {},
                            aktiiviset_kpl: profiiliData?.aktiiviset_kpl || 0,
                            tulevat_kpl: profiiliData?.tulevat_kpl || 0
                        };
                    }
                    
                    await supabase.schema('espan').from('weekly_counters').insert([newRow]);
                }
            };

            // --- UUSI: Universaalin keston tallennus (Suojeltu testitilalta) ---
            const insertKestoAnalytiikka = async () => {
                // Tallennetaan vain jos aika, tyyppi ja tapa ovat olemassa, EIKÄ olla testitilassa
                if (state.kesto && state.kestoTyyppi && state.kestoTapa && !isTestMode) {
                    
                    // Normalisoidaan avain samalla tavalla kuin asiakkaan yksilöllisessä holvissa
                    const normalizeKey = (str) => (str || '').toLowerCase()
                        .replace(/ä/g, 'a')
                        .replace(/ö/g, 'o')
                        .replace(/[^a-z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '');
                    
                    const kategoria = `${normalizeKey(state.kestoTyyppi)}_${normalizeKey(state.kestoTapa)}`;
                    
                    // Luodaan asettelu 'YYYY-MM' anonyymille pohjalle
                    const pvm = new Date();
                    const kuukausiVuosi = `${pvm.getFullYear()}-${String(pvm.getMonth() + 1).padStart(2, '0')}`;

                    const { error } = await supabase
                        .schema('espan')
                        .from('universaali_kesto_analytiikka')
                        .insert([{
                            asiantuntija_id: asiantuntijaId,
                            kuukausi_vuosi: kuukausiVuosi,
                            kategoria: kategoria,
                            kesto_min: parseInt(state.kesto, 10),
                            pyoristys_erotus_min: parseInt(state.kestoErotus || 0, 10)
                        }]);

                    if (error) {
                        console.error("❌ Sentinel: Virhe universaalin kestoanalytiikan tallennuksessa", error);
                    } else {
                        console.log(`📊 Sentinel: Kestoanalytiikka tallennettu Universal-holviin (${kategoria}: ${state.kesto} min, Erotus: ${state.kestoErotus} min)`);
                    }
                } else if (state.kesto && isTestMode) {
                    console.log(`🧪 Sentinel [TESTITILA]: Keston tallennus ohitettu Universaalista tietokannasta, jotta data ei vääristy.`);
                }
            };

            // Ajetaan KAIKKI analytiikat saumattomasti samaan aikaan rinnakkain!
            await Promise.all([
                upsertCounter(currentWeek.year, currentWeek.week, false, extraPayload),
                upsertCounter(futureWeek.year, futureWeek.week, true, null),
                insertKestoAnalytiikka() // 🟢 UUSI UNIVERSAALITAULUN PÄIVITYS TÄSSÄ!
            ]);

            const paivanTavoite = parseInt(localStorage.getItem('espan_paivan_tyot') || '0', 10) + 1;
            localStorage.setItem('espan_paivan_tyot', paivanTavoite);

            console.log(isTestMode ? `🧪 Sentinel [TESTITILA]: Tilastot tallennettu.` : `✅ Sentinel [TUOTANTO]: Tilastot tallennettu!`);

        } catch (err) {
            console.error("❌ Sentinel Analytics Kriittinen Virhe:", err);
            sessionStorage.removeItem('espan_last_logged_signature');
        }
    };

    return { logPlanCopied };
};