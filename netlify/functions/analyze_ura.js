// --- netlify/functions/analyze_ura.js ---
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
        const { rawText, knownTriggers } = JSON.parse(event.body);
        
        if (!rawText) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte on pakollinen' }) };

        const prompt = `Olet asiantunteva TE-palveluiden asiantuntija. Tehtäväsi on jäsentää asiakkaan raaka työ- ja palveluhistoria selkeäksi tekstiksi ja erotella tietyt tiedot omiin kenttiinsä.
        
        RAAKA DATA:
        ${rawText.substring(0, 15000)}

        OHJEET:
        1. Jätä tarkat työnantajien nimet pois (korvaa geneerisesti, esim. "kuljetusalan yritys").
        2. Kirjoita 'tyohistoria' -kenttään kronologinen tiivistelmä (3-5 viimeisintä vuotta).
        3. Kirjoita 'koulutushistoria' -kenttään ranskalaisilla viivoilla ja lihavoinneilla suoritetut tutkinnot ja kortit.
        4. Etsi tekstistä KAIKKI työkokeilut ja vastaavat palvelujaksot. Kirjoita ne 'tyokokeilut_pvm' -kenttään VAIN JA AINOASTAAN muodossa PP.KK.VVVV - PP.KK.VVVV. Älä kirjoita mitään muuta tekstiä, ei sanoja, ei selityksiä, ei luettelomerkkejä. Vain puhtaat päivämääräparit omille riveilleen.
        5. Älä ehdota tulevaisuuden polkuja. Älä käytä markdown-otsikoita (#).`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Tiivistelmä työkokemuksesta ja aiemmista TE-palveluista virkakielellä." },
                koulutushistoria: { type: SchemaType.STRING, description: "Luettelomainen ja lihavoitu lista suoritetuista tutkinnoista, kursseista ja korteista." },
                tyokokeilut_pvm: { type: SchemaType.STRING, description: "Pelkät työkokeilujen päivämääräparit allekkain (esim. 01.02.2023 - 31.05.2023). Palauta tyhjänä jos ei löydy." },
                esco_ammatti: { type: SchemaType.STRING, description: "Poimi historiasta asiakkaan selkein pääammatti tai vahvin osaamisala virallisen tuntuiseksi ammattinimikkeeksi (esim. 'Ohjelmistokehittäjä'). Palauta tyhjä, jos liian pirstaleinen." },
                loydetyt_triggerit: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Valitse sopivimmat laukaisevat signaalit näiden joukosta: ${knownTriggers.join(', ')}.` 
                }
            },
            required: ["tyohistoria", "koulutushistoria", "tyokokeilut_pvm", "esco_ammatti", "loydetyt_triggerit"]
        };

        const aiData = await generateWithFallback(prompt, schema);
        console.log("🐝 URA-analyysi valmis:", JSON.stringify(aiData, null, 2));

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui', details: error.message }) };
    }
};