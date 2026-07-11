import { useCallback } from 'react';
import { useSignal } from '../components/signals/useSignal';

export const useSentinelFingerprint = (state) => {
    // Otetaan dynaaminen getSignalInfo käyttöön!
    const { activeSignals, getSignalInfo } = useSignal();

    const normalize = (str) => {
        if (!str || str === 'X' || str === 'XX' || str === 'XXXX' || str === 'XXX') return str; 
        return String(str).toUpperCase().replace(/[^A-Z0-9ÄÖÅ]/g, '');
    };

    const generateFingerprints = useCallback((mode = 'check') => {
        // --- OSA 1: STABIILI TUNNISTE (Pää) ---
        let paiva = 'X', vuosiPari = 'X';
        const alkuPvm = state?.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.TH_ALKU_PVM || state?.asiakas?.tyonhaku_alkanut;
        
        if (alkuPvm) {
            const parts = String(alkuPvm).split('.');
            if (parts[0]) paiva = parts[0].padStart(2, '0');
            if (parts.length >= 3) {
                const v = parts[2].trim().substring(0, 4); 
                if (v.length === 4) vuosiPari = v.charAt(1) + v.charAt(3);
            }
        }

        const kunta = state?.suunnitelman_perustiedot?.kotikunta?.muuttujat?.KUNTA || state?.asiakas?.kotikunta || 'X';
        
        // --- KIELEN TUNNISTUS (TÄYSIN DYNAAMINEN) ---
        let kieli = 'X';
        
        if (activeSignals && getSignalInfo) {
            // Käydään läpi kaikki asiakkaalla päällä olevat signaalit
            for (const key of Object.keys(activeSignals)) {
                if (activeSignals[key]) {
                    const info = getSignalInfo(key);
                    // Jos tietokanta sanoo, että tämän signaalin kategoria on 'Äidinkieli', se on osuma!
                    if (info && info.cat === 'Äidinkieli') {
                        kieli = key;
                        break;
                    }
                }
            }
        }
        
        // VARAJÄRJESTELMÄ: Jos kieltä ei ollut signaalina, otetaan se vapaasta tekstikentästä
        if (kieli === 'X' && state?.['custom-kielitaso_aidinkieli']) {
            kieli = state['custom-kielitaso_aidinkieli'];
        }

        // --- OSA 2: TALLENNETTAVA TIETO (Reppu - 11 merkkiä) ---
        let tapa = 'XXX'; 
        const yhtTapa = state?.suunnitelman_perustiedot?.laadittu?.muuttujat?.YHTEYDENOTTOTAPA || '';
        const yhtTapaStr = String(yhtTapa).toLowerCase();
        if (yhtTapaStr.includes('puhelin')) tapa = 'PUH';
        else if (yhtTapaStr.includes('käynti') || yhtTapaStr.includes('kaynti')) tapa = 'KÄY';

        let nykyKk = 'XX'; 
        if (mode === 'save') {
            const uusiPvm = state?.suunnitelman_perustiedot?.laadittu?.muuttujat?.PÄIVÄMÄÄRÄ;
            if (uusiPvm) {
                const parts = String(uusiPvm).split('.');
                if (parts.length >= 2) nykyKk = parts[1].padStart(2, '0');
            }
        }

        let viimeKayntiKk = state?.asiakas?.viime_kaynti_kk || 'XX';
        
        if (mode === 'save' && tapa === 'KÄY' && nykyKk !== 'XX') {
            viimeKayntiKk = nykyKk;
        }

        let syntymaVuosi = 'XXXX';
        const sv = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI || state?.asiakas?.syntymavuosi;
        if (sv) {
            const numSv = String(sv).replace(/\D/g, '');
            if (numSv.length >= 4) syntymaVuosi = numSv.substring(0, 4);
        }

        const nID = `${normalize(paiva)}${normalize(kieli)}${normalize(kunta)}${normalize(vuosiPari)}`;
        const nPayload = `${normalize(tapa)}${normalize(nykyKk)}${normalize(viimeKayntiKk)}${normalize(syntymaVuosi)}`;

        return [nID + nPayload];
    }, [state, activeSignals, getSignalInfo]); // Lisätty getSignalInfo dependency-arrayhin

    return { generateFingerprints };
};