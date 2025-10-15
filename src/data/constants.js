/**
 * Tämä tiedosto sisältää sovelluksen vakioita, joita käytetään
 * palkkatukilaskennassa. Tavoitteena on välttää koodiin
 * kovakoodattuja merkkijonoja ja numeroita.
 */

// Avainsanat, jotka tulevat sovelluksen keskitetystä tilasta (state)
// ja kuvaavat asiakkaan työkykyä.
export const TYOKYKY_AVAINSANAT = {
    ALENTUNUT: 'tyokyky_alentunut',
    SELVITYKSESSA: 'tyokyky_selvityksessa',
};

// Avainarvot datan hakemiseen statesta
export const STATE_MUUTTUJAT = {
    SYNTYMAVUOSI: 'SYNTYMÄVUOSI',
    TYONHAKU_ALKUPVM: 'PÄIVÄMÄÄRÄ',
};

// Yksittäiset, tunnistetut ehdot analyysin tuloslistaukseen.
// Nämä kuvaavat asiakkaan tilanteeseen liittyviä tekijöitä.
export const TAYTTYVAT_EHODOT = {
    NUORI: '15-24-vuotias',
    IAKAS_50: '50 vuotta täyttänyt',
    IAKAS_55_PITKAAIKAINEN: '55v täyttänyt pitkäaikaistyötön',
    IAKAS_60_PITKAAIKAINEN: '60v täyttänyt pitkäaikaistyötön',
    EI_TUTKINTOA: 'Ei toisen asteen tutkintoa',
    EI_ANSIOTYOSSA_6KK: 'Ei ansiotyössä 6kk aikana',
    ALENTUNUT_TYOKYKY: 'Alentunut työkyky',
    OPPISOPIMUS: 'Oppisopimuskoulutus',
};

// Lopulliset, käyttäjälle näytettävät ehdotustekstit, jotka on päivitetty
// vastaamaan ohjeiden mukaisia prosentteja, kestoja ja maksimisummia.
export const PALKKATUKI_EHDOTUKSET = {
    EI_ERITYISIA: 'Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.',
    ALENTUNUT_TYOKYKY: 'Alentuneesti työkykyisen palkkatuki (70 %, 10 kk + jatkomahdollisuus, max 1770 €/kk).',
    YHDISTYS_100: '100 % palkkatuki yhdistykselle (100 %, 10 kk, max 2020 €/kk).',
    IAKAS_60_PITKAAIKAINEN: '60v täyttänyt, pitkään työtön (50 %, max 24 kk, max 1260 €/kk).',
    IAKAS_55_TUKI: '55 vuotta täyttäneiden työllistämistuki (70 %, 10 kk, max 1770 €/kk).',
    OPPISOPIMUS: 'Ehdotus: Palkkatuki oppisopimukseen (50 %, koulutuksen ajan, max 1260 €/kk).',
    OSAAMISEN_PARANTAMINEN_5KK: 'Ammatillisen osaamisen parantaminen (50 %, max 5 kk, max 1260 €/kk).',
    OSAAMISEN_PARANTAMINEN_10KK: 'Ammatillisen osaamisen parantaminen (50 %, max 10 kk, max 1260 €/kk).',
};

// Muut suositukset ja lausumat
export const MUUT_SUOSITUKSET = {
    TYOKOKEILU_PUOLTO: "Puolletaan työkokeilua.",
    HELSINKI_LISA_EHDOTUS: "Asiakkaalle voidaan hakea Helsinki-lisää myönnetyn palkkatuen perusteella.",
};

// Ohjetekstit modaali-ikkunaa varten
export const OHJEET = {
    OTSIKKO: "Palkkatuen ja muiden tukien ehdot",
    KAPPALEET: [
        {
            otsikko: "Palkkatuen perusperiaate",
            teksti: "Palkkatuki on työttömän työnhakijan työllistymisen edistämiseksi tarkoitettu tuki, jonka TE-toimisto tai kuntakokeilu voi myöntää työnantajalle palkkauskustannuksiin. Tuen määrä ja kesto riippuvat työttömän tilanteesta ja tuen myöntämisen perusteesta."
        },
        {
            otsikko: "Tärkeimmät tukimuodot",
            lista: [
                "**Ammatillisen osaamisen parantaminen (50%):** Edellyttää kuulumista yhteen viidestä kohderyhmästä (esim. alle 25-v, yli 50-v, ei tutkintoa). Kesto on 5kk (työttömyys alle 12kk) tai 10kk (työttömyys yli 12kk).",
                "**Alentunut työkyky (70%):** Perustuu työllistymistä vaikeuttavaan vammaan tai sairauteen. Kesto on 10kk, ja jatko on mahdollinen.",
                "**55 vuotta täyttäneiden työllistämistuki (70%):** Myönnetään vähintään 24kk työttömänä olleelle 55 vuotta täyttäneelle. Kesto 10kk.",
                "**100% tuki (yhdistykset/säätiöt):** Vähintään 24kk työttömänä olleelle, joka kuuluu yhteen viidestä kohderyhmästä. Kesto 10kk.",
                "**Oppisopimus (50%):** Myönnetään työttömälle, jolla on osaamisen puutteita. Kesto on koko koulutuksen ajan."
            ]
        },
        {
            otsikko: "Helsinki-lisä",
            teksti: "Helsinki-lisää voidaan hakea työnantajalle, joka palkkaa helsinkiläisen työttömän, jolle on myönnetty palkkatuki tai 55v työllistämistuki."
        },
        {
            otsikko: "Työkokeilu",
            teksti: "Työkokeilu on toimenpide, jonka avulla henkilö voi selvittää ammatinvalinta- ja uravaihtoehtojaan tai mahdollisuuksiaan palata työmarkkinoille. Sille voidaan antaa puoltava lausunto."
        }
    ]
};
