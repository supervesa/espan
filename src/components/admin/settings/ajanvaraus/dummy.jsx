// src/components/admin/settings/ajanvaraus/dummy.jsx

/**
 * TESTIASIAKKAAT AJANVARAUS-SIMULAATTORIIN
 * 
 * Nämä asiakkaat sisältävät kaikki tarvittavat signaalit ja historiatiedot, 
 * joiden perusteella analyzeSchedule ja draftingEngine tekevät päätöksensä.
 */

export const clientTemplates = {
    // 1. TÄYDELLINEN RUTIINI (Aikaa on, kaikki rullaa)
    perus: { 
        type: 'taydentava', 
        name: 'Matti Normaali (Malminkatu)', 
        jumpMonths: 3, 
        jumpDays: 0,
        isFamiliar: true, 
        needsInterpreter: false, 
        is46: false,
        description: 'Lakisääteinen 3 kk rytmi. Postinumero (00100) ohjaa Malminkadulle. Ei lähikäyntivelvoitetta, sillä kävi toimistolla 2 kk sitten.',
        mockState: {
            asiakas: { postinumero: '00100', asiointikieli: 'suomi' }, // 00100 -> Keskinen -> Malminkatu
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: {
                    muuttujat: {
                        TH_ALKU_PVM: '2025-01-01',
                        tapaamishistoria: [
                            { v: 2026, kk: 5, tapa: 'PUH' }, // Edellinen tapaaminen 3 kk sitten
                            { v: 2026, kk: 6, tapa: 'KÄY' }  // Edellinen lähikäynti 2 kk sitten
                        ]
                    }
                }
            }
        }
    },

    // 1B. LOKAATIO-TESTI (Viipurinkatu Matchmaking)
    viipuri: { 
        type: 'taydentava', 
        name: 'Veera Viipuri (Lähikäyntivelvoite)', 
        jumpMonths: 0, 
        jumpDays: 5, // Lähiaikoina
        isFamiliar: false, 
        needsInterpreter: false, 
        is46: false,
        forcedMode: 'kaynti', // Pakotetaan käyntiin, jotta lokaatiotutka aktivoituu
        description: 'Postinumero (00510) ohjaa asiakkaan Viipurinkadulle. Haku hylkää etäpäivät ja Malminkadun päivät, etsien ensisijaisesti Viipurinkadun työvuoroja.',
        mockState: {
            asiakas: { postinumero: '00510', asiointikieli: 'suomi' }, // 00510 -> Keskinen -> VIIPURINKATU (Poikkeus)
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: {
                    muuttujat: {
                        TH_ALKU_PVM: '2025-01-01',
                        tapaamishistoria: [] // Ei aiempaa historiaa
                    }
                }
            }
        }
    },

    // 2. LÄHIKÄYNTIVELVOITE PAUKKUU (Pakotettu lähikäynti)
    kasvotusten: { 
        type: 'taydentava', 
        name: 'Kasvotusten-Kalle (Lähivelvoite)', 
        jumpMonths: 3, 
        jumpDays: 0,
        isFamiliar: true, 
        needsInterpreter: false, 
        is46: false,
        description: '3 kk rytmi ok, mutta edellisestä lähikäynnistä on 7 kk. Tekoälyn on pakko asettaa tapaaminen käynniksi.',
        mockState: {
            asiakas: { postinumero: '00930', asiointikieli: 'suomi' }, // 00930 -> Itä -> Itäkeskus
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: {
                    muuttujat: {
                        TH_ALKU_PVM: '2024-05-01',
                        tapaamishistoria: [
                            { v: 2026, kk: 5, tapa: 'PUH' }, // Edellinen tapaaminen 3 kk sitten
                            { v: 2026, kk: 1, tapa: 'KÄY' }  // Edellinen lähikäynti 7 kk sitten -> Laukaisu!
                        ]
                    }
                }
            }
        }
    },

    // 3. AKTIVOINTIJAKSO (Toimeentulotuki havaittu)
    aktivointi: { 
        type: 'aktivointi', 
        name: 'Aktiivinen Anna (Toimeentulotuki)', 
        jumpMonths: 0, 
        jumpDays: 0, // Moottori heittää automaattisesti +28 pv
        isFamiliar: false, 
        needsInterpreter: false, 
        is46: false,
        description: 'Etuussignaali laukaisee Aktivointijakson. Vaatii 4 viikon välein lähikäynnin.',
        mockState: {
            asiakas: { postinumero: '00530', asiointikieli: 'suomi' }, // 00530 -> Keskinen -> Viipurinkatu
            activeSignals: { ETUUS_TOIMEENTULOTUKI: true }, // Tämä signaali laukaisee aktivoinnin
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2026-06-01', tapaamishistoria: [] } }
            }
        }
    },

    // 4. HÄTÄTILA 46 § (Lakisääteinen palvelu päättyy)
    hata: { 
        type: 'alkuhaastattelu', 
        name: 'Hätäinen Heikki (46 § Työkokeilu)', 
        jumpMonths: 0, 
        jumpDays: 3, 
        isFamiliar: false, 
        needsInterpreter: false, 
        is46: true,
        description: 'Työkokeilu päättyy 12 päivän kuluttua. Tekoälyn on ohitettava muut säännöt (Prioriteetti 1) ja löydettävä aika välittömästi.',
        mockState: {
            asiakas: { postinumero: '00100', asiointikieli: 'suomi' },
            activeSignals: {},
            sessionServices: [
                { entity_key: 'tyokokeilu', data: { loppu: '2026-09-05' } } // Päättyy kohta -> Laukaisu!
            ],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2025-10-01', tapaamishistoria: [] } }
            }
        }
    },

    // 5. TULKKI JA AIKAPUSKURI (Ulkomaalaistaustainen)
    tulkki: { 
        type: 'taydentava', 
        name: 'Tariq Tulkki (Arabia)', 
        jumpMonths: 3, 
        jumpDays: 0,
        isFamiliar: false, 
        needsInterpreter: true, 
        is46: false,
        description: 'Asiointikieli Arabia. Aikaan pitää lisätä tulkkipuskuri (esim. +15min) eikä tuttua asiakasta voida soveltaa.',
        mockState: {
            asiakas: { postinumero: '00710', asiointikieli: 'arabia' }, // 00710 -> Pohjoinen -> Malminkatu (Kieli laukaisee needsInterpreter-tilan)
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: {
                    muuttujat: {
                        TH_ALKU_PVM: '2026-02-01',
                        tapaamishistoria: [{ v: 2026, kk: 5, tapa: 'PUH' }]
                    }
                }
            }
        }
    },

    // 6. UUSI ASIAKAS (Ei historiaa)
    uusi: {
        type: 'alkuhaastattelu', 
        name: 'Uusi Ulla (Työnhaku alkanut)', 
        jumpMonths: 0, 
        jumpDays: 5,
        isFamiliar: false, 
        needsInterpreter: false, 
        is46: false,
        description: 'Työnhaku juuri alkanut. Ei tapaamishistoriaa, joten lähikäyntivelvoite iskee päälle ja aika on löydettävä pian.',
        mockState: {
            asiakas: { postinumero: '00180', asiointikieli: 'suomi' }, // 00180 -> Keskinen -> Malminkatu
            activeSignals: { tyonhaku_alkanut: '2026-08-20' }, // Alkanut juuri
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2026-08-20', tapaamishistoria: [] } }
            }
        }
    },

    // 7. LOMA- JA POISSAOLOTESTERI (Kiireellinen perusaika)
    lomatesti: { 
        type: 'taydentava', 
        name: 'Liisa Lomatesteri (Pika-aika)', 
        jumpMonths: 0, 
        jumpDays: 2, // Moottori yrittää tunkea aikaa ylihuomiselle
        isFamiliar: true, 
        needsInterpreter: false, 
        is46: false, // Ei ohita normaaleja lomasääntöjä kuten 46 pykälä
        description: 'Tavoiteaika on jo +2 pv päässä (kuluvan viikon sisällä). Erinomainen testaamaan loman ja poissaolon (esim 2 vk) kiertämistä kalenterissa.',
        mockState: {
            asiakas: { postinumero: '00100', asiointikieli: 'suomi' },
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: {
                    muuttujat: {
                        TH_ALKU_PVM: '2026-01-01',
                        tapaamishistoria: [{ v: 2026, kk: 7, tapa: 'PUH' }] // Ollut vähän aikaa sitten
                    }
                }
            }
        }
    },

    // 8. DATAPERUSTEINEN (Erittäin nopea asiakas)
    nopea_data: { 
        type: 'taydentava', 
        name: 'Nopea Niilo (Dynaaminen: ~15min)', 
        jumpMonths: 1, 
        jumpDays: 0, 
        isFamiliar: true, 
        needsInterpreter: false, 
        is46: false, 
        description: 'TESTAA AUTOMAATIOTA: Jos "Salli dataperusteiset kestot" on päällä, tekoäly tajuaa asiakkaan historian perusteella (mediaani 15), että 45 min oletusta ei tarvita, ja ehdottaa tarkan pientä aikaa.',
        mockState: {
            asiakas: { postinumero: '00100', asiointikieli: 'suomi' },
            // 🟢 TÄSSÄ ON ASIAKKAAN HOLVIN DATA: Neljä lyhyttä puhelua!
            kestot: {
                'taydentava_puhelu': [15, 20, 10, 15] 
            },
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2026-01-01', tapaamishistoria: [] } }
            }
        }
    },

    // 9. DATAPERUSTEINEN (Hitaampi asiakas)
    hidas_data: { 
        type: 'taydentava', 
        name: 'Hidas Hannele (Dynaaminen: ~60min)', 
        jumpMonths: 1, 
        jumpDays: 0, 
        isFamiliar: true, 
        needsInterpreter: false, 
        is46: false, 
        description: 'TESTAA AUTOMAATIOTA: Vaikka asiakas on tuttu rutiiniasiakas, historia paljastaa puheluiden venyvän aina tunnin mittaisiksi. Tekoäly suojelee kalenteria ja varaa tilaa jopa 60 min.',
        mockState: {
            asiakas: { postinumero: '00200', asiointikieli: 'suomi' },
            // 🟢 TÄSSÄ ON ASIAKKAAN HOLVIN DATA: Pitkiä puheluita!
            kestot: {
                'taydentava_puhelu': [60, 55, 60, 70, 60] 
            },
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2025-06-01', tapaamishistoria: [] } }
            }
        }
    },

    // 10. UNIVERSAALI DATA (Holvi 2: ~5min)
    urpo_universaali: { 
        type: 'tyonhakukeskustelu', 
        name: 'Urpo Universaali (Yleisdata: 5min)', 
        jumpMonths: 1, 
        jumpDays: 0, 
        isFamiliar: false, 
        needsInterpreter: false, 
        is46: false, 
        description: 'TESTAA HOLVI 2: Ei henkilökohtaista historiaa. Tekoäly sukeltaa asiantuntijan universaaliin analytiikkaan, löytää sieltä 5 minuutin mediaanin ja murskaa sillä manuaaliset oletusasetukset.',
        mockState: {
            asiakas: { postinumero: '00300', asiointikieli: 'suomi' },
            kestot: {}, // 🟢 TÄRKEÄÄ: Omaa historiaa ei ole!
            activeSignals: {},
            sessionServices: [],
            suunnitelman_perustiedot: {
                sect1: { muuttujat: { TH_ALKU_PVM: '2026-08-01', tapaamishistoria: [] } }
            }
        }
    }
};