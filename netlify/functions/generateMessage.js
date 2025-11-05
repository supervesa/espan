// netlify/functions/generateMessage.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Alustetaan Gemini (käyttää samaa avainta kuin toinen funktiosi)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Käytetään sitä mallia, jonka totesimme toimivaksi
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

// --- "Resepti" viestin personalisointiin ---
function createPersonalizationPrompt(baseMessage, customerState, templateId) {
    
    // Yritetään poimia asiakkaan suunnitelman ydintavoite, jos sellainen on
    const aiPlanSummary = customerState?.['custom-suunnitelma'] || '';

    // Poistetaan turha "kohina" state-objektista
    const relevantState = {
        perustiedot: {
            syntymavuosi: customerState?.perustiedot?.syntymavuosi
        },
        tyotilanne: customerState?.tyotilanne,
        tyokyky: customerState?.tyokyky,
        kielitaso: customerState?.kielitaso,
        osaaminen_ja_yrittajyys: customerState?.koulutus_yrittajyys,
        tyonhakuvelvollisuus: customerState?.tyonhakuvelvollisuus,
        viimeisin_suunnitelmaehdotus: aiPlanSummary
    };

    // Annetaan tekoälylle konteksti siitä, mitä ollaan tekemässä
    let context = "Tämä on yleinen viesti asiakkaalle.";
    if (templateId.includes('kutsu-alkuhaastattelu')) {
        context = "Tämä on virallinen kutsu ENSIMMÄISEEN alkuhaastatteluun.";
    } else if (templateId.includes('kutsu-tyonhakukeskustelu')) {
        context = "Tämä on virallinen kutsu määräaikaiseen työnhakukeskusteluun.";
    } else if (templateId.includes('kutsu-taydentava')) {
        context = "Tämä on kutsu täydentävään keskusteluun, joka perustuu usein asiakkaan erityistarpeeseen.";
    } else if (templateId.includes('tavoitteluyritys')) {
        context = "Tämä on tavoitteluviesti, koska asiakasta ei ole saatu kiinni.";
    }

    return `
Olet ammattimainen ja empaattinen TE-asiantuntija. Tehtäväsi on ottaa "geneerinen" viestipohja ja "personalisoida" se asiakkaan tilanteen mukaan.

Tässä on asiakkaan taustatiedot (anonymisoitu):
${JSON.stringify(relevantState, null, 2)}

Tässä on viestin konteksti (mitä ollaan tekemässä):
${context}

Tässä on geneerinen viestiluonnos, jota sinun tulee muokata:
---
${baseMessage}
---

OHJEET:
1.  **Säilytä rakenne:** Älä muuta viestin ydinasioita (kuten päivämääriä, kellonaikoja tai paikkoja, jos ne on annettu).
2.  **PERSONALISOI SISÄLTÖ:** Muokkaa viestin *syy* ja *sisältö* vastaamaan asiakkaan taustatietoja. Tämä on tärkein tehtäväsi.
    * **Esimerkki 1:** Jos geneerinen teksti sanoo "Keskustelemme... työllistymistäsi edistävistä toimista" JA asiakkaan datassa näkyy 'tyokyky: { paavalinta: "tyokyky_selvityksessa" }', muuta teksti muotoon: "Keskustelemme tilanteestasi ja sinulle sopivista työkykyä tukevista palveluista."
    * **Esimerkki 2:** Jos geneerinen teksti sanoo "Keskustelemme... työllistymistäsi edistävistä toimista" JA asiakkaan datassa näkyy 'osaaminen_ja_yrittajyys: { "avainsana": "ei_tutkintoa" }', muuta teksti muotoon: "Käymme läpi tilannettasi ja sinulle sopivia koulutusvaihtoehtoja ammatillisen tutkinnon suorittamiseksi."
    * **Esimerkki 3:** Jos 'viimeisin_suunnitelmaehdotus' -kentässä on tekstiä, käytä sitä pääasiallisena inspiraationa viestin sisällölle.
3.  **KIELITASO:** Jos 'kielitaso'-datassa on merkintöjä heikosta suomen taidosta (esim. A1, A2, B1), YKSINKERTAISTA kieltä. Vältä monimutkaisia lauseita ja viranomaisjargonia (kuten "laiminlyönti"). Korvaa se selkeämmällä kielellä (esim. "On tärkeää, että saavut paikalle.").
4.  **SÄVY:** Jos 'tyokyky'-datassa on merkintöjä, käytä erityisen empaattista ja ymmärtäväistä sävyä.

Palauta VAIN ja AINOASTAAN uusi, muokattu ja personalisoitu viestiteksti. Älä selitä, mitä teit.
`;
}

// Pääkäsittelijä
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Otetaan data vastaan React-komponentilta
        const { baseMessage, customerState, templateId } = JSON.parse(event.body);

        if (!baseMessage || !customerState) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Puuttuvia tietoja' }) };
        }

        // 1. Luodaan "resepti"
        const prompt = createPersonalizationPrompt(baseMessage, customerState, templateId);
        
        // 2. Kutsutaan Geminiä
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const refinedMessage = response.text().trim();

        // 3. Palautetaan paranneltu viesti
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refinedMessage: refinedMessage }),
        };

    } catch (error) {
        console.error("Virhe Gemini-kutsussa (generateMessage):", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe tekoälyviestin luonnissa: " + error.message }) };
    }
};