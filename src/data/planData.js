// --- DATA ---

export const TYONHAKUVELVOLLISUUS_LOPPUTEKSTI = `\nHaetut paikat ja suunnitelman tehtävät tulee merkata toteutuneeksi kuukausittain...`;

export const planData = {
  aihealueet: [
    // ... muut osiot pysyvät ennallaan ...
    {
      otsikko: "Suunnitelman tyyppi", id: "suunnitelman_tyyppi", monivalinta: false, fraasit: [{ "teksti": "Laaditaan työllistymissuunnitelma.", "avainsana": "tyollisyyssuunnitelma" }]
    },
    {
      otsikko: "Suunnitelman perustiedot", id: "suunnitelman_perustiedot", monivalinta: true, fraasit: [ { teksti: "Asiakkaan syntymävuosi: [SYNTYMÄVUOSI]", avainsana: "syntymavuosi", muuttujat: { "SYNTYMÄVUOSI": { "tyyppi": "numero", "oletus": 1980 } } }, { teksti: "Asiakkaan työnhaku on alkanut [PÄIVÄMÄÄRÄ].", avainsana: "tyonhaku_alkanut", muuttujat: { "PÄIVÄMÄÄRÄ": { "tyyppi": "teksti", "oletus": new Date().toLocaleDateString('fi-FI') } } }, { teksti: "Tämä suunnitelma laadittiin [YHTEYDENOTTOTAPA] [PÄIVÄMÄÄRÄ].", avainsana: "laadittu", muuttujat: { YHTEYDENOTTOTAPA: { tyyppi: "valinta", vaihtoehdot: ["puhelinajalla", "käyntiajalla"], oletus: "puhelinajalla" }, PÄIVÄMÄÄRÄ: { tyyppi: "teksti", oletus: new Date().toLocaleDateString('fi-FI') } } }, { "teksti": "Asiakas hyväksyi suunnitelman käynnillä.", "avainsana": "hyvaksynta_kaynnilla" }, { "teksti": "Asiakas hyväksyi suunnitelman luettuna puhelimitse.", "avainsana": "hyvaksynta_puhelimitse" }, { "teksti": "Asiakas hyväksyy suunnitelman Oma asiointi -palvelussa.", "avainsana": "hyvaksynta_oma" } ]
    },
    {
      otsikko: "Työttömyysturva", id: "tyottomyysturva", tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Asiakkaan työtilanne", id: "tyotilanne", monivalinta: true, fraasit: [{ "teksti": "Asiakas on työtön työnhakija.", "avainsana": "tyoton" }, { "teksti": "Asiakas ei ole ollut ansiotyössä kuuden edellisen kuukauden aikana.", "avainsana": "alle_6kk_tyossa"}, { teksti: "Asiakas on irtisanottu (työnantajan toimesta) yrityksestä [YRITYS] [AMMATTI]-tehtävistä [PVM].", avainsana: "irtisanottu", muuttujat: { YRITYS: { tyyppi: "teksti" }, AMMATTI: { tyyppi: "teksti" }, PVM: { tyyppi: "teksti" } } }, { "teksti": "Asiakas on lomautettu.", "avainsana": "lomautettu" }, { "teksti": "Asiakas on osa-aikatyössä.", "avainsana": "osa-aikainen" }, { "teksti": "Asiakas on palkkatuetussa työssä.", "avainsana": "palkkatuki" }, { "teksti": "Asiakas on työkokeilussa.", "avainsana": "tyokokeilu" }, { "teksti": "Asiakas on työvoimakoulutuksessa.", "avainsana": "koulutus" }, { "teksti": "Asiakas on kuntoutuksessa.", "avainsana": "kuntoutus" }]
    },
    {
      otsikko: "Koulutus ja yrittäjyys", id: "koulutus_yrittajyys", monivalinta: true, fraasit: [ { teksti: "Asiakas on koulutukseltaan [KOULUTUS] (v. [VUOSI]).", avainsana: "koulutus_tausta", muuttujat: { KOULUTUS: { tyyppi: "teksti" }, VUOSI: { tyyppi: "teksti" } } }, { "teksti": "Asiakkaalla ei ole toisen asteen tutkintoa.", "avainsana": "ei_tutkintoa" }, { "teksti": "Asiakas on oppisopimuskoulutuksessa.", "avainsana": "oppisopimus" }, { "teksti": "Asiakkaalla ei ole yrittäjyysajatuksia.", "avainsana": "ei_yrittajyysajatuksia" } ]
    },
    {
      otsikko: "Työkyky", id: "tyokyky", tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Palkkatuki", id: "palkkatuki", tyyppi: "erikoiskomponentti"
    },
    {
      otsikko: "Palveluunohjaus", id: "palveluunohjaus", monivalinta: true, fraasit: [{ "teksti": "Asiakas ohjattu CV-pajaan.", "avainsana": "cv_paja" }, { "teksti": "Asiakas ohjattu uraohjaukseen.", "avainsana": "uraohjaus" }]
    },
    {
      otsikko: "Suunnitelma", id: "suunnitelma", monivalinta: true, fraasit: [{ "teksti": "Tarvittavat toimenpiteet: CV:n päivittäminen.", "avainsana": "toimenpide_cv" }, { "teksti": "Tarvittavat toimenpiteet: Työhakemuksen laatiminen.", "avainsana": "toimenpide_hakemus" }, { "teksti": "Tarvittavat toimenpiteet: Yhteydenotto työnantajiin.", "avainsana": "toimenpide_yhteydenotto" }]
    },
    {
      otsikko: "Työnhakuvelvollisuus",
      id: "tyonhakuvelvollisuus",
      monivalinta: false,
      alentamisenPerustelut: [ // UUSI OSA
        "Huomioiden asiakkaan työkyky",
        "Huomioiden vallitseva työmarkkinatilanne",
        "Huomioiden asiakkaan puutteellinen osaaminen tai kielitaito",
        "Huomioiden asiakkaan kokonaistilanne ja palvelutarve",
        "Muu syy (tarkennetaan alla)"
      ],
      fraasit: [
        {
          teksti: "Palvelumallin mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus. Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].",
          avainsana: "paasaanto",
          ehdot: { tyotilanne: ["tyoton", "irtisanottu"], tyokyky: ["tyokyky_normaali"] },
          muuttujat: { LKM: { tyyppi: "numero", oletus: 4 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        },
        {
          teksti: "Asiakkaalle asetettu työnhakuvelvollisuus osa-aikatyöntekijän mukaisesti. Asiakkaan tulee hakea yhtä työmahdollisuutta kolmen kuukauden tarkastelujakson aikana ja ilmoittaa Työmarkkinatorin asiointipalvelussa tai muulla sovitulla tavalla velvollisuuden täyttymisestä.",
          avainsana: "alennettu_osa_aikainen",
          ehdot: { tyotilanne: ["osa-aikainen"] }
        },
        {
          teksti: "Lukumäärällistä työnhakuvelvoitetta ei asetettu, koska asiakkaan työkykyä selvitetään.",
          avainsana: "ei_velvoitetta_tyokyky",
          ehdot: { tyokyky: ["tyokyky_selvityksessa"] }
        },
        {
          teksti: "Asiakkaalle ei aseteta työnhakuvelvollisuutta, koska asiakas on lomautettu.",
          avainsana: "ei_velvoitetta_lomautus",
          ehdot: { tyotilanne: ["lomautettu"] }
        },
        {
          teksti: "Manuaalinen asetus: Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].",
          avainsana: "manuaalinen",
          muuttujat: { LKM: { tyyppi: "numero", oletus: 0 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        }
      ]
    }
  ]
};
