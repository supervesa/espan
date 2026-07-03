import aiRouter from './aiRouter.js';
const { generateWithFallback, SchemaType } = aiRouter;

export const parseTicketData = async (emailText, emailReceivedAt, subject, sender) => {
    
    let analyzedText = emailText;
    let deterministicFacts = "";

    const isKorsisaari = sender.toLowerCase().includes('payiq') || subject.toLowerCase().includes('korsisaari');
    const isOnnibus = sender.toLowerCase().includes('onnibus') || subject.toLowerCase().includes('onnibus');

    // 1. ONNIBUS-LOGIIKKA
    if (isOnnibus) {
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
                deterministicFacts += `
!!! HUOMIO: OHJELMALLISESTI VAHVISTETUT FAKTAT !!!
Tietokone on lukenut kuitista vain YHDEN matkan viivakoodin. Käytä EHDOTTOMASTI näitä arvoja:
- Matkan tyyppi: Yksisuuntainen. 
- Aseta 'route_info' tarkkaan muotoon: "Yhdensuuntainen: [Mistä] - [Mihin]". (Älä ikinä käytä sanaa meno-paluu tälle kuitille!).
- Aseta 'departure_time': "${firstDepartureTime}"
- Lisää 'smartTags'-taulukkoon tagi "Yhdensuuntainen ➡️".
`;
                console.log(`[Ticket Parser] Löydettiin 1 OnniBus-matka: ${firstDepartureTime}`);
            
            } else if (matches.length > 1) {
                const [ , rDD, rMM, rYY, rHH, rmm ] = matches[1];
                const returnTime = `20${rYY}-${rMM}-${rDD}T${rHH}:${rmm}:00`;
                
                deterministicFacts += `
!!! HUOMIO: OHJELMALLISESTI VAHVISTETUT FAKTAT !!!
Tietokone on lukenut kuitista USEAMMAN viivakoodin, joten kyseessä on MENOPALUU. Noudata EHDOTTOMASTI näitä ohjeita:
- Aseta 'route_info' tarkkaan muotoon: "Meno-paluu: [Mistä] - [Mihin]"
- Aseta 'departure_time' ensimmäisen matkan ajaksi: "${firstDepartureTime}"
- Toisen matkan (paluu) aika on: "${returnTime}" (käytä tätä ostoennakon arvioinnissa, mutta tallenna departure_timeen vain eka).
- Varmista, että etsit 'total_price' kenttään KOKO KUITIN KOKONAISSUMMAN, ei vain yhtä matkaa.
- Lisää 'smartTags'-taulukkoon tagit "Meno-paluu 🔄" ja "OnniBus 🚌".
`;
                console.log(`[Ticket Parser] Löydettiin Menopaluu! Meno: ${firstDepartureTime}, Paluu: ${returnTime}`);
            }
        }
    }

    // 2. KORSISAARI / PAIKALLISLIIKENNE -LOGIIKKA
    if (isKorsisaari) {
        deterministicFacts += `
!!! HUOMIO PAIKALLISLIIKENTEESTÄ !!!
Kyseessä on paikallisliikenteen kuitti (Korsisaari / PayiQ). Noudata näitä ohjeita:
1. Koska kertalipuissa ei lue erikseen lähtöaikaa tulevaisuudessa, aseta 'departure_time' samaksi kuin kuitin ostoaika: "${emailReceivedAt}".
2. Etsi kokonaishinta (total_price) sanojen "Yhteensä", "Loppusumma" tai "Hinta" läheisyydestä.
3. ÄLYKÄS TAGI (TÄRKEÄ): Jos kuitin loppusumma on suuri (esim. yli 40€) TAI tekstissä mainitaan sana "kausilippu" tai "30", lisää EHDOTTOMASTI 'smartTags'-listaan tagi "Kausilippu 🎫".
`;
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
            anomalyInfo: { type: SchemaType.STRING, nullable: true, description: "Lyhyt selitys, jos havaitsit poikkeavuuden. Jos kaikki kunnossa, aseta null." }
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
2. Päättele reitti (Mistä - Mihin), tai tottele vahvistettuja faktoja jos niitä yllä annettiin.
3. Laske ostoennakko (leadTimeHours) sähköpostin saapumisajan ja matkan lähtöajan välillä.
4. Luo älykkäät tagit faktojen ja sisällön pohjalta.
5. Palauta vastaus tiukasti JSON-skeeman mukaisesti.
    `;

    console.log("[Ticket Parser] Lähetetään teksti Geminille analysoitavaksi...");
    const result = await generateWithFallback(prompt, ticketSchema);
    
    return result;
};