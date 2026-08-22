import { schedule } from '@netlify/functions';
import { handler as fetchTicketsHandler } from './fetch-tickets.js';

const CRON_SCHEDULE = '0 19 * * 0,3';

const cronHandler = async (event, context) => {
    console.log("⏰ CRON-AJASTIN KÄYNNISTYI! (Ke/Su klo 22:00)");
    
    try {
        // KORJAUS 1: Huijatussa tapahtumassa on nyt tyhjät headerit ja body
        // siltä varalta, että fetchTicketsHandler vaatii niiden olemassaoloa.
        const mockEvent = { 
            httpMethod: 'POST',
            headers: {},
            body: JSON.stringify({})
        };
        
        // KORJAUS 2: Välitetään molemmat parametrit (event ja context)
        const response = await fetchTicketsHandler(mockEvent, context);
        
        console.log("✅ CRON-ajo suoritettu onnistuneesti!");
        console.log("Tulos:", response ? response.body : "Ei paluuarvoa");
        
        // KORJAUS 3: Pieni body varmuuden vuoksi
        return { 
            statusCode: 200,
            body: "CRON-ajo OK"
        };
        
    } catch (error) {
        console.error("❌ CRON-ajossa tapahtui virhe:", error);
        return { 
            statusCode: 500,
            body: "Virhe ajossa"
        };
    }
};

export const handler = schedule(CRON_SCHEDULE, cronHandler);