import React, { useState, useMemo } from 'react';
// TUO TARVITTAVAT DATATIEDOSTOT JA VAKIOT
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
// OLETETAAN, ETTÄ constants.js on samassa kansiossa kuin planData.js (tai korjaa polku)
import { PALKKATUKI_LISAHUOMIOT } from '../data/constants.js';
import AikatauluEhdotus from './AikatauluEhdotus';

const FINGERPRINT = '\u200B\u200D\u200C';

// Apufunktio fraasin käsittelyyn (KOPIOITU)
const processPhrase = (phraseData, specificSelectionState) => {
    if (!phraseData || !phraseData.teksti) return '';
    let text = phraseData.teksti;
    const variableSource = specificSelectionState?.muuttujat || {};
    if (phraseData.muuttujat && typeof variableSource === 'object') {
        Object.keys(phraseData.muuttujat).forEach((key) => {
            const value = variableSource[key];
            if (value !== undefined && value !== null) {
                try {
                    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`\\\[${escapedKey}\\]`, 'g');
                    text = text.replace(regex, String(value));
                } catch (e) { console.error(`Error replacing variable [${key}]:`, e); }
            }
        });
    }
    text = text.replace(/\(\s*v\.\s*\)/g, '').replace(/\s*\[[A-Z_]+\]/g, '').trim();
    return text.replace(/\.$/, '').trim();
};

// Apufunktio yksittäisen osion sisällön generointiin (KORJATTU Object.keys-virhe)
const generateSectionContent = (section, selection, state) => {
    // console.log(`[generateSectionContent LIST] Processing section: ${section?.id}`, { selection });
    let generated = '';
    const sectionId = section?.id;
    if (!sectionId) return '';

    if (sectionId === 'tyokyky' && state.tyokyky) {
       // ... (Työkyky-logiikka ennallaan) ...
        const s = state.tyokyky; let tyokykyParts = [];
        if (s.paavalinta) { /*...*/ } if (s.omaArvio) { /*...*/ } if (s.palveluohjaukset) { /*...*/ }
        let combinedSelectionsText = tyokykyParts.join('. ').trim();
        if (s.koonti && s.koonti.trim()) { /*...*/ generated = combinedSelectionsText ? combinedSelectionsText + '\n\n' + `Koonti keskustelusta:\n${s.koonti.trim()}` : `Koonti keskustelusta:\n${s.koonti.trim()}`; }
        else { generated = combinedSelectionsText; }
    }
    else if (sectionId === 'palkkatuki' && state.palkkatuki) {
        generated = state.palkkatuki.puoltoKappale?.replace(/\.$/, '').trim() || '';
        if (state.palkkatuki.lisahuomiot && typeof PALKKATUKI_LISAHUOMIOT === 'object' && Object.values(state.palkkatuki.lisahuomiot).some(v => v)) {
            const lisahuomiotText = Object.entries(state.palkkatuki.lisahuomiot)
                .filter(([key, value]) => value && PALKKATUKI_LISAHUOMIOT[key])
                .map(([key]) => PALKKATUKI_LISAHUOMIOT[key].label)
                .join('\n- ');
             if(lisahuomiotText) {
                 generated += (generated ? '\n\n' : '') + `Lisähuomiot:\n- ${lisahuomiotText}`;
             }
        }
    }
    else if (sectionId === 'tyonhakuvelvollisuus' && selection) {
        // ... (Työnhakuvelvollisuus-logiikka ennallaan) ...
        const originalSectionData = planData.aihealueet.find(s => s.id === sectionId);
        const phraseData = originalSectionData?.fraasit?.find(f => f.avainsana === selection.avainsana);
        if (phraseData) { /*...*/ generated = processPhrase(phraseData, selection); /* + alennus + lopputeksti */}
    }
    else if (sectionId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
        generated = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
    }
    // --- KORJAUS TÄSSÄ: Lisätty tarkistus `if (!selection)` ---
    else if (selection && typeof selection === 'object') {
         const originalSectionData = planData.aihealueet.find(s => s.id === sectionId);
        let generatedParts = [];
        if (originalSectionData?.monivalinta) {
            // TÄMÄ AIHEUTTI VIRHEEN: Object.keys(selection)
            // Lisätään tarkistus, että selection ei ole null
            if (selection) { 
                const selectedKeys = Object.keys(selection).filter(avainsana =>
                    avainsana !== 'avainsana' && avainsana !== 'muuttujat' && selection[avainsana]
                );
                selectedKeys.forEach(avainsana => {
                    const phraseState = selection[avainsana];
                    const phraseData = originalSectionData.fraasit?.find(f => f.avainsana === avainsana);
                    if (phraseData) {
                        let processedText = '';
                        if (typeof phraseState === 'object' && phraseState !== null && phraseState.avainsana === avainsana) { processedText = processPhrase(phraseData, phraseState); }
                        else if (phraseState === true) { processedText = processPhrase(phraseData, {}); }
                        if (processedText) generatedParts.push(processedText);
                    }
                });
                generated = generatedParts.join('. ');
            }

        } else if (selection.avainsana) { // Yksivalinta
            const phraseData = originalSectionData?.fraasit?.find(f => f.avainsana === selection.avainsana);
            if (phraseData) { generated = processPhrase(phraseData, selection); }
        }
    }
    // Koulutus, Yrittäjyys, Ammattikortit, Kielitaso
    else if (['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(section.id)) {
        let generatedParts = [];
        if (section.monivalinta) {
             // TÄSSÄKIN TARVITAAN TARKISTUS
             if (selection) {
                const selectedKeys = Object.keys(selection).filter(avainsana => selection[avainsana] === true);
                selectedKeys.forEach(avainsana => {
                    const phraseData = section.fraasit?.find(f => f.avainsana === avainsana);
                    if (phraseData?.teksti) generatedParts.push(phraseData.teksti);
                });
                generated = generatedParts.join('. ');
             }
        } else if (selection?.avainsana) {
             const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
             if (phraseData) { generated = processPhrase(phraseData, selection); }
        }
    }

    const customKey = sectionId === 'kielitaso' ? 'custom-kielitaso' : `custom-${sectionId}`;
    const customText = state[customKey]?.trim() || '';
    if (customText) {
        generated += (generated ? '\n\n' : '') + customText;
    }

    // console.log(`[generateSectionContent LIST] Generated for ${sectionId}: "${generated}"`);
    return generated.trim();
};
// --- KOPIOINTI PÄÄTTYY TÄHÄN ---


const SummaryPanel = ({ state, sections }) => {

    console.log("[SummaryPanel] Received props:", { state, sections });

    const [feedback, setFeedback] = useState('');

    const fullSummaryText = useMemo(() => {
        console.log("[SummaryPanel useMemo] Calculating fullSummaryText with state:", state);
        let textParts = [];
        let koulutusJaYrittajyysCustomText = '';

        const printOrder = [
            'suunnitelman_tyyppi', 'suunnitelman_perustiedot', 'tyottomyysturva',
            'tyotilanne', 'koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso',
            'tyokyky', 'palkkatuki', 'palveluunohjaus', 'suunnitelma', 'tyonhakuvelvollisuus'
        ];

        printOrder.forEach(sectionId => {
            const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
            if (!sectionDataFromPlan) return;
            const selection = state[sectionId];

             if (['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(sectionId)) {
                 // --- KORJATTU TARKISTUS ---
                 // Kutsutaan generateSectionContent vain, jos dataa on
                const generatedValinnat = selection ? generateSectionContent(sectionDataFromPlan, selection, state) : '';
                const customKey = sectionId === 'kielitaso' ? 'custom-kielitaso' : `custom-${sectionId}`;
                const customText = state[customKey]?.trim() || '';
                
                let combinedText = generatedValinnat;
                 if (customText) {
                     combinedText += (combinedText ? '\n\n' : '') + customText;
                 }
                 if (combinedText) {
                    koulutusJaYrittajyysCustomText += (koulutusJaYrittajyysCustomText ? '\n\n' : '') + combinedText;
                 }
                return;
            }
            if (sectionId === 'tyottomyysturva') {
                 if (state.tyottomyysturva?.yhteenvetoFraasi) { textParts.push(`**${sectionDataFromPlan.otsikko}**\n${state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim()}.`); }
                return;
            }
            // Muiden osioiden generointi
            const generatedContent = generateSectionContent(sectionDataFromPlan, selection, state);
            if (generatedContent) {
                let finalContent = generatedContent;
                const lastLine = finalContent.split('\n').pop() || '';
                if (!/[.!?]$/.test(lastLine.trim()) && !finalContent.endsWith('\n\n')) { finalContent += '.'; }
                textParts.push(`**${sectionDataFromPlan.otsikko}**\n${finalContent}`);
            }
        });

        if (koulutusJaYrittajyysCustomText) {
             let finalKoulutusContent = koulutusJaYrittajyysCustomText;
             const lastKoulutusLine = finalKoulutusContent.split('\n').pop() || '';
             if (!/[.!?]$/.test(lastKoulutusLine.trim()) && !finalKoulutusContent.endsWith('\n\n')) { finalKoulutusContent += '.'; }
             const tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Asiakkaan työtilanne**'));
             const insertIndex = tyotilanneIndex > -1 ? tyotilanneIndex + 1 : 2;
             const koulutusOtsikko = planData.aihealueet.find(s => s.id === 'koulutus')?.otsikko || 'Koulutus ja yrittäjyys';
             textParts.splice(insertIndex, 0, `**${koulutusOtsikko}**\n${finalKoulutusContent}`);
        }

        let cleanedTextParts = textParts.map(part => part.replace(/\n\s*\.\s*$/, '').trim()).filter(Boolean);
        const finalText = FINGERPRINT + cleanedTextParts.join('\n\n');
        console.log("[SummaryPanel useMemo] Final fullSummaryText for copy:", finalText);
        return finalText;
    }, [state]);

    const handleCopy = () => {
        // ... (Kopiointilogiikka ennallaan) ...
        const summaryToCopy = fullSummaryText;
        console.log("[SummaryPanel handleCopy] Attempting to copy text:", summaryToCopy);
        try { /*...*/ } catch (err) { /*...*/ }
    };

    // --- Statusten haku ---
    const getSectionStatus = (sectionId) => {
        const simpleId = sectionId.replace('osio-', '').replace(/-/g, '_');
         const sectionExistsInData = planData.aihealueet.some(s => s.id === simpleId);
         if (!sectionExistsInData && !['kielitaso'].includes(simpleId)) { 
             return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
         }
        if (state[simpleId] && Object.keys(state[simpleId]).length > 0) {
            if (Object.keys(state[simpleId]).length === 1 && state[`custom-${simpleId}`]) { return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; }
             if (simpleId === 'palkkatuki' && state.palkkatuki?.palkkatuki_puolletaan !== undefined) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyokyky' && state.tyokyky?.paavalinta) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             if (simpleId === 'tyonhakuvelvollisuus' && state.tyonhakuvelvollisuus?.avainsana) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
              if (simpleId === 'suunnitelma' && Object.keys(state.suunnitelma || {}).length > 0) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
              if (['koulutus', 'yrittajyys'].includes(simpleId) && (state[simpleId]?.avainsana || state[`custom-${simpleId}`])) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
               if (simpleId === 'suunnitelman_perustiedot' && Object.keys(state[simpleId] || {}).length >= 2) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
                if (simpleId === 'tyotilanne' && Object.keys(state[simpleId] || {}).length >= 1) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
                 if (simpleId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) { return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' }; }
             return { text: 'Valmis', tagClass: 'tag--success', chipClass: 'chip--active' };
        } else if (state[`custom-${simpleId}`]) { return { text: 'Muokattu', tagClass: 'tag--warning', chipClass: 'chip--warning' }; }
        return { text: 'Odottaa', tagClass: 'tag--pending', chipClass: '' };
    };
     const areAllSectionsComplete = sections.every(section => getSectionStatus(section.id).text === 'Valmis');
     // console.log("[SummaryPanel] Are all sections complete?", areAllSectionsComplete);


    return (
        <>
            <div className="summary-drag-handle"></div>
            <h2>Yhteenveto</h2>
            <div className="summary-progress-tracker">
                {sections.map(section => {
                    const status = getSectionStatus(section.id);
                    const chipId = `${section.id.replace('osio-','').replace(/_/g, '-')}-chip`;
                    return <div key={section.id} id={chipId} className={`chip ${status.chipClass}`}>{section.name}</div>;
                })}
            </div>

            <ul className="summary-items-list">
                {sections.map(panelSection => {
                     const status = getSectionStatus(panelSection.id);
                     let sectionId = panelSection.id.replace('osio-', '').replace(/-/g, '_');
                     if (sectionId === 'tyonhaku') sectionId = 'tyonhakuvelvollisuus';
                     if (sectionId === 'palveluohjaus') sectionId = 'palveluunohjaus';

                     const sectionDataFromPlan = planData.aihealueet.find(s => s.id === sectionId);
                     const selection = state[sectionId];
                     const sectionText = sectionDataFromPlan ? generateSectionContent(sectionDataFromPlan, selection, state) : '';
                     const statusId = `${sectionId.replace(/_/g, '-')}-status`;

                     console.log(`[RENDER LOOP] panelSection.id: ${panelSection.id}, Mapped sectionId: ${sectionId}, Text Length: ${sectionText.length}, Section Data Found: ${!!sectionDataFromPlan}`);

                     if (!sectionDataFromPlan) return null;

                     return (
                        <li
                            key={panelSection.id}
                            className="summary-item"
                            data-target={panelSection.id}
                        >
                            <div className="summary-item-header" onClick={() => {
                                const targetElement = document.getElementById(panelSection.id);
                                if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth' }); }
                            }}>
                                <span className="summary-item__title">{panelSection.name}</span>
                                <span id={statusId} className={`tag ${status.tagClass}`}>{status.text}</span>
                            </div>

                            {sectionText && (
                                <div className="summary-item-generated-text">
                                    {sectionText.split('\n').map((line, index, arr) => (
                                        <React.Fragment key={index}>
                                            {line}
                                            {index < arr.length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="summary-actions">
                <button id="save-button" className="btn" disabled={!areAllSectionsComplete}> Tallenna analyysi </button>
                <button className="btn btn--secondary" onClick={handleCopy} disabled={!fullSummaryText || fullSummaryText === FINGERPRINT}> Kopioi yhteenveto </button>
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>

             <AikatauluEhdotus state={state} />
        </>
    );
};

export default SummaryPanel;