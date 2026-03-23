const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { SYSTEM_PERSONA } = require("./aiPersona");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { url, knownCategories = [], knownTriggers = [] } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "URL-osoite puuttuu." }) };

    // 1. MÄÄRITELLÄÄN TIUKKA JSON-SKEEMA (STRUCTURED OUTPUT)
    // Tämä takaa, että AI palauttaa tasan nämä kentät, eikä mitään muuta.
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "Palvelun selkeä ja virallinen nimi."
        },
        category: {
          type: SchemaType.STRING,
          description: `Valitse sopivin olemassa oleva kategoria näistä: ${knownCategories.join(', ')}. Jos mikään ei sovi, luo uusi lyhyt kategoria.`
        },
        description: {
          type: SchemaType.STRING,
          description: "Tiivis kuvaus asiantuntijalle."
        },
        plan_text: {
          type: SchemaType.STRING,
          description: "Virkakielinen asiakirjateksti työllistymissuunnitelmaan (1-3 lausetta)."
        },
        triggers: {
          type: SchemaType.STRING,
          description: `1-3 laukaisevaa signaalia pilkulla erotettuna. Suosi olemassa olevia: ${knownTriggers.join(', ')}.`
        },
        language_req: {
          type: SchemaType.STRING,
          description: "Suomen kielen taitovaatimus CEFR-asteikolla (esim. A1.2, B1). Palauta tyhjä merkkijono, jos ei mainittu."
        },
        brochure_url: {
          type: SchemaType.STRING,
          description: "Esitteen, tulostettavan materiaalin tai lisätiedon linkki (esim. PDF) sivun HTML:stä. Palauta suora URL tai tyhjä merkkijono."
        }
      },
      required: ["title", "category", "description", "plan_text", "triggers", "language_req", "brochure_url"]
    };

    const SERVICE_TASK_INSTRUCTIONS = `Olet työllisyyspalveluiden asiantuntija. Lue annettu verkkosivuston HTML-sisältö ja tiivistä se täsmälleen määriteltyyn JSON-skeemaan.`;

    // 2. HAETAAN SIVUSTON SISÄLTÖ
    let websiteContent = "";
    try {
        const siteResponse = await fetch(url);
        if (!siteResponse.ok) throw new Error("Sivuston haku epäonnistui.");
        const html = await siteResponse.text();
        websiteContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                             .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                             .substring(0, 35000); 
    } catch (fetchErr) {
        return { statusCode: 400, body: JSON.stringify({ error: "Verkkosivun lukeminen epäonnistui." }) };
    }

    // 3. KUTSUTAAN UUTTA GEMINI 3.1 FLASH-LITE -MALLIA
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", // UUSI NOPEA JA EDULLINEN MALLI
      systemInstruction: `${SYSTEM_PERSONA}\n\n${SERVICE_TASK_INSTRUCTIONS}`
    });

    // 4. GENERATION CONFIG: PAKOTETAAN JSON
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Analysoi seuraava palvelukuvaus:\n\n${websiteContent}` }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema, // Kytketään tiukka skeema
        }
    });

    // Koska käytämme responseMimeTypea, tulos on 100% varmasti puhdas JSON-string. 
    // Vanhoja ````json ... ```` siivouksia ei enää tarvita!
    const responseText = result.response.text();

    return { 
        statusCode: 200, 
        headers: { "Content-Type": "application/json" }, 
        body: responseText 
    };

  } catch (error) {
    console.error("API virhe:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Analysointi epäonnistui." }) };
  }
};