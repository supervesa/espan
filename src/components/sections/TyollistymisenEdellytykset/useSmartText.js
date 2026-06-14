// /src/components/sections/TyollistymisenEdellytykset/useSmartText.js
import { useCallback } from 'react';

export const useSmartText = () => {
    
    // 1. Dynaaminen Haistelija
    const sniffText = useCallback((text, phrasesData = []) => {
        if (!text || phrasesData.length === 0) return [];
        
        const lowerText = text.toLowerCase();
        const foundPhraseKeys = [];
        
        phrasesData.forEach(phrase => {
            // extraction_pattern on nyt puhdas JSON array tietokannassa!
            const keywords = phrase.extraction_pattern || [];
            
            // Tarkistetaan löytyykö mikään avainsanoista tekstistä
            const isMatch = keywords.some(word => lowerText.includes(word.toLowerCase()));
            
            if (isMatch) {
                foundPhraseKeys.push(phrase.phrase_key);
            }
        });
        
        return foundPhraseKeys;
    }, []);

    // 2. Nivova lausemoottori
    const buildSentence = useCallback((fragments, intro = "", outro = ".") => {
        if (!fragments || fragments.length === 0) return "";
        
        let listText = "";
        if (fragments.length === 1) {
            listText = fragments[0];
        } else if (fragments.length === 2) {
            listText = `${fragments[0]} ja ${fragments[1]}`;
        } else {
            listText = `${fragments.slice(0, -1).join(", ")} sekä ${fragments[fragments.length - 1]}`;
        }
        
        return `${intro}${listText}${outro}`;
    }, []);

    // 3. Markkina-arvion lausemoottori
    const buildMarkkinaArvioText = useCallback((onPitkittynyt, tyollistymisMahdollisuudet, esteFragments) => {
        let sentences = [];
        if (onPitkittynyt) sentences.push("Asiakkaan työttömyys on pitkittynyt.");
        if (tyollistymisMahdollisuudet) sentences.push(`Työllistymismahdollisuudet avoimille markkinoille lähiaikoina arvioidaan ${tyollistymisMahdollisuudet.toLowerCase()}.`);
        if (esteFragments && esteFragments.length > 0) sentences.push(buildSentence(esteFragments, "Työllistymistä haastaa lisäksi ", "."));
        
        return sentences.join(" ");
    }, [buildSentence]);

    return { sniffText, buildSentence, buildMarkkinaArvioText };
};