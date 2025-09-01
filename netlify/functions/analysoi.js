// Tämä on Netlify-funktio, joka toimii backendinä.

// Apufunktio datan anonymisointiin
const anonymizeState = (state) => {
    const cleanState = JSON.parse(JSON.stringify(state)); // Syväkopio

    // Poistetaan tarkat päivämäärät, nimet, paikat jne.
    if (cleanState.suunnitelman_perustiedot?.laadittu?.muuttujat) {
        cleanState.suunnitelman_perustiedot.laadittu.muuttujat.PÄIVÄMÄÄRÄ = '[PÄIVÄMÄÄRÄ]';
    }
    if (cleanState.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat) {
        const pvm = cleanState.suunnitelman_perustiedot.tyonhaku_alkanut.muuttujat.PÄIVÄMÄÄRÄ;
        // Muunnetaan kestoksi
        const parts = pvm.split('.');
        const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const diffDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
        cleanState.suunnitelman_perustiedot.tyonhaku_alkanut.muuttujat.PÄIVÄMÄÄRÄ = `n. ${Math.floor(diffDays / 30.44)} kk sitten`;
    }
    if (cleanState.tyotilanne?.irtisanottu?.muuttujat) {
        cleanState.tyotilanne.irtisanottu.muuttujat.YRITYS = '[YRITYS]';
        cleanState.tyotilanne.irtisanottu.muuttujat.AMMATTI = '[AMMATTI]';
        cleanState.tyotilanne.irtisanottu.muuttujat.PVM = '[PÄIVÄMÄÄRÄ]';
    }
    // Poistetaan kaikki vapaat tekstikentät varmuuden vuoksi
     Object.keys(cleanState).forEach(key => {
        if (key.startsWith('custom-')) {
            delete cleanState[key];
        }
    });

    return cleanState;
};

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const state = JSON.parse(event.body);
        
        // 1. Anonymisoi data
        const anonymizedState = anonymizeState(state);

        // 2. LÄHETÄ ANONYMISOITU DATA TEKOÄLYLLE (Tässä simuloitu)
        // Todellisuudessa tässä olisi kutsu esim. OpenAI:n tai Googlen API:in
        // const aiResponse = await callRealAI(anonymizedState);
        
        // 3. Simuloitu tekoälyn vastaus
        const suggestions = {
            palveluohjaukset: [],
            suunnitelma: []
        };

        if (state.tyokyky?.paavalinta?.avainsana === 'tyokyky_selvityksessa') {
            suggestions.palveluohjaukset.push({ teksti: "Ohjaus työterveystarkastukseen", avainsana: "ohjaus_terveystarkastus" });
        }
        if (state.koulutus_yrittajyys?.ei_tutkintoa) {
            suggestions.suunnitelma.push({ teksti: "Selvitetään asiakkaalle sopivia ammatillisia koulutusvaihtoehtoja.", avainsana: "toimenpide_koulutus_selvitys" });
        }
         if (Object.keys(state.tyotilanne || {}).length === 0) {
             suggestions.suunnitelma.push({ teksti: "Määritellään asiakkaan tarkempi työtilanne (työtön, lomautettu, jne.).", avainsana: "toimenpide_tilanne_maaritys" });
        }


        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestions }),
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe analyysissä: " + error.message }) };
    }
};
