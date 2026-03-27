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

        const prompt = `Olet asiantunteva TE-palveluiden asiantuntija. Tehtäväsi on jäsentää asiakkaan raaka työ- ja palveluhistoria selkeäksi, virkamiesmäiseksi tekstiksi työllistymissuunnitelmaa varten.
        
        RAAKA DATA:
        ${rawText.substring(0, 15000)}

        OHJEET TEKSTIN MUOTOILUUN JA JAKAMISEEN:
        1. Jätä tarkat työnantajien nimet pois, korvaa ne geneerisesti (esim. "työskennellyt logistiikka-alan yrityksessä").
        2. Erottele työhistoria ja aiemmat TE-palvelut (esim. työkokeilut, palkkatuet) 'tyohistoria' -kenttään kronologiseksi tiivistelmäksi (3-5 viimeisintä vuotta).
        3. Erottele kaikki suoritetut tutkinnot, lyhytkurssit ja pätevyydet (esim. hygieniapassi, työturvallisuuskortti) 'koulutushistoria' -kenttään.
        4. Käytä koulutushistoriassa luettelomerkkejä (viivaa - tai asteriskia *) ja lihavoi (**) tutkintonimikkeet ja kortit.
        5. Älä ehdota tulevaisuuden polkuja tai suosituksia, keskity vain olemassa olevan datan siistimiseen.
        6. Älä käytä markdown-otsikoita (#), vaan pelkkiä rivinvaihtoja, lihavointeja ja luettelomerkkejä.`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { 
                    type: SchemaType.STRING, 
                    description: "Tiivistelmä työkokemuksesta ja aiemmista TE-palveluista virkakielellä." 
                },
                koulutushistoria: { 
                    type: SchemaType.STRING, 
                    description: "Luettelomainen ja lihavoitu lista suoritetuista tutkinnoista, kursseista ja korteista." 
                },
                esco_ammatti: { 
                    type: SchemaType.STRING, 
                    description: "Poimi historiasta asiakkaan selkein pääammatti tai vahvin osaamisala virallisen tuntuiseksi ammattinimikkeeksi (esim. 'Ohjelmistokehittäjä', 'Lähihoitaja'). Palauta tyhjä, jos historia on liian pirstaleinen." 
                },
                loydetyt_triggerit: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Valitse sopivimmat laukaisevat signaalit näiden joukosta: ${knownTriggers.join(', ')}. Valitse vain sellaisia, joihin historiassa on selkeä viittaus.` 
                }
            },
            required: ["tyohistoria", "koulutushistoria", "esco_ammatti", "loydetyt_triggerit"]
        };

        const aiData = await generateWithFallback(prompt, schema);
        console.log("🐝 URA-analyysi valmis (Jaettu):", JSON.stringify(aiData, null, 2));

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui', details: error.message }) };
    }
};