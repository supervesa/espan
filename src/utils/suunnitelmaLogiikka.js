import { SUUNNITELMA_SAANNOT } from '../data/constants';

/**
 * Rakentaa dynaamisen suunnitelmatekstin annettujen sääntöjen ja sovelluksen tilan perusteella.
 * * @param {object} state - Koko sovelluksen tilaobjekti.
 * @returns {string | null} Palauttaa valmiiksi muotoillun suunnitelmatekstin yhtenä merkkijonona
 * tai null, jos mikään sääntö ei täyty.
 */
export const rakennaSuunnitelmaTeksti = (state) => {
    // Varmistetaan, että state on olemassa.
    if (!state) {
        return null;
    }

    // Käydään läpi kaikki SUUNNITELMA_SAANNOT-listan säännöt.
    // Käytetään .map-funktiota ja suodatetaan tyhjät pois, jotta järjestys säilyy.
    const planParts = SUUNNITELMA_SAANNOT
        .map(rule => {
            // Tarkistetaan, täyttyykö säännön ehto.
            if (rule.ehto(state)) {
                // Jos ehto täyttyy, suoritetaan tekstin luova funktio.
                const textPart = rule.teksti(state);
                // Varmistetaan, ettei lisätä tyhjiä tai null-arvoja.
                if (textPart) {
                    return textPart;
                }
            }
            return null; // Palautetaan null, jos ehto ei täyty.
        })
        .filter(Boolean); // Poistetaan kaikki null-arvot listasta.

    // Jos yhtään osaa ei luotu, palautetaan null.
    if (planParts.length === 0) {
        return null;
    }

    // Yhdistetään kaikki osat yhdeksi tekstikappaleeksi,
    // eroteltuna kahdella rivinvaihdolla (luo tyhjän rivin väliin).
    return planParts.join('\n\n');
};