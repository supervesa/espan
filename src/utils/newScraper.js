// src/utils/newScraper.js

/**
 * VAIHE 1: Älykäs Tiedonlouhija
 * Yrittää jäsentää tekstin osioihin. Jos epäonnistuu, palauttaa koko tekstin yhtenä lohkona.
 */
function scrapeStructuredData(text) {
    const scrapedData = {};
    const fullText = `\n${text}\n`;

    const sectionMapping = {
        'ASIAKKAAN TYÖTILANNE': 'tyotilanne',
        'KOULUTUS JA YRITTÄJYYS': 'koulutus_yrittajyys',
        'TYÖKYKY': 'tyokyky',
        'SUUNNITELMA': 'suunnitelma',
    };

    const headers = Object.keys(sectionMapping);
    let sectionsFound = 0;

    headers.forEach(header => {
        // Päivitetty Regex, joka etsii sekä **lihavoituja** että ISOILLA KIRJAIMILLA kirjoitettuja otsikoita.
        const sectionRegex = new RegExp(`(?:\\n${header}\\n|\\*\\*${header}\\*\\*)\\n?([\\s\\S]*?)(?=\\n(?:${headers.join('|')}|\\*\\*(?:${headers.join('|')})\\*\\*)\\n|$)`, 'gi');
        const sectionMatch = fullText.match(sectionRegex);

        if (sectionMatch) {
            sectionsFound++;
            const sectionKey = sectionMapping[header];
            // Otetaan talteen vain vapaa teksti yksinkertaisuuden vuoksi
            scrapedData[sectionKey] = { vapaa_teksti: sectionMatch[0].replace(new RegExp(`(?:\\n${header}\\n|\\*\\*${header}\\*\\*)\\n?`), '').trim() };
        }
    });

    // FALLBACK: Jos yhtään osiota ei löytynyt, palauta koko teksti yhtenä kenttänä.
    if (sectionsFound === 0) {
        return {
            koko_teksti: text.trim()
        };
    }

    return scrapedData;
}

/**
 * VAIHE 2: Automaattinen Anonymisoija
 * Käy läpi jäsennellyn JSON-objektin ja korvaa henkilötiedot.
 */
function anonymizeData(data) {
    const anonymizedData = JSON.parse(JSON.stringify(data));

    const piiRules = [
        { name: 'HETU', regex: /\b\d{6}[-A+]\d{3}[\w\d]\b/g, replacement: '[HETU]' },
        { name: 'PUHELIN', regex: /(\+358|0)\s?(\d{1,3})\s?(\d{5,8})\b/g, replacement: '[PUHELINNUMERO]' },
        { name: 'EMAIL', regex: /[\w.-]+@[\w.-]+\.\w{2,}/g, replacement: '[SÄHKÖPOSTI]' },
    ];

    function traverseAndAnonymize(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                piiRules.forEach(rule => {
                    obj[key] = obj[key].replace(rule.regex, rule.replacement);
                });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                traverseAndAnonymize(obj[key]);
            }
        }
    }
    traverseAndAnonymize(anonymizedData);
    return anonymizedData;
}

/**
 * VAIHE 3: Tekoäly-promptin generointi
 * Rakentaa dynaamisesti oikeanlaiset ohjeet datan rakenteen perusteella.
 */
function generateAIPrompt(anonymizedData) {
    let syotetiedotOsuus;

    // Tarkistetaan, onko data jäsennelty vai yhtenäinen tekstilohko.
    if (anonymizedData.koko_teksti) {
        syotetiedotOsuus = `## Syötetiedot (Anonymisoitu vapaa teksti)

Analysoi seuraava anonymisoitu tekstikokonaisuus:

\`\`\`text
${anonymizedData.koko_teksti}
\`\`\``;
    } else {
        syotetiedotOsuus = `## Syötetiedot (Anonymisoitu JSON)

Analysoi seuraava JSON-objekti, joka on louhittu alkuperäisestä tekstistä:

\`\`\`json
${JSON.stringify(anonymizedData, null, 2)}
\`\`\``;
    }

    // Palautetaan koko prompt-rakenne, jossa syötetiedot on dynaamisesti luotu.
    return `## Rooli ja Tavoite

Olet asiantuntija-avustaja, jonka tehtävä on muuntaa asiakassuunnitelman teksti täysin koneluettavaksi ja rakenteelliseksi JSON-objektiksi. Tavoitteesi on analysoida alla oleva anonymisoitu data ja tuottaa lopputulos tarkasti määritellyssä muodossa.

---

${syotetiedotOsuus}

---

## Tehtävänanto

1.  **Analysoi syötetiedot:** Käy läpi yllä annettu data huolellisesti.
2.  **Päättele ja luokittele:** Tee tekstin perusteella loogisia johtopäätöksiä ja tunnista eri osioihin (kuten työkyky, koulutus) liittyvät tiedot.
3.  **Muokkaa kieliasia:** Muokkaa kieliasua yhtenäiseksi, ja käytä asiakas-passiivia.
4.  **Täytä tulosformaatti:** Rakenna lopputulos noudattaen TÄSMÄLLEEN alla annettua \`## Tulosformaatti\` -rakennetta.

---

## Tulosformaatti (Pakollinen)

Vastauksesi TÄYTYY olla VAIN ja AINOASTAAN alla kuvatun muotoinen JSON-objekti. Älä lisää mitään selityksiä ennen tai jälkeen JSON-koodin.

\`\`\`json
{
  "suunnitelman_perustiedot": {
    "valinnat": {},
    "lisatiedot": null
  },
  "tyotilanne": {
    "valinnat": ["avainsana1"],
    "lisatiedot": "Kaikki vapaa teksti, joka ei sovi mihinkään valintaan."
  },
  "koulutus_yrittajyys": {
    "valinnat": {
      "koulutus_tausta": {
        "KOULUTUS": "Filosofian maisteri, fysiikka",
        "VUOSI": "2007"
      }
    },
    "lisatiedot": "Muu vapaa teksti koulutuksesta."
  },
  "tyokyky": {
    "paavalinta": "tyokyky_selvityksessa",
    "alentumaKuvaus": "Tiivistelmä alentuman syistä, jos relevanttia.",
    "koonti": "Yleinen koonti keskustelusta ja muista havainnoista.",
    "omaArvio": "Minkä numeerisen arvon asiakas antanut asteikolla 1-10. Jos useampi numero, anna aina yksi numero ja valitse korkeampi arvoinen"
  }
}
\`\`\`

---

## Rajoitteet ja Säännöt

* **VAIN JSON:** Älä tuota mitään muuta kuin pyydetyn JSON-objektin.
* **NULL ARVOT:** Jos jollekin kentälle ei löydy tietoa, aseta sen arvoksi \`null\`.
* **SÄILYTÄ KIELI:** Pidä kaikki tekstit suomen kielellä.`;
}

/**
 * PÄÄFUNKTIO: Koko käsittelyputki
 */
export function processTextForAI(rawText) {
    const structuredData = scrapeStructuredData(rawText);
    const anonymizedData = anonymizeData(structuredData);
    const finalPrompt = generateAIPrompt(anonymizedData);
    return finalPrompt;
}