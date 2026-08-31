const { generateWithFallback, SchemaType } = require('./utils/aiRouter');
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
        const { ammatit, taidot, luvat } = JSON.parse(event.body);

        // Varmistetaan, että jokin syöte löytyy
        if (!ammatit && !taidot && !luvat) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte puuttuu' }) };
        }

        // Rakennetaan Prompt yhdistämällä globaali persoona ja tämä spesifi tehtävä
        const prompt = `${SYSTEM_PERSONA}

        TEHTÄVÄ: 
        Tehtäväsi on laatia asiakkaalle nimetön, lyhyt ja myyvä esittelyteksti Työmarkkinatorin työnhakuprofiiliin. 
        Koska teksti julkaistaan asiakkaan profiilissa, KIRJOITA TEKSTI ASIAKKAAN NÄKÖKULMASTA (Minä-muodossa: "Olen...", "Osaan...").

        LÄHTÖTiedot (Käytä vain näitä, älä keksi asioita):
        - Ammatit (ESCO): ${ammatit || 'Ei määritelty'}
        - Erityisosaaminen: ${taidot || 'Ei määritelty'}
        - Kortit ja Luvat: ${luvat || 'Ei määritelty'}

        SÄÄNNÖT:
        1. ANONYMITEETTI: Tekstissä ei saa olla nimiä, työnantajia, oppilaitoksia tai tarkkoja paikkakuntia.
        2. PITUUS: Kirjoita tiivis, 3-4 virkkeen pituinen energinen myyntipuhe työnantajalle.
        3. FAKTAPOHJA: Sisällytä tekstiin asiakkaan vahvuudet (taidot ja luvat) luontevasti.
        `;

        // Määritellään palautettavan datan rakenne
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                otsikko: { 
                    type: SchemaType.STRING, 
                    description: "Napakka, työnantajan huomion herättävä otsikko (max 6 sanaa, esim. 'Monipuolinen ja luotettava logistiikka-alan ammattilainen')." 
                },
                esittelyteksti: { 
                    type: SchemaType.STRING, 
                    description: "Varsinainen myyntipuhe (minä-muodossa), pituus 3-4 virkettä." 
                },
                avainsanat: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Poimi tekstistä 3-5 parasta hakusanaa tai taitoa erilliseksi listaksi."
                }
            },
            required: ["otsikko", "esittelyteksti", "avainsanat"]
        };

        // Kutsutaan AI-reititintä
        const aiData = await generateWithFallback(prompt, schema);
        
        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("Profiilin generoinnin virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Generointi epäonnistui' }) };
    }
};