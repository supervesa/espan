import React, { useState } from 'react';
import { FileText, Wand2 } from 'lucide-react';
import { extractAIOccupations, extractWithRules } from '../../../utils/regex'; 

const TyotilanneNotes = ({ customText, onUpdateCustomText, uiKey, actions, dynamicKeys, phrases }) => {
    const [isExtracting, setIsExtracting] = useState(false);
    const [feedback, setFeedback] = useState('');

    const handleQuickExtract = async () => {
        if (!customText) return;
        setIsExtracting(true);
        setFeedback('');
        let foundSomething = false;
        
        // Luodaan muuttuja, jota voimme muokata ja siivota prosessin aikana
        let newCustomText = customText; 

        console.log("--- PIKAPURKU ALOITETTU (Uusi Sääntömoottori) ---");

        // 1. Pura Ammatit
        const { esco, finesco } = extractAIOccupations(newCustomText);

        if (finesco) {
            console.log("Löydettiin Finesco-ala:", finesco);
            actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finesco);
            actions.onAddSignal(`AI_FINESCO_${finesco}`);
            foundSomething = true;
        }

        if (esco) {
            console.log("Löydettiin ESCO-ammatti:", esco);
            actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', esco);
            actions.onAddSignal(`AI_ESCO_${esco}`);
            foundSomething = true;
            try {
                const res = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(esco)}&language=fi&type=occupation`);
                if (res.ok) {
                    const data = await res.json();
                    if (data._embedded?.results?.[0]) actions.onUpdateAsiakas('tavoiteammatti_esco_uri', data._embedded.results[0].uri);
                }
            } catch (e) {}
        }

        // 2. Pura säännöt (Sääntömoottori käy läpi Base_textin sekä Regexin)
        const extractedRules = extractWithRules(newCustomText, phrases || [], [], dynamicKeys);

        // KORJAUS: Ruksitaan fraasit JA poistetaan ne tekstikentästä pomminvarmasti
        if (extractedRules.foundPhrases.length > 0) {
            console.log("Löydettiin ruksittavia fraaseja:", extractedRules.foundPhrases);
            
            extractedRules.foundPhrases.forEach(phraseKey => {
                // Asetetaan laatikko päälle
                actions.onUpdateVariable(uiKey, phraseKey, true);
                
                // SIIVOUS: Etsitään alkuperäinen teksti ja poistetaan se laatikosta
                const phraseObj = phrases?.find(p => p.avainsana === phraseKey || p.phrase_key === phraseKey);
                
                if (phraseObj && (phraseObj.base_text || phraseObj.teksti)) {
                    // Haetaan teksti ja poistetaan mahdolliset välilyönnit reunoilta
                    let baseTextToClean = (phraseObj.base_text || phraseObj.teksti).trim();
                    
                    // POISTETAAN PISTE LOPUSTA joustavuuden vuoksi, jotta osuu URA-tekstiin
                    baseTextToClean = baseTextToClean.replace(/\.$/, '');
                    
                    // Escapetaan teksti regexiä varten turvalliseksi
                    const safeBaseText = baseTextToClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // Regex: Poistaa base_textin ja mahdollisen "Asiakkaan työtilanne" otsikon sen yläpuolelta
                    // \s* tarkoittaa tyhjiä rivejä tai välilyöntejä
                    const cleanupRegex = new RegExp(`(?:Asiakkaan työtilanne\\s*\\n\\s*)?${safeBaseText}\\.?\\s*`, 'gi');
                    
                    newCustomText = newCustomText.replace(cleanupRegex, '\n');
                }
            });
            foundSomething = true;
        }

        // 3. Varmistetaan, ettei tekstin alkuun jäänyt orpoa otsikkoa yksinään,
        // jos itse lause poistettiin toisella tavalla
        newCustomText = newCustomText.replace(/Asiakkaan työtilanne\s*\n*(?=URA-|Asiakkaan tavoite|$)/gi, '');

        // 4. Käsitellään erikseen päivämäärät (Palvelut)
        if (extractedRules.services.length > 0) {
            const service = extractedRules.services[0]; 
            console.log("Löydettiin palvelun päivämäärät:", service);
            
            actions.onUpdateVariable(uiKey, 'palvelu_alku', service.start);
            actions.onUpdateVariable(uiKey, 'palvelu_loppu', service.end);
            
            if (typeof actions.onUpdateAsiakas === 'function') {
                actions.onUpdateAsiakas('palvelu_alku', service.start);
                actions.onUpdateAsiakas('palvelu_loppu', service.end);
            }
            foundSomething = true;
        }

        // 5. Tallenna muokattu ja siistitty teksti takaisin tekstikenttään
        if (foundSomething) {
            // Poistetaan ylimääräiset tyhjät rivit, joita tekstin poisto saattoi jättää
            newCustomText = newCustomText.replace(/\n{3,}/g, '\n\n').trim();
            if (newCustomText !== customText) {
                console.log("Siivottu teksti tallennetaan!");
                onUpdateCustomText(uiKey, newCustomText);
            }
        }

        if (extractedRules.foundPhrases.length === 0 && extractedRules.services.length === 0) {
            console.log("Palveluita tai fraaseja ei löytynyt tekstistä.");
        }

        setIsExtracting(false);
        setFeedback(foundSomething ? '✓ Tiedot poimittu lomakkeelle!' : 'Ei uutta dataa poimittavaksi.');
        setTimeout(() => setFeedback(''), 4000);
    };

    return (
        <div className="custom-text-container" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                <label htmlFor={`custom-text-${uiKey}`} className="icon-label" style={{ margin: 0, fontSize: '1.05rem' }}>
                    <FileText size={18} className="text-primary" /> Vapaat lisätiedot ja yhteenveto
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {feedback && <span className="feedback-text" style={{ fontSize: '0.85rem' }}>{feedback}</span>}
                    <button 
                        className="btn-ai-action" 
                        onClick={handleQuickExtract} 
                        disabled={!customText || isExtracting}
                        title="Tekoäly etsii ammatit ja päivämäärät ja siirtää ne lomakkeelle!"
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderRadius: '4px' }}
                    >
                        {isExtracting ? <Wand2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 
                        Pura tiedot lomakkeelle
                    </button>
                </div>
            </div>

            <p className="stat-label" style={{ marginBottom: '1rem' }}>
                Kirjaa tähän omat huomiosi. Jos tekstissä on URA-yhteenveto, voit purkaa tiedot lomakkeelle yllä olevasta napista.
            </p>

            <textarea
                id={`custom-text-${uiKey}`}
                rows="8"
                className="form-input text-mono"
                value={customText || ''}
                onChange={(e) => onUpdateCustomText(uiKey, e.target.value)}
                placeholder="Kirjaa tähän mahdolliset lisätiedot..."
                style={{ lineHeight: '1.6', padding: '1rem' }}
            />
        </div>
    );
};

export default TyotilanneNotes;