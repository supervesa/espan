// --- netlify/functions/extract_education.js ---
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
        const { rawText, mode } = JSON.parse(event.body);
        
        if (!rawText) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte on pakollinen' }) };

        let prompt = "";
        let schema = {};

        // --- MOODI 1: UUSI LISTAUSTILA (Keltainen laatikko) ---
        if (mode === 'list') {
            prompt = `Olet asiantunteva TE-palveluiden avustaja. Lue seuraava teksti, joka sisältää asiakkaan suorittamia tutkintoja, kursseja ja ammattikortteja.
            
            TEKSTI:
            ${rawText.substring(0, 10000)}

            TEHTÄVÄSI:
            1. Poimi kaikki viralliset koulutukset ja tutkinnot (esim. Peruskoulu, Ylioppilas, Ammattitutkinnot, AMK) listaksi 'degrees'.
            2. Poimi kaikki ammattikortit ja luvat erilliseksi listaksi 'cards'.
            
            KORTTIEN NIMET ON PALAUTETTAVA NÄILLÄ TARKKAAN MÄÄRITETYILLÄ AVAINSANOILLA, jos sellainen löytyy tekstistä:
            - hygieniapassi
            - tyoturvallisuuskortti
            - tulityokortti
            - trukkikortti
            - ensiapu_1
            - ensiapu_2
            - anniskelupassi
            - vartijakortti
            - ajokortti_b (tai c, ce jne.)
            
            Jos löydät kortin, jota ei ole tällä listalla, kirjoita sen nimi pienellä, ilman välilyöntejä ja korvaa välilyönnit alaviivalla (esim. matkailualan_turvallisuuspassi).`;

            schema = {
                type: SchemaType.OBJECT,
                properties: {
                    degrees: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                degree: { type: SchemaType.STRING, description: "Koulutuksen tai tutkinnon selkokielinen nimi." },
                                year: { type: SchemaType.STRING, description: "Valmistumisvuosi (esim. 2018). Jätä tyhjäksi jos ei lue tekstissä." }
                            },
                            required: ["degree"]
                        },
                        description: "Kaikki tekstistä löydetyt tutkinnot ja koulutukset."
                    },
                    cards: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING },
                        description: "Löydetyt ammattikortit ja luvat."
                    }
                },
                required: ["degrees", "cards"]
            };
        } 
        
        // --- MOODI 2: ALKUPERÄINEN YKSITTÄISEN TUTKINNON TILA ---
        else {
            prompt = `Olet asiantunteva työllisyyspalveluiden avustaja. Lue seuraava raakateksti, joka on kopioitu asiakkaan koulutustiedoista (esim. Koski-palvelusta).
            
            TEKSTI:
            ${rawText.substring(0, 5000)}

            TEHTÄVÄ: Poimi tekstistä korkein tai olennaisin suoritettu tutkinto ja sen valmistumisvuosi. Palauta ne lyhyessä muodossa.`;

            schema = {
                type: SchemaType.OBJECT,
                properties: {
                    degree: { type: SchemaType.STRING, description: "Tutkinnon virallinen nimi (esim. 'Kone- ja tuotantotekniikan perustutkinto' tai 'Ylioppilastutkinto')." },
                    year: { type: SchemaType.STRING, description: "Valmistumisvuosi (esim. '2023'). Palauta tyhjänä jos ei tiedossa." }
                },
                required: ["degree"]
            };
        }

        const aiData = await generateWithFallback(prompt, schema);
        console.log(`🐝 Koulutuspoiminta valmis (Mode: ${mode || 'single'}):`, JSON.stringify(aiData, null, 2));

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Koulutuspoiminnan virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Koulutustietojen analysointi epäonnistui', details: error.message }) };
    }
};