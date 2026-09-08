// --- netlify/functions/analyze_ura_story.js ---
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
        const { tyopaikat, esco_pääammatti, koulutukset, palvelut, huomiot } = JSON.parse(event.body);

        // Prompti ohjaa Geminiä olemaan luova, empaattinen ja ideoiva.
        const prompt = `Olet empaattinen ja asiantunteva työllisyyspalveluiden uraohjaaja. 
        Tehtäväsi on laatia asiakkaan anonymisoidun työ- ja koulutushistorian pohjalta laadukas sanallinen yhteenveto, sekä ideoida uusia urapolkuja.

        ASIAKKAAN FAKTAT (Koneellisesti puhdistettu):
        - Pääammatti (ESCO): ${esco_pääammatti || 'Ei määritelty'}
        - Työpaikat: ${tyopaikat || 'Ei merkintöjä'}
        - Koulutukset: ${JSON.stringify(koulutukset || [])}
        - Aktiiviset palvelut: ${JSON.stringify(palvelut || [])}
        - Tekoälyn huomiot: ${JSON.stringify(huomiot || [])}

        OSA 1: TYÖHISTORIAN YHTEENVETO ('tyohistoria')
        Kirjoita 2 kappaleen pituinen selkeä, myyvä ja asiantunteva yhteenveto asiakkaan osaamisesta ja taustasta. 
        Käytä asiakas-passiivia (sinuttele), esim. "Sinulla on vahva kokemus...". Puhu kokemuksen luonteesta, asenteesta ja osaamisesta.

        OSA 2: IDEOINTI ('vaihtoehtoiset_ammatit')
        Ideoi asiakkaan aiemman osaamisen pohjalta tasan 2-3 uutta, vaihtoehtoista ESCO-ammattinimikettä, joita asiakas voisi harkita (esim. alanvaihto tai looginen eteneminen).

        OSA 3: KOULUTUSEHDOTUKSET ('koulutusehdotukset')
        Ideoi 1-2 konkreettista ehdotusta täydentäviksi koulutuksiksi (esim. lupa- tai lyhytkoulutukset), jotka parantaisivat asiakkaan työllistymistä näiden faktojen pohjalta.

        Palauta vastaus pyydetyssä JSON-muodossa. Vastaa täydellisellä ja luonnollisella suomen kielellä.`;

        // JSON-schema pakottaa Geminin antamaan tiukan rakenteen Frontille
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Laadukas ja empaattinen sanallinen yhteenveto (2 kappaletta)." },
                vaihtoehtoiset_ammatit: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "2-3 vaihtoehtoista ammattinimikettä."
                },
                koulutusehdotukset: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "1-2 koulutusideaa."
                }
            },
            required: ["tyohistoria", "vaihtoehtoiset_ammatit", "koulutusehdotukset"]
        };

        const aiData = await generateWithFallback(prompt, schema);
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Tarina-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui' }) };
    }
};