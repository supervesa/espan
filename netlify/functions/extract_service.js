const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    // 1. CORS-Asetukset
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { url, knownCategories, knownTriggers } = JSON.parse(event.body);

        if (!url) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL on pakollinen' }) };
        }

        // 2. Alustetaan Gemini API
        // VINKKI: Jos flash-lite-preview antaa edelleen 503-virhettä ruuhkan takia, 
        // voit vaihtaa malliksi "gemini-3.1-flash", joka on usein vakaampi tuotannossa.
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite-preview", 
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: { 
                            type: SchemaType.STRING, 
                            description: "Palvelun virallinen nimi." 
                        },
                        category: { 
                            type: SchemaType.STRING, 
                            description: `Paras kategoria näistä: ${knownCategories.join(', ')}. Voit luoda uuden vain jos mikään ei sovi.` 
                        },
                        description: { 
                            type: SchemaType.STRING, 
                            description: "Laaja kuvaus asiantuntijalle. JAA KAHTEEN OSAAN: Kirjoita ensin selkeä tiivistelmä siitä, mitä palvelu tekee. Lisää sen perään tyhjä rivi ja otsikko 'Vaatimukset ja kohderyhmä:', jonka alle listaat selkeästi kenelle palvelu on suunnattu ja mitkä ovat osallistumisen ehdot (esim. ikäraja, asuinpaikka, työttömyyden kesto)." 
                        },
                        plan_text: { 
                            type: SchemaType.STRING, 
                            description: "Asiakkaan viralliseen asiakirjaan tulostuva teksti. Kirjoita virkamiesmäisesti, passiivissa tai kolmannessa persoonassa. ÄLÄ aloita lausetta kuin jatkaisit jotain aiempaa. Aloita lause muodollisesti, esim: 'Asiakas ohjataan...', 'Asiakas osallistuu...' tai 'Suunnitelmaan sisältyy...'. Kerro lyhyesti myös, miksi palvelu on asiakkaalle hyödyllinen." 
                        },
                        triggers: { 
                            type: SchemaType.ARRAY,
                            items: { type: SchemaType.STRING },
                            description: `Palauta taulukkona sopivimmat signaalit näistä: ${knownTriggers.join(', ')}. Voit lisätä myös 1-2 uutta lyhyttä signaalia (esim. 'alle_30v').` 
                        },
                        language_req: { 
                            type: SchemaType.STRING, 
                            description: "Vaadittu suomen kielen taito CEFR-asteikolla (esim. A1.2, B1.1). Jos ei mainittu, palauta tyhjä merkkijono." 
                        },
                        brochure_url: { 
                            type: SchemaType.STRING, 
                            description: "Linkki ladattavaan esitteeseen (esim. .pdf). ERIKOISHUOMIO: Jos sivulla on useita esitteitä, valitse EHDOTTOMASTI se, joka on suomenkielinen (urlissa esim. 'fi', 'suomi', 'finnish') ja koskee Helsingin aluetta ('hel', 'helsinki'). Jos tällaista ei löydy, jätä tyhjäksi." 
                        }
                    },
                    required: ["title", "category", "description", "plan_text", "triggers", "language_req", "brochure_url"]
                }
            }
        });

        // 3. Suoritetaan haku
        const prompt = `Lue seuraavan verkkosivun sisältö ja poimi sieltä tiedot työllisyyspalveluiden asiantuntijajärjestelmään: ${url}`;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Varmistetaan, että tulos on validia JSONia
        const aiData = JSON.parse(responseText);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(aiData)
        };

    } catch (error) {
        console.error("AI-haun virhe:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Sisällön louhinta epäonnistui', details: error.message })
        };
    }
};