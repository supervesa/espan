export const TYONHAKUVELVOLLISUUS_LOPPUTEKSTI = `\nHaetut paikat ja suunnitelman tehtävät tulee merkata toteutuneeksi kuukausittain. Ilmoita, mitä työtä olet hakenut, mistä ja milloin. Suunnitelman voi kuitata toteutuneeksi Työmarkkinatorin asiointipalvelussa tai soittamalla Helsingin työllisyyspalveluiden neuvontanumeroon 09 310 36107. Työnhakija voi toteuttaa työnhakuvelvollisuutta esimerkiksi hakemalla itse valitsemaansa avointa työpaikkaa, piilotyöpaikkaa tai tarjottua työpaikkaa, tehdä ja julkaista yhden kerran työnhakuprofiilin Työmarkkinatorilla tai hakea muuta vastaavaa työmahdollisuutta, johon hakijalla on realistiset mahdollisuudet työllistyä.\nAsiakkaalle on kerrottu hänelle asetetusta työnhakuvelvollisuudesta ja sen ehdoista. Pyydettäessä asiakkaan tulee todentaa hänelle soveltuvien työmahdollisuuksien hakeminen (kopiot, valokuvat tai muut dokumentit). Tarvittaessa selvitystä voidaan pyytää myös työnantajalta. Asiakas suorittaa ja kuittaa suunnitelmassa sovitut tehtävät määräaikoihin mennessä ja ilmoittaa työnhaun muutoksista Työmarkkinatorin asiointipalvelussa. Asiakas on tietoinen, että suunnitelman noudattamatta jättäminen voi vaikuttaa työttömyysetuuden saamiseen.\nAsiakas tietää ilmoittaa mahdolliset muutokset työnhakutilanteessa Helsingin työllisyyspalveluihin.`;

export const planData = {
  aihealueet: [
    {
      otsikko: "Suunnitelman tyyppi",
      id: "suunnitelman_tyyppi",
      monivalinta: false,
      fraasit: [{ lyhenne: "Työllistymissuunnitelma", teksti: "Laaditaan työllistymissuunnitelma.", avainsana: "tyollisyyssuunnitelma" }]
    },
    {
      otsikko: "Suunnitelman perustiedot",
      id: "suunnitelman_perustiedot",
      monivalinta: true,
      fraasit: [
        { lyhenne: "Syntymävuosi", teksti: "Asiakkaan syntymävuosi: [SYNTYMÄVUOSI]", avainsana: "syntymavuosi", muuttujat: { "SYNTYMÄVUOSI": { "tyyppi": "numero", "oletus": 1980 } } },
        { lyhenne: "Työnhaun alku", teksti: "Asiakkaan työnhaku on alkanut [PÄIVÄMÄÄRÄ].", avainsana: "tyonhaku_alkanut", muuttujat: { "PÄIVÄMÄÄRÄ": { "tyyppi": "teksti", "oletus": new Date().toLocaleDateString('fi-FI') } } },
        { lyhenne: "Laatimistapa", teksti: "Tämä suunnitelma laadittiin [YHTEYDENOTTOTAPA] [PÄIVÄMÄÄRÄ].", avainsana: "laadittu", muuttujat: { YHTEYDENOTTOTAPA: { tyyppi: "valinta", vaihtoehdot: ["puhelinajalla", "käyntiajalla"], oletus: "puhelinajalla" }, PÄIVÄMÄÄRÄ: { tyyppi: "teksti", oletus: new Date().toLocaleDateString('fi-FI') } } },
        { lyhenne: "Hyväksyntä (käynti)", teksti: "Asiakas hyväksyi suunnitelman käynnillä.", "avainsana": "hyvaksynta_kaynnilla" },
        { lyhenne: "Hyväksyntä (puhelin)", teksti: "Asiakas hyväksyi suunnitelman luettuna puhelimitse.", "avainsana": "hyvaksynta_puhelimitse" },
        { lyhenne: "Hyväksyntä (Oma asiointi)", teksti: "Asiakas hyväksyy suunnitelman Oma asiointi -palvelussa.", "avainsana": "hyvaksynta_oma" }
      ]
    },
    {
      otsikko: "Työttömyysturva",
      id: "tyottomyysturva",
      tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Asiakkaan työtilanne",
      id: "tyotilanne",
      monivalinta: true,
      fraasit: [
        { lyhenne: "Työtön", teksti: "Asiakas on työtön työnhakija.", avainsana: "tyoton" },
        { lyhenne: "Ei ansiotyössä 6kk", teksti: "Asiakas ei ole ollut ansiotyössä kuuden edellisen kuukauden aikana.", "avainsana": "alle_6kk_tyossa"},
        { lyhenne: "Irtisanottu", teksti: "Asiakas on irtisanottu (työnantajan toimesta) yrityksestä [YRITYS] [AMMATTI]-tehtävistä [PVM].", avainsana: "irtisanottu", muuttujat: { YRITYS: { tyyppi: "teksti" }, AMMATTI: { tyyppi: "teksti" }, PVM: { tyyppi: "teksti" } } },
        { lyhenne: "Lomautettu", teksti: "Asiakas on lomautettu.", avainsana: "lomautettu" },
        { lyhenne: "Osa-aikatyössä", teksti: "Asiakas on osa-aikatyössä.", "avainsana": "osa-aikainen" }
      ]
    },
    {
      otsikko: "Koulutus ja yrittäjyys",
      id: "koulutus_yrittajyys",
      monivalinta: true,
      fraasit: [
         { lyhenne: "Koulutustausta", teksti: "Asiakas on koulutukseltaan [KOULUTUS] (v. [VUOSI]).", avainsana: "koulutus_tausta", muuttujat: { KOULUTUS: { tyyppi: "teksti" }, VUOSI: { tyyppi: "teksti" } } },
         { lyhenne: "Ei tutkintoa", teksti: "Asiakkaalla ei ole toisen asteen tutkintoa.", avainsana: "ei_tutkintoa" },
         { lyhenne: "Oppisopimus", teksti: "Asiakas on oppisopimuskoulutuksessa.", avainsana: "oppisopimus" },
         { lyhenne: "Ei yrittäjyyttä", teksti: "Asiakkaalla ei ole yrittäjyysajatuksia.", "avainsana": "ei_yrittajyysajatuksia" }
      ]
    },
    {
      otsikko: "Työkyky",
      id: "tyokyky",
      tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Palkkatuki",
      id: "palkkatuki",
      tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Palveluunohjaus",
      id: "palveluunohjaus",
      monivalinta: true,
      fraasit: [{ lyhenne: "CV-paja", teksti: "Asiakas ohjattu CV-pajaan.", avainsana: "cv_paja" }, { lyhenne: "Uraohjaus", teksti: "Asiakas ohjattu uraohjaukseen.", avainsana: "uraohjaus" }]
    },
    {
      otsikko: "Suunnitelma",
      id: "suunnitelma",
      monivalinta: true,
      fraasit: [{ lyhenne: "CV:n päivitys", teksti: "Tarvittavat toimenpiteet: CV:n päivittäminen.", "avainsana": "toimenpide_cv" }, { lyhenne: "Työhakemus", teksti: "Tarvittavat toimenpiteet: Työhakemuksen laatiminen.", "avainsana": "toimenpide_hakemus" }]
    },
    {
      otsikko: "Työnhakuvelvollisuus",
      id: "tyonhakuvelvollisuus",
      monivalinta: false,
      alentamisenPerustelut: [
        "Työnhakuvelvollisuutta alennettu huomioiden työmarkkinatilanne.",
        "Työnhakuvelvollisuutta alennettu huomioiden asiakkaan työkyky ja vallitseva työmarkkinatilanne.",
        "Muu syy (tarkennetaan alla)"
      ],
      fraasit: [
        {
          avainsana: "paasaanto",
          lyhenne: "Pääsääntö (esim. 4 hakua/kk)",
          teksti: `Palvelumallin mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus. Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          ehdot: { tyokyky: ["tyokyky_normaali"], tyotilanne: ["tyoton"] },
          muuttujat: { LKM: { tyyppi: "numero", oletus: 4 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        },
        {
          avainsana: "alennettu_osa_aikainen",
          lyhenne: "Alennettu (Osa-aikatyö)",
          teksti: `Asiakkaalle asetettu työnhakuvelvollisuus osa-aikatyöntekijän mukaisesti. Koska hakija on osa-aikaisessa työssä, hänen tulee hakea vähintään yhtä työmahdollisuutta kolmen kuukauden tarkastelujakson aikana.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          ehdot: { tyotilanne: ["osa-aikainen"] }
        },
        {
          avainsana: "ei_velvoitetta_tyokyky",
          lyhenne: "Ei velvoitetta (Työkyky)",
          teksti: `Lukumäärällistä työnhakuvelvoitetta ei asetettu, koska asiakkaan työkykyä selvitetään.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          ehdot: { tyokyky: ["tyokyky_selvityksessa", "tyokyky_alentunut"] }
        },
        {
          avainsana: "ei_velvoitetta_lomautus",
          lyhenne: "Ei velvoitetta (Lomautus)",
          teksti: `Asiakkaalle ei aseteta työnhakuvelvollisuutta, koska asiakas on lomautettu. Työnhakuvelvollisuus alkaa, kun lomautuksen alkamisesta on kulunut kolme kuukautta ja asiakkaalle on järjestetty työnhakukeskustelu.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          ehdot: { tyotilanne: ["lomautettu"] }
        },
        {
          avainsana: "manuaalinen",
          lyhenne: "Manuaalinen asetus",
          teksti: `Manuaalinen asetus: Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          muuttujat: { LKM: { tyyppi: "numero", oletus: 0 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        }
      ]
    }
  ]
};
