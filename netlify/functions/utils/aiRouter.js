// --- netlify/functions/utils/aiRouter.js ---
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

// KESKITETTY MALLILISTA TÄRKEYSJÄRJESTYKSESSÄ
// 1. Ensisijainen (Nopein/Halvin)
// 2. Vakaa varamalli
// 3. Järeä hätävara
const FALLBACK_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite", 
    "gemini-3.1-flash",
    "gemini-3.1-pro" 
];

async function generateWithFallback(prompt, schema = null) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    let lastError = null;

    for (const modelName of FALLBACK_MODELS) {
        try {
            console.log(`[AI Router] Yritetään mallia: ${modelName}...`);
            
            // Määritellään asetukset (JSON tai puhdas teksti)
            const config = {
                responseMimeType: schema ? "application/json" : "text/plain",
            };
            if (schema) config.responseSchema = schema;

            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: config
            });

            // Yritetään hakea vastaus
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            console.log(`[AI Router] ✅ Onnistui mallilla: ${modelName}`);
            
            // Jos annoimme scheman, reititin parsii JSONin valmiiksi. Muuten palautetaan teksti.
            return schema ? JSON.parse(text) : text;

        } catch (error) {
            console.error(`[AI Router] ❌ Malli ${modelName} epäonnistui:`, error.message);
            lastError = error;
            
            // Tarkistetaan, onko kyseessä Googlen pään ruuhka (503) tai kiintiö ylitetty (429)
            const isOverloaded = error.message.includes('503') || error.message.includes('429');
            
            if (isOverloaded) {
                console.log(`[AI Router] ⚠️ Ruuhkaa havaittu, siirrytään lennosta seuraavaan malliin...`);
                continue; // Kokeillaan listan seuraavaa!
            } else {
                // Jos virhe on meidän oma mokamme (esim. huono prompti), kaadutaan suosiolla
                throw error;
            }
        }
    }
    
    // Jos koko for-luuppi meni läpi ja KAIKKI mallit olivat jumissa
    throw new Error(`Kaikki tekoälymallit ovat tällä hetkellä ruuhkautuneet. Yritä hetken kuluttua uudestaan.`);
}

// Viedään funktio ja SchemaType muiden tiedostojen käyttöön
module.exports = { generateWithFallback, SchemaType };