import { useCallback } from 'react';
import { useSignal } from '../components/signals/useSignal';

export const useSentinelFingerprint = (state) => {
    const { activeSignals, getSignalInfo } = useSignal();

    const normalize = (str) => {
        if (!str || str === 'X' || str === 'XX' || str === 'XXXX' || str === 'XXX') return str; 
        return String(str).toUpperCase().replace(/[^A-Z0-9ÄÖÅ]/g, '');
    };

    const getFingerprintData = useCallback(() => {
        // --- 1. STABIILI TUNNISTE (Pää) ---
        let suola = 'XXX', vuosiPari = 'X';
        const alkuPvm = state?.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.TH_ALKU_PVM || state?.asiakas?.tyonhaku_alkanut;
        
        if (alkuPvm) {
            const parts = String(alkuPvm).split('.');
            if (parts.length >= 3) {
                const p = parts[0].padStart(2, '0');
                const k = parts[1].padStart(2, '0');
                const v = parts[2].trim().substring(0, 4); 
                
                if (v.length === 4) {
                    const rimpsuNum = parseInt(`${p}${k}${v}`, 10);
                    if (!isNaN(rimpsuNum)) {
                        suola = String(rimpsuNum % 997).padStart(3, '0');
                    }
                    vuosiPari = v.charAt(1) + v.charAt(3);
                }
            }
        }

        const kunta = state?.suunnitelman_perustiedot?.kotikunta?.muuttujat?.KUNTA || state?.asiakas?.kotikunta || 'X';
        
        // --- KIELEN TUNNISTUS ---
        let kieli = 'X';
        if (activeSignals && getSignalInfo) {
            for (const key of Object.keys(activeSignals)) {
                if (activeSignals[key]) {
                    const info = getSignalInfo(key);
                    if (info && info.cat === 'Äidinkieli') {
                        kieli = key;
                        break;
                    }
                }
            }
        }

        if (kieli === 'X' && state?.['custom-kielitaso_aidinkieli']) {
            kieli = state['custom-kielitaso_aidinkieli'];
        }

        // Tunniste luodaan suolan, kielen, KUNNAN ja vuosiparin perusteella
        const idPart = `${suola}${normalize(kieli)}${normalize(kunta)}${normalize(vuosiPari)}`;

        // --- 2. HOLVIN SISÄLTÖ (JSON Reppu) ---
        let tapa = 'XXX'; 
        const yhtTapa = state?.suunnitelman_perustiedot?.laadittu?.muuttujat?.YHTEYDENOTTOTAPA || '';
        const yhtTapaStr = String(yhtTapa).toLowerCase();
        if (yhtTapaStr.includes('puhelin')) tapa = 'PUH';
        else if (yhtTapaStr.includes('käynti') || yhtTapaStr.includes('kaynti')) tapa = 'KÄY';

        let nykyKk = null;
        let nykyVuosi = null;
        const uusiPvm = state?.suunnitelman_perustiedot?.laadittu?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (uusiPvm) {
            const parts = String(uusiPvm).split('.');
            if (parts.length >= 3) {
                nykyKk = parseInt(parts[1], 10);
                nykyVuosi = parseInt(parts[2], 10);
            }
        }

        let syntymaVuosi = null;
        const sv = state?.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI || state?.asiakas?.syntymavuosi;
        if (sv) {
            const numSv = String(sv).replace(/\D/g, '');
            if (numSv.length >= 4) syntymaVuosi = numSv.substring(0, 4);
        }

        // Haetaan postinumero, jotta se voidaan pakata reppuun
        let postinumero = state?.asiakas?.postinumero || null;
        if (postinumero && String(postinumero).length !== 5) {
            postinumero = null; // Varmistetaan, että tallennetaan vain valideja numeroita
        }

      const aiempiHistoria = Array.isArray(state?.asiakas?.tapaamishistoria) ? state.asiakas.tapaamishistoria : [];
        let uusiHistoria = [...aiempiHistoria];

        if (tapa !== 'XXX' && nykyKk && nykyVuosi) {
            // Katsotaan onko täsmälleen sama jo olemassa
            const isDuplicate = uusiHistoria.some(h => h.tapa === tapa && h.kk === nykyKk && h.v === nykyVuosi);
            if (!isDuplicate) {
                uusiHistoria.push({ tapa, kk: nykyKk, v: nykyVuosi });
            }
        }

        // KORJAUS: Järjestetään AINA aikajärjestykseen (uusin vuosi ensin, sitten uusin kuukausi)
        uusiHistoria.sort((a, b) => {
            if (b.v !== a.v) return b.v - a.v;
            return b.kk - a.kk;
        });

        if (uusiHistoria.length > 3) {
            uusiHistoria = uusiHistoria.slice(0, 3);
        }
        
        // Pakataan tiedot reppuun
        const payload = {
            sv: syntymaVuosi,
            postinro: postinumero, // UUSI: Postinumero matkustaa täällä
            historia: uusiHistoria
        };

        return { idPart, payload };
    }, [state, activeSignals, getSignalInfo]);

    return { getFingerprintData };
};