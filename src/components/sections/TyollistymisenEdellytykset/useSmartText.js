// /src/components/sections/TyollistymisenEdellytykset/useSmartText.js
import { useCallback } from 'react';

export const useSmartText = () => {
    
    // 1. Dynaaminen Haistelija
    const sniffText = useCallback((text, phrasesData = []) => {
        if (!text || phrasesData.length === 0) return [];
        const lowerText = text.toLowerCase();
        const foundPhraseKeys = [];
        phrasesData.forEach(phrase => {
            const keywords = phrase.extraction_pattern || [];
            const isMatch = keywords.some(word => lowerText.includes(word.toLowerCase()));
            if (isMatch) foundPhraseKeys.push(phrase.phrase_key);
        });
        return foundPhraseKeys;
    }, []);

    // 2. Nivova lausemoottori
    const buildSentence = useCallback((fragments, intro = "", outro = ".") => {
        if (!fragments || fragments.length === 0) return "";
        let listText = "";
        if (fragments.length === 1) listText = fragments[0];
        else if (fragments.length === 2) listText = `${fragments[0]} ja ${fragments[1]}`;
        else listText = `${fragments.slice(0, -1).join(", ")} sekä ${fragments[fragments.length - 1]}`;
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

    // 4. Yksittäisen palvelun lause (jos lisätään vain yksi)
    const buildPalveluHistoriaText = useCallback((service) => {
        if (!service || !service.title) return "";
        const tila = service.tila ? service.tila.toLowerCase() : 'ohjattu';
        const syy = service.lisatieto ? service.lisatieto.trim() : '';

        let lisatietoPate = "";
        let lisatietoLause = "";
        if (syy) {
            if (syy.length <= 35 && !syy.includes(' ja ') && !syy.includes('.')) {
                lisatietoPate = ` (${syy.replace(/\.$/, '')})`; 
            } else {
                lisatietoLause = ` ${syy.charAt(0).toUpperCase() + syy.slice(1)}`;
            }
        }

        let teksti = "";
        if (tila === 'suoritettu') teksti = `Aiemmin asiakkaalla suoritettu palvelu ${service.title}${lisatietoPate}.`;
        else if (tila === 'alkanut') teksti = `Asiakas osallistuu tällä hetkellä palveluun ${service.title}${lisatietoPate}.`;
        else if (tila === 'keskeytynyt') teksti = `Asiakas on keskeyttänyt palvelun ${service.title}${lisatietoPate}.`;
        else if (tila === 'ei soveltuva') teksti = `Asiakas on todettu ei-soveltuvaksi palveluun ${service.title}${lisatietoPate}.`;
        else if (tila === 'peruuntunut') teksti = `Palvelu ${service.title} on peruuntunut${lisatietoPate}.`;
        else {
            let tilaSana = tila;
            if (!['ohjattu', 'jonossa', 'hakenut'].includes(tila)) tilaSana = 'ohjattu';
            if (tilaSana === 'jonossa') teksti = `Asiakas on jonossa palveluun ${service.title}${lisatietoPate}.`;
            else if (tilaSana === 'hakenut') teksti = `Asiakas on hakenut palveluun ${service.title}${lisatietoPate}.`;
            else teksti = `Asiakas on ohjattu palveluun ${service.title}${lisatietoPate}.`;
        }
        
        if (lisatietoLause && tila === 'keskeytynyt') teksti += ` Perustelu:${lisatietoLause}`;
        else if (lisatietoLause && tila === 'ei soveltuva') teksti += ` Perustelu:${lisatietoLause}`;
        else if (lisatietoLause && tila === 'peruuntunut') teksti += ` Syy:${lisatietoLause}`;
        else if (lisatietoLause) teksti += lisatietoLause;

        return teksti.replace(/\.\./g, '.').trim();
    }, []);

    // 5. UUSI: Älykäs kokoava eräajo (Yhdistää saman tyyppiset, ei rivinvaihtoja!)
    const buildKokoPalveluhistoriaText = useCallback((services) => {
        if (!services || services.length === 0) return "";

        const suoritetut = [];
        const menossa = [];
        const negatiiviset = [];

        services.forEach(service => {
            const tila = service.tila ? service.tila.toLowerCase() : 'ohjattu';
            const syy = service.lisatieto ? service.lisatieto.trim() : '';
            
            let lisatietoPate = "";
            let lisatietoLause = "";
            if (syy) {
                if (syy.length <= 35 && !syy.includes(' ja ') && !syy.includes('.')) {
                    lisatietoPate = ` (${syy.replace(/\.$/, '')})`; 
                } else {
                    lisatietoLause = ` ${syy.charAt(0).toUpperCase() + syy.slice(1)}`;
                }
            }

            const obj = { title: service.title, lisatietoPate, lisatietoLause, tila };

            if (tila === 'suoritettu') suoritetut.push(obj);
            else if (['keskeytynyt', 'ei soveltuva', 'peruuntunut'].includes(tila)) negatiiviset.push(obj);
            else menossa.push(obj);
        });

        let lauseet = [];

        // Ryhmä 0: Menossa olevat yhdistetään yhdeksi lauseeksi
        if (menossa.length > 0) {
            if (menossa.length === 1) {
                const s = menossa[0];
                let alku = "Asiakas on ohjattu palveluun";
                if (s.tila === 'jonossa') alku = "Asiakas on jonossa palveluun";
                if (s.tila === 'hakenut') alku = "Asiakas on hakenut palveluun";
                if (s.tila === 'alkanut') alku = "Asiakas osallistuu tällä hetkellä palveluun";
                
                let txt = `${alku} ${s.title}${s.lisatietoPate}.`;
                if (s.lisatietoLause) txt += s.lisatietoLause;
                lauseet.push(txt);
            } else {
                const nimet = menossa.map(s => `${s.title}${s.lisatietoPate}`);
                let txt = `Asiakas on ohjattu palveluihin ${buildSentence(nimet, "", "")}.`;
                menossa.forEach(s => { if (s.lisatietoLause) txt += s.lisatietoLause; });
                lauseet.push(txt);
            }
        }

        // Ryhmä 1: Suoritetut yhdistetään yhdeksi lauseeksi
        if (suoritetut.length > 0) {
            if (suoritetut.length === 1) {
                const s = suoritetut[0];
                let txt = `Aiemmin asiakkaalla suoritettu palvelu ${s.title}${s.lisatietoPate}.`;
                if (s.lisatietoLause) txt += s.lisatietoLause;
                lauseet.push(txt);
            } else {
                const nimet = suoritetut.map(s => `${s.title}${s.lisatietoPate}`);
                let txt = `Aiemmin asiakkaalla suoritetut palvelut: ${buildSentence(nimet, "", "")}.`;
                suoritetut.forEach(s => { if (s.lisatietoLause) txt += s.lisatietoLause; });
                lauseet.push(txt);
            }
        }

        // Ryhmä 2-4: Negatiiviset aina omina lauseinaan
        negatiiviset.forEach(s => {
            let txt = "";
            if (s.tila === 'keskeytynyt') {
                txt = `Asiakas on keskeyttänyt palvelun ${s.title}${s.lisatietoPate}.`;
                if (s.lisatietoLause) txt += ` Perustelu:${s.lisatietoLause}`;
            } else if (s.tila === 'ei soveltuva') {
                txt = `Asiakas on todettu ei-soveltuvaksi palveluun ${s.title}${s.lisatietoPate}.`;
                if (s.lisatietoLause) txt += ` Perustelu:${s.lisatietoLause}`;
            } else if (s.tila === 'peruuntunut') {
                txt = `Palvelu ${s.title} on peruuntunut${s.lisatietoPate}.`;
                if (s.lisatietoLause) txt += ` Syy:${s.lisatietoLause}`;
            }
            lauseet.push(txt);
        });

        // Yhdistetään kaikki listan lauseet yhdeksi puhtaaksi kappaleeksi (erottimena välilyönti, EI rivinvaihtoja)
        return lauseet.join(" ").replace(/\.\./g, '.').replace(/\s{2,}/g, ' ').trim();
    }, [buildSentence]);

    return { sniffText, buildSentence, buildMarkkinaArvioText, buildPalveluHistoriaText, buildKokoPalveluhistoriaText };
};