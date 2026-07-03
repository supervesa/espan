import { schedule } from '@netlify/functions';
import { handler as fetchTicketsHandler } from './fetch-tickets.js';

// CRON-aikataulu: "0 19 * * 0,3"
// 0 = tasatunti
// 19 = klo 19:00 UTC-aikaa (Klo 22:00 Suomen kesäaikaa)
// * = joka päivä kuukaudesta
// * = joka kuukausi
// 0,3 = Sunnuntai (0) ja Keskiviikko (3)
const CRON_SCHEDULE = '0 19 * * 0,3';

const cronHandler = async (event, context) => {
    console.log("⏰ CRON-AJASTIN KÄYNNISTYI! (Ke/Su klo 22:00)");
    
    try {
        // Kutsutaan olemassa olevaa funktiota ja huijataan se luulemaan, 
        // että joku painoi käyttöliittymän POST-nappia.
        const mockEvent = { httpMethod: 'POST' };
        
        const response = await fetchTicketsHandler(mockEvent);
        
        console.log("✅ CRON-ajo suoritettu onnistuneesti!");
        console.log("Tulos:", response.body);
        
        return { statusCode: 200 };
    } catch (error) {
        console.error("❌ CRON-ajossa tapahtui virhe:", error);
        return { statusCode: 500 };
    }
};

// Netlify vaatii tämän 'schedule'-kääreen ymmärtääkseen ajastuksen
export const handler = schedule(CRON_SCHEDULE, cronHandler);