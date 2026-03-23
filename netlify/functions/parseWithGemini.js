// netlify/functions/parseWithGemini.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- TÄMÄ ON AINOA "RESEPTIMME" (Versio 3.0: SuperAI) ---
function createFullParsePrompt(rawText) {
    return `
Olet huipputarkka data-analyytikko. Tehtäväsi on lukea suomenkielinen TE-toimiston asiakasteksti ja muuttaa se TÄYDELLISEKSI JSON-objektiksi, joka noudattaa sovelluksen sisäistä rakennetta.

TÄRKEIN SÄÄNTÖ: Sinun täytyy erottaa toisistaan RAKENTEELLISET VALINNAT (kuten 'tyoton') ja VAPAA TEKSTI ('custom-...' kentät). Jos lause on "Asiakas on työtön työnhakija.", aseta "tyoton" valinta ja ÄLÄ laita sitä lausetta enää "custom-tyotilanne" -kenttään.

TEKSTI, JOKA ANALYSOIDAAN:
---
${rawText}
---

JSON-POHJA, JOKA TULEE TÄYTTÄÄ (Täytä kaikki mitä löydät):
{
  "suunnitelman_perustiedot": {
    "tyonhaku_alkanut": {
        "avainsana": "tyonhaku_alkanut",
        "muuttujat": { "PÄIVÄMÄÄRÄ": "Etsi lauseesta 'Asiakkaan työnhaku on alkanut DD.MM.YYYY'" }
    },
    "laadittu": {
        "avainsana": "laadittu",
        "muuttujat": { "YHTEYDENOTTOTAPA": "puhelinajalla", "PÄIVÄMÄÄRÄ": "Etsi lauseesta 'laadittiin puhelinajalla DD.MM.YYYY'" }
    },
    "syntymavuosi": {
        "avainsana": "syntymavuosi",
        "muuttujat": { "SYNTYMÄVUOSI": "Päättele syntymävuosi esim. koulutuksen päättymisvuodesta (esim. '... (v. 2007)' -> ~1982)" }
    },
    "custom-suunnitelman_perustiedot": "Kopioi tähän kaikki MUU vapaa teksti 'Suunnitelman perustiedot' -otsikon alta (paitsi ne lauseet, joista poimit päivämäärät)."
  },
  "tyotilanne": {
    "tyoton": { "avainsana": "tyoton" },
    "custom-tyotilanne": "Kopioi tähän kaikki MUU vapaa teksti 'Asiakkaan työtilanne' -otsikon alta (paitsi lause 'Asiakas on työtön työnhakija')."
  },
  "koulutus_yrittajyys": {
    "koulutus_tausta": {
        "avainsana": "koulutus_tausta",
        "muuttujat": { "KOULUTUS": "Etsi asiakkaan koulutus, esim. 'koulutukseltaan Fil. maist., fysiikka...'" }
    },
    "custom-koulutus_yrittajyys": "Kopioi tähän kaikki MUU vapaa teksti 'Koulutus ja yrittäjyys' -otsikon alta (paitsi se lause, josta poimit koulutuksen)."
  },
  "tyokyky": {
    "omaArvio": "Etsi asiakkaan antama pistemäärä (0-10), jos se on mainittu.",
    "custom-tyokyky": "Kopioi tähän KOKO vapaa teksti 'Työkyky'-otsikon alta."
  },
  "suunnitelma": {
    // Huom: Tämä kenttä on nyt 'suunnitelma'-objektin sisällä, EI 'tyonhakuvelvollisuus'.
    // Sinun App.js saattaa tarvita pienen muutoksen, jos se odottaa 'tyonhakuvelvollisuus'-pääavainta.
    // TAI muutetaan tämä vastaamaan App.js:n rakennetta:
  },
  "tyonhakuvelvollisuus": {
    "avainsana": "Päättele avainsana: 'paasaanto' (jos on velvollisuus) tai 'ei_velvoitetta_tyokyky' (jos 'Lukumäärällistä työnhakuvelvoitetta ei asetettu...')"
    // Muuttujia ei tarvita, koska RegEx ei niitä poiminut
  },
  "custom-suunnitelma": "Kopioi tähän KOKO vapaa teksti 'Suunnitelma'-otsikon alta (myös se lause työnhakuvelvollisuudesta, koska se on osa suunnitelmaa)."
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
    cleanText = cleanText.replace(/Oikeudet ja velvollisuudet/gi, ''); 
    cleanText = cleanText.replace(/Työnhakuvelvollisuuden toteuttaminen ja seuranta/gi, '');

    // Yleinen PII-anonymisointi
    cleanText = cleanText.replace(/Asiakas:\s+[A-Za-zÅÄÖåäö\s-]+/gi, 'Asiakas: [ANONYMISOITU]');
    cleanText = cleanText.replace(/\d{6}[-A]\d{3}[A-Z0-9]/gi, '[SOTU ANONYMISOITU]');
    cleanText = cleanText.replace(/0\d{2}\s?\d{7,}/gi, '[PUHELIN ANONYMISOITU]');
    return cleanText;
}

// Pääkäsittelijä
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
        const prompt = createFullParsePrompt(anonymizedText); // Kutsuu nyt uutta, kaikenkattavaa reseptiä
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponseText = response.text().trim();

        // Puhdistetaan vastaus (poistetaan ```json -merkit)
        let cleanedJsonString = aiResponseText.replace(/```json/g, '').replace(/```/g, '');

        const jsonMatch = cleanedJsonString.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Gemini-vastaus ei ollut JSON:", aiResponseText);
            throw new Error('Tekoäly ei palauttanut validia JSON-dataa.');
        }
        
        cleanedJsonString = jsonMatch[0].replace(/,\s*([\}\]])/g, "$1");
        
        const parsedJson = JSON.parse(cleanedJsonString);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedJson), // Palauttaa KOKO state-objektin
        };

    } catch (error) {
        console.error("Virhe Gemini-scraper-kutsussa:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Virhe tekoäly-scraperissa: " + error.message }) };
    }
};