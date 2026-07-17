export const ENTITY_DEFINITIONS = {
    tyokokeilu: {
        label: "Työkokeilu",
        category: "palvelu",
        icon: "Briefcase",
        fields: { alku: "date", loppu: "date", jarjestaja: "text" },
        isLawCritical: true
    },
    palkkatuki: {
        label: "Palkkatuki",
        category: "palvelu",
        icon: "Coins",
        fields: { alku: "date", loppu: "date", tyonantaja: "text" },
        isLawCritical: true
    },
    tyovoimakoulutus: {
        label: "Työvoimakoulutus",
        category: "palvelu",
        icon: "GraduationCap",
        fields: { alku: "date", loppu: "date", koulutus: "text" },
        isLawCritical: true
    },
    // VALMIUS TULEVAISUUDELLE (Opinnot)
    opiskelu_omaehtoinen: {
        label: "Omaehtoinen opiskelu",
        category: "opiskelu",
        icon: "BookOpen",
        fields: { alku: "date", loppu: "date", oppilaitos: "text", tutkinto: "text" },
        isLawCritical: true
    },
    opiskelu_sivutoiminen: {
        label: "Sivutoiminen opiskelu",
        category: "opiskelu",
        icon: "Clock",
        fields: { alku: "date", loppu: "date", oppilaitos: "text" },
        isLawCritical: false
    },

    // --- GLOBAALI POHJA TIETOKANNAN PALVELUILLE ---
    asiantuntijapalvelu: {
        label: "Dynaaminen", // Korvataan ajonaikaisesti (esim. "Ammatinvalinnan ja uraohjauksen psykologipalvelu")
        category: "asiantuntijapalvelu",
        icon: "Activity", // Voidaan myös mapata db:n 'category' kentän perusteella myöhemmin
        fields: { tila: "select", lisatieto: "text" },
        isLawCritical: false // Korvataan ajonaikaisesti db:n 'hard_service' -arvolla
    }
};