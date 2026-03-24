// --- netlify/functions/extract_snippet.js ---
// Tuodaan meidän uusi älykäs reititin!
const { generateWithFallback, SchemaType } = require('./utils/aiRouter');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const { url, triggerDictionary } = JSON.parse(event.body);
        if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL on pakollinen' }) };

        // 1. Määritellään vain mitä halutaan (Schema)
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                label: { type: SchemaType.STRING, description: "Lyhyt ja ytimekäs otsikko linkille (esim. 'Työkokeilu', 'CV-paja')" },
                content: { type: SchemaType.STRING, description: "Lyhyt, ystävällinen saateteksti sähköpostiin (1-2 lausetta)." },
                ai_description: { type: SchemaType.STRING, description: "Ohje asiantuntijalle/tekoälylle siitä, milloin tätä linkkiä kannattaa ehdottaa." },
                triggers: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Palauta taulukkona sopivimmat signaalit TÄSTÄ listasta: ${triggerDictionary.join(', ')}. Valitse vain listalla olevia sanoja!` 
                }
            },
            required: ["label", "content", "ai_description", "triggers"]
        };

        // 2. Määritellään kysymys
        const prompt = `Lue verkkosivu: ${url}. Tiivistä sivun sisältö lyhyeksi sähköpostin tietoiskuksi ja valitse sille sopivimmat signaalit.`;
        
        // 3. ANNETAAN REITITTIMEN HOITAA LOPUT!
        const aiData = await generateWithFallback(prompt, schema);

        // Palautetaan reitittimen antama (ja valmiiksi JSONiksi muuttama) data
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("AI-haun virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Louhinta epäonnistui', details: error.message }) };
    }
};