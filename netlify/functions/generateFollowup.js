// netlify/functions/generateFollowup.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
// Tuodaan olemassa oleva tietopankkisi.
// HUOM: Polku saattaa vaatia säätöä riippuen kansiorakenteestasi.
// Tämä olettaa, että kansiosi ovat /netlify/functions/ ja /src/data/
const { infoSnippets } = require('../../src/data/infoSnippets.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Käytetään tuttua mallia

function createFollowupPrompt(customerState, linkDatabase) {
    // Siivotaan state-objekti, lähetetään vain oleellinen
    const relevantState = {
        suunnitelma_valinnat: customerState.suunnitelma || {},
        suunnitelma_teksti: customerState['custom-suunnitelma'] || null,
        tyokyky: customerState.tyokyky || null,
        koulutus: customerState.koulutus_yrittajyys || null,
        palkkatuki: customerState.palkkatuki || null
    };

    return `
Olet Vesa Nessling, kannustava ja ammattimainen työllisyys-asiantuntija. Olet juuri lopettanut tapaamisen asiakkaan kanssa.

Tehtäväsi on kirjoittaa asiakkaalle ystävällinen "Kiitos tapaamisesta" -sähköposti.

Tässä on JSON-muodossa ne tiedot, jotka kirjasit ylös tapaamisesta:
---
${JSON.stringify(relevantState, null, 2)}
---

Tässä on tietopankki hyödyllisistä linkeistä (infoSnippets), joita voit käyttää:
---
${JSON.stringify(linkDatabase, null, 2)}
---

OHJEET SÄHKÖPOSTILLE:

1.  **Aloitus:** Aloita ystävällisesti, esim. "Hei, ja kiitos tapaamisesta tänään!"
2.  **Yhteenveto:** Kirjoita 1-2 kappaleen vapaamuotoinen yhteenveto. Käytä "suunnitelma_teksti"-kenttää pääasiallisena pohjana sille, mitä sovittiin. Mainitse tärkeimmät sovitut asiat.
3.  **Lisäresurssit (TÄRKEIN):**
    * Analysoi asiakkaan tilannetta (tyokyky, koulutus, palkkatuki jne.).
    * Valitse tietopankista 1-3 kaikkein hyödyllisintä linkkiä, jotka liittyvät suoraan asiakkaan tilanteeseen.
    * Esittele ne osiossa, esim. "Tässä vielä muutama hyödyllinen linkki, joista keskustelimme:". Käytä 'label'-kenttää linkin nimenä ja 'content'-kenttää linkkinä/tekstinä.
    * ÄLÄ ehdota linkkiä, jos se ei liity asiakkaan tilanteeseen.
4.  **Lopetus:** Päätä viesti kannustavasti.

Palauta VAIN ja AINOASTAAN valmis sähköpostiteksti.
`;
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const { customerState } = JSON.parse(event.body);
        if (!customerState) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Asiakasdata puuttuu' }) };
        }

        // Käytetään 'infoSnippets' muuttujaa tietopankkina
        const prompt = createFollowupPrompt(customerState, infoSnippets);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const followupEmail = response.text().trim();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followupEmail: followupEmail })
        };

    } catch (error) {
        console.error("Virhe Gemini-kutsussa (generateFollowup):", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe yhteenvedon luonnissa: " + error.message }) };
    }
};