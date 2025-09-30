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
        { lyhenne: "Laatimistapa", teksti: "Tämä suunnitelma laadittiin [YHTEYDENOTTOTAPA] [PÄIVÄMÄÄRÄ].", avainsana: "laadittu", muuttujat: { YHTEYDENOTTOTAPA: { tyyppi: "valinta", "vaihtoehdot": ["puhelinajalla", "käyntiajalla"], oletus: "puhelinajalla" }, PÄIVÄMÄÄRÄ: { tyyppi: "teksti", oletus: new Date().toLocaleDateString('fi-FI') } } },
        { lyhenne: "Tapaamisen tyyppi", teksti: "Tapaamisen tyyppi: [TAPAAMISTYYPPI]", avainsana: "tapaamisen_tyyppi", muuttujat: { "TAPAAMISTYYPPI": { "tyyppi": "valinta", "vaihtoehdot": ["Alkuhaastattelu", "3kk Työnhakukeskustelu", "6kk Täydentävä keskustelu"], oletus: "Alkuhaastattelu" } } },
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
        { lyhenne: "Osa-aikatyössä", teksti: "Asiakas on osa-aikatyössä.", "avainsana": "osa-aikainen" },
        { lyhenne: "Palkkatuella", teksti: "Asiakas on palkkatuetussa työssä.", "avainsana": "palkkatuki" },
        { lyhenne: "Työkokeilussa", teksti: "Asiakas on työkokeilussa.", "avainsana": "tyokokeilu" }
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
      fraasit: [
          { lyhenne: "Tuleva poissaolo", teksti: "Tiedossa on yli 3kk kestävä poissaolo (työ/palvelus/perhevapaa) seuraavan 3kk aikana.", "avainsana": "tuleva_poissaolo" },
          { lyhenne: "CV:n päivitys", teksti: "Tarvittavat toimenpiteet: CV:n päivittäminen.", "avainsana": "toimenpide_cv" },
          { lyhenne: "Työhakemus", teksti: "Tarvittavat toimenpiteet: Työhakemuksen laatiminen.", "avainsana": "toimenpide_hakemus" }
      ]
    },
    {
      otsikko: "Työnhakuvelvollisuus",
      id: "tyonhakuvelvollisuus",
      monivalinta: false,
      alentamisenPerustelut: [
        "Työnhakuvelvollisuutta alennettu huomioiden työmarkkinatilanne.",
        "Työnhakuvelvollisuutta alennettu huomioiden asiakkaan työkyky ja vallitseva työmarkkinatilanne.",
        "Asiakkaan koulutus ja/tai työkokemus rajaa merkittävästi soveltuvia työmahdollisuuksia alueella.",
        "Asiakkaan puutteellinen kielitaito rajaa merkittävästi soveltuvia työmahdollisuuksia.",
        "Ammattitaitosuojan aikana asiakkaan ammattia vastaavia työmahdollisuuksia on vähän tarjolla.",
        "Asiakkaan osaamisessa (esim. digitaitojen tai lupakorttien puute) on puutteita, jotka rajaavat työmahdollisuuksia.",
        "Muu syy (tarkennetaan alla)"
      ],
      fraasit: [
        {
          avainsana: "paasaanto",
          lyhenne: "Pääsääntö (esim. 4 hakua/kk)",
          teksti: `Palvelumallin mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus. Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Asiakas on työtön ja työkyky on normaali, joten sovelletaan palvelumallin mukaista pääsääntöä.",
          ehdot: { tyokyky: ["tyokyky_normaali"], tyotilanne: ["tyoton", "irtisanottu", "alle_6kk_tyossa"] },
          muuttujat: { LKM: { tyyppi: "numero", oletus: 4 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        },
        {
          avainsana: "alennettu_osa_aikainen",
          lyhenne: "Alennettu (Osa-aikatyö)",
          teksti: `Asiakkaalle asetettu työnhakuvelvollisuus osa-aikatyöntekijän mukaisesti. Koska hakija on osa-aikaisessa työssä, hänen tulee hakea vähintään yhtä työmahdollisuutta kolmen kuukauden tarkastelujakson aikana.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Lain mukaan osa-aikatyössä olevalle voidaan asettaa alennettu työnhakuvelvollisuus.",
          ehdot: { tyotilanne: ["osa-aikainen"] }
        },
        {
          avainsana: "alennettu_opiskelija",
          lyhenne: "Alennettu (Omaehtoinen opiskelu)",
          teksti: `Koska asiakas opiskelee omaehtoisia opintoja työttömyysetuudella tuettuna, hänen tulee hakea vähintään kolmea työmahdollisuutta kolmen kuukauden tarkastelujakson aikana.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Omaehtoisia opintoja työttömyysetuudella suorittavalle koulutusta vailla olevalle voidaan asettaa alennettu velvollisuus."
        },
        {
          avainsana: "ei_velvoitetta_palvelu",
          lyhenne: "Ei velvoitetta (Palvelun aikana)",
          teksti: `Asiakkaalle ei aseteta työnhakuvelvollisuutta palvelun aikana. Työnhakuvelvollisuus tarkastellaan seuraavassa työnhakukeskustelussa.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Työnhakuvelvollisuutta ei aseteta työkokeilun tai palkkatukityön kaltaisen palvelun aikana.",
          ehdot: { tyotilanne: ["palkkatuki", "tyokokeilu"] }
        },
        {
          avainsana: "ei_velvoitetta_tyokyky",
          lyhenne: "Ei velvoitetta (Työkyky)",
          teksti: `Lukumäärällistä työnhakuvelvoitetta ei asetettu. Lain 48 §:n mukaisesti edellytyksenä on luotettava lääketieteellinen selvitys työkyvyttömyydestä sekä se, että asiakas noudattaa suunnitelmaa esimerkiksi työkyvyttömyysetuuden hakemiseksi tai kuntoutukseen hakeutumiseksi.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Työkyvyn selvittäminen tai todettu alentuma on peruste jättää velvoite asettamatta, kun asiakas noudattaa suunnitelmaa.",
          ehdot: { tyokyky: ["tyokyky_selvityksessa"] }
        },
        {
          avainsana: "ei_velvoitetta_lomautus",
          lyhenne: "Ei velvoitetta (Lomautus)",
          teksti: `Asiakkaalle ei aseteta työnhakuvelvollisuutta, koska asiakas on lomautettu. Työnhakuvelvollisuus alkaa, kun lomautuksen alkamisesta on kulunut kolme kuukautta ja asiakkaalle on järjestetty työnhakukeskustelu.${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Lain mukaan lomautetulle ei aseteta työnhakuvelvoitetta ensimmäisen kolmen kuukauden aikana.",
          ehdot: { tyotilanne: ["lomautettu"] }
        },
        {
            avainsana: "ei_velvoitetta_lyhytaikainen",
            lyhenne: "Ei velvoitetta (Lyhyt työttömyys ennen poissaoloa)",
            teksti: `Työnhakuvelvollisuutta ei asetettu, koska asiakkaan työttömyyden arvioidaan päättyvän alle kolmen kuukauden kuluessa alkavaan, yli kolme kuukautta kestävään [SYY (esim. perhevapaa, varusmiespalvelus)].${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
            selite: "Velvollisuutta ei tarvitse asettaa, jos työttömyys on lyhytaikainen ja tiedossa on pidempi poissaolo työmarkkinoilta.",
            muuttujat: { SYY: { tyyppi: "teksti" } }
        },
        {
          avainsana: "manuaalinen",
          lyhenne: "Manuaalinen asetus",
          teksti: `Manuaalinen asetus: Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI}`,
          selite: "Sääntöehdotus ei vastaa tilannetta. Asiantuntija asettaa velvollisuuden manuaalisesti.",
          muuttujat: { LKM: { tyyppi: "numero", oletus: 0 }, AIKAJAKSO: { tyyppi: "valinta", vaihtoehdot: ["kuukaudessa", "kolmen kuukauden aikana"], oletus: "kuukaudessa" } }
        }
      ]
    }
  ]
};