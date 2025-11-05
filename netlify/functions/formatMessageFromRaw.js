// netlify/functions/formatMessageFromRaw.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Alustetaan Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Käytetään tuttua mallia

// --- "Resepti" viestin muotoiluun raakatekstistä ---
function createFormattingPrompt(rawText, customerState) {
    
    // Poimitaan asiakkaan tilasta vain oleellinen kontekstia varten
    const relevantState = {
        perustiedot: {
            syntymavuosi: customerState?.perustiedot?.syntymavuosi
        },
        tyokyky: customerState?.tyokyky,
        kielitaso: customerState?.kielitaso,
        osaaminen_ja_yrittajyys: customerState?.koulutus_yrittajyys,
        viimeisin_suunnitelmaehdotus: customerState?.['custom-suunnitelma'] || ''
    };

    return `
Olet ammattimainen TE-asiantuntija (sinun oletusnimesi on "Vesa Nessling"). Tehtäväsi on muotoilla kiireessä kirjoitetut "raakateksti"-muistiinpanot viralliseksi, selkeäksi ja kohteliaaksi asiakasviestiksi.

Tässä on asiakkaan taustatiedot (anonymisoitu), joita voit käyttää sävyn ja kontekstin määrittämiseen:
${JSON.stringify(relevantState, null, 2)}

Tässä on raakateksti, joka sisältää viestin ydinasiat:
---
${rawText}
---

OHJEET:
1.  **Tunnista ydinviesti:** Ymmärrä, mitä raakatekstillä yritetään sanoa (esim. onko se ajanvaraus, tavoittelu, ohjeistus?).
2.  **Rakenna täydellinen viesti:** Kirjoita täysi viesti, joka sisältää kaiken raakatekstin informaation (kuten päivämäärät, kellonajat, paikat, syyt).
3.  **Käytä kontekstia:** Hyödynnä asiakkaan taustatietoja. Jos asiakkaalla on 'tyokyky'-merkintöjä, käytä erityisen empaattista sävyä. Jos 'kielitaso' on heikko, käytä hyvin yksinkertaista suomen kieltä.
4.  **Muotoilu:** Aloita viesti aina "Tervehdys Helsingin työllisyyspalveluista!". Jos raakatekstissä ei mainita muuta asiantuntijaa, päätä viesti "Terveisin,\nVesa Nessling, Helsingin työllisyyspalvelut".

Palauta VAIN ja AINOASTAAN valmis viestiteksti. Älä selitä, mitä teit.
`;
}

// Pääkäsittelijä
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Otetaan data vastaan React-komponentilta
        const { rawText, customerState } = JSON.parse(event.body);

        if (!rawText || !customerState) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Puuttuva raakateksti tai asiakasdata' }) };
        }

        // 1. Luodaan "resepti"
        const prompt = createFormattingPrompt(rawText, customerState);
        
        // 2. Kutsutaan Geminiä
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const formattedMessage = response.text().trim();

        // 3. Palautetaan muotoiltu viesti
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formattedMessage: formattedMessage }),
        };

    } catch (error) {
        console.error("Virhe Gemini-kutsussa (formatMessageFromRaw):", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe tekoälyviestin muotoilussa: " + error.message }) };
    }
};