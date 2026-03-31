// --- netlify/functions/extract_service.js ---
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
        const { mode, aiInput, knownCategories, knownTriggers } = JSON.parse(event.body);
        
        if (!aiInput) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte on pakollinen' }) };

        // --- UUSI: Muutetaan objektit tekoälylle ymmärrettäväksi tekstiksi ---
        const triggersContext = knownTriggers.map(t => 
            `- AVAIN: "${t.keyword}" | NIMI: "${t.label}" | KUVAUS: "${t.description}"`
        ).join('\n');
        // ----------------------------------------------------------------------

        let prompt = "";

        if (mode === 'url') {
            prompt = `Lue seuraavan verkkosivun sisältö ja poimi tiedot: ${aiInput}. 
            TÄMÄ ON NORMAALI TYÖLLISYYSPALVELU. Älä etsi URA-numeroita. Älä keksi hakuajan päättymistä, jos sitä ei suoraan lue.
            Yritä päätellä, mihin ammattiin tämä palvelu tähtää.`;
        } else {
            prompt = `Lue seuraava Työmarkkinatorilta kopioitu teksti ja poimi tiedot.
            TEKSTI:
            ${aiInput.substring(0, 15000)}
            
            TÄMÄ ON TYÖVOIMAKOULUTUS (TVM). Etsi huolellisesti URA-numero tai Kurssitunnus. 
            OLE ÄÄRIMMÄISEN TARKKA PÄIVÄMÄÄRIEN KANSSA: Erota 'hakuajan päättyminen' (Haku avoinna) ja koko 'koulutuksen päättyminen' (Kesto) toisistaan! Ota vain hakuajan loppumispäivä.
            Etsi tekstistä kohta 'Ammattiryhmät' tai 'Ammatit ja osaamiset' ja poimi sieltä koulutuksen tavoiteammatti.`;
        }

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING, description: "Palvelun tai koulutuksen virallinen nimi." },
                category: { type: SchemaType.STRING, description: `Paras kategoria näistä: ${knownCategories.join(', ')}.` },
                description: { type: SchemaType.STRING, description: "Laaja kuvaus asiantuntijalle. JAA KAHTEEN OSAAN: Kirjoita ensin selkeä tiivistelmä. Lisää otsikko 'Vaatimukset ja kohderyhmä:', jonka alle listaat ehdot." },
                plan_text: { type: SchemaType.STRING, description: "Asiakkaan viralliseen asiakirjaan tulostuva teksti. JOS kyseessä on Työvoimakoulutus, sisällytä tekstiin myös URA-numero." },
                
                // --- KORJATTU TRIGGERS-SÄÄNTÖ ---
                triggers: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Lue alla oleva sallittujen signaalien lista tarkasti. Valitse tekstin perusteella parhaiten sopivat signaalit. Palauta VAIN signaalin 'AVAIN' (keyword). Älä palauta nimeä tai kuvausta.\n\nSALLITUT SIGNAALIT:\n${triggersContext}` 
                },
                // --------------------------------
                
                language_req: { type: SchemaType.STRING, description: "Vaadittu suomen kielen taito CEFR-asteikolla (esim. B1.1)." },
                brochure_url: { type: SchemaType.STRING, description: "Linkki ladattavaan suomenkieliseen esitteeseen." },
                provider: { type: SchemaType.STRING, description: "Koulutuksen tai palvelun järjestäjä (oppilaitos tai yritys)." },
                ura_number: { type: SchemaType.STRING, description: "TE-hallinnon virallinen koulutusnumero (esim. '712345'). Palauta tyhjä jos normaali palvelu." },
                start_date: { type: SchemaType.STRING, description: "Alkamisaika." },
                enrollment_deadline: { 
                    type: SchemaType.STRING, 
                    description: "Hakuaika päättyy. Palauta EHDOTTOMASTI muodossa VVVV-KK-PP (esim. '2026-04-30'). Älä palauta kellonaikoja." 
                },
                esco_title: { 
                    type: SchemaType.STRING, 
                    description: "Ammatin tai ammattiryhmän nimi, johon tämä tähtää (esim. 'Ohjelmistokehittäjä', 'Lähihoitaja'). Palauta vain yksi selkeä ammattinimike ilman lisätekstejä. Jos ei löydy, palauta tyhjä merkkijono." 
                }
            },
            required: ["title", "category", "description", "plan_text", "triggers", "language_req", "brochure_url", "provider", "ura_number", "start_date", "enrollment_deadline", "esco_title"]
        };

        const aiData = await generateWithFallback(prompt, schema);

        // Pakotetaan tyyppi täysin Frontin kytkimen perusteella!
        aiData.service_type = mode === 'text' ? 'koulutus' : 'palvelu';
        if (mode === 'url') aiData.ura_number = '';

        // --- ESCO API:N AUTOMAATTINEN HAKU (Konepellin alla) ---
        aiData.esco_uri = ''; 

        if (aiData.esco_title) {
            try {
                console.log(`🔍 Etsitään ESCO-rajapinnasta ammattia tekoälyn sanalla: "${aiData.esco_title}"`);
                const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(aiData.esco_title)}&language=fi&type=occupation`);
                const escoJson = await escoRes.json();
                
                if (escoJson._embedded && escoJson._embedded.results && escoJson._embedded.results.length > 0) {
                    const bestMatch = escoJson._embedded.results[0];
                    console.log(`✅ Virallinen ESCO-ammatti löytyi: ${bestMatch.title}`);
                    aiData.esco_title = bestMatch.title;
                    aiData.esco_uri = bestMatch.uri;
                } else {
                    console.log(`⚠️ ESCO-osumaa ei löytynyt, jätetään tyhjäksi.`);
                    aiData.esco_title = ''; 
                }
            } catch (e) {
                console.error("ESCO API taustahaun virhe:", e);
                aiData.esco_title = '';
            }
        }

        console.log(`🐝 AI DATA RAW (Mode: ${mode}):`, JSON.stringify(aiData, null, 2));

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("AI-haun virhe:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sisällön louhinta epäonnistui', details: error.message }) };
    }
};