// src/utils/newScraper.js

/**
 * VAIHE 1: Älykäs Tiedonlouhija
 * Jäsentää tekstin osioihin ja yrittää tunnistaa yleisimmät vakiolauseet.
 * Käsittelee tekstin vain kerran alusta loppuun.
 */
function scrapeStructuredData(text) {
    const scrapedData = {};
    const fullText = `\n${text}\n`;

    const sectionMapping = {
        'SUUNNITELMAN PERUSTIEDOT': 'suunnitelman_perustiedot',
        'ASIAKKAAN TYÖTILANNE': 'tyotilanne',
        'KOULUTUS JA YRITTÄJYYS': 'koulutus_yrittajyys',
        'TYÖKYKY': 'tyokyky',
        'SUUNNITELMA': 'suunnitelma',
    };
    
    const headers = Object.keys(sectionMapping);
    // Luodaan yksi iso regex, joka osaa tunnistaa kaikki mahdolliset otsikot.
    const splitRegex = new RegExp(`(\\*\\*(${headers.join('|')})\\*\\*|(${headers.join('|')}))`, 'gi');
    
    // Pilkotaan koko teksti osiin otsikoiden perusteella.
    const parts = fullText.split(splitRegex).filter(p => p && p.trim() !== '');

    let currentSectionKey = null;

    for (const part of parts) {
        const trimmedPart = part.trim();
        const headerMatch = headers.find(h => h === trimmedPart.replace(/\*/g, ''));

        if (headerMatch) {
            // Löydettiin uusi otsikko, asetetaan se nykyiseksi osioksi.
            currentSectionKey = sectionMapping[headerMatch];
            if (!scrapedData[currentSectionKey]) {
                scrapedData[currentSectionKey] = { strukturoitu: [], vapaa_teksti: '' };
            }
        } else if (currentSectionKey) {
            // Tämä osa on sisältöä, joka kuuluu edelliseen otsikkoon.
            scrapedData[currentSectionKey].vapaa_teksti += (scrapedData[currentSectionKey].vapaa_teksti ? '\n' : '') + trimmedPart;
        }
    }

    // FALLBACK: Jos mitään osioita ei löytynyt, palauta koko teksti.
    if (Object.keys(scrapedData).length === 0) {
        return { koko_teksti: text.trim() };
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
        // [PÄIVÄMÄÄRÄ] poistettu anonymisoinnista, koska se on hyödyllinen tekoälylle.
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
 * Rakentaa dynaamisesti oikeanlaiset ja tarkemmat ohjeet.
 */
function generateAIPrompt(anonymizedData) {
    let syotetiedotOsuus;

    if (anonymizedData.koko_teksti) {
        syotetiedotOsuus = `## Syötetiedot (Anonymisoitu vapaa teksti)\n\nAnalysoi seuraava anonymisoitu tekstikokonaisuus:\n\n\`\`\`text\n${anonymizedData.koko_teksti}\n\`\`\``;
    } else {
        syotetiedotOsuus = `## Syötetiedot (Anonymisoitu JSON)\n\nAnalysoi seuraava JSON-objekti, joka on louhittu alkuperäisestä tekstistä:\n\n\`\`\`json\n${JSON.stringify(anonymizedData, null, 2)}\n\`\`\``;
    }

    return `## Rooli ja Tavoite

Olet asiantuntija-avustaja, jonka tehtävä on muuntaa asiakassuunnitelman teksti täysin koneluettavaksi ja rakenteelliseksi JSON-objektiksi. Tavoitteesi on luokitella, jaotella ja yhtenäistää alla oleva anonymisoitu data, ja tuottaa lopputulos tarkasti määritellyssä muodossa.

---

${syotetiedotOsuus}

---

## Tehtävänanto

1.  **Analysoi syötetiedot:** Käy läpi yllä annettu data huolellisesti.
2.  **Päättele ja luokittele:** Tee tekstin perusteella loogisia johtopäätöksiä.
3.  **Louhi muuttujat:** Tunnista tekstistä tarkat tiedot, kuten päivämäärät ja syntymävuodet, ja sijoita ne oikeisiin muuttujiin tulosformaatissa.
4.  **Siirrä ja muokkaa kieliasu:** Siirrä kaikki vapaan tekstin osat oikeisiin kenttiin (\`lisatiedot\`, \`alentumaKuvaus\`, \`koonti\`). Samalla kun siirrät tekstin, muokkaa sen kieliasu neutraaliksi ja ammattimaiseksi käyttäen asiakas-passiivia.
5.  **Täytä tulosformaatti:** Rakenna lopputulos noudattaen TÄSMÄLLEEN alla annettua \`## Tulosformaatti\` -rakennetta.

---

## Tulosformaatti (Pakollinen)

Vastauksesi TÄYTYY olla VAIN ja AINOASTAAN alla kuvatun muotoinen JSON-objekti. Älä lisää mitään selityksiä ennen tai jälkeen JSON-koodin.

\`\`\`json
{
  "suunnitelman_perustiedot": {
    "valinnat": {
      "syntymavuosi": {
        "SYNTYMÄVUOSI": 1980
      },
      "tyonhaku_alkanut": {
        "PÄIVÄMÄÄRÄ": "1.1.2025"
      }
    },
    "lisatiedot": "Kaikki muu perustietoihin liittyvä vapaa teksti."
  },
  "tyotilanne": {
    "valinnat": ["avainsana1"],
    "lisatiedot": "Kaikki työtilanteeseen liittyvä vapaa teksti."
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
    "alentumaKuvaus": "Lauseet, jotka kuvailevat työkykyä alentavia tekijöitä.",
    "koonti": "Muut työkykyyn liittyvät havainnot.",
    "omaArvio": 8
  }
}
\`\`\`

---

## Rajoitteet ja Säännöt

* **VAIN JSON:** Älä tuota mitään muuta kuin pyydetyn JSON-objektin.
* **SÄILYTÄ TIEDON SISÄLTÖ:** Voit muokata lauserakenteita, mutta älä muuta tekstin alkuperäistä tietosisältöä.
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