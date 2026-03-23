const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    // CORS-otsikot (sallii pyynnöt frontendistäsi)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Alustetaan malli tiukoilla reunaehdoilla!
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: "Olet Helsingin työllisyyspalveluiden asiantuntija. Kirjoita annetuista avainsanoista tai ohjeesta selkeä, ystävällinen ja asiallinen viranomaisviestin ydin. ÄLÄ lisää viestiin alkutervehdystä (kuten 'Hei asiakas') tai lopputervehdystä (kuten 'Ystävällisin terveisin'). Palauta vain varsinainen viestin asiasisältö."
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ text: text.trim() }) 
        };
    } catch (error) {
        console.error("Gemini Error:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: 'Tekoäly ei vastannut pyyntöön.' }) 
        };
    }
};