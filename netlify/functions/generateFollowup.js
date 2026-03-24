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
        const { customerName, planItems, obligationsCount, selectedSnippets } = JSON.parse(event.body);
        
        const sovitutAsiatText = planItems && planItems.length > 0
            ? planItems.join('\n- ')
            : 'Ei erillisiä toimenpiteitä kirjattu tällä kertaa.';

        const velvollisuusText = obligationsCount > 0
            ? `Sovimme, että haet ${obligationsCount} työpaikkaa kuukaudessa.`
            : 'Tällä hetkellä sinulla ei ole numeerista työnhakuvelvollisuutta.';

        const snippetsContext = selectedSnippets && selectedSnippets.length > 0
            ? selectedSnippets.map(s => `LINKIN NIMI: "${s.label}". LINKIN URL: "${s.url || 'Ei URLia'}". ASIANTUNTIJAN OHJE TEKOÄLYLLE: "${s.ai_description || ''}". LINKIN SISÄLTÖ: "${s.content}"`).join('\n\n')
            : 'Ei erillisiä linkkejä lisättäväksi.';

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
Kirjoita asiakkaalle ("${customerName}") lyhyt ja ytimekäs tapaamisen yhteenvetoviesti "Hampurilaismallin" mukaisesti:

1. LÄMMIN YLÄSÄMPYLÄ: Kiitä tapaamisesta.
2. PIHVI (Sovitut asiat): Tee näistä asioista selkeä To-Do -lista:\n- ${sovitutAsiatText}
3. MAUSTEET (Velvollisuudet & Hyväksyntä): Kerro työnhakuvelvollisuudesta: "${velvollisuusText}". Muistuta jämäkästi, että suunnitelma pitää käydä hyväksymässä Oma asiointi -palvelussa, jotta työttömyysturvaan ei tule katkoksia.
4. RANSKALAISET (Linkit): Upota nämä linkit viestiin. Perustele lyhyesti niiden hyöty asiakkaalle ohjeen pohjalta. Datat: \n${snippetsContext}
5. TUKEVA ALASÄMPYLÄ: Päätä viesti tsemppaavasti ja muistuta, että olet tukena.`;

        const aiData = await generateWithFallback(prompt, schema);

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Sähköpostin generointivirhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sähköpostin luonti epäonnistui' }) };
    }
};