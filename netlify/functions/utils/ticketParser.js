import aiRouter from './aiRouter.js';
const { generateWithFallback, SchemaType } = aiRouter;

export const parseTicketData = async (emailText, emailReceivedAt, subject, sender) => {
    
    let analyzedText = emailText;
    let deterministicFacts = "";

    // Tarkistetaan onko kyseessä aito OnniBus-kuitti
    if (sender.toLowerCase().includes('onnibus') || subject.toLowerCase().includes('onnibus')) {
        const searchKeyword = 'TILAUKSEN YHTEENVETO';
        
        // Joustava giljotiini: Etsitään missä kohti tekstiä alkaa "TILAUKSEN YHTEENVETO"
        if (analyzedText.includes(searchKeyword)) {
            analyzedText = analyzedText.substring(analyzedText.indexOf(searchKeyword));
            console.log("[Ticket Parser] Giljotiini leikkasi OnniBus-kuitin tilausyhteenvedosta eteenpäin.");
        }

        // Regex-täsmähaku varauskoodeille (esim. 5-0158-080726-OB5-1430-HELK-MIKK)
        const onniRegex = /\d+-\d+-(\d{2})(\d{2})(\d{2})-[A-Z0-9]+-(\d{2})(\d{2})-([A-Z]+)-([A-Z]+)/g;
        const matches = [...analyzedText.matchAll(onniRegex)];

        if (matches.length > 0) {
            const [ , DD, MM, YY, HH, mm, start, end ] = matches[0];
            const firstDepartureTime = `20${YY}-${MM}-${DD}T${HH}:${mm}:00`;

            if (matches.length === 1) {
                deterministicFacts = `
!!! HUOMIO: OHJELMALLISESTI VAHVISTETUT FAKTAT !!!
Tietokone on jo lukenut matkalipun viivakoodista seuraavat faktat. ÄLÄ YRITÄ ARVATA NÄITÄ, vaan käytä tismalleen näitä arvoja:
- Matkan tyyppi: Yksisuuntainen
- departure_time: "${firstDepartureTime}"
`;
                console.log(`[Ticket Parser] Löydettiin 1 OnniBus-matka: ${firstDepartureTime}`);
            
            } else if (matches.length > 1) {
                const [ , rDD, rMM, rYY, rHH, rmm ] = matches[1];
                const returnTime = `20${rYY}-${rMM}-${rDD}T${rHH}:${rmm}:00`;
                
                deterministicFacts = `
!!! HUOMIO: OHJELMALLISESTI VAHVISTETUT FAKTAT !!!
Tietokone on lukenut viivakoodeista, että kyseessä on MENOPALUU-matka (tai useampi lippu samassa kuitissa). Noudata EHDOTTOMASTI näitä ohjeita:
- Aseta 'route_info' muotoon: "Meno-paluu: [Mistä] - [Mihin]"
- Aseta 'departure_time' ensimmäisen matkan ajaksi: "${firstDepartureTime}"
- Toisen matkan (paluu) aika on: "${returnTime}" (käytä tätä tietoa ostoennakon tai trendin arvioinnissa, mutta tallenna departure_timeen vain ensimmäinen aika).
- Varmista, että etsit 'total_price' kenttään KOKO KUITIN loppusumman, joka löytyy tyypillisesti TOSITE-otsikoiden yhteydestä.
- Lisää smartTags-taulukkoon tagit "Meno-paluu 🔄" ja "OnniBus 🚌".
`;
                console.log(`[Ticket Parser] Löydettiin Menopaluu! Meno: ${firstDepartureTime}, Paluu: ${returnTime}`);
            }
        }
    }

    // JSON-SKEEMA GEMINILLE
    const ticketSchema = {
        type: SchemaType.OBJECT,
        properties: {
            total_price: { type: SchemaType.NUMBER, description: "Lipun/kuittikokonaisuuden lopullinen kokonaishinta numerona (esim. 24.90)" },
            departure_time: { type: SchemaType.STRING, description: "Matkan lähtöaika ISO 8601 muodossa (esim. 2026-07-08T14:30:00Z)" },
            route_info: { type: SchemaType.STRING, description: "Reitin tiedot tiiviisti, esim. 'Helsinki - Mikkeli' tai 'Meno-paluu: Helsinki - Mikkeli'" },
            confidenceScore: { type: SchemaType.NUMBER, description: "Luottamusarvio 0-100 siitä, kuinka varma olet tiedoista" },
            leadTimeHours: { type: SchemaType.NUMBER, description: "Ostoennakko tunneissa (ensimmäisen matkan lähtöajan ja sähköpostin saapumisajan erotus)" },
            smartTags: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "2-4 tagia (max 20 merkkiä/kpl). Sisällytä kulkuväline-emoji ja tilannekuvaus."
            },
            priceTrend: { type: SchemaType.NUMBER, description: "Arvio hinnasta prosentteina vs. keskihinta (esim. -10 jos halpa, 15 jos kallis, 0 jos normaali)" },
            anomalyInfo: { type: SchemaType.STRING, nullable: true, description: "Lyhyt selitys, jos havaitsit poikkeavuuden" }
        },
        required: ["total_price", "departure_time", "route_info", "confidenceScore", "leadTimeHours", "smartTags", "priceTrend"]
    };

    const prompt = `
Olet taloushallinnon data-analyytikko. Tehtäväsi on poimia matkalipun tiedot sähköpostin raakatekstistä.

SÄHKÖPOSTIN METADATA:
- Otsikko: ${subject}
- Lähettäjä: ${sender}
- Saapunut (ostohetki): ${emailReceivedAt}
${deterministicFacts}

KUITIN (LEIKATTU) RAAKATEKSTI:
${analyzedText}

OHJEET:
1. Etsi kokonaishinta (total_price).
2. Päättele reitti (Mistä - Mihin), tai tottele vahvistettuja faktoja.
3. Laske ostoennakko (leadTimeHours) sähköpostin saapumisajan ja (ensimmäisen) matkan lähtöajan välillä.
4. Luo älykkäät tagit.
5. Palauta vastaus tiukasti JSON-skeeman mukaisesti.
    `;

    console.log("[Ticket Parser] Lähetetään teksti Geminille analysoitavaksi...");
    const result = await generateWithFallback(prompt, ticketSchema);
    
    return result;
};