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

        // --- 4. Kielitaito (Äidinkieli + Suomi dynaamisesti) ---
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

        const yhdistettyLause = generatedParts.join(' ').replace(/\.\./g, '.').trim();
        
        return {
            koulutusLause,
            yrittajyysLause,
            ammattikorttiLause,
            kielitaitoLause,
            yhdistettyLause: yhdistettyLause + (yhdistettyLause && !yhdistettyLause.endsWith('.') ? '.' : '')
        };
    }, [koulutusState, ammattikortitState, yrittajyysState, customTekstit, koulutusPhrases, ammattikorttiPhrases, yrittajyysPhrases, languageLevels]);
};