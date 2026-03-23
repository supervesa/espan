const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { SYSTEM_PERSONA } = require("./aiPersona"); // Ladataan yhteinen äänensävy

exports.handler = async (event, context) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { prompt } = JSON.parse(event.body);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING, description: "Lyhyt ja iskevä otsikko palikalle (hallintaa varten)." },
                category: { type: SchemaType.STRING, description: "Valitse yksi: Tervehdys, Ydinviesti, Ohje, Lakiteksti tai Allekirjoitus." },
                content: { type: SchemaType.STRING, description: "Palikan varsinainen tekstisisältö." },
                is_locked: { type: SchemaType.BOOLEAN, description: "True, jos kyseessä on lakiteksti tai muu ei-muokattava virallinen ohje. Muuten false." }
            },
            required: ["title", "category", "content", "is_locked"]
        };

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            // Yhdistetään äänensävy ja tämän toiminnon tehtävänanto:
            systemInstruction: `${SYSTEM_PERSONA}

EHDOTTOMAT SÄÄNNÖT TÄHÄN TEHTÄVÄÄN:
- Jos käyttäjä pyytää tervehdyksen (esim. "Uusi Tervehdys-palikka"), kirjoita vain tervehdys.
- Jos kyseessä on ohje tai lakiteksti, merkitse se lukituksi (is_locked: true).
- Muotoile teksti ytimekkääksi ja heti käyttövalmiiksi rakennuspalikaksi.

TEHTÄVÄSI: Suunnittele uusi uudelleenkäytettävä viestin legopalikka käyttäjän pyynnön pohjalta.`,
            generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        });

        const result = await model.generateContent(prompt);
        return { statusCode: 200, headers, body: result.response.text() };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};