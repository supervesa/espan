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
        4. 'esco_ammatti': Poimi vahvin jo olemassa oleva pääammatti viralliseksi ammattinimikkeeksi (yksi selkeä sana, esim. "Sairaanhoitaja").
        5. 'finesco_ammattiala': Määrittele ammattinimikkeeseen tai asiakkaan taustaan parhaiten sopiva laajempi ammattiala TÄSMÄLLEEN yhdellä näistä termeistä: Johtotehtävät, Erityisasiantuntijatyö, Asiantuntijatyö, Toimisto- ja asiakaspalveluala, Palvelu- ja myyntiala, Maa- ja metsätalousala, Rakennus-, korjaus- ja valmistusala, Prosessi- ja kuljetusala, Avustava työ, Sotilasala, tai "Ei määritelty".
        6. 'nykyinen_opiskelija' ja 'nykyinen_yrittaja': Päättele tekstistä, onko asiakas tällä hetkellä (juuri nyt) päätoiminen opiskelija tai aktiivinen yrittäjä. Palauta true/false.

        OSA 2: TILANNEKUVA JA KÄYNNISSÄ OLEVAT PALVELUT
        Vertaamalla annettuja päivämääriä nykypäivään (${currentDate}), vastaa seuraaviin:
        7. 'tila_tyokokeilu': Onko asiakas JUURI NYT työkokeilussa? (Vihje: etsi sanaa "työkokeilu").
        8. 'tila_palkkatuki': Onko asiakas JUURI NYT palkkatuella? (Vihje: etsi sanaa "palkkatuki").
        9. 'tila_tyoton': Onko asiakas tällä hetkellä työtön (ei opiskele, ei yritä, ei aktiivista palvelua)?
        10. 'nykyinen_palvelu_alku' ja 'nykyinen_palvelu_loppu': JOS asiakas on tällä hetkellä (tai on juuri aloittamassa) työkokeilussa, palkkatukityössä tai työvoimakoulutuksessa, poimi kyseisen jakson ALKU- ja LOPPUPÄIVÄMÄÄRÄT muodossa PP.KK.VVVV. Jos aktiivista palvelua ei ole, palauta tyhjät merkkijonot.

        OSA 3: TULEVAISUUDEN IDEOINTI (URAOHJAAJAN ROOLI)
        11. 'vaihtoehtoiset_ammatit': Ideoi asiakkaan osaamisen pohjalta tasan 2 uutta, vaihtoehtoista ammattia. Anna VAIN ammattinimikkeet (esim. "Myyjä", "Koodari"). Älä kirjoita selityksiä.
        12. 'koulutusehdotukset': Ideoi tasan 2 konkreettista uutta koulutusta tai lyhytkurssia.
        
        YHTEISET SÄÄNNÖT:
        - Älä käytä markdown-otsikoita (#).`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                tyohistoria: { type: SchemaType.STRING, description: "Tiivistelmä todellisesta työkokemuksesta." },
                koulutushistoria: { type: SchemaType.STRING, description: "Lista oikeasti suoritetuista tutkinnoista ja korteista valmistumisvuosineen." },
                tyokokeilut_pvm: { type: SchemaType.STRING, description: "Pelkät työkokeilujen päivämääräparit allekkain." },
                esco_ammatti: { type: SchemaType.STRING, description: "Asiakkaan nykyinen vahvin pääammatti." },
                finesco_ammattiala: { 
                    type: SchemaType.STRING, 
                    enum: [
                        "Johtotehtävät", "Erityisasiantuntijatyö", "Asiantuntijatyö", 
                        "Toimisto- ja asiakaspalveluala", "Palvelu- ja myyntiala", 
                        "Maa- ja metsätalousala", "Rakennus-, korjaus- ja valmistusala", 
                        "Prosessi- ja kuljetusala", "Avustava työ", "Sotilasala", "Ei määritelty"
                    ],
                    description: "Tarkka ylätason ISCO-pohjainen ammattiluokka." 
                },
                tila_tyokokeilu: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työkokeilussa?" },
                tila_palkkatuki: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä palkkatuella?" },
                tila_tyoton: { type: SchemaType.BOOLEAN, description: "Onko asiakas tällä hetkellä työtön?" },
                nykyinen_palvelu_alku: { type: SchemaType.STRING, description: "Käynnissä olevan palvelun (työkokeilu, palkkatuki, koulutus) alkupäivä muodossa PP.KK.VVVV. Jos ei ole, palauta tyhjä." },
                nykyinen_palvelu_loppu: { type: SchemaType.STRING, description: "Käynnissä olevan palvelun (työkokeilu, palkkatuki, koulutus) loppupäivä muodossa PP.KK.VVVV. Jos ei ole, palauta tyhjä." },
                vaihtoehtoiset_ammatit: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Ideoi tasan 2 uutta vaihtoehtoista ammattia/alaa (pelkät nimikkeet)."
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
            required: [
                "tyohistoria", "koulutushistoria", "tyokokeilut_pvm", "esco_ammatti", "finesco_ammattiala", 
                "tila_tyokokeilu", "tila_palkkatuki", "tila_tyoton", "nykyinen_palvelu_alku", "nykyinen_palvelu_loppu", 
                "vaihtoehtoiset_ammatit", "koulutusehdotukset", "nykyinen_opiskelija", "nykyinen_yrittaja", "loydetyt_triggerit"
            ]
        };

        const aiData = await generateWithFallback(prompt, schema);
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("URA-analyysin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Analyysi epäonnistui', details: error.message }) };
    }
};