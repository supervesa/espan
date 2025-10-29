// src/data/guide.js

/**
 * Contains guidance information for A-TMT statuses linked to planData avainsanas.
 * Based on the PDF "Työnhakijan tilanne A-TMTllä ja laissa.pdf" (version 2.10.2025).
 */
export const aTmtGuide = {
  // --- Avainsana from planData.js ---
  tyoton: {
    aTmtStatus: "Työtön", // Exact name in A-TMT
    description: "Valitaan työnhakijalle, joka ei ole työsuhteessa, ei työllisty päätoimisesti yritystoiminnassa/omassa työssään yli kahta viikkoa, eikä ole päätoiminen opiskelija. Sisältää sivutoimiset opiskelijat/yrittäjät, 4kk suoja-ajalla olevat, puitesopimukset ja max 2 vko kestävät 'tarvittaessa töihin kutsuttava' -sopimukset.",
    legalNotes: "Huom: Järjestämislain (JL) työtön-määritelmä laajempi (sis. alle 4h/vko työn ja kokoaik. lomautetut). Työttömyysturvalain (TTL) määritelmä vielä laajempi (sis. osa-aikatyön, lyh. työviikon ym.). Palveluprosessi (esim. työnhakukeskustelut, THV) ja palkkatuki määrittyvät JL:n mukaan. TTL määrittelee etuusoikeuden.",
    requiredInfo: null,
    priority: 1
  },

  alle_6kk_tyossa: {
    aTmtStatus: null,
    description: "Tämä tieto itsessään ei määritä A-TMT-statusta, mutta on relevantti palkkatuen kannalta.",
    legalNotes: "Palkkatukioikeutta määriteltäessä huomioidaan järjestämislain työttömän määritelmä.",
    requiredInfo: null,
    priority: 0
  },

  irtisanottu: {
    aTmtStatus: "Työtön",
    description: "Yleensä status on 'Työtön'. Tarkista irtisanomisen syy ja ajankohta työttömyysturvaa varten.",
    legalNotes: "Työsuhteen päättymissyy voi vaikuttaa työttömyysturvaan (esim. karenssi).",
    requiredInfo: null,
    priority: 1
  },

  lomautettu: {
    aTmtStatus: "Lomautettu",
    description: "Kokoaikaisesti lomautettu määräajaksi tai toistaiseksi.",
    legalNotes: "JL:n mukaan työtön. Asiakasprosessissa ja THV:ssa poikkeuksia pääsääntöön. Palkkatuki mahdollinen. TTL:n mukaan työtön. Työttömyysetuus mahdollinen.",
    requiredInfo: ['lomautuksen_tyyppi'],
    priority: 5
  },

  osa_aikainen: {
    aTmtStatus: "Osa-aikatyössä oleva",
    description: "Väh. 2 vko kestävä työ-/virkasuhde, työaika <= 80% alan max. Myös vaihteleva työaika, jossa taatut väh.tunnit <= 80%. Myös sopimukset ilman taattuja tunteja (nollasopimukset). **Myös puite-/runkosopimus, jonka perusteella tehty väh. 2 vko työjakso, jossa tunnit <= 80%**. Lyhyet, yksittäiset keikat (esim. 1 pv) eivät yleensä muuta tilannetta.",
    legalNotes: "JL:n mukaan työtön, jos säännöllinen työaika < 4h/vko tai vaihtelevassa taattu min < 4h/vko. Palkkatuki voi olla mahdollinen, jos JL työtön. Asiakasprosessi ja THV JL:n mukaan. TTL mahdollistaa sovitellun etuuden.",
    requiredInfo: ['tyoaika_h_vko', 'kesto_yli_2vko', 'sopimuksen_tyyppi'],
    priority: 3
  },

  palkkatuki: {
    aTmtStatus: "Työssä oleva, työllistetty",
    description: "Työnhakija, jonka työnantajalle maksetaan palkkatukea (koko- tai osa-aikainen). Myös starttirahalla aloittanut yrittäjä.",
    legalNotes: "Asiakasprosessi riippuu työn kestosta (< 1 kk vs >= 1 kk). Työnvälitys ja tarjoukset mahdollisia. TTL-oikeus riippuu mm. työajasta.",
    requiredInfo: ['kesto_yli_1kk'],
    priority: 6
  },

  tyokokeilu: {
    aTmtStatus: "Työllistymistä edistävässä palvelussa",
    description: "Työkokeilussa oleva työnhakija. Huom: Työhönvalmennus ei muuta statusta.",
    legalNotes: "JL:n mukaan työtön, palveluaika lasketaan työttömyyden kertymään. Asiakasprosessi ja THV palvelun keston mukaan. Työnvälitys ja tarjoukset mahdollisia. TTL:n mukainen palvelu, johon liittyy lausunto. Oikeus etuuteen palvelun ajalta.",
    requiredInfo: null,
    priority: 4
  }
};

// --- ADDED LANGUAGE LEVELS ---
export const kielitaitoTasot = {
  // A1 Tasot
  "A1.1": { 
    nimi: "Kielitaidon alkeiden hallinta", 
    yleiskuvaus: "Suppea viestintä kaikkein tutuimmissa tilanteissa",
    selkokuvaus: "Ymmärtää yksittäisiä sanoja ja yksinkertaisia, välittömiä työohjeita."
  },
  "A1.2": { 
    nimi: "Kehittyvä alkeiskielitaito", 
    yleiskuvaus: "Suppea viestintä kaikkein tutuimmissa tilanteissa",
    selkokuvaus: "Osaa viestiä välittömistä tarpeista ja esittää perustason kysymyksiä työpaikalla."
  },
  "A1.3": { 
    nimi: "Toimiva alkeiskielitaito", 
    yleiskuvaus: "Suppea viestintä kaikkein tutuimmissa tilanteissa",
    selkokuvaus: "Pystyy toimimaan yksinkertaisissa ja tarkasti ohjatuissa rutiinityötehtävissä."
  },
  
  // A2 Tasot
  "A2.1": { 
    nimi: "Peruskielitaidon alkuvaihe", 
    yleiskuvaus: "Välittömän sosiaalisen kanssakäymisen perustarpeet",
    selkokuvaus: "Selviytyy yksinkertaisista ja rutiininomaisista sosiaalisista vuorovaikutustilanteista työyhteisössä."
  },
  "A2.2": { 
    nimi: "Kehittyvä peruskielitaito", 
    yleiskuvaus: "Välittömän sosiaalisen kanssakäymisen perustarpeet",
    selkokuvaus: "Pystyy keskustelemaan tutuista ja rutiininomaisista työtehtävistä."
  },
  
  // B1 Tasot
  "B1.1": { 
    nimi: "Toimiva peruskielitaito", 
    yleiskuvaus: "Selviytyminen arkielämässä",
    selkokuvaus: "Selviytyy tavallisimmista työelämän tilanteista ja epävirallisista keskusteluista."
  },
  "B1.2": { 
    nimi: "Sujuva peruskielitaito", 
    yleiskuvaus: "Selviytyminen arkielämässä",
    selkokuvaus: "Osaa viestiä varmasti useimmissa työtilanteissa ja ymmärtää selkeitä työkeskusteluja."
  },
  
  // B2 Tasot
  "B2.1": { 
    nimi: "Itsenäisen kielitaidon perustaso", 
    yleiskuvaus: "Selviytyminen säännöllisessä kanssakäymisessä",
    selkokuvaus: "Pystyy itsenäiseen vuorovaikutukseen ja suoriutuu työtehtävistä ilman merkittäviä kielihasteita."
  },
  "B2.2": { 
    nimi: "Toimiva itsenäinen kielitaito", 
    yleiskuvaus: "Selviytyminen säännöllisessä kanssakäymisessä",
    selkokuvaus: "Viestii tehokkaasti ja sujuvasti vaativissa työtilanteissa, mukaan lukien neuvottelutilanteet."
  },
  
  // C1 Taso
  "C1.1": { 
    nimi: "Taitavan kielitaidon perustaso", 
    yleiskuvaus: "Selviytyminen monissa vaativissa kielenkäyttötilanteissa",
    selkokuvaus: "Käyttää kieltä sujuvasti ja tehokkaasti vaativissa ammatillisissa vuorovaikutustilanteissa."
  }
};