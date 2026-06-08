// --- netlify/functions/analyze_ura.js ---
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
        const { rawText, knownTriggers, currentDate } = JSON.parse(event.body);
        
        if (!rawText) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte on pakollinen' }) };

        const prompt = `Olet asiantunteva TE-palveluiden asiantuntija. Tänään on ${currentDate}. Tehtäväsi on kaksi-osainen: ensin jäsennät asiakkaan historian puhtaisiin faktoihin, ja sen jälkeen toimit uraohjaajana ideoiden tulevaisuutta.
        
        RAAKA DATA:
        ${rawText.substring(0, 15000)}

        OSA 1: HISTORIAN FAKTAT (ÄLÄ KEKSI MITÄÄN UUTTA)
        1. 'tyohistoria': Kirjoita kronologinen tiivistelmä (3-5 viimeisintä vuotta). Korvaa tarkat työnantajat geneerisesti.
        2. 'koulutushistoria': Listaa ranskalaisilla viivoilla ja lihavoinneilla vain asiakkaan oikeasti suorittamat tutkinnot, kurssit ja kortit. Liitä jokaisen koulutuksen/kortin perään myös sen suoritus- tai valmistumisvuosi (esim. "2024").
        3. 'tyokokeilut_pvm': Etsi KAIKKI työkokeilut. Kirjoita VAIN muodossa PP.KK.VVVV - PP.KK.VVVV omille riveilleen.
        4. 'esco_ammatti': Poimi vahvin jo olemassa oleva pääammatti viralliseksi ammattinimikkeeksi.
        5. 'finesco_ammattiala': Määrittele ammattinimikkeeseen tai asiakkaan taustaan parhaiten sopiva laajempi ammattiala (esim. Rakennusala, Palvelu- ja myyntityö, Asiantuntijatyö).
        6. TÄRKEÄÄ: Päättele tekstistä, onko asiakas tällä hetkellä (juuri nyt) päätoiminen opiskelija tai aktiivinen yrittäjä. Palauta true/false.

        OSA 2: TILANNEKUVA (LOMAKKEEN AUTOMAATIOTA VARTEN)
        Vertaamalla annettuja päivämääriä nykypäivään (${currentDate}), vastaa seuraaviin (true/false):
        7. 'tila_tyokokeilu': Onko asiakas JUURI NYT työkokeilussa (tai onko se päättynyt aivan äskettäin / alkamassa)? (Vihje: etsi sanaa "työkokeilu").
        8. 'tila_palkkatuki': Onko asiakas JUURI NYT palkkatuella? (Vihje: etsi sanaa "palkkatuki").
        9. 'tila_tyoton': Onko asiakas tällä hetkellä työtön (ei opiskele, ei yritä, ei aktiivista työsuhdetta)?

        OSA 3: TULEVAISUUDEN IDEOINTI (URAOHJAAJAN ROOLI)
        10. 'vaihtoehtoiset_ammatit': Ideoi asiakkaan osaamisen pohjalta tasan 2 uutta, vaihtoehtoista ammattia.
        11. 'koulutusehdotukset': Ideoi tasan 2 konkreettista uutta koulutusta tai lyhytkurssia.
        
        YHTEISET SÄÄNNÖT:
        - Älä käytä markdown-otsikoita (#).`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Tiivistelmä todellisesta työkokemuksesta." },
                koulutushistoria: { type: SchemaType.STRING, description: "Lista oikeasti suoritetuista tutkinnoista ja korteista valmistumisvuosineen." },
                tyokokeilut_pvm: { type: SchemaType.STRING, description: "Pelkät työkokeilujen päivämääräparit allekkain." },
                esco_ammatti: { type: SchemaType.STRING, description: "Asiakkaan nykyinen vahvin pääammatti." },
                finesco_ammattiala: { type: SchemaType.STRING, description: "Laajempi ammattiala, johon ammattiprofiili kuuluu." },
                tila_tyokokeilu: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työkokeilussa?" },
                tila_palkkatuki: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä palkkatuella?" },
                tila_tyoton: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työtön?" },
                vaihtoehtoiset_ammatit: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Ideoi tasan 2 uutta vaihtoehtoista ammattia/alaa."
                },
                koulutusehdotukset: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Ideoi tasan 2 konkreettista ehdotusta tulevaisuuden koulutuksiksi."
                },
                nykyinen_opiskelija: {
                    type: SchemaType.BOOLEAN,
                    description: "Onko asiakas tällä hetkellä, nykyhetkessä, opiskelija? True tai false."
                },
                nykyinen_yrittaja: {
                    type: SchemaType.BOOLEAN,
                    description: "Onko asiakkaalla tällä hetkellä aktiivista yritystoimintaa? True tai false."
                },
                loydetyt_triggerit: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Valitse sopivimmat laukaisevat signaalit näiden joukosta: ${knownTriggers.join(', ')}.` 
                }
            },
            required: ["tyohistoria", "koulutushistoria", "tyokokeilut_pvm", "esco_ammatti", "finesco_ammattiala", "tila_tyokokeilu", "tila_palkkatuki", "tila_tyoton", "vaihtoehtoiset_ammatit", "koulutusehdotukset", "nykyinen_opiskelija", "nykyinen_yrittaja", "loydetyt_triggerit"]
        };

        const aiData = await generateWithFallback(prompt, schema);
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui', details: error.message }) };
    }
};