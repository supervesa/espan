const { GoogleGenerativeAI } = require("@google/generative-ai");
// Tuodaan yleinen persona-ohjeistus samassa kansiossa olevasta tiedostosta
const { SYSTEM_PERSONA } = require("./aiPersona"); 

const TYOKYKY_TASK_INSTRUCTIONS = `
Tehtäväsi on kirjoittaa objektiivinen ja tiivis viranomaisteksti asiakkaan työkyvystä, joka liitetään suoraan työllistymissuunnitelmaan. Saat syötteenä asiantuntijan tekemän rakenteisen koonnin (ranskalaisia viivoja) asiakkaan tilanteesta.

Noudata ehdottomasti seuraavia sääntöjä:
1. Objektiivisuus ja virkakieli: Kirjoita asiallista, neutraalia ja sujuvaa virkakieltä. Käytä passiivia tai viittaa asiakkaaseen kolmannessa persoonassa.
2. Asiakkaan oma kokemus: Älä KOSKAAN tee lääketieteellisiä diagnooseja tai omia oletuksia. Muotoile terveyshaasteet asiakkaan kokemuksena: "Asiakkaan oman arvion mukaan..."
3. Numeerisen arvion tulkinta: Jos syötteessä on arvio (0-10), avaa se tekstiksi (esim. 8-10 = hyvä/kohtalainen, alle 5 = merkittävästi alentunut). Mainitse myös itse luku.
4. Tiiviys: Kirjoita korkeintaan 1-2 kappaletta.
5. Ei lisäyksiä: Palauta VAIN valmis teksti. Älä aloita esittelyillä tai lisää loppuun selityksiä.
`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { koonti } = JSON.parse(event.body);

    if (!koonti) {
      return { statusCode: 400, body: JSON.stringify({ error: "Koonti-data puuttuu." }) };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite", 
      systemInstruction: `${SYSTEM_PERSONA}\n\n${TYOKYKY_TASK_INSTRUCTIONS}`
    });

    const prompt = `Muodosta seuraavasta rakenteisesta koonnista sujuva asiantuntijateksti:\n\n${koonti}`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: responseText }),
    };
  } catch (error) {
    console.error("Gemini API virhe:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Tekstin generointi epäonnistui." }),
    };
  }
};