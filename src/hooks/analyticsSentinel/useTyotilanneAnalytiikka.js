import { useMemo } from 'react';

// Apufunktio päivämäärien karkeaan vertailuun analytiikkaa varten
const parseDateForAnalytics = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]); // Vuosi, Kuukausi (0-indeksi), Päivä
    }
    return new Date(dateStr);
};

export const useTyotilanneAnalytiikka = (currentSectionState = {}, sessionServices = []) => {
    
    // useMemo varmistaa, että laskenta tehdään vain kun data oikeasti muuttuu
    const analyticsData = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const data = {
            paastatus: 'tuntematon',
            historia_kpl: {
                tyokokeilu: 0,
                palkkatuki: 0,
                tyovoimakoulutus: 0,
                kuntouttava_tyotoiminta: 0
            },
            aktiiviset_kpl: 0,
            tulevat_kpl: 0,
            ai_tuonti_kaytetty: false,
            pikasyotto_kaytetty: false
        };

        // 1. PÄÄSTATUS (Päätellään ruksituista fraaseista)
        const activeKeys = Object.keys(currentSectionState).filter(k => currentSectionState[k]);
        const statusKeyStr = activeKeys.join(' ').toLowerCase();
        
        if (statusKeyStr.includes('tyoton') || statusKeyStr.includes('työttöm')) data.paastatus = 'työtön';
        else if (statusKeyStr.includes('tyossakayva') || statusKeyStr.includes('työssä')) data.paastatus = 'työssäkäyvä';
        else if (statusKeyStr.includes('opiskeli')) data.paastatus = 'opiskelija';
        else if (statusKeyStr.includes('kuntoutu')) data.paastatus = 'kuntoutuja';

        // 2. PALVELUIDEN MÄÄRÄT JA TILAT
        sessionServices.forEach(service => {
            const validServices = ['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus', 'kuntouttava_tyotoiminta'];
            if (!validServices.includes(service.entity_key) || !service.data?.loppu) return;

            const loppuPvm = parseDateForAnalytics(service.data.loppu);
            const alkuPvm = parseDateForAnalytics(service.data.alku);

            if (!loppuPvm) return;

            // Tilalogiikka
            if (loppuPvm < now) {
                // Mennyt aika -> Lisätään historiaan
                if (data.historia_kpl[service.entity_key] !== undefined) {
                    data.historia_kpl[service.entity_key] += 1;
                }
            } else if (alkuPvm && alkuPvm > now) {
                data.tulevat_kpl += 1;
            } else {
                data.aktiiviset_kpl += 1;
            }

            // Metadatan seuranta (Miten asiantuntija työskenteli)
            if (service.meta?.source === 'ai_tuonti') data.ai_tuonti_kaytetty = true;
            if (service.meta?.source === 'pikasyotto') data.pikasyotto_kaytetty = true;
        });

        return data;
    }, [currentSectionState, sessionServices]);

    return analyticsData;
};