const { generateWithFallback, SchemaType } = require("./utils/aiRouter");
const { SYSTEM_PERSONA } = require("./aiPersona"); // Ladataan yhteinen äänensävy

exports.handler = async (event, context) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { prompt, availablePieces } = JSON.parse(event.body);
        
        // 1. Määritellään skeema
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                ydinviesti: { type: SchemaType.STRING, description: "Itse kirjoitettu selkeä viestin ydin." },
                ehdotetut_palikat: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Taulukko niiden palikoiden ID:istä, jotka sopivat viestiin lisukkeeksi." }
            },
            required: ["ydinviesti", "ehdotetut_palikat"]
        };

        // 2. Määritellään järjestelmäohje (Persona + säännöt)
        const systemInstruction = `${SYSTEM_PERSONA}

EHDOTTOMAT RAKENNESÄÄNNÖT TÄHÄN TEHTÄVÄÄN:
1. Älä koskaan aloita viestiä tervehdyksellä (kuten "Hei", "Terve").
2. Älä koskaan päätä viestiä lopputervehdykseen tai allekirjoitukseen (kuten "Ystävällisin terveisin", oma nimesi).
3. Tuota vain itse asiasisältö. Kirjoittamasi teksti upotetaan osaksi viestipohjaa, jossa tervehdykset on jo hoidettu.

TEHTÄVÄSI: Kirjoita käyttäjän ohjeista selkeä viestin ydin. Valitse lisäksi 'availablePieces' -listalta 0-3 sopivimman palikan ID:tä, jotka täydentäisivät tätä viestiä (esim. lakitekstit laiminlyönnistä tai ohjeet).`;

        // 3. Valmistellaan varsinainen prompti
        const piecesMenu = availablePieces.map(p => `${p.id} | ${p.title} | ${p.category}`).join('\n');
        const fullPrompt = `Käyttäjän ohje: ${prompt}\n\nSaatavilla olevat lisäpalikat:\n${piecesMenu}`;

        // 4. Kutsutaan reititintä
        // Reititin parsii JSONin valmiiksi, koska annoimme sille scheman
        const resultObject = await generateWithFallback(fullPrompt, schema, systemInstruction);

        // 5. Palautetaan vastaus merkkijonona (stringify)
        return { statusCode: 200, headers, body: JSON.stringify(resultObject) };
        
    } catch (error) {
        console.error("Generointivirhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};