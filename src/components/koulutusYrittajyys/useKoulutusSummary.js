import { useMemo } from 'react';
import { toLowerFirst, createListSentence } from '../../utils/stringUtils';

// Apufunktio päivämäärän parsimiseen (sama kuin Tyotilanne-osiossa)
const parseDate = (s) => {
    if (!s) return null;
    const p = s.split('.');
    if (p.length !== 3) return new Date(s);
    return new Date(p[2], p[1] - 1, p[0]);
};

// Apufunktio statuksen määrittämiseen suhteessa nykyhetkeen (15.6.2026)
const getStatus = (alku, loppu) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const s = parseDate(alku);
    const e = parseDate(loppu);

    if (!s || !e || isNaN(s) || isNaN(e)) return 'present';
    if (e < now) return 'past';
    if (s <= now && e >= now) return 'present';
    return 'future';
};

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

        // --- 3. Pätevyydet ja kortit ---
        try {
            if (customTekstit?.valitut_ammattikortit) {
                const valitutKortit = JSON.parse(customTekstit.valitut_ammattikortit);
                if (Array.isArray(valitutKortit) && valitutKortit.length > 0) {
                    const korttiNimetArray = valitutKortit.map(k => k.nimi);
                    const korttiNimet = createListSentence(korttiNimetArray);
                    ammattikorttiLause = `Asiakkaalla on voimassa olevat pätevyydet: ${korttiNimet}.`;
                    generatedParts.push(ammattikorttiLause);
                }
            }
        } catch(e) { console.error(e); }

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

            if (osat.length === 2) digitaidotLause = `Asiakkaalla on ${osat[0]} ja ${osat[1]}.`;
            else if (digitaidot) digitaidotLause = `Asiakkaalla on ${osat[0]}.`;
            else if (pankkitunnukset) digitaidotLause = osat[0].charAt(0).toUpperCase() + osat[0].slice(1) + '.';
            if (digitaidotLause) generatedParts.push(digitaidotLause);
        }

        // --- 6. Tekoälyn valitut koulutusideat ---
        try {
            if (customTekstit?.valitutAiIdeat) {
                const ideatArray = JSON.parse(customTekstit.valitutAiIdeat);
                if (Array.isArray(ideatArray) && ideatArray.length > 0) {
                    ideatLause = `Asiakkaan kanssa sovittiin seuraavien koulutusmahdollisuuksien selvittämisestä: ${ideatArray.join(', ')}.`;
                    generatedParts.push(ideatLause);
                }
            }
        } catch (e) { console.error(e); }

        // --- 7. TUETTU OPISKELU (GOLDEN MASTER INTEGRAATIO) ---
        const services = customTekstit?.sessionServices || [];
        const studies = services.filter(s => s.category === 'opiskelu');

        if (studies.length > 0) {
            const studySentences = studies.map(s => {
                const status = getStatus(s.data.alku, s.data.loppu);
                const nimiPart = s.data.nimi ? `(${s.data.nimi}) ` : '';
                
                let verbi = "Asiakkaan kanssa on sovittu";
                let opiskelunTyyppi = "opiskelusta";

                if (status === 'past') {
                    verbi = "Asiakas on ollut";
                    switch (s.entity_key) {
                        case 'opiskelu_omaehtoinen': opiskelunTyyppi = "omaehtoisessa opiskelussa"; break;
                        case 'opiskelu_lyhytkestoinen': opiskelunTyyppi = "lyhytkestoisissa opinnoissa"; break;
                        case 'opiskelu_kotoutuja': opiskelunTyyppi = "kotoutujan omaehtoisessa opiskelussa"; break;
                        case 'opiskelu_sivutoiminen': opiskelunTyyppi = "sivutoimisessa opiskelussa"; break;
                    }
                } else if (status === 'present') {
                    verbi = "Asiakas on parhaillaan";
                    switch (s.entity_key) {
                        case 'opiskelu_omaehtoinen': opiskelunTyyppi = "omaehtoisessa opiskelussa"; break;
                        case 'opiskelu_lyhytkestoinen': opiskelunTyyppi = "lyhytkestoisissa opinnoissa"; break;
                        case 'opiskelu_kotoutuja': opiskelunTyyppi = "kotoutujan omaehtoisessa opiskelussa"; break;
                        case 'opiskelu_sivutoiminen': opiskelunTyyppi = "sivutoimisessa opiskelussa"; break;
                    }
                } else {
                    // Future - pidetään alkuperäinen taivutus
                    switch (s.entity_key) {
                        case 'opiskelu_omaehtoinen': opiskelunTyyppi = "työttömyysetuudella tuetusta omaehtoisesta opiskelusta"; break;
                        case 'opiskelu_lyhytkestoinen': opiskelunTyyppi = "työttömyysetuudella tuetuista lyhytkestoisista opinnoista"; break;
                        case 'opiskelu_kotoutuja': opiskelunTyyppi = "kotoutujan omaehtoisesta opiskelusta"; break;
                        case 'opiskelu_sivutoiminen': opiskelunTyyppi = "sivutoimisesta opiskelusta"; break;
                    }
                }

                let sentence = `${verbi} ${opiskelunTyyppi} ${nimiPart}ajalla ${s.data.alku} – ${s.data.loppu}.`;

                // Lakipykälät (vain jos merkitty dataan)
                let ehdot = [];
                if (s.data.edellytys_suunnitelma) ehdot.push("Opiskelusta on sovittu tässä suunnitelmassa (75 §)");
                if (s.data.edellytys_seuranta) ehdot.push("Opintojen etenemisen seurannasta on sovittu (77 §)");
                
                if (ehdot.length > 0) {
                    sentence += " " + createListSentence(ehdot) + ".";
                }
                return sentence;
            });

            tuettuOpiskeluLause = studySentences.join(' ');
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