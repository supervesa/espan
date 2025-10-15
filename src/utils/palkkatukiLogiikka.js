import { TAYTTYVAT_EHODOT, PALKKATUKI_EHDOTUKSET, MUUT_SUOSITUKSET } from '../data/constants';

/**
 * Apufunktio, joka tarkistaa, kuuluuko asiakas ammatillisen osaamisen
 * parantamisen tai 100% tuen viiteen kohderyhmään.
 * Kotoutuja-statusta ei tällä hetkellä tarkisteta, koska tieto puuttuu datasta.
 * @param {object} data - Asiakkaan tiedot sisältävä objekti.
 * @returns {boolean} - Palauttaa true, jos asiakas kuuluu kohderyhmään.
 */
const kuuluuKohderyhmaan = (data) => {
    if (!data.onkoTyoton) {
        return false;
    }
    // Palautetaan suoraan ehtolausekkeen tulos. Tämä on syntaktisesti selkeä tapa.
    return (
        (data.age >= 15 && data.age < 25) || // alle 25-vuotias
        data.age >= 50 ||                     // yli 50-vuotias
        data.onkoEiTutkintoa ||               // ei toisen asteen tutkintoa
        data.eiAnsiotyossa6kk                 // ei ole ollut ansiotyössä 6kk aikana
    );
};

// Säännöt on määritelty prioriteettijärjestyksessä (tärkein ensin)
// vastaamaan toimitettuja ohjeita.
const saannot = [
    // 1. Alentunut työkyky (korkein prioriteetti, 70%)
    {
        ehto: (data) => data.tyokykyStatus.startsWith("Alentunut"),
        tulos: PALKKATUKI_EHDOTUKSET.ALENTUNUT_TYOKYKY,
    },
    // 2. 55v työllistämistuki (korkea tuki, 70%)
    {
        ehto: (data) => data.onkoTyoton && data.age >= 55 && data.tyottomyysKuukausia >= 24,
        tulos: PALKKATUKI_EHDOTUKSET.IAKAS_55_TUKI,
    },
    // 3. 100% tuki yhdistykselle (vaatii nyt kuulumisen kohderyhmään)
    {
        ehto: (data) => data.onkoTyoton && data.tyottomyysKuukausia >= 24 && data.tyonantaja_yhdistys && kuuluuKohderyhmaan(data),
        tulos: PALKKATUKI_EHDOTUKSET.YHDISTYS_100,
    },
    // 4. 60v pitkäaikaistyötön
    {
        ehto: (data) => data.onkoTyoton && data.age >= 60 && data.tyottomyysKuukausia >= 12,
        tulos: PALKKATUKI_EHDOTUKSET.IAKAS_60_PITKAAIKAINEN,
    },
    // 5. Oppisopimus
    {
        ehto: (data) => (data.onkoOppisopimus || data.onko_oppisopimus),
        tulos: PALKKATUKI_EHDOTUKSET.OPPISOPIMUS,
    },
    // 6. Ammatillisen osaamisen parantaminen (yli 12kk työtön JA kuuluu kohderyhmään)
    {
        ehto: (data) => data.onkoTyoton && data.tyottomyysKuukausia >= 12 && kuuluuKohderyhmaan(data),
        tulos: PALKKATUKI_EHDOTUKSET.OSAAMISEN_PARANTAMINEN_10KK,
    },
    // 7. Ammatillisen osaamisen parantaminen (alle 12kk työtön JA kuuluu kohderyhmään)
    {
        ehto: (data) => data.onkoTyoton && data.tyottomyysKuukausia < 12 && data.tyottomyysKuukausia !== null && kuuluuKohderyhmaan(data),
        tulos: PALKKATUKI_EHDOTUKSET.OSAAMISEN_PARANTAMINEN_5KK,
    },
];

/**
 * Suorittaa palkkatukianalyysin asiakkaan tietojen perusteella.
 * @param {object} asiakasData - Asiakkaan tiedot.
 * @returns {object} - Objekti, joka sisältää täyttyneet ehdot ja lopullisen ehdotuksen.
 */
export const laskePalkkatukiAnalyysi = (asiakasData) => {
    const {
        age, tyottomyysKuukausia, tyokykyStatus, onkoTyoton,
        onkoEiTutkintoa, eiAnsiotyossa6kk, onkoOppisopimus, onko_oppisopimus
    } = asiakasData;

    // Kerää kaikki yksittäiset täyttyvät ehdot listaukseen näytettäväksi.
    const conditionsMet = [];
    if (onkoTyoton && age >= 15 && age < 25) conditionsMet.push(TAYTTYVAT_EHODOT.NUORI);
    if (onkoTyoton && age >= 50) conditionsMet.push(TAYTTYVAT_EHODOT.IAKAS_50);
    if (onkoTyoton && onkoEiTutkintoa) conditionsMet.push(TAYTTYVAT_EHODOT.EI_TUTKINTOA);
    if (onkoTyoton && eiAnsiotyossa6kk) conditionsMet.push(TAYTTYVAT_EHODOT.EI_ANSIOTYOSSA_6KK);
    if (tyokykyStatus.startsWith("Alentunut")) conditionsMet.push(TAYTTYVAT_EHODOT.ALENTUNUT_TYOKYKY);
    if (onkoTyoton && age >= 60 && tyottomyysKuukausia >= 12) conditionsMet.push(TAYTTYVAT_EHODOT.IAKAS_60_PITKAAIKAINEN);
    if (onkoTyoton && age >= 55 && tyottomyysKuukausia >= 24) conditionsMet.push(TAYTTYVAT_EHODOT.IAKAS_55_PITKAAIKAINEN);
    if (onkoOppisopimus || onko_oppisopimus) conditionsMet.push(TAYTTYVAT_EHODOT.OPPISOPIMUS);

    // Etsi priorisoidusta listasta ensimmäinen sääntö, jonka ehto täyttyy.
    const sopivaSaanto = saannot.find(saanto => saanto.ehto(asiakasData));
    const ehdotus = sopivaSaanto ? sopivaSaanto.tulos : PALKKATUKI_EHDOTUKSET.EI_ERITYISIA;

    return { conditionsMet, ehdotus };
};

/**
 * Määrittää, tuleeko Helsinki-lisää ehdottaa.
 * @param {string} palkkatukiEhdotus - Palkkatukianalyysin tulos.
 * @returns {string | null} - Palauttaa ehdotustekstin tai null.
 */
export const laskeHelsinkiLisa = (palkkatukiEhdotus) => {
    // Jos mikä tahansa palkkatuki tai 55v tuki on myönnetty, Helsinki-lisää voidaan hakea.
    if (palkkatukiEhdotus && palkkatukiEhdotus !== PALKKATUKI_EHDOTUKSET.EI_ERITYISIA) {
        return MUUT_SUOSITUKSET.HELSINKI_LISA_EHDOTUS;
    }
    return null;
};