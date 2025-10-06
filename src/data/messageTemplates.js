export const messageTemplates = [
    // --- Kategoria: Ajanvaraukset ja muistutukset ---
    {
        id: 'ajanvaraus-yleinen',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Tapaamisen varaus (Yleinen)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Sinulle on varattu aika tapaamiseen {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.
Paikka: {location}
Jos esitetty aika ei sovi, ilmoitathan siitä mahdollisimman pian.
Huomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Tapaamisen tyyppi', type: 'select', options: ['alkuhaastatteluun', 'työnhakukeskusteluun', 'täydentävään työnhakukeskusteluun'] },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' },
            { id: 'location', label: 'Paikka', type: 'text', placeholder: 'Viipurinkatu 2, 00510 Helsinki' }
        ]
    },
    {
        id: 'puhelinaika-yleinen',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Puhelinajan varaus (Yleinen)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Sinulle on varattu puhelinaika {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.
Asiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.
Huomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Puhelun aihe', type: 'select', options: ['alkuhaastattelua', 'työnhakukeskustelua', 'täydentävää työnhakukeskustelua'] },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ajan-siirto',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Ajan siirto',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Aiemmin sovittua aikaa {meetingType} varten on siirretty.
Uusi aika on {date} klo {time}. Asiantuntijana toimii {expertName}.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
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
        template: `Tervehdys Helsingin työllisyyspalveluista!
Yritin tavoitella sinua puhelimitse. Asia koskee: {reason}.
Soitan sinulle uudelleen myöhemmin. Puhelu tulee 09 310 -alkuisesta numerosta.

Vaihtoehtoisesti voit jättää meille yhteydenottopyynnön Työmarkkinatorilla.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'reason', label: 'Yhteydenoton syy', type: 'datalist', options: ['työnhaun aloittamista', 'selvityspyyntöäsi', 'yhteystietojesi päivittämistä', 'työllistymissuunnitelmaasi'] },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ilmoitus-soitosta-tarkka',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Ilmoitus tulevasta soitosta (Tarkka aika)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Tavoittelen sinua puhelimitse {date} klo {time} koskien asiaa: {reason}.

Puhelu tulee 09 310 -alkuisesta numerosta.

Terveisin {expertName}, Helsingin työllisyyspalvelut`,
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
        template: `Tervehdys Helsingin työllisyyspalveluista!
Tavoittelen sinua puhelimitse {timeframe} koskien asiaa: {reason}.

Puhelu tulee 09 310 -alkuisesta numerosta.

Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'timeframe', label: 'Soiton ajankohta', type: 'select', options: ['tänään iltapäivällä', 'huomenna aamupäivällä', 'huomenna iltapäivällä'] },
            { id: 'reason', label: 'Soiton syy', type: 'text', placeholder: 'jättämääsi yhteydenottopyyntöä' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },

    // --- Kategoria: Muut ilmoitukset ja ohjeet ---
    {
        id: 'vastaus-yhteydenottopyyntoon',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Vastaus yhteydenottopyyntöön (Yleinen)',
        template: `Hei,
Kiitos yhteydenotostasi. {message}
Terveisin, {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'message', label: 'Viesti', type: 'textarea', placeholder: 'Olen vastaanottanut työtodistuksesi...' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    },
    {
        id: 'muistutus-suunnitelman-hyvaksyminen',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Muistutus suunnitelman hyväksymisestä',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Et ole vielä hyväksynyt työllistymissuunnitelmaasi. Hoidathan asian Työmarkkinatorin asiointipalvelussa {date} mennessä.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Määräaika', type: 'date' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', defaultValue: 'Vesa Nessling' }
        ]
    }
];