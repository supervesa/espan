// --- netlify/functions/generateFollowup.js ---
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        // Otetaan vastaan puhtaaksi käännetyt tiedot Frontendiltä!
        const { customerName, planItems, obligationsCount, selectedSnippets } = JSON.parse(event.body);
        
        const sovitutAsiatText = planItems && planItems.length > 0 
            ? planItems.join('\n- ') 
            : 'Ei erillisiä toimenpiteitä kirjattu tällä kertaa.';

        const velvollisuusText = obligationsCount > 0 
            ? `Sovimme, että haet ${obligationsCount} työpaikkaa kuukaudessa.` 
            : 'Tällä hetkellä sinulla ei ole numeerista työnhakuvelvollisuutta.';

        const snippetsContext = selectedSnippets && selectedSnippets.length > 0 
            ? selectedSnippets.map(s => `LINKIN NIMI: "${s.label}". LINKIN URL: "${s.url || 'Ei URLia'}". ASIANTUNTIJAN OHJE TEKOÄLYLLE: "${s.ai_description || ''}". LINKIN SISÄLTÖ: "${s.content}"`).join('\n\n')
            : 'Ei erillisiä linkkejä lisättäväksi.';

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
             model: "gemini-3.1-flash-lite-preview",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        followupEmailHtml: { 
                            type: SchemaType.STRING, 
                            description: "Sähköposti HTML-muodossa. Käytä <p>, <ul>, <li>, <strong>. TEE LINKEISTÄ KLIKATTAVIA: <a href='url'>Linkin nimi</a>." 
                        },
                        followupEmailText: { 
                            type: SchemaType.STRING, 
                            description: "Sama sähköposti pelkkänä raakatekstinä ilman HTML-tägejä." 
                        }
                    },
                    required: ["followupEmailHtml", "followupEmailText"]
                }
            }
        });

        const prompt = `Olet empaattinen, mutta asiallinen työllisyyspalveluiden asiantuntija. Kirjoita asiakkaalle ("${customerName}") tapaamisen yhteenvetoviesti "Hampurilaismallin" mukaisesti:

        1. LÄMMIN YLÄSÄMPYLÄ: Kiitä ystävällisesti tapaamisesta.
        2. PIHVI (Sovitut asiat): Tee näistä sovitusta asioista selkeä, kannustava To-Do -lista asiakkaalle:\n- ${sovitutAsiatText}
        3. MAUSTEET (Velvollisuudet & Hyväksyntä): Kerro ystävällisesti työnhakuvelvollisuudesta: "${velvollisuusText}". TÄRKEÄÄ: Muistuta asiakasta LAAJASTI ja KANNUSTAVASTI, että hänen pitää käydä Oma Asiointi -palvelussa vahvistamassa tehty suunnitelma, jotta työttömyysturva ei katkea.
        4. RANSKALAISET (Linkit): Asiantuntija on valinnut asiakkaalle nämä linkit ja ohjeet. Upota ne sähköpostiin kauniisti. Käytä asiantuntijan ohjetta apuna, kun perustelet miksi linkki on mukana. Datat: \n${snippetsContext}
        5. TUKUVA ALASÄMPYLÄ: Päätä viesti tsemppaavasti ja kerro, että apua on aina saatavilla.

        Palauta teksti sekä puhtaana HTML-koodina että raakatekstinä.`;

        const result = await model.generateContent(prompt);
        const aiData = JSON.parse(result.response.text());

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Sähköpostin generointivirhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sähköpostin luonti epäonnistui' }) };
    }
};