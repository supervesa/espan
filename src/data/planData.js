export const TYONHAKUVELVOLLISUUS_LOPPUTEKSTI = `
Oikeudet ja velvollisuudet
Asiakkaalle on kerrottu työvoimapalveluiden järjestämisestä annetun lain (380/2023, 2 luku 13 §) mukaisista työnhakijan yleisistä oikeuksista ja velvollisuuksista. Asiakas on ilmoittanut olevansa valmis ottamaan vastaan työtä ja koulutusta.

Osana asiakkaan työllistymisen edistämistä on sovittu työnhakukeskusteluista (380/2023, 4 luku 32 §) sekä täydentävistä työnhakukeskusteluista (380/2023, 4 luku 33 §). Asiakas ymmärtää, että näihin tämän suunnitelman perusteella järjestettäviin ja erikseen ilmoitettaviin keskusteluihin osallistuminen on lakisääteinen velvollisuus.

Työnhakuvelvollisuuden toteuttaminen ja seuranta
Asiakkaan tulee toteuttaa suunnitelmassa sovittua työnhakuvelvollisuutta (380/2023, 4 luku 35 §) ja ilmoittaa sen toteutumisesta (4 luku 36 §) kuukausittain Työmarkkinatorin asiointipalvelussa tai muulla sovitulla tavalla (esim. Helsingin työllisyyspalvelut, p. 09 310 36107). 

Työnhakuvelvollisuutta voi täyttää hakemalla avoimia työpaikkoja, olemalla suoraan yhteydessä työnantajiin, julkaisemalla työnhakuprofiilin Työmarkkinatorilla tai muilla vastaavilla tavoilla, jotka tähtäävät työllistymiseen avoimille työmarkkinoille.

Asiakkaan on pyydettäessä todennettava työnhakunsa (esim. kopio hakemuksesta tai työnantajan vastaus). Asiakkaan vastuulla on ilmoittaa työnhaun ja olosuhteiden muutoksista viipymättä ja noudattaa annettuja määräaikoja. Asiakas on tietoinen, että suunnitelman laiminlyönnillä tai työnhakuvelvollisuuden täyttämättä jättämisellä on vaikutusta oikeuteen saada työttömyysetuutta työttömyysturvalain (1290/2002, 2 a luku) mukaisesti.
`;

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
        { 
  lyhenne: "Työnhaun alku", 
  teksti: "Asiakkaan työnhaku on alkanut [TH_ALKU_PVM].", 
  avainsana: "tyonhaku_alkanut", 
  muuttujat: { "TH_ALKU_PVM": { "tyyppi": "teksti", "oletus": new Date().toLocaleDateString('fi-FI') } } 
},
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
      otsikko: "Koulutus", // Nimi muutettu
      id: "koulutus",      // <-- ID MUUTETTU
      monivalinta: false,
      fraasit: [
         // Vain koulutusfraasit jäävät
         { 
           lyhenne: "Koulutustausta", 
           teksti: "Asiakas on koulutukseltaan [KOULUTUS] (v. [VUOSI]).", 
           avainsana: "koulutus_tausta", 
           muuttujat: { KOULUTUS: { tyyppi: "teksti" }, VUOSI: { tyyppi: "teksti" } },
           ryhma: 'koulutus' // Tämä voi jäädä, ei haittaa mitään
         },
         { 
           lyhenne: "Ei tutkintoa", 
           teksti: "Asiakkaalla ei ole toisen asteen tutkintoa.", 
           avainsana: "ei_tutkintoa",
           ryhma: 'koulutus'
         },
         { 
           lyhenne: "Oppisopimus", 
           teksti: "Asiakas on oppisopimuskoulutuksessa.", 
           avainsana: "oppisopimus",
           ryhma: 'koulutus'
         }
         // Yrittäjyys-fraasi poistettu täältä
      ]
    },
    {
      otsikko: "Yrittäjyys",
      id: "yrittajyys",
      monivalinta: false,
      fraasit: [
         { 
           lyhenne: "Ei yrittäjyyttä", 
           teksti: "Asiakkaalla ei ole yrittäjyysajatuksia.", 
           "avainsana": "ei_yrittajyysajatuksia",
           ryhma: 'yrittajyys'
         }
      ]
    },
    // --- LISÄÄ TÄMÄ UUSI OSIO planData.js-TIEDOSTOON ---
    {
      otsikko: "Ammattikortit", // Otsikolla ei ole väliä, piilotamme sen
      id: "ammattikortit", // UUSI, OMA ID
      monivalinta: true, // TÄMÄ ON MONIVALINTAOSIO
      fraasit: [
         {
          avainsana: 'hygieniapassi',
          teksti: 'hygieniapassi', // Yhteenvetoa varten
          tyyppi: 'monivalinta',
          ryhma: 'ammattikortit',
          lyhenne: 'Hygieniapassi'
        },
        {
          avainsana: 'tyoturvallisuuskortti',
          teksti: 'työturvallisuuskortti',
          tyyppi: 'monivalinta',
          ryhma: 'ammattikortit',
          lyhenne: 'Työturvallisuuskortti'
        },
        {
          avainsana: 'tulityokortti',
          teksti: 'tulityökortti',
          tyyppi: 'monivalinta',
          ryhma: 'ammattikortit',
          lyhenne: 'Tulityökortti'
        },
        {
          avainsana: 'alkoholipassi',
          teksti: 'alkoholipassi',
          tyyppi: 'monivalinta',
          ryhma: 'ammattikortit',
          lyhenne: 'Alkoholipassi'
        }
        // Lisää uudet kortit tähän listaan
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
      "otsikko": "Työnhakuvelvollisuus",
      "id": "tyonhakuvelvollisuus",
      "monivalinta": false,
      "alentamisenPerustelut": [
        "Työnhakuvelvollisuutta kevennetty huomioiden työssäkäyntialueen työmarkkinatilanne (380/2023 35 §).",
        "Työnhakuvelvollisuutta kevennetty huomioiden asiakkaan työkyky (380/2023 35 §).",
        "Asiakkaan koulutus, työkokemus tai puutteelliset digitaitot/lupakortit rajaavat soveltuvia työmahdollisuuksia (380/2023 35 §).",
        "Asiakkaan puutteellinen kielitaito rajaa merkittävästi soveltuvia työmahdollisuuksia (380/2023 35 §).",
        "Ammattitaitosuojan aikana asiakkaan ammattia vastaavia työmahdollisuuksia on vähän tarjolla (380/2023 35 §).",
        "Työnhakuvelvollisuutta ei aseteta: Työssäkäyntialueella ei ole haettavissa soveltuvia työmahdollisuuksia (380/2023 34 § 1 mom. 1 kohta).",
        "Työnhakuvelvollisuutta ei aseteta: Osa-aikatyö ja terveydentila, joka estää muun työn vastaanottamisen (380/2023 34 § 1 mom. 3 kohta).",
        "Työnhakuvelvollisuutta ei aseteta: Työttömyys päättyy tai perhevapaa/varusmiespalvelus alkaa kuukauden kuluessa (380/2023 34 § 1 mom. 7 kohta).",
        "Työnhakuvelvollisuutta ei aseteta: Asiakas on ohjattu monialaiseen palvelutarpeen arviointiin (Laki 381/2023 5 §).",
        "Muu syy (tarkennetaan alla)"
      ],
      "fraasit": [
        {
          "avainsana": "paasaanto",
          "lyhenne": "Pääsääntö (esim. 4 hakua/kk)",
          "teksti": "Lain (380/2023 32–33 §) mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus. Asiakkaan tulee hakea vähintään [LKM] työmahdollisuutta [AIKAJAKSO].",
          "selite": "Asiakas on työtön ja työkyky on normaali, joten sovelletaan palvelumallin mukaista pääsääntöä.",
          "ehdot": { "tyokyky": ["tyokyky_normaali"], "tyotilanne": ["tyoton", "irtisanottu"] },
          "muuttujat": { "LKM": { "tyyppi": "numero", "oletus": 4 }, "AIKAJAKSO": { "tyyppi": "valinta", "vaihtoehdot": ["kuukaudessa", "kolmen kuukauden aikana"], "oletus": "kuukaudessa" } }
        },
        {
          "avainsana": "ei_velvoitetta_tyomahdollisuudet",
          "lyhenne": "Ei velvoitetta (Ei työmahdollisuuksia)",
          "teksti": "Työnhakuvelvollisuutta ei aseteta (Laki 380/2023 34 § 1 mom. 1 kohta). Työvoimaviranomaisen arvion mukaan asiakkaan työssäkäyntialueella ei ole haettavissa sellaisia työmahdollisuuksia, joihin hän voisi työllistyä huomioiden työkokemuksen, koulutuksen, muun osaamisen ja työkyvyn.",
          "selite": "Uusi peruste: Velvoitetta ei aseteta, jos haettavaa työtä ei tosiasiallisesti ole alueella."
        },
        {
          "avainsana": "ei_velvoitetta_osa_aikainen_terveys",
          "lyhenne": "Ei velvoitetta (Osa-aikatyö + Terveys)",
          "teksti": "Työnhakuvelvollisuutta ei aseteta (Laki 380/2023 34 § 1 mom. 3 kohta). Asiakas on osa-aikaisessa työssä, eikä muun työn vastaanottaminen samanaikaisesti ole mahdollista hänen työkykynsä tai terveydentilansa vuoksi.",
          "selite": "Uusi peruste: Osa-aikatyössä oleva, jonka terveys estää lisätyön tekemisen.",
          "ehdot": { "tyotilanne": ["osa-aikainen"] }
        },
        {
          "avainsana": "kevennetty_osa_aikainen",
          "lyhenne": "Kevennetty (Osa-aikatyö)",
          "teksti": "Asiakkaalle asetettu kevennetty työnhakuvelvollisuus (Laki 380/2023 35 §). Koska hakija on osa-aikaisessa työssä, hänen tulee hakea vähintään yhtä työmahdollisuutta kolmen kuukauden tarkastelujakson aikana.",
          "selite": "Osa-aikatyössä olevalle asetetaan kevennetty velvollisuus, jos terveys ei estä lisätyötä.",
          "ehdot": { "tyotilanne": ["osa-aikainen"] }
        },
        {
          "avainsana": "kevennetty_opiskelija",
          "lyhenne": "Kevennetty (Omaehtoinen opiskelu)",
          "teksti": "Asiakkaalle asetettu kevennetty työnhakuvelvollisuus (Laki 380/2023 35 §). Koska asiakas suorittaa työttömyysetuudella tuettuja omaehtoisia opintoja, hänen tulee hakea vähintään kolmea työmahdollisuutta kolmen kuukauden tarkastelujakson aikana.",
          "selite": "Omaehtoisia opintoja suorittavalle (muu kuin luku/kirjoitustaito) voidaan asettaa kevennetty velvollisuus."
        },
        {
          "avainsana": "ei_velvoitetta_tym",
          "lyhenne": "Ei velvoitetta (Monialainen TYM)",
          "teksti": "Työnhakuvelvollisuutta ei sisällytetä tähän suunnitelmaan. Asiakas on ohjattu monialaiseen palvelutarpeen arviointiin, ja työnhakuvelvollisuudesta sovitaan monialaisessa työllistymissuunnitelmassa (Laki 381/2023 5 §).",
          "selite": "TYM-asiakkaiden kohdalla velvoite siirtyy monialaiseen suunnitelmaan."
        },
        {
          "avainsana": "ei_velvoitetta_tyokyky",
          "lyhenne": "Ei velvoitetta (Työkyvyttömyys)",
          "teksti": "Työnhakuvelvollisuutta ei aseteta (Laki 380/2023 34 § 1 mom. 2 kohta). Perusteena on luotettava lääketieteellinen selvitys työkyvyttömyydestä. Asiakas noudattaa suunnitelmaa työkyvyttömyysetuuden hakemiseksi tai kuntoutukseen hakeutumiseksi.",
          "selite": "Työkyvyn alentuma on peruste jättää velvoite asettamatta, kun prosessi on käynnissä.",
          "ehdot": { "tyokyky": ["tyokyky_selvityksessa", "tyokyky_alentunut"] }
        },
        {
          "avainsana": "ei_velvoitetta_lomautus",
          "lyhenne": "Ei velvoitetta (Lomautus < 3kk)",
          "teksti": "Asiakkaalle ei aseteta työnhakuvelvollisuutta (Laki 380/2023 34 § 3 mom.). Työnhakuvelvollisuus alkaa vasta, kun lomautuksen alkamisesta on kulunut kolme kuukautta.",
          "selite": "Lomautetulla ei ole velvoitetta ensimmäisen 3 kk aikana.",
          "ehdot": { "tyotilanne": ["lomautettu"] }
        },
        {
          "avainsana": "ei_velvoitetta_lyhytaikainen",
          "lyhenne": "Ei velvoitetta (Päättyy 1kk sisällä)",
          "teksti": "Työnhakuvelvollisuutta ei aseteta tarkastelujaksolle, koska asiakkaan työttömyys päättyy kuukauden kuluessa kokoaikaisen työn alkamiseen tai hän aloittaa kuukauden kuluessa varusmies-/siviilipalveluksen tai perhevapaan (Laki 380/2023 34 § 1 mom. 7 kohta).",
          "selite": "Aikaraja on uuden lain mukaan 1 kuukausi (aiemmin käytäntö usein 3 kk).",
          "muuttujat": { "SYY": { "tyyppi": "valinta", "vaihtoehdot": ["työn alkaminen", "perhevapaa", "varusmiespalvelus"], "oletus": "työn alkaminen" } }
        },
        {
          "avainsana": "ei_velvoitetta_opiskelu_erityinen",
          "lyhenne": "Ei velvoitetta (Luku- ja kirjoitustaito/Yhteishankinta)",
          "teksti": "Työnhakuvelvollisuutta ei aseteta, koska asiakas opiskelee päätoimisia luku- ja kirjoitustaidon opintoja tai osallistuu yhteishankintana järjestettyyn työvoimakoulutukseen (Laki 380/2023 34 § 1 mom. 4-5 kohta).",
          "selite": "Tietyt koulutusmuodot vapauttavat hausta kokonaan."
        },
        {
          "avainsana": "manuaalinen",
          "lyhenne": "Manuaalinen asetus (Kevennetty)",
          "teksti": "Asiantuntijan arvion perusteella asiakkaalle on asetettu kevennetty työnhakuvelvollisuus: [LKM] työmahdollisuutta [AIKAJAKSO] (Laki 380/2023 35 §).",
          "selite": "Käytetään kun mikään valmis kategoria ei täyty, mutta hakuja on syytä vähentää.",
          "muuttujat": { "LKM": { "tyyppi": "numero", "oletus": 0 }, "AIKAJAKSO": { "tyyppi": "valinta", "vaihtoehdot": ["kuukaudessa", "kolmen kuukauden aikana"], "oletus": "kuukaudessa" } }
        }
      ]
    }
    
  ]
};