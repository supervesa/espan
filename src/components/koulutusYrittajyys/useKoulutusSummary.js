// --- src/components/sections/useKoulutusSummary.js ---
import { useMemo } from 'react';
import { toLowerFirst, createListSentence } from '../../utils/stringUtils';

export const useKoulutusSummary = (
    koulutusState,
    ammattikortitState,
    yrittajyysState,
    kielitasoState,
    customTekstit,
    koulutusPhrases,
    ammattikorttiPhrases,
    yrittajyysPhrases,
    languageLevels
) => {
    return useMemo(() => {
        let koulutusLause = '';
        let yrittajyysLause = '';
        let ammattikorttiLause = '';
        let kielitaitoLause = '';
        let ideatLause = '';
        let tuettuOpiskeluLause = '';
        let generatedParts = [];

        // --- 1. Koulutus ---
        if (koulutusState?.avainsana) {
            const phrase = koulutusPhrases.find(f => f.phrase_key === koulutusState.avainsana);
            if (phrase) {
                let text = phrase.base_text || '';
                if (koulutusState.muuttujat) {
                    Object.entries(koulutusState.muuttujat).forEach(([key, value]) => {
                        if (value) text = text.replace(`[${key}]`, value);
                    });
                }
                koulutusLause = text.replace(/\s*\[.*?\]/g, '').trim();
                generatedParts.push(koulutusLause);
            }
        }

        // --- 2. Yrittäjyys ---
        if (yrittajyysState?.avainsana) {
             const phrase = yrittajyysPhrases.find(f => f.phrase_key === yrittajyysState.avainsana);
             if (phrase?.base_text) {
                 yrittajyysLause = phrase.base_text.trim();
                 generatedParts.push(yrittajyysLause);
             }
        }

        // --- 3. Ammattikortit ---
        const selectedCards = Object.keys(ammattikortitState || {})
            .map(key => {
                if (ammattikortitState[key]) {
                    const phrase = ammattikorttiPhrases.find(f => f.phrase_key === key);
                    return phrase?.base_text;
                }
                return null;
            })
            .filter(Boolean);

        if (selectedCards.length > 0) {
            ammattikorttiLause = `Asiakkaalla on voimassa mm. ${createListSentence(selectedCards)}.`;
            generatedParts.push(ammattikorttiLause);
        }

        // --- 4. Kielitaito ---
        const aidinkieli = customTekstit?.aidinkieli;
        const suomiTaso = customTekstit?.suomiTaso;

        if (aidinkieli && suomiTaso) {
            const levelData = languageLevels.find(l => l.level_key === suomiTaso);
            const workDesc = levelData ? toLowerFirst(levelData.work_description) : "";
            kielitaitoLause = `Asiakkaan äidinkieli on ${aidinkieli}, suomen kielen taito on tasolla ${suomiTaso}. Asiakas ${workDesc}`;
        } else if (aidinkieli) {
            kielitaitoLause = `Asiakkaan äidinkieli on ${aidinkieli}.`;
        } else if (suomiTaso) {
            const levelData = languageLevels.find(l => l.level_key === suomiTaso);
            const workDesc = levelData ? toLowerFirst(levelData.work_description) : "";
            kielitaitoLause = `Asiakkaan suomen kielen taito on tasolla ${suomiTaso}. Asiakas ${workDesc}`;
        }
        if (kielitaitoLause) generatedParts.push(kielitaitoLause.trim());

        // --- 5. Tekoälyn valitut koulutusideat ---
        try {
            if (customTekstit?.valitutAiIdeat) {
                const ideatArray = JSON.parse(customTekstit.valitutAiIdeat);
                if (Array.isArray(ideatArray) && ideatArray.length > 0) {
                    const yhdistettyIdeat = ideatArray.join(', ');
                    ideatLause = `Asiakkaan kanssa sovittiin seuraavien koulutusmahdollisuuksien selvittämisestä: ${yhdistettyIdeat}.`;
                    generatedParts.push(ideatLause);
                }
            }
        } catch (e) {
            console.error("Virhe AI-ideoiden parsinnassa:", e);
        }

        // --- 6. Tuettu Opiskelu (SIIRRETTY VIIMEISEKSI) ---
        if (customTekstit?.tuettu_aktiivinen) {
            let opiskelunTyyppi = "";
            switch (customTekstit.tuettu_tyyppi) {
                case 'omaehtoinen': opiskelunTyyppi = "omaehtoisesta opiskelusta"; break;
                case 'lyhytkestoinen': opiskelunTyyppi = "lyhytkestoisista opinnoista"; break;
                case 'kotoutuja': opiskelunTyyppi = "kotoutujan omaehtoisesta opiskelusta"; break;
                case 'sivutoiminen': opiskelunTyyppi = "sivutoimisesta opiskelusta"; break;
                default: opiskelunTyyppi = "opiskelusta";
            }

            // A. Peruslause (Tyyppi + Nimi + Aika)
            let alkuosa = `Asiakkaan kanssa on sovittu työttömyysetuudella tuetusta ${opiskelunTyyppi}`;
            if (customTekstit.tuettu_opinnon_nimi) {
                alkuosa += ` (${customTekstit.tuettu_opinnon_nimi})`;
            }
            if (customTekstit.tuettu_alku_pvm && customTekstit.tuettu_loppu_pvm) {
                const s = new Date(customTekstit.tuettu_alku_pvm).toLocaleDateString('fi-FI');
                const e = new Date(customTekstit.tuettu_loppu_pvm).toLocaleDateString('fi-FI');
                alkuosa += ` ajalla ${s} – ${e}`;
            }
            alkuosa += ".";

            // B. Lakipykälä-ehdot (Laitetaan siistiksi jatkolauseeksi)
            let ehdot = [];
            if (customTekstit.tuettu_perusopetus) ehdot.push("Opintojen tavoitteena on perusopetuksen oppimäärän suorittaminen (76 §)");
            if (customTekstit.tuettu_edellytys_suunnitelma) ehdot.push("Opiskelusta on sovittu tässä suunnitelmassa (75 §)");
            if (customTekstit.tuettu_edellytys_tarkoituksenmukaisuus) ehdot.push("Opiskelu parantaa olennaisesti ammattitaitoa ja mahdollisuuksia työllistyä avoimille työmarkkinoille (73 §)");
            if (customTekstit.tuettu_edellytys_seuranta) ehdot.push("Opintojen etenemisen seurannasta on sovittu (77 §)");

            tuettuOpiskeluLause = alkuosa;
            if (ehdot.length > 0) {
                tuettuOpiskeluLause += " " + createListSentence(ehdot) + ".";
            }

            generatedParts.push(tuettuOpiskeluLause);
        }

        const yhdistettyLause = generatedParts.join(' ').replace(/\.\./g, '.').trim();
        
        return {
            koulutusLause,
            yrittajyysLause,
            ammattikorttiLause,
            kielitaitoLause,
            ideatLause,
            tuettuOpiskeluLause,
            yhdistettyLause: yhdistettyLause + (yhdistettyLause && !yhdistettyLause.endsWith('.') ? '.' : '')
        };
    }, [koulutusState, ammattikortitState, yrittajyysState, customTekstit, koulutusPhrases, ammattikorttiPhrases, yrittajyysPhrases, languageLevels]);
};