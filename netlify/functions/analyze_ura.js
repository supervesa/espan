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

        const prompt = `Olet asiantunteva TE-palveluiden asiantuntija. Tänään on ${currentDate}. Tehtäväsi on jäsennellä asiakkaan työ- ja palveluhistoria rakenteelliseksi dataksi.
        
        RAAKA DATA:
        ${rawText.substring(0, 15000)}

        OSA 1: HISTORIAN FAKTAT
        1. 'tyohistoria': Kirjoita kronologinen tiivistelmä (3-5 viimeisintä vuotta). Korvaa tarkat työnantajat geneerisesti.
        2. 'suoritetut_koulutukset': Poimi KAIKKI asiakkaan suorittamat tutkinnot. Erota tutkinnon nimi ja valmistumisvuosi (esim. "2024").
        3. 'tyokokeilut_pvm': Etsi menneet työkokeilut ja palauta vain päivämääräparit.
        4. 'esco_ammatti': Poimi vahvin jo olemassa oleva pääammatti viralliseksi ammattinimikkeeksi (yksi selkeä sana).
        5. 'finesco_ammattiala': Valitse tasan yksi näistä: Johtotehtävät, Erityisasiantuntijatyö, Asiantuntijatyö, Toimisto- ja asiakaspalveluala, Palvelu- ja myyntiala, Maa- ja metsätalousala, Rakennus-, korjaus- ja valmistusala, Prosessi- ja kuljetusala, Avustava työ, Sotilasala, tai "Ei määritelty".
        6. 'nykyinen_opiskelija' ja 'nykyinen_yrittaja': Onko asiakas juuri nyt opiskelija tai yrittäjä (true/false).

        OSA 2: TILANNEKUVA JA KÄYNNISSÄ OLEVAT PALVELUT (KRIITTINEN)
        7. 'tila_tyoton': Onko asiakas tällä hetkellä täysin työtön (ei aktiivista palvelua tai opiskelua)?
        8. 'aktiiviset_palvelut': Etsi tekstistä kaikki asiakkaalla TÄLLÄ HETKELLÄ käynnissä olevat tai juuri alkavat TE-palvelut ja opinnot. 
           - Käytä "entity_key" kentässä VAIN näitä arvoja: "tyokokeilu", "palkkatuki", "tyovoimakoulutus", "opiskelu_omaehtoinen", "opiskelu_sivutoiminen", "opiskelu_lyhytkestoinen", "opiskelu_kotoutuja".
           - Poimi alkamis- ja päättymispäivä muodossa PP.KK.VVVV.
           - Poimi tarkenne (esim. oppilaitoksen tai työnantajan nimi), jos se mainitaan tekstissä.

        OSA 3: TULEVAISUUDEN IDEOINTI
        9. 'vaihtoehtoiset_ammatit': Ideoi asiakkaan osaamisen pohjalta tasan 2 uutta ammatti-ideaa (pelkät nimikkeet).
        10. 'koulutusehdotukset': Ideoi tasan 2 konkreettista ehdotusta tulevaisuuden koulutuksiksi.`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Tiivistelmä todellisesta työkokemuksesta." },
                suoritetut_koulutukset: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            tutkinto: { type: SchemaType.STRING, description: "Tutkinnon tai kurssin nimi" },
                            vuosi: { type: SchemaType.STRING, description: "Valmistumisvuosi, esim. '2024'. Jos ei mainittu, jätä tyhjäksi." }
                        },
                        required: ["tutkinto", "vuosi"]
                    },
                    description: "Lista asiakkaan suorittamista tutkinnoista ja koulutuksista."
                },
                tyokokeilut_pvm: { type: SchemaType.STRING, description: "Pelkät työkokeilujen päivämääräparit allekkain." },
                esco_ammatti: { type: SchemaType.STRING, description: "Asiakkaan nykyinen vahvin pääammatti." },
                finesco_ammattiala: { 
                    type: SchemaType.STRING, 
                    enum: [
                        "Johtotehtävät", "Erityisasiantuntijatyö", "Asiantuntijatyö", 
                        "Toimisto- ja asiakaspalveluala", "Palvelu- ja myyntiala", 
                        "Maa- ja metsätalousala", "Rakennus-, korjaus- ja valmistusala", 
                        "Prosessi- ja kuljetusala", "Avustava työ", "Sotilasala", "Ei määritelty"
                    ]
                },
                tila_tyoton: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä täysin työtön?" },
                aktiiviset_palvelut: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            entity_key: { 
                                type: SchemaType.STRING,
                                enum: ["tyokokeilu", "palkkatuki", "tyovoimakoulutus", "opiskelu_omaehtoinen", "opiskelu_sivutoiminen", "opiskelu_lyhytkestoinen", "opiskelu_kotoutuja"]
                            },
                            alku: { type: SchemaType.STRING, description: "Alkupäivä muodossa PP.KK.VVVV" },
                            loppu: { type: SchemaType.STRING, description: "Loppupäivä muodossa PP.KK.VVVV" },
                            tarkenne: { type: SchemaType.STRING, description: "Oppilaitoksen tai järjestäjän nimi, jos mainittu" }
                        },
                        required: ["entity_key", "alku", "loppu"]
                    },
                    description: "Kaikki asiakkaalla parhaillaan käynnissä olevat palvelut ja opinnot."
                },
                vaihtoehtoiset_ammatit: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                koulutusehdotukset: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                nykyinen_opiskelija: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä opiskelija? True tai false." },
                nykyinen_yrittaja: { type: SchemaType.BOOLEAN, description: "Onko asiakkaalla tällä hetkellä aktiivista yritystoimintaa? True tai false." },
                loydetyt_triggerit: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Valitse sopivimmat laukaisevat signaalit näiden joukosta: ${knownTriggers.join(', ')}.` 
                }
            },
            required: [
                "tyohistoria", "suoritetut_koulutukset", "tyokokeilut_pvm", "esco_ammatti", "finesco_ammattiala", 
                "tila_tyoton", "aktiiviset_palvelut", "vaihtoehtoiset_ammatit", "koulutusehdotukset", 
                "nykyinen_opiskelija", "nykyinen_yrittaja", "loydetyt_triggerit"
            ]
        };

        const aiData = await generateWithFallback(prompt, schema);
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui' }) };
    }
};