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
        console.log("\n==================================================");
        console.log("🚀 [AI-EXTRACT] UUSI LOUHINTAPYYNTÖ VASTAANOTETTU");
        console.log("==================================================");

        const { mode, aiInput, knownCategories, knownTriggers } = JSON.parse(event.body);
        
        if (!aiInput) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Syöte on pakollinen' }) };

        console.log(`📌 MODE: ${mode}`);
        console.log(`📄 RAAKASYÖTE (Ensimmäiset 500 merkkiä):\n${aiInput.substring(0, 500)}...\n`);

        const triggersContext = knownTriggers.map(t => 
            `- AVAIN: "${t.keyword}" | NIMI: "${t.label}" | KUVAUS: "${t.description}"`
        ).join('\n');

        let prompt = "";

        // ANTI-HALLUSINOINTI LISÄTTY PROMPTEIHIN
        if (mode === 'url') {
            prompt = `Lue seuraavan verkkosivun sisältö ja poimi työllisyyspalvelun tiedot: ${aiInput}. 
            TÄMÄ ON TYÖLLISYYSPALVELU.
            
            EHDOTTOMAT SÄÄNNÖT:
            1. Pysy tiukasti tekstissä. Älä keksi tai hallusinoi mitään tietoa.
            2. Älä keksi URA-numeroita.
            3. Älä keksi hakuajan päättymistä. Jos sitä ei mainita, palauta tyhjä merkkijono.
            4. Määritä tekstin perusteella, onko palvelu velvoittava (hard_service) tai vaatiiko se asiantuntijan tekemän syvällisen lähetteen (requires_referral) esimerkiksi psykologille tai terveydenhuoltoon.`;
        } else {
            prompt = `Lue seuraava Työmarkkinatorilta kopioitu teksti ja poimi tiedot.
            TEKSTI:
            ${aiInput.substring(0, 15000)}
            
            TÄMÄ ON TYÖVOIMAKOULUTUS (TVM).
            
            EHDOTTOMAT SÄÄNNÖT:
            1. Pysy tiukasti tekstissä. Älä keksi tai hallusinoi mitään tietoa.
            2. Etsi huolellisesti URA-numero. Jos sitä ei löydy, palauta tyhjä.
            3. OLE TARKKA PÄIVÄMÄÄRIEN KANSSA. Erota 'haku päättyy' ja 'koulutus päättyy' toisistaan. Jos et ole varma, jätä tyhjäksi.
            4. Etsi koulutuksen tavoiteammatti (ESCO). Älä arvaile yleisiä termejä, vaan poimi tekstin 'Ammattiryhmät' -kohdasta.`;
        }

        prompt += `\n\nLUO LISÄKSI 'meta'-objekti. 
        1. Etsi tekstistä alkuperäinen palvelukategoria (esim. 'Sosiaalipalvelut', 'Työllisyyspalvelut') ja lisää se 'meta'-objektiin avaimella 'original_source_category'.
        2. Keksi muita englanninkielisiä avain-arvo -pareja (boolean tai string) tekstissä havaitsemistasi ERIKOISVAATIMUKSISTA. 
        Esimerkkejä:
        - "requires_own_laptop": true
        - "remote_only": true
        - "supports_interpreter": true
        - "voluntary_only": true
        - "referral_recipient": "SOTE" (kenelle lähete menee)`;

        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING, description: "Palvelun tai koulutuksen virallinen nimi." },
                category: { type: SchemaType.STRING, description: `Paras kategoria näistä: ${knownCategories.join(', ')}.` },
                description: { type: SchemaType.STRING, description: "Laaja kuvaus asiantuntijalle. Jaa kahteen osaan: Tiivistelmä, sitten 'Vaatimukset ja kohderyhmä:'." },
                plan_text: { type: SchemaType.STRING, description: "Asiakkaan asiakirjaan tulostuva juridinen teksti." },
                triggers: { 
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: `Valitse tekstin perusteella parhaiten sopivat signaalit. Palauta VAIN signaalin 'AVAIN'.\nSALLITUT SIGNAALIT:\n${triggersContext}` 
                },
                language_req: { type: SchemaType.STRING, description: "Vaadittu suomen kielen taito CEFR-asteikolla (esim. B1.1)." },
                brochure_url: { type: SchemaType.STRING, description: "Linkki esitteeseen." },
                provider: { type: SchemaType.STRING, description: "Järjestäjä." },
                ura_number: { type: SchemaType.STRING, description: "TE-hallinnon numero. Tyhjä jos ei ole." },
                start_date: { type: SchemaType.STRING, description: "Alkamisaika." },
                enrollment_deadline: { type: SchemaType.STRING, description: "Hakuaika päättyy (VVVV-KK-PP)." },
                esco_title: { type: SchemaType.STRING, description: "Tavoiteammatti tai tyhjä." },
                hard_service: { type: SchemaType.BOOLEAN, description: "Onko velvoittava työllisyyspalvelu?" },
                requires_referral: { type: SchemaType.BOOLEAN, description: "Vaatiiko lähetteen?" },
                // --- TÄMÄ MUUTOS PAKOTTAA TEKOÄLYN POIMIMAAN TIEDON ---
                meta: { 
                    type: SchemaType.OBJECT, 
                    properties: {
                        original_source_category: { type: SchemaType.STRING, description: "Alkuperäinen palvelukategoria tekstistä (esim. 'Sosiaalipalvelut')." },
                        referral_recipient: { type: SchemaType.STRING, description: "Kenelle lähete ohjautuu (jos requires_referral on true)." }
                    },
                    required: ["original_source_category"] // Asetetaan alkuperäinen kategoria pakolliseksi
                }
            },
            required: ["title", "category", "description", "plan_text", "triggers", "language_req", "provider", "hard_service", "requires_referral", "meta"]
        };

        console.log("🤖 Kysytään tekoälyltä (Router)...");
        const aiData = await generateWithFallback(prompt, schema);

        console.log("\n--- 🧠 TEKOÄLYN RAAKA PALAUTUS ---");
        console.log(JSON.stringify(aiData, null, 2));
        console.log("----------------------------------\n");

        // -------------------------------------------------------------
        // KÄSITTELY JA SUODATUS
        // -------------------------------------------------------------
        console.log("⚙️  Ajetaan liiketoimintasäännöt ja suodatukset...");

        // Pakotetaan turvasäännöt Työvoimakoulutuksille (TVM)
        if (mode === 'text') {
            aiData.service_type = 'koulutus';
            aiData.hard_service = false; 
            aiData.requires_referral = false; 
            console.log("   🛡️ TVM-säännöt pakotettu: hard_service ja requires_referral on false.");
        } else {
            aiData.service_type = 'palvelu';
            aiData.ura_number = '';
        }

        // ESCO API -haku
        aiData.esco_uri = ''; 
        if (aiData.esco_title) {
            try {
                console.log(`   🔍 Etsitään ESCO-koodia ammatille: "${aiData.esco_title}"`);
                const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(aiData.esco_title)}&language=fi&type=occupation`);
                const escoJson = await escoRes.json();
                if (escoJson._embedded && escoJson._embedded.results && escoJson._embedded.results.length > 0) {
                    aiData.esco_title = escoJson._embedded.results[0].title;
                    aiData.esco_uri = escoJson._embedded.results[0].uri;
                    console.log(`   ✅ ESCO osuma: ${aiData.esco_title} (${aiData.esco_uri})`);
                } else {
                    console.log(`   ⚠️ Ei ESCO osumaa ammatille "${aiData.esco_title}". Tyhjennetään.`);
                    aiData.esco_title = ''; 
                }
            } catch (e) {
                console.log("   ❌ ESCO API virhe. Tyhjennetään esco_title.");
                aiData.esco_title = '';
            }
        }

        console.log("\n==================================================");
        console.log("📦 [AI-EXTRACT] LOPULLINEN KÄSITELTY DATA FRONTILLE");
        console.log(JSON.stringify(aiData, null, 2));
        console.log("==================================================\n");

        return { statusCode: 200, headers, body: JSON.stringify(aiData) };

    } catch (error) {
        console.error("\n❌❌❌ KRIITTINEN VIRHE AI-HAUSSA ❌❌❌");
        console.error(error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sisällön louhinta epäonnistui', details: error.message }) };
    }
};