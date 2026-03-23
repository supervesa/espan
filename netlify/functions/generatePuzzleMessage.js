const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { SYSTEM_PERSONA } = require("./aiPersona"); // Ladataan yhteinen äänensävy

exports.handler = async (event, context) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { prompt, availablePieces } = JSON.parse(event.body);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                ydinviesti: { type: SchemaType.STRING, description: "Itse kirjoitettu selkeä viestin ydin." },
                ehdotetut_palikat: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Taulukko niiden palikoiden ID:istä, jotka sopivat viestiin lisukkeeksi." }
            },
            required: ["ydinviesti", "ehdotetut_palikat"]
        };

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            // Yhdistetään äänensävy ja tämän toiminnon tarkat säännöt:
            systemInstruction: `${SYSTEM_PERSONA}

EHDOTTOMAT RAKENNESÄÄNNÖT TÄHÄN TEHTÄVÄÄN:
1. Älä koskaan aloita viestiä tervehdyksellä (kuten "Hei", "Terve").
2. Älä koskaan päätä viestiä lopputervehdykseen tai allekirjoitukseen (kuten "Ystävällisin terveisin", oma nimesi).
3. Tuota vain itse asiasisältö. Kirjoittamasi teksti upotetaan osaksi viestipohjaa, jossa tervehdykset on jo hoidettu.

TEHTÄVÄSI: Kirjoita käyttäjän ohjeista selkeä viestin ydin. Valitse lisäksi 'availablePieces' -listalta 0-3 sopivimman palikan ID:tä, jotka täydentäisivät tätä viestiä (esim. lakitekstit laiminlyönnistä tai ohjeet).`,
            generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        });

        const piecesMenu = availablePieces.map(p => `${p.id} | ${p.title} | ${p.category}`).join('\n');
        const fullPrompt = `Käyttäjän ohje: ${prompt}\n\nSaatavilla olevat lisäpalikat:\n${piecesMenu}`;

        const result = await model.generateContent(fullPrompt);
        return { statusCode: 200, headers, body: result.response.text() };
        
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};