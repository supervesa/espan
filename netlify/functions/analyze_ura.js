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

        OSA 1: HISTORIAN FAKTAT
        1. 'tyohistoria': Kirjoita kronologinen tiivistelmä (3-5 viimeisintä vuotta).
        2. 'suoritetut_koulutukset': Poimi listaan KAIKKI asiakkaan oikeasti suorittamat tutkinnot, kurssit ja kortit.
        3. 'tyokokeilut_pvm': Etsi KAIKKI työkokeilut. Kirjoita VAIN muodossa PP.KK.VVVV - PP.KK.VVVV omille riveilleen.
        4. 'esco_ammatti': Poimi vahvin jo olemassa oleva pääammatti viralliseksi ammattinimikkeeksi (yksi selkeä sana).
        5. 'finesco_ammattiala': Määrittele ammattinimikkeeseen parhaiten sopiva laajempi ammattiala (Valitse tasan yksi ISCO-luokista: Johtotehtävät, Erityisasiantuntijatyö, Asiantuntijatyö, Toimisto- ja asiakaspalveluala, Palvelu- ja myyntiala, Maa- ja metsätalousala, Rakennus-, korjaus- ja valmistusala, Prosessi- ja kuljetusala, Avustava työ, Sotilasala, tai "Ei määritelty").
        6. 'nykyinen_opiskelija' ja 'nykyinen_yrittaja': Päättele tekstistä, onko asiakas juuri nyt opiskelija tai yrittäjä (true/false).

        OSA 2: TILANNEKUVA JA PÄIVÄMÄÄRÄT (KRIITTINEN)
        7. 'tila_tyokokeilu': Onko asiakas JUURI NYT työkokeilussa?
        8. 'tila_palkkatuki': Onko asiakas JUURI NYT palkkatuella?
        9. 'tila_tyoton': Onko asiakas tällä hetkellä työtön työntekijä (ei opiskele, ei yritä, ei aktiivista palvelua)?
        10. PÄIVÄMÄÄRÄT ('nykyinen_palvelu_alku' ja 'nykyinen_palvelu_loppu'): Etsi tekstistä ERITTÄIN TARKASTI se päivämääräväli, jolloin käynnissä oleva tai juuri alkava työkokeilu, palkkatuki tai koulutus tapahtuu. Muunna ne muotoon PP.KK.VVVV (esim. "1.2.2026"). Jos palvelua ei ole, jätä tyhjäksi.

        OSA 3: TULEVAISUUDEN IDEOINTI
        11. 'vaihtoehtoiset_ammatit': Ideoi asiakkaan osaamisen pohjalta tasan 2 uutta ammatti-ideaa (pelkät nimikkeet).
        12. 'koulutusehdotukset': Ideoi tasan 2 konkreettista ehdotusta koulutuksiksi.`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Tiivistelmä työkokemuksesta." },
                suoritetut_koulutukset: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            tutkinto: { type: SchemaType.STRING, description: "Tutkinnon nimi" },
                            vuosi: { type: SchemaType.STRING, description: "Valmistumisvuosi, esim. '2024'" }
                        },
                        required: ["tutkinto", "vuosi"]
                    },
                    description: "Lista suoritetuista tutkinnoista."
                },
                tyokokeilut_pvm: { type: SchemaType.STRING, description: "Työkokeilujen pvm-välit." },
                esco_ammatti: { type: SchemaType.STRING, description: "Asiakkaan nykyinen vahvin pääammatti." },
                finesco_ammattiala: { 
                    type: SchemaType.STRING, 
                    enum: [
                        "Johtotehtävät", "Erityisasiantuntijatyö", "Asiantuntijatyö", 
                        "Toimisto- ja asiakaspalveluala", "Palvelu- ja myyntiala", 
                        "Maa- ja metsätalousala", "Rakennus-, korjaus- ja valmistusala", 
                        "Prosessi- ja kuljetusala", "Avustava työ", "Sotilasala", "Ei määritelty"
                    ],
                    description: "ISCO-pohjainen ammattiluokka." 
                },
                tila_tyokokeilu: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työkokeilussa?" },
                tila_palkkatuki: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä palkkatuella?" },
                tila_tyoton: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työtön?" },
                nykyinen_palvelu_alku: { type: SchemaType.STRING, description: "Käynnissä olevan palvelun alkupäivä." },
                nykyinen_palvelu_loppu: { type: SchemaType.STRING, description: "Käynnissä olevan palvelun loppupäivä." },
                vaihtoehtoiset_ammatit: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Ideat uusiksi ammateiksi."
                },
                koulutusehdotukset: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Koulutusehdotukset."
                },
                nykyinen_opiskelija: { type: SchemaType.BOOLEAN, description: "Onko asiakas opiskelija?" },
                nykyinen_yrittaja: { type: SchemaType.BOOLEAN, description: "Onko asiakkaalla yritystoimintaa?" },
                loydetyt_triggerit: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Valitse laukaisevat signaalit." 
                }
            },
            required: [
                "tyohistoria", "suoritetut_koulutukset", "tyokokeilut_pvm", "esco_ammatti", "finesco_ammattiala", 
                "tila_tyokokeilu", "tila_palkkatuki", "tila_tyoton", "nykyinen_palvelu_alku", "nykyinen_palvelu_loppu", 
                "vaihtoehtoiset_ammatit", "koulutusehdotukset", "nykyinen_opiskelija", "nykyinen_yrittaja", "loydetyt_triggerit"
            ]
        };

        const aiData = await generateWithFallback(prompt, schema);
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui' }) };
    }
};