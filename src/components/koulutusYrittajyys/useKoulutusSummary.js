// --- src/components/koulutusYrittajyys/useKoulutusSummary.js ---
import { useMemo } from 'react';
import { toLowerFirst, createListSentence } from '../../utils/stringUtils';

export const useKoulutusSummary = (
    koulutusState,
    ammattikortitState, // Pidetään mukana jotta rajapinta ei hajoa muiden komponenttien kanssa
    yrittajyysState,
    kielitasoState,
    customTekstit,
    koulutusPhrases,
    ammattikorttiPhrases, // Pidetään mukana
    yrittajyysPhrases,
    languageLevels
) => {
    return useMemo(() => {
        let koulutusLause = '';
        let yrittajyysLause = '';
        let ammattikorttiLause = '';
        let kielitaitoLause = '';
        let digitaidotLause = '';
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
        const yrittajyysUusiTeksti = customTekstit?.yrittajyys_teksti;
        if (yrittajyysUusiTeksti) {
            yrittajyysLause = yrittajyysUusiTeksti;
            generatedParts.push(yrittajyysLause);
        } else if (yrittajyysState?.avainsana) {
            const phrase = yrittajyysPhrases.find(f => f.phrase_key === yrittajyysState.avainsana);
            if (phrase?.base_text) {
                yrittajyysLause = phrase.base_text.trim();
                generatedParts.push(yrittajyysLause);
            }
        }

        // --- 3. Pätevyydet ja kortit (UUSI LOGIIKKA - KORJATTU KIELIOPPI) ---
        try {
            if (customTekstit?.valitut_ammattikortit) {
                const valitutKortit = JSON.parse(customTekstit.valitut_ammattikortit);
                
                if (Array.isArray(valitutKortit) && valitutKortit.length > 0) {
                    // Poimitaan nimet listaksi
                    const korttiNimetArray = valitutKortit.map(k => k.nimi);
                    // Käytetään hienoa listanmuodostajaa ("A, B ja C")
                    const korttiNimet = createListSentence(korttiNimetArray);
                    
                    ammattikorttiLause = `Asiakkaalla on voimassa olevat pätevyydet: ${korttiNimet}.`;
                    generatedParts.push(ammattikorttiLause);
                }
            }
        } catch(e) {
            console.error("Virhe ammattikorttien parsinnassa:", e);
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

        // --- 5. Digitaidot ja asiointi ---
        const digitaidot = customTekstit?.digitaidot;
        const pankkitunnukset = customTekstit?.pankkitunnukset;

        if (digitaidot || pankkitunnukset) {
            let osat = [];
            
            if (digitaidot === 'hyvat') osat.push('hyvät digitaidot');
            else if (digitaidot === 'perusteet') osat.push('perustason digitaidot');
            else if (digitaidot === 'heikot') osat.push('puutteelliset digitaidot tai niitä ei ole lainkaan');

            if (pankkitunnukset === 'kylla') osat.push('hänellä on käytössään vahva tunnistautuminen');
            else if (pankkitunnukset === 'ei') osat.push('hänellä ei ole käytössään vahvaa tunnistautumista');
            else if (pankkitunnukset === 'selvitettava') osat.push('vahvan tunnistautumisen tilanne on selvitettävä');

            if (osat.length === 2) {
                digitaidotLause = `Asiakkaalla on ${osat[0]} ja ${osat[1]}.`;
            } else if (digitaidot) {
                digitaidotLause = `Asiakkaalla on ${osat[0]}.`;
            } else if (pankkitunnukset) {
                digitaidotLause = osat[0].charAt(0).toUpperCase() + osat[0].slice(1) + '.';
            }
            
            if (digitaidotLause) {
                digitaidotLause = digitaidotLause.charAt(0).toUpperCase() + digitaidotLause.slice(1);
                generatedParts.push(digitaidotLause);
            }
        }

        // --- 6. Tekoälyn valitut koulutusideat ---
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

        // --- 7. Tuettu Opiskelu ---
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

            // B. Lakipykälä-ehdot
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
            digitaidotLause,
            ideatLause,
            tuettuOpiskeluLause,
            yhdistettyLause: yhdistettyLause + (yhdistettyLause && !yhdistettyLause.endsWith('.') ? '.' : '')
        };
    }, [koulutusState, ammattikortitState, yrittajyysState, customTekstit, koulutusPhrases, ammattikorttiPhrases, yrittajyysPhrases, languageLevels]);
};