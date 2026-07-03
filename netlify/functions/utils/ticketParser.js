import aiRouter from './aiRouter.js';
const { generateWithFallback, SchemaType } = aiRouter;

// Sanakirja kaupunkien lyhenteille
const CITY_MAP = {
    'HELK': 'Helsinki',
    'HELS': 'Helsinki',
    'MIKK': 'Mikkeli',
    'TAMP': 'Tampere',
    'TKU': 'Turku',
    'JYV': 'Jyväskylä',
    'OULU': 'Oulu',
    'KUO': 'Kuopio',
    'PORI': 'Pori',
    'LAHT': 'Lahti'
};

const getCityName = (code) => {
    const upper = code.toUpperCase();
    return CITY_MAP[upper] || (upper.charAt(0) + upper.slice(1).toLowerCase());
};

export const parseTicketData = async (emailText, emailReceivedAt, subject, sender) => {
    
    let analyzedText = emailText;
    let deterministicFacts = "";

    const isKorsisaari = sender.toLowerCase().includes('payiq') || subject.toLowerCase().includes('korsisaari');
    const isOnnibus = sender.toLowerCase().includes('onnibus') || subject.toLowerCase().includes('onnibus');

    // 1. ONNIBUS-LOGIIKKA (Viivakoodin purku, fiksattu deduplikointi ja Mikkeli-ankkuri)
    if (isOnnibus) {
        const searchKeyword = 'TILAUKSEN YHTEENVETO';
        
        if (analyzedText.includes(searchKeyword)) {
            analyzedText = analyzedText.substring(analyzedText.indexOf(searchKeyword));
            console.log("[Ticket Parser] Giljotiini leikkasi OnniBus-kuitin tilausyhteenvedosta eteenpäin.");
        }

        // Täsmähaku varauskoodeille (esim. 5-0158-080726-OB5-1430-HELK-MIKK)
        const onniRegex = /\d+-\d+-(\d{2})(\d{2})(\d{2})-[A-Z0-9]+-(\d{2})(\d{2})-([A-Z]+)-([A-Z]+)/g;
        const matches = [...analyzedText.matchAll(onniRegex)];

        if (matches.length > 0) {
            // DEDUPLIKOINTI: Ryhmitellään matkat ainoastaan ajan ja reitin perusteella
            const uniqueMatchesMap = new Map();
            matches.forEach(match => {
                const [ , DD, MM, YY, HH, mm, startCode, endCode ] = match;
                
                // Luodaan uniikki avain: esim. "260715-0900-MIKK-HELK"
                const journeyKey = `${YY}${MM}${DD}-${HH}${mm}-${startCode}-${endCode}`;
                
                if (!uniqueMatchesMap.has(journeyKey)) {
                    uniqueMatchesMap.set(journeyKey, match);
                }
            });
            
            const uniqueMatches = Array.from(uniqueMatchesMap.values());
            let journeysFact = "";
            
            uniqueMatches.forEach((match, index) => {
                const [ , DD, MM, YY, HH, mm, startCode, endCode ] = match;
                const depTime = `20${YY}-${MM}-${DD}T${HH}:${mm}:00`;
                const routeInfo = `${getCityName(startCode)} - ${getCityName(endCode)}`;
                
                // SUUNTALOGIIKKA (Mikkeli-ankkuri)
                let direction = 'tuntematon';
                if (startCode.toUpperCase() === 'MIKK') {
                    direction = 'meno';
                } else if (endCode.toUpperCase() === 'MIKK') {
                    direction = 'paluu';
                }
                
                journeysFact += `\nMatka ${index + 1}:\n- Suunta (direction): "${direction}"\n- Reitti (route_info): "${routeInfo}"\n- Lähtöaika (departure_time): "${depTime}"\n`;
            });

            deterministicFacts += `
!!! OHJELMALLISESTI VAHVISTETUT MATKAT (ONNIBUS) !!!
Tietokone löysi kuitista tasan ${uniqueMatches.length} uniikkia matkaa. LUO 'journeys'-taulukkoon TÄSMÄLLEEN NÄMÄ MATKAT.
Älä poista, lisää tai keksi omia matkoja. Kopioi nämä tiedot suoraan.
Etsi HTML-tekstistä näille matkoille erilliset hinnat. Jos et löydä eriteltyjä hintoja, jaa kuitin loppusumma tasan näiden kesken.
${journeysFact}
Lisää 'smartTags'-listaan kulkuväline (OnniBus 🚌) ja reittityyppi (Yhdensuuntainen ➡️ tai Meno-paluu 🔄).
`;
            console.log(`[Ticket Parser] Löydettiin Regexillä ${matches.length} osumaa, joista suodatettiin ${uniqueMatches.length} uniikkia matkaa.`);
        }
    }

    // 2. KORSISAARI-LOGIIKKA
    if (isKorsisaari) {
        deterministicFacts += `
!!! OHJELMALLISESTI VAHVISTETTU (PAIKALLISLIIKENNE) !!!
Kyseessä on paikallisliikenne (Korsisaari/PayiQ).
Luo 'journeys'-taulukkoon tasan 1 matka näillä EHDOTTOMILLA tiedoilla:
- direction: "paikallis"
- route_info: "Nurmijärvi - lähialue (Paikallisliikenne)"
- departure_time: "${emailReceivedAt}"
- price: Koko kuitin kokonaishinta.
Lisää 'smartTags'-listaan "🎟️ Kertalippu". Jos hinta > 40€ tai tekstissä lukee 'kausilippu'/'30', lisää EHDOTTOMASTI "Kausilippu 🎫".
`;
    }

    // JSON-SKEEMA GEMINILLE
    const ticketSchema = {
        type: SchemaType.OBJECT,
        properties: {
            total_price: { type: SchemaType.NUMBER, description: "Lipun/kuittikokonaisuuden lopullinen kokonaishinta numerona (esim. 24.90)" },
            confidenceScore: { type: SchemaType.NUMBER, description: "Luottamusarvio 0-100 siitä, kuinka varma olet tiedoista" },
            leadTimeHours: { type: SchemaType.NUMBER, description: "Ostoennakko tunneissa (ensimmäisen matkan lähtöajan ja sähköpostin saapumisajan erotus)" },
            smartTags: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "2-4 tagia (max 20 merkkiä/kpl). Sisällytä kulkuväline-emoji ja tilannekuvaus."
            },
            priceTrend: { type: SchemaType.NUMBER, description: "Arvio hinnasta prosentteina vs. keskihinta (esim. -10 jos halpa, 15 jos kallis, 0 jos normaali)" },
            anomalyInfo: { type: SchemaType.STRING, nullable: true, description: "Lyhyt selitys, jos havaitsit poikkeavuuden. Jos ok, null." },
            
            // MATKATAULUKKO
            journeys: {
                type: SchemaType.ARRAY,
                description: "Lista kuitin sisältämistä matkoista. (Yksi tai useampi)",
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        departure_time: { type: SchemaType.STRING, description: "Matkan lähtöaika ISO 8601 muodossa" },
                        route_info: { type: SchemaType.STRING, description: "Reitti, esim. 'Helsinki - Mikkeli'" },
                        direction: { type: SchemaType.STRING, description: "Suunta: 'meno', 'paluu' tai 'paikallis'" },
                        price: { type: SchemaType.NUMBER, description: "Tämän yksittäisen matkaosuuden hinta (euroa)" }
                    },
                    required: ["departure_time", "route_info", "direction", "price"]
                }
            }
        },
        required: ["total_price", "confidenceScore", "leadTimeHours", "smartTags", "priceTrend", "journeys"]
    };

    const prompt = `
Olet taloushallinnon data-analyytikko. Tehtäväsi on poimia matkalipun tiedot sähköpostin raakatekstistä.

SÄHKÖPOSTIN METADATA:
- Otsikko: ${subject}
- Lähettäjä: ${sender}
- Saapunut (ostohetki): ${emailReceivedAt}

${deterministicFacts}

ERITTÄIN TÄRKEÄ SÄÄNTÖ:
Jos sähköpostissa kuvataan yksi ainoa matka (esim. matkustetaan vain kerran paikasta A paikkaan B), luot TARKALLEEN YHDEN matkan 'journeys'-taulukkoon.
Sähköpostit ja kuitit toistavat usein saman reitin ja kellonajan otsikossa, kuitin yhteenvedossa ja ehtoteksteissä. ÄLÄ luo näistä toistoista uusia matkoja. 
Kaksi matkaa luodaan VAIN JA AINOASTAAN, jos kyseessä on meno-paluu (eri reitti ja eri aika) tai oikea jatkoyhteys (eri aika).

KUITIN (LEIKATTU) RAAKATEKSTI:
${analyzedText}

OHJEET:
1. Etsi kokonaishinta (total_price).
2. Muodosta 'journeys' taulukko ohjeiden mukaisesti.
3. Laske ostoennakko (leadTimeHours).
4. Palauta vastaus tiukasti JSON-skeeman mukaisesti.
    `;

    console.log("[Ticket Parser] Lähetetään teksti Geminille analysoitavaksi...");
    const result = await generateWithFallback(prompt, ticketSchema);
    
    return result;
};