import { useMemo } from 'react';
import { kielitaitoTasot } from '../../data/guide'; // Varmista polku
import { toLowerFirst, createListSentence } from '../../utils/stringUtils';

export const useKoulutusSummary = (
    koulutusState,
    ammattikortitState,
    yrittajyysState,
    kielitasoState,
    customTekstit,
    sectionData,          // Koulutus data
    korttiSectionData,    // Kortti data
    yrittajyysSectionData // Yrittäjyys data
) => {

    const summaryData = useMemo(() => {
        // Alustetaan tilat tyhjiksi objekteiksi varmuuden vuoksi
        koulutusState = koulutusState || {};
        ammattikortitState = ammattikortitState || {};
        yrittajyysState = yrittajyysState || {};
        const { customKoulutusText, customKielitasoText } = customTekstit || {};

        // Haetaan fraasit omista osioistaan
        const koulutusFraasit = sectionData?.fraasit || [];
        const korttiFraasit = korttiSectionData?.fraasit || [];
        const yrittajyysFraasit = yrittajyysSectionData?.fraasit || [];

        // Alustetaan osien lauseet
        let koulutusLause = '';
        let yrittajyysLause = '';
        let ammattikorttiLause = '';
        let kielitaitoLause = '';

        // Kerätään generoidut osat tähän
        let generatedParts = [];

        // --- 1a. Käsittele Koulutus-valinta ---
        if (koulutusState && koulutusState.avainsana) {
            const phrase = koulutusFraasit.find(f => f.avainsana === koulutusState.avainsana);
            if (phrase) {
                let text = phrase.teksti || '';
                if (koulutusState.muuttujat) {
                    Object.entries(koulutusState.muuttujat).forEach(([key, value]) => {
                        if (value || typeof value === 'number') {
                            text = text.replace(`[${key}]`, value);
                        }
                    });
                }
                koulutusLause = text.replace(/\s*\[.*?\]/g, '').trim();
                if (koulutusLause) generatedParts.push(koulutusLause);
            }
        }

        // --- 1b. Käsittele Yrittäjyys-valinta ---
        if (yrittajyysState && yrittajyysState.avainsana) {
             const phrase = yrittajyysFraasit.find(f => f.avainsana === yrittajyysState.avainsana);
             if(phrase) {
                 yrittajyysLause = phrase.teksti.trim();
                 if (yrittajyysLause) generatedParts.push(yrittajyysLause);
             }
        }

        // --- 2. Käsittele Ammattikortit (KORJATTU EHTO) ---
        const selectedCards = Object.keys(ammattikortitState)
            .map(avainsana => {
                // TARKISTETAAN, ONKO ARVO OBJEKTI (vanha App.jsx tallentaa näin)
                if (typeof ammattikortitState[avainsana] === 'object' && ammattikortitState[avainsana] !== null) {
                    const fraasi = korttiFraasit.find(f => f.avainsana === avainsana);
                    if (fraasi) {
                        return fraasi.teksti; // Otetaan tekstikenttä planData:sta
                    }
                }
                // Jos tulevaisuudessa App.jsx korjataan tallentamaan 'true', tämä ehto toimisi:
                // else if (ammattikortitState[avainsana] === true) { ... }
                return null;
            })
            .filter(Boolean); // Poistaa null-arvot

        if (selectedCards.length > 0) {
            const cardListString = createListSentence(selectedCards);
            ammattikorttiLause = `Asiakkaalla on voimassa mm. ${cardListString}.`;
            generatedParts.push(ammattikorttiLause);
        }

        // --- 3. Käsittele Kielitaito ---
        let languageParts = [];
        let suomiTiedot = '';
        if (kielitasoState?.muutKielet && kielitasoState.muutKielet.length > 0) {
             if (typeof kielitaitoTasot !== 'undefined') {
                const suomi = kielitasoState.muutKielet.find(lang => lang.kieli.toLowerCase() === 'suomi' && lang.taso);
                if (suomi) {
                    const levelDescription = kielitaitoTasot[suomi.taso]?.selkokuvaus;
                    if (levelDescription) {
                        suomiTiedot = toLowerFirst(levelDescription);
                    }
                }
             }
        }
        if (kielitasoState?.aidinkieli && suomiTiedot) {
            const suomiTiedotSuomeksi = suomiTiedot.replace(/^(\w+)/, '$1 suomeksi');
            languageParts.push(`Asiakkaan äidinkieli on ${kielitasoState.aidinkieli}, asiakas ${suomiTiedotSuomeksi}`);
        } else if (kielitasoState?.aidinkieli) {
            languageParts.push(`Asiakkaan äidinkieli on ${kielitasoState.aidinkieli}.`);
        } else if (suomiTiedot) {
            const suomiTiedotSuomeksi = suomiTiedot.replace(/^(\w+)/, '$1 suomeksi');
            languageParts.push(`Asiakas ${suomiTiedotSuomeksi}`);
        }
        if (languageParts.length > 0) {
            const lause = languageParts.join(', ');
            kielitaitoLause = lause.endsWith('.') ? lause : lause + '.';
            generatedParts.push(kielitaitoLause);
        }

        // --- 4. Yhdistä generoidut ja custom-tekstit ---
        const combinedGenerated = generatedParts.filter(part => part && part.trim() !== '').join(' ').replace(/\.\./g, '.').trim();

        let finalTextParts = [];
        if (combinedGenerated) finalTextParts.push(combinedGenerated);

         // Lisää customKielitasoText (jos on olemassa JA eroaa generoidusta)
         if (customKielitasoText && customKielitasoText.trim()) {
             if (!combinedGenerated.includes(customKielitasoText.trim())) {
                 if(!finalTextParts.some(p => p === customKielitasoText.trim())) {
                    finalTextParts.push(customKielitasoText.trim());
                 }
             }
         }

        // Yhdistetään lopullinen lause pisteillä ja välilyönneillä
        let yhdistettyLause = finalTextParts.join('. ').replace(/\.\./g, '.').trim();
         // Varmistetaan, että lopussa on piste, jos tekstiä on
        if (yhdistettyLause && !yhdistettyLause.endsWith('.')) {
             yhdistettyLause += '.';
        }

        // Palautetaan objekti, joka sisältää sekä osat että lopullisen yhdistetyn lauseen
        return {
            koulutusLause,
            yrittajyysLause,
            ammattikorttiLause,
            kielitaitoLause,
            yhdistettyLause
        };

    }, [
        koulutusState,
        ammattikortitState,
        yrittajyysState,
        kielitasoState,
        customTekstit,
        sectionData,
        korttiSectionData,
        yrittajyysSectionData
    ]);

    // Palautetaan koko dataobjekti
    return summaryData;
};