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
    
    const analyticsData = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const data = {
            paastatus: 'tuntematon',
            historia_vuodet: {
                tyokokeilu: {},
                palkkatuki: {},
                tyovoimakoulutus: {},
                kuntouttava_tyotoiminta: {}
            },
            aktiiviset_kpl: 0,
            tulevat_kpl: 0
        };

        // 1. PÄÄSTATUS (Luetaan nyt suoraan oikeita tietokannan fraasiavaimia)
        const activeKeys = Object.keys(currentSectionState).filter(k => currentSectionState[k]);
        const statusKeyStr = activeKeys.join(' ').toLowerCase();
        
        // Järjestys on tärkeä, jos on ruksattu useita (mikä on määräävin)
        if (statusKeyStr.includes('osa-aikainen')) data.paastatus = 'osa-aikainen';
        else if (statusKeyStr.includes('lomautettu')) data.paastatus = 'lomautettu';
        else if (statusKeyStr.includes('tyoton')) data.paastatus = 'työtön';
        else if (statusKeyStr.includes('koulutuksessa')) data.paastatus = 'opiskelija';
        else if (statusKeyStr.includes('kuntoutu') || statusKeyStr.includes('sairauspaivaraha')) data.paastatus = 'kuntoutuja';

        // 2. PALVELUIDEN MÄÄRÄT JA TILAT (Vuosi-aggregaatiolla)
        if (Array.isArray(sessionServices)) {
            sessionServices.forEach(service => {
                const validServices = ['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus', 'kuntouttava_tyotoiminta'];
                if (!validServices.includes(service.entity_key) || !service.data?.loppu) return;

                const loppuPvm = parseDateForAnalytics(service.data.loppu);
                const alkuPvm = parseDateForAnalytics(service.data.alku);

                if (!loppuPvm) return;

                if (loppuPvm < now) {
                    const endYear = loppuPvm.getFullYear().toString();
                    if (data.historia_vuodet[service.entity_key] !== undefined) {
                        if (!data.historia_vuodet[service.entity_key][endYear]) {
                            data.historia_vuodet[service.entity_key][endYear] = 0;
                        }
                        data.historia_vuodet[service.entity_key][endYear] += 1;
                    }
                } else if (alkuPvm && alkuPvm > now) {
                    data.tulevat_kpl += 1;
                } else {
                    data.aktiiviset_kpl += 1;
                }
            });
        }

        return data;
    }, [currentSectionState, sessionServices]);

    return analyticsData;
};