// Netlify-funktio: /netlify/functions/generatePlan.js

// 1. Tuodaan Google Gemini -kirjasto
const { GoogleGenerativeAI } = require("@google/generative-ai");
// Tuodaan reseptitiedosto
const { AI_PROMPT_RECIPE } = require("./ai_recipe.js");

// 2. Alustetaan Gemini-client API-avaimella ympäristömuuttujasta
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Anonymisointifunktio (Säilyy ennallaan) ---
const anonymizeState = (state) => {
    const cleanState = JSON.parse(JSON.stringify(state)); // Syväkopio

    // Poistetaan tarkat päivämäärät, nimet, paikat jne.
    if (cleanState.suunnitelman_perustiedot?.laadittu?.muuttujat) {
        cleanState.suunnitelman_perustiedot.laadittu.muuttujat.PÄIVÄMÄÄRÄ = '[PÄIVÄMÄÄRÄ]';
    }
    if (cleanState.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat) {
        const pvm = cleanState.suunnitelman_perustiedot.tyonhaku_alkanut.muuttujat.PÄIVÄMÄÄRÄ;
        if (pvm && pvm.split('.').length === 3) {
            const parts = pvm.split('.');
            const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
            const diffDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
            cleanState.suunnitelman_perustiedot.tyonhaku_alkanut.muuttujat.PÄIVÄMÄÄRÄ = `n. ${Math.floor(diffDays / 30.44)} kk sitten`;
        } else {
            cleanState.suunnitelman_perustiedot.tyonhaku_alkanut.muuttujat.PÄIVÄMÄÄRÄ = '[TUNTEMATON KESTO]';
        }
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

// --- PÄÄKÄSITTELIJÄ ---
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const fullState = JSON.parse(event.body);
        
        // 1. Anonymisoi KOKO data ensin (turvallisuussyistä)
        const anonymizedState = anonymizeState(fullState);

        // 2. Poimi VAIN halutut, anonymisoidut tiedot tekoälyä varten
        // *** PÄIVITETTY TÄSTÄ ***
        const relevantData = {
            tyotilanne: anonymizedState.tyotilanne || null,
            osaaminen_ja_yrittajyys: anonymizedState.koulutus_yrittajyys || null,
            tyokyky: anonymizedState.tyokyky || null,
            nykyiset_palveluohjaukset: anonymizedState.palveluunohjaus || null,
            palkkatuki_tiedot: anonymizedState.palkkatuki || null,
            // TÄMÄ ON LISÄYS:
            tyonhakuvelvollisuus: anonymizedState.tyonhakuvelvollisuus || null 
        };
        // *** PÄIVITYS PÄÄTTYY ***

        // 3. Luo kehote Geminille
        const dataString = JSON.stringify(relevantData, null, 2);
        const prompt = AI_PROMPT_RECIPE.replace('%%DATA%%', dataString);
        
        // 4. Tee kutsu Gemini-tekoälyyn (Käytetään toimivaa mallia)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiSuggestion = response.text().trim(); // Otetaan vastaus ja siistitään se

        // 5. Palauta tekoälyn ehdotus React-sovellukselle
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestion: aiSuggestion }),
        };

    } catch (error) {
        console.error("Virhe Gemini-kutsussa:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe tekoälyanalyysissä: " + error.message }) };
    }
};