// netlify/functions/parseScraperText.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

// --- PÄIVITETTY JA YKSINKERTAISTETTU RESEPTI ---
// Tämä tekoäly-funktio KESKITTYY NYT VAIN TULKINTAAN.
// Se EI enää yritä kopioida vapaan tekstin lohkoja.
function createScraperPrompt(rawText) {
    return `
Olet huipputarkka data-analyytikko. Tehtäväsi on lukea suomenkielinen TE-toimiston asiakasteksti ja poimia siitä VAIN TULKINTAA vaativat tiedot.

VASTAUSOHJEET:
- Palauta AINOASTAAN validi JSON-objekti.
- Jos et löydä tietoa, palauta kentän arvoksi 'null' (tai tyhjä objekti {}).
- Älä tervehdi, äläkä selitä vastaustasi.
- Lue koko konteksti ja tee päätelmät sen perusteella (esim. jos lukee "ei ole työtön", älä aseta "tyoton").

TEKSTI, JOKA ANALYSOIDAAN:
---
${rawText}
---

JSON-POHJA, JOKA TULEE TÄYTTÄÄ (Täytä vain nämä):
{
  "suunnitelman_perustiedot": {
    "syntymavuosi": {
        "avainsana": "syntymavuosi",
        "muuttujat": { "SYNTYMÄVUOSI": "Päättele syntymävuosi tekstistä, esim. 'Fil. maist... (v. 2007)' -> 2007 - 25 = 1982" }
    }
  },
  "tyotilanne": {
    "tyoton": { "avainsana": "tyoton" },
    "lomautettu": { "avainsana": "lomautettu" }
    // Päättele asiakkaan tila 'Asiakkaan työtilanne' -kappaleesta.
  },
  "koulutus_yrittajyys": {
    "koulutus_tausta": {
        "avainsana": "koulutus_tausta",
        "muuttujat": { "KOULUTUS": "Etsi asiakkaan koulutus 'Koulutus ja yrittäjyys' -kappaleesta (esim. 'koulutukseltaan Fil. maist., fysiikka...')" }
    }
  },
  "tyonhakuvelvollisuus": {
    // Päättele työnhakuvelvollisuuden tila 'Suunnitelma'-kappaleesta
    "avainsana": "Päättele avainsana: 'paasaanto' (jos on velvollisuus) tai 'ei_velvoitetta_tyokyky' (jos velvoitetta ei ole asetettu esim. työkyvyn vuoksi, kuten 'Lukumäärällistä työnhakuvelvoitetta ei asetettu...')",
    "muuttujat": {
        "LKM": "Montako paikkaa tulee hakea? (Jos 'paasaanto')",
        "AIKAJAKSO": "Missä ajassa? (Jos 'paasaanto')"
    }
  }
}
`;
}

// Anonymisointi (pysyy ennallaan)
function anonymizeText(text) {
    let cleanText = text;
    // Poistaa yleiset lauseet, jotka sotkevat analyysiä
    cleanText = cleanText.replace(/Asiakas (hyväksyy|tietää ilmoittaa).*/gi, '');
    cleanText = cleanText.replace(/Asiakkaalle on kerrottu.*/gi, '');
    cleanText = cleanText.replace(/Asiakas on tietoinen.*/gi, '');
    cleanText = cleanText.replace(/Asiakas suorittaa ja kuittaa.*/gi, '');
    cleanText = cleanText.replace(/Haetut paikat ja suunnitelman tehtävät.*/gi, '');

    // Yleinen PII-anonymisointi
    cleanText = cleanText.replace(/Asiakas:\s+[A-Za-zÅÄÖåäö\s-]+/gi, 'Asiakas: [ANONYMISOITU]');
    cleanText = cleanText.replace(/\d{6}[-A]\d{3}[A-Z0-9]/gi, '[SOTU ANONYMISOITU]');
    cleanText = cleanText.replace(/0\d{2}\s?\d{7,}/gi, '[PUHELIN ANONYMISOITU]');
    return cleanText;
}

// Pääkäsittelijä (pysyy ennallaan)
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { rawText } = JSON.parse(event.body);
        if (!rawText) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Raakateksti puuttuu' }) };
        }

        const anonymizedText = anonymizeText(rawText);
        const prompt = createScraperPrompt(anonymizedText); // Kutsuu nyt uutta, parempaa reseptiä
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponseText = response.text().trim();

        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Gemini-vastaus ei ollut JSON:", aiResponseText);
            throw new Error('Tekoäly ei palauttanut validia JSON-dataa.');
        }
        
        const parsedJson = JSON.parse(jsonMatch[0]);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedJson),
        };

    } catch (error) {
        console.error("Virhe Gemini-scraper-kutsussa:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe tekoäly-scraperissa: " + error.message }) };
    }
};