// --- netlify/functions/generateFollowup.js ---
const { generateWithFallback, SchemaType } = require('./utils/aiRouter');
// Tuodaan keskitetty persoona (olettaen, että tiedosto on samassa kansiossa)
const { SYSTEM_PERSONA } = require('./aiPersona');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        // UUSI LAYER: Otetaan vastaan sekä finalPlanText että meetingSummary (tapaamiskirjaus)
        const {
            customerName,
            planItems,
            obligationsCount,
            selectedSnippets,
            finalPlanText,
            meetingSummary
        } = JSON.parse(event.body);

        const cleanMeetingSummary = (meetingSummary || '').trim();
        
        const sovitutAsiatText = planItems && planItems.length > 0
            ? planItems.join('\n- ')
            : 'Ei erillisiä toimenpiteitä kirjattu tällä kertaa.';

        const velvollisuusText = obligationsCount > 0
            ? `Sovimme, että haet ${obligationsCount} työpaikkaa kuukaudessa.`
            : 'Tällä hetkellä sinulla ei ole numeerista työnhakuvelvollisuutta.';

        const snippetsContext = selectedSnippets && selectedSnippets.length > 0
            ? selectedSnippets.map(s => `LINKIN NIMI: "${s.label}". LINKIN URL: "${s.url || 'Ei URLia'}". ASIANTUNTIJAN OHJE TEKOÄLYLLE: "${s.ai_description || ''}". LINKIN SISÄLTÖ: "${s.content}"`).join('\n\n')
            : 'Ei erillisiä linkkejä lisättäväksi.';

        // UUSI: Tapaamiskirjaus ensisijaisena, asiakasystävällisenä yhteenvetona tapaamisesta
        const tapaamiskirjausKonteksti = cleanMeetingSummary
            ? `\nTÄSSÄ ON ASIANTUNTIJAN LAATIMA TAPAAMISKIRJAUS (ENSISIJAINEN LÄHDE):\n"""\n${cleanMeetingSummary}\n"""\nKäännä tämä asiakaspassiivista luontevaksi, ystävälliseksi sinutteluksi (esim. "Asiakas hakee itsenäisesti..." -> "Haet itsenäisesti...", "Asiakas ohjataan..." -> "Ohjaan sinut..."). Säilytä tarkasti tieto siitä, mihin asiakas hakee itse ja mihin hänet ohjataan, sekä mahdolliset hakuajat.`
            : '';

        // Virallinen suunnitelmateksti mukana taustatietona (tai pääasiallisena lähteenä, jos tapaamiskirjausta ei ole)
        const suunnitelmaKonteksti = finalPlanText
            ? `\nTÄSSÄ ON ASIAKKAAN KANSSA SOVITTU VIRALLINEN SUUNNITELMATEKSTI:\n"""\n${finalPlanText}\n"""\n${
                cleanMeetingSummary
                    ? 'Käytä tätä täydentävänä taustatietona (esim. yksityiskohdat ja aikataulut), mutta älä kopioi raskasta viranomaisjargonia, pykäläviittauksia tai lähetemainintoja sähköpostiin.'
                    : 'Käytä tätä tekstiä pääasiallisena lähteenä, kun tiivistät asiakkaalle, mitä olette sopineet.'
            }`
            : '';

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                followupEmailHtml: {
                    type: SchemaType.STRING,
                    description: "Sähköposti HTML-muodossa. Käytä <p>, <ul>, <li>, <strong>. TEE LINKEISTÄ KLIKATTAVIA: <a href='url'>Linkin nimi</a>."
                },
                followupEmailText: {
                    type: SchemaType.STRING,
                    description: "Sama sähköposti pelkkänä raakatekstinä ilman HTML-tägejä."
                }
            },
            required: ["followupEmailHtml", "followupEmailText"]
        };

        // Yhdistetään Master Persoona ja tilannekohtainen tehtävänanto
        const prompt = `${SYSTEM_PERSONA}

TEHTÄVÄ:
Kirjoita asiakkaalle ("${customerName}") lyhyt, lämmin ja ytimekäs tapaamisen yhteenvetoviesti "Hampurilaismallin" mukaisesti.${tapaamiskirjausKonteksti}${suunnitelmaKonteksti}

KIELIHUOLTO JA SÄVY:
- Kirjoita luontevaa, selkeää ja kieliopillisesti moitteetonta suomea.
- Sinuttele asiakasta ystävällisesti ja kunnioittavasti.
- Vältä kapulakieltä, turhaa toistoa sekä sisäisiä hallintotermejä (älä mainitse lähetteitä, sisäisiä tunnisteita tai lakipykäliä).
- Jos tapaamiskirjaus ja suunnitelmateksti mainitsevat samoja asioita, yhdistä ne sujuvasti yhdeksi selkeäksi kokonaisuudeksi toistamatta samaa asiaa kahteen kertaan.

VIESTIN RAKENNE:
1. LÄMMIN YLÄSÄMPYLÄ: Kiitä tapaamisesta ja mainitse lyhyesti, että työllistymissuunnitelma on nyt päivitetty.
2. PIHVI (Sovitut asiat): Tee sovituista asioista asiakkaalle selkeä, konkreettinen ja ystävällinen To-Do -lista hyödyntäen yllä annettua tapaamiskirjausta, suunnitelmatekstiä sekä näitä valittuja kohteita:\n- ${sovitutAsiatText}
   Erottele selkeästi, mitä asiakas tekee itse (esim. koulutukseen hakeminen ja hakuaika) ja missä asioissa hänet ohjataan eteenpäin.
3. MAUSTEET (Velvollisuudet & Hyväksyntä): Kerro työnhakuvelvollisuudesta: "${velvollisuusText}". Muistuta selkeästi ja ystävällisen jämäkästi, että suunnitelma kannattaa käydä hyväksymässä Oma asiointi -palvelussa, jotta työttömyysturvaan ei tule katkoksia.
4. RANSKALAISET (Linkit): Upota nämä linkit luontevasti viestiin. Perustele lyhyesti niiden hyöty asiakkaalle ohjeen pohjalta. Datat: \n${snippetsContext}
5. TUKEVA ALASÄMPYLÄ: Päätä viesti tsemppaavasti ja muistuta, että olet tukena.`;

        const aiData = await generateWithFallback(prompt, schema);

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Sähköpostin generointivirhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sähköpostin luonti epäonnistui' }) };
    }
};