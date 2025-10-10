export const messageTemplates = [
    // --- Kategoria: Yleiset pohjat ---
    {
        id: 'yleinen-tapaaminen',
        category: 'Yleiset pohjat',
        title: 'Yleinen tapaamisen varaus',
        subject: 'Tapaamisvaraus',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika tapaamiseen {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.\n\nPaikka: {location}\n\nJos esitetty aika ei sovi, ilmoitathan siitä mahdollisimman pian.\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Tapaamisen tyyppi', type: 'select', options: ['alkuhaastatteluun', 'työnhakukeskusteluun', 'täydentävään työnhakukeskusteluun'] },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' },
            { id: 'location', label: 'Paikka', type: 'text', placeholder: 'Viipurinkatu 2, 00510 Helsinki' }
        ]
    },
    {
        id: 'yleinen-puhelinaika',
        category: 'Yleiset pohjat',
        title: 'Yleinen puhelinajan varaus',
        subject: 'Puhelinaika',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Puhelun aihe', type: 'select', options: ['alkuhaastattelua', 'työnhakukeskustelua', 'täydentävää työnhakukeskustelua'] },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'yleinen-ajan-siirto',
        category: 'Yleiset pohjat',
        title: 'Yleinen ajan siirto',
        subject: 'Ajanvarauksen siirto',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nAiemmin sovittua aikaa {meetingType} varten on siirretty.\n\nUusi aika on {date} klo {time}. Asiantuntijana toimii {expertName}.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Tapaamisen tyyppi', type: 'select', options: ['alkuhaastattelulle', 'työnhakukeskustelulle', 'täydentävälle työnhakukeskustelulle'] },
            { id: 'date', label: 'Uusi päivämäärä', type: 'date' },
            { id: 'time', label: 'Uusi kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    // --- Kategoria: Yhteydenotot ja tavoittelu ---
    {
        id: 'tavoitteluyritys-syylla',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Tavoitteluyritys (Syyllä)',
        subject: 'Yhteydenotto Helsingin työllisyyspalveluista',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nYritin tavoitella sinua puhelimitse. Asia koskee: {reason}.\n\nSoitan sinulle uudelleen myöhemmin. Puhelu tulee 09 310 -alkuisesta numerosta.\n\nVaihtoehtoisesti voit jättää meille yhteydenottopyynnön Työmarkkinatorilla.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'reason', label: 'Yhteydenoton syy', type: 'datalist', options: ['työnhaun aloittamista', 'työllistymissuunnitelman päivitystä', 'jättämääsi yhteydenottopyyntöä', 'oman tilanteesi tarkastamista', 'selvityspyyntöäsi', 'yhteystietojesi päivittämistä'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ilmoitus-soitosta-tarkka',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Ilmoitus tulevasta soitosta (Tarkka aika)',
        subject: 'Yhteydenotto Helsingin työllisyyspalveluista',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nTavoittelen sinua puhelimitse {date} klo {time} koskien asiaa: {reason}.\n\nPuhelu tulee 09 310 -alkuisesta numerosta.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'reason', label: 'Soiton syy', type: 'text', placeholder: 'sairauslomaasi ja työnhakua' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ilmoitus-soitosta-yleinen',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Ilmoitus tulevasta soitosta (Yleinen aika)',
        subject: 'Yhteydenotto Helsingin työllisyyspalveluista',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nTavoittelen sinua puhelimitse {timeframe} koskien asiaa: {reason}.\n\nPuhelu tulee 09 310 -alkuisesta numerosta.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'timeframe', label: 'Soiton ajankohta', type: 'select', options: ['tänään iltapäivällä', 'huomenna aamupäivällä', 'huomenna iltapäivällä'] },
            { id: 'reason', label: 'Soiton syy', type: 'text', placeholder: 'jättämääsi yhteydenottopyyntöä' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    // --- Kategoria: Viralliset Kutsupohjat ---
    {
        id: 'kutsu-alkuhaastattelu-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Kutsu: Alkuhaastattelu (Aika määritelty)',
        subject: 'Kutsu alkuhaastatteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika alkuhaastatteluun, jossa kartoitamme yhdessä tilannettasi ja laadimme henkilökohtaisen työllistymissuunnitelman. Keskustelemme mahdollisista työpaikoista, koulutustarpeista ja muista työllistymistäsi edistävistä toimista.\n\nAika: {date} klo {time}\nPaikka: {location}\nAsiantuntija: {expertName}\n\n{addons}\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'location', label: 'Toimipiste', type: 'select', options: ['Helsingin Työllisyyspalvelut, Viipurinkatu 2 (6 krs.), 00510 Helsinki', 'Helsingin Työllisyyspalvelut, Malminkatu 34, 00100 Helsinki', 'Helsingin Työllisyyspalvelut, Asiakkaankatu 3A, 00930 Helsinki'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ],
        addons: [
            { id: 'tulkki_tarve', label: 'Ilmoita jos tarvitset tapaamiseen tulkkia.', text: 'Ilmoita jos tarvitset tapaamiseen tulkkia.' },
            { id: 'tulkki_osallistuu', label: 'Tapaamiseen osallistuu tulkki.', text: 'Tapaamiseen osallistuu tulkki.' },
            { id: 'sostyo_osallistuu', label: 'Tapaamiseen osallistuu sosiaalityöntekijä.', text: 'Tapaamiseen osallistuu sosiaalityöntekijä.' },
            { id: 'muu_osallistuu', label: 'Tapaamiseen osallistuu:', text: 'Tapaamiseen osallistuu {muu_input}.', hasInput: true, inputId: 'muu_input' }
        ]
    },
    {
        id: 'kutsu-alkuhaastattelu-yleinen',
        category: 'Viralliset Kutsupohjat',
        title: 'Kutsu: Alkuhaastattelu (Yleinen)',
        subject: 'Kutsu alkuhaastatteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika alkuhaastatteluun, jossa kartoitamme yhdessä tilannettasi ja laadimme henkilökohtaisen työllistymissuunnitelman. Keskustelemme mahdollisista työpaikoista, koulutustarpeista ja muista työllistymistäsi edistävistä toimista.\n\nPaikka: {location}\nAsiantuntija: {expertName}\n\n{addons}\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'location', label: 'Toimipiste', type: 'select', options: ['Helsingin Työllisyyspalvelut, Viipurinkatu 2 (6 krs.), 00510 Helsinki', 'Helsingin Työllisyyspalvelut, Malminkatu 34, 00100 Helsinki', 'Helsingin Työllisyyspalvelut, Asiakkaankatu 3A, 00930 Helsinki'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ],
        addons: [
            { id: 'tulkki_tarve', label: 'Ilmoita jos tarvitset tapaamiseen tulkkia.', text: 'Ilmoita jos tarvitset tapaamiseen tulkkia.' },
            { id: 'tulkki_osallistuu', label: 'Tapaamiseen osallistuu tulkki.', text: 'Tapaamiseen osallistuu tulkki.' },
            { id: 'sostyo_osallistuu', label: 'Tapaamiseen osallistuu sosiaalityöntekijä.', text: 'Tapaamiseen osallistuu sosiaalityöntekijä.' },
            { id: 'muu_osallistuu', label: 'Tapaamiseen osallistuu:', text: 'Tapaamiseen osallistuu {muu_input}.', hasInput: true, inputId: 'muu_input' }
        ]
    },
    {
        id: 'kutsu-tyonhakukeskustelu-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Kutsu: Työnhakukeskustelu (Aika määritelty)',
        subject: 'Kutsu työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika työnhakukeskusteluun, jossa saat tukea työnhakuusi ja tarkistamme yhdessä työllistymissuunnitelmasi toteutumista. Päivitämme suunnitelmasi ja ohjaamme sinut tarvittaessa eteenpäin sopiviin palveluihin.\n\nAika: {date} klo {time}\nPaikka: {location}\nAsiantuntija: {expertName}\n\n{addons}\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'location', label: 'Toimipiste', type: 'select', options: ['Helsingin Työllisyyspalvelut, Viipurinkatu 2 (6 krs.), 00510 Helsinki', 'Helsingin Työllisyyspalvelut, Malminkatu 34, 00100 Helsinki', 'Helsingin Työllisyyspalvelut, Asiakkaankatu 3A, 00930 Helsinki'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ],
        addons: [
            { id: 'tulkki_tarve', label: 'Ilmoita jos tarvitset tapaamiseen tulkkia.', text: 'Ilmoita jos tarvitset tapaamiseen tulkkia.' },
            { id: 'tulkki_osallistuu', label: 'Tapaamiseen osallistuu tulkki.', text: 'Tapaamiseen osallistuu tulkki.' },
            { id: 'sostyo_osallistuu', label: 'Tapaamiseen osallistuu sosiaalityöntekijä.', text: 'Tapaamiseen osallistuu sosiaalityöntekijä.' },
            { id: 'muu_osallistuu', label: 'Tapaamiseen osallistuu:', text: 'Tapaamiseen osallistuu {muu_input}.', hasInput: true, inputId: 'muu_input' }
        ]
    },
    {
        id: 'kutsu-tyonhakukeskustelu-yleinen',
        category: 'Viralliset Kutsupohjat',
        title: 'Kutsu: Työnhakukeskustelu (Yleinen)',
        subject: 'Kutsu työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika työnhakukeskusteluun, jossa saat tukea työnhakuusi ja tarkistamme yhdessä työllistymissuunnitelmasi toteutumista. Päivitämme suunnitelmasi ja ohjaamme sinut tarvittaessa eteenpäin sopiviin palveluihin.\n\nPaikka: {location}\nAsiantuntija: {expertName}\n\n{addons}\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'location', label: 'Toimipiste', type: 'select', options: ['Helsingin Työllisyyspalvelut, Viipurinkatu 2 (6 krs.), 00510 Helsinki', 'Helsingin Työllisyyspalvelut, Malminkatu 34, 00100 Helsinki', 'Helsingin Työllisyyspalvelut, Asiakkaankatu 3A, 00930 Helsinki'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ],
        addons: [
            { id: 'tulkki_tarve', label: 'Ilmoita jos tarvitset tapaamiseen tulkkia.', text: 'Ilmoita jos tarvitset tapaamiseen tulkkia.' },
            { id: 'tulkki_osallistuu', label: 'Tapaamiseen osallistuu tulkki.', text: 'Tapaamiseen osallistuu tulkki.' },
            { id: 'sostyo_osallistuu', label: 'Tapaamiseen osallistuu sosiaalityöntekijä.', text: 'Tapaamiseen osallistuu sosiaalityöntekijä.' },
            { id: 'muu_osallistuu', label: 'Tapaamiseen osallistuu:', text: 'Tapaamiseen osallistuu {muu_input}.', hasInput: true, inputId: 'muu_input' }
        ]
    },
    {
        id: 'kutsu-taydentava-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Kutsu: Täydentävä työnhakukeskustelu',
        subject: 'Kutsu täydentävään työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu aika täydentävään työnhakukeskusteluun. Keskustelussa saat henkilökohtaista tukea työnhakuusi, arvioimme työllistymissuunnitelmasi edistymistä ja etsimme yhdessä ratkaisuja mahdollisiin työllistymisen esteisiin.\n\nAika: {date} klo {time}\nPaikka: {location}\nAsiantuntija: {expertName}\n\n{addons}\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'location', label: 'Toimipiste', type: 'select', options: ['Helsingin Työllisyyspalvelut, Viipurinkatu 2 (6 krs.), 00510 Helsinki', 'Helsingin Työllisyyspalvelut, Malminkatu 34, 00100 Helsinki', 'Helsingin Työllisyyspalvelut, Asiakkaankatu 3A, 00930 Helsinki'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ],
        addons: [
            { id: 'tulkki_tarve', label: 'Ilmoita jos tarvitset tapaamiseen tulkkia.', text: 'Ilmoita jos tarvitset tapaamiseen tulkkia.' },
            { id: 'tulkki_osallistuu', label: 'Tapaamiseen osallistuu tulkki.', text: 'Tapaamiseen osallistuu tulkki.' },
            { id: 'sostyo_osallistuu', label: 'Tapaamiseen osallistuu sosiaalityöntekijä.', text: 'Tapaamiseen osallistuu sosiaalityöntekijä.' },
            { id: 'muu_osallistuu', label: 'Tapaamiseen osallistuu:', text: 'Tapaamiseen osallistuu {muu_input}.', hasInput: true, inputId: 'muu_input' }
        ]
    },
    // --- PUHELINAJAT ---
    {
        id: 'puhelin-alkuhaastattelu-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Alkuhaastattelu (Aika määritelty)',
        subject: 'Puhelinaika alkuhaastatteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika alkuhaastatteluun, jossa kartoitamme yhdessä tilannettasi ja laadimme henkilökohtaisen työllistymissuunnitelman. Keskustelemme mahdollisista työpaikoista, koulutustarpeista ja muista työllistymistäsi edistävistä toimista.\n\nAika: {date} klo {time}\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'puhelin-alkuhaastattelu-yleinen',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Alkuhaastattelu (Yleinen)',
        subject: 'Puhelinaika alkuhaastatteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika alkuhaastatteluun, jossa kartoitamme yhdessä tilannettasi ja laadimme henkilökohtaisen työllistymissuunnitelman. Keskustelemme mahdollisista työpaikoista, koulutustarpeista ja muista työllistymistäsi edistävistä toimista.\n\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'puhelin-tyonhakukeskustelu-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Työnhakukeskustelu (Aika määritelty)',
        subject: 'Puhelinaika työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika työnhakukeskusteluun, jossa saat tukea työnhakuusi ja tarkistamme yhdessä työllistymissuunnitelmasi toteutumista. Päivitämme suunnitelmasi ja ohjaamme sinut tarvittaessa eteenpäin sopiviin palveluihin.\n\nAika: {date} klo {time}\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'puhelin-tyonhakukeskustelu-yleinen',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Työnhakukeskustelu (Yleinen)',
        subject: 'Puhelinaika työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika työnhakukeskusteluun, jossa saat tukea työnhakuusi ja tarkistamme yhdessä työllistymissuunnitelmasi toteutumista. Päivitämme suunnitelmasi ja ohjaamme sinut tarvittaessa eteenpäin sopiviin palveluihin.\n\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nHuomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon (Laki julkisesta työvoima- ja yrityspalvelusta (916/2012) 2 luku 2 §).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'puhelin-taydentava-aika',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Täydentävä (Aika määritelty)',
        subject: 'Puhelinaika täydentävään työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika täydentävään työnhakukeskusteluun. Keskustelussa saat henkilökohtaista tukea työnhakuusi, arvioimme työllistymissuunnitelmasi edistymistä ja etsimme yhdessä ratkaisuja mahdollisiin työllistymisen esteisiin.\n\nAika: {date} klo {time}\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'puhelin-taydentava-yleinen',
        category: 'Viralliset Kutsupohjat',
        title: 'Puhelinaika: Täydentävä (Yleinen)',
        subject: 'Puhelinaika täydentävään työnhakukeskusteluun',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nSinulle on varattu puhelinaika täydentävään työnhakukeskusteluun. Keskustelussa saat henkilökohtaista tukea työnhakuusi, arvioimme työllistymissuunnitelmasi edistymistä ja etsimme yhdessä ratkaisuja mahdollisiin työllistymisen esteisiin.\n\nAsiantuntija: {expertName}\n\nAsiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.\n\nMikäli aika ei sovi, ilmoitathan siitä mahdollisimman pian Työmarkkinatorin Asiointi-palvelussa: https://tyomarkkinatori.fi/henkiloasiakkaat/asiointi tai neuvontapuhelimeemme 09 310 36107 (klo 9-15).\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },

    // --- Kategoria: Muut ilmoitukset ja ohjeet ---
    {
        id: 'vastaus-yhteydenottopyyntoon-varaus',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Vastaus yhteydenottopyyntöön (Ajanvaraus tulossa)',
        subject: 'Vastaus yhteydenottopyyntöösi',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nOlet jättänyt yhteydenottopyynnön Helsingin työllisyyspalveluihin. Sinulle varataan aika työnhakukeskusteluun. Saat siitä ilmoituksen Suomi.fi-viestipalveluun, mikäli olet ottanut sähköisen asioinnin käyttöön. Muussa tapauksessa ilmoitus toimitetaan sinulle postitse.\n\nTerveisin,\n{expertName}\nHelsingin työllisyyspalvelut`,
        fields: [
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'dokumenttien-toimitus',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Ohje dokumenttien toimittamiseen (Turvaposti)',
        subject: 'Dokumenttien toimittaminen Helsingin työllisyyspalveluihin',
        template: `Hei,\n\nPyydämme teitä toimittamaan seuraavat dokumentit: {dokumentit}.\n\nVoitte toimittaa ne turvallisesti käyttämällä Helsingin kaupungin turvasähköpostia osoitteessa securemail.hel.fi.\n\nValitkaa vastaanottajaksi kirjaamo.tyollisyyspalvelut@hel.fi ja mainitkaa viestissä nimenne sekä henkilötunnuksenne.\n\nTerveisin,\n{expertName}`,
        fields: [
            { id: 'dokumentit', label: 'Pyydettävät dokumentit', type: 'textarea', placeholder: 'esim. työsopimus ja viimeisin palkkalaskelma' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'muistutus-suunnitelman-hyvaksyminen',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Muistutus suunnitelman hyväksymisestä',
        subject: 'Muistutus työllistymissuunnitelman hyväksymisestä',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nEt ole vielä hyväksynyt työllistymissuunnitelmaasi. Hoidathan asian Työmarkkinatorin asiointipalvelussa {date} mennessä.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Määräaika', type: 'date' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
{
    id: 'suunnitelman-paivitys-kaksiosainen',
    category: 'Muut ilmoitukset ja ohjeet',
    title: 'Kehotus päivittämään työllistymissuunnitelma (2-osainen)',
    subject: 'Työllistymissuunnitelmasi päivitys',
    template: `Tervehdys Helsingin työllisyyspalveluista!\n\nOn aika päivittää työllistymissuunnitelmasi.\n\n1. JOS TILANTEESI EI OLE MUUTTUNUT ja olet edelleen työtön työnhakija, pyydämme sinua vahvistamaan tämän vastaamalla tähän viestiin sanalla OK. Tämän jälkeen päivitämme suunnitelmasi.\n\n2. JOS TILANTEESSASI ON TAPAHTUNUT MUUTOKSIA (esim. opinnot, osa-aikatyö), pyydämme sinua ilmoittamaan siitä vastaamalla tähän viestiin sanalla MUUTOS. Tämän jälkeen asiantuntija ottaa sinuun yhteyttä uuden ajan varaamiseksi.\n\nTerveisin,\n{expertName}\nHelsingin työllisyyspalvelut`,
    fields: [
        { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
    ]
},
 {
        id: 'suunnitelma-paivitetty-hyvaksy',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Ilmoitus päivitetystä suunnitelmasta (Hyväksy)',
        subject: 'Työllistymissuunnitelmasi on päivitetty',
        template: `Tervehdys Helsingin työllisyyspalveluista!\n\nTyöllistymissuunnitelmasi on päivitetty. Pyydämme sinua hyväksymään sen Työmarkkinatorin asiointi-palvelussa {date} mennessä.\n\nTerveisin,\n{expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Määräaika', type: 'date' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    }
];