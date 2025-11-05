// --- src/utils/summaryGenerator.js ---
// KORJATTU VERSIO (EI SISÄLLÄ JSX:ÄÄ)

import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
// Oletetaan, että constants.js on samassa data-kansiossa (tai korjaa polku)
import { PALKKATUKI_LISAHUOMIOT } from '../data/constants.js';

const FINGERPRINT = '\u200B\u200D\u200C';

// --- Apufunktiot (sisäiseen käyttöön) ---

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

// --- EXPORT 1: generateSectionContent ---
// Tätä käytetään SummaryPanelin listanäkymässä (yksittäisten osioiden näyttämiseen)
export const generateSectionContent = (section, selection, state) => {
    let generated = '';
    const sectionId = section?.id;
    if (!sectionId) return '';

    if (sectionId === 'tyokyky' && state.tyokyky) {
        const s = state.tyokyky;
        let tyokykyParts = [];
        if (s.paavalinta) {
            if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) { tyokykyParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`); }
            else if (s.paavalinta.avainsana === 'tyokyky_selvityksessa') { tyokykyParts.push("Työkyky vaatii lisäselvitystä"); }
            else if (s.paavalinta.avainsana === 'tyokyky_normaali') { tyokykyParts.push("Työkyky on normaali"); }
        }
        if (s.omaArvio) { tyokykyParts.push(`Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10`); }
        if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) { const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti.toLowerCase().replace(/\.$/, '')).join(', '); tyokykyParts.push(`Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}`); }
        let combinedSelectionsText = tyokykyParts.join('. ').trim();
        if (s.koonti && s.koonti.trim()) { generated = combinedSelectionsText ? combinedSelectionsText + '\n\n' + `Koonti keskustelusta:\n${s.koonti.trim()}` : `Koonti keskustelusta:\n${s.koonti.trim()}`; }
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
        const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
        if (phraseData) {
            let koottuTeksti = processPhrase(phraseData, selection);
            if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([, v]) => v).map(([k]) => k);
                let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                koottuTeksti += alennusTeksti;
            }
            if (TYONHAKUVELVOLLISUUS_LOPPUTEKSTI) {
                 koottuTeksti += `\n\n${TYONHAKUVELVOLLISUUS_LOPPUTEKSTI.trim()}`;
            }
            generated = koottuTeksti;
        }
    }
    else if (sectionId === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
        generated = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
    }
    else if (selection && typeof selection === 'object' && !['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(section.id)) {
        let generatedParts = [];
        if (section.monivalinta) {
            if (selection) { 
                const selectedKeys = Object.keys(selection).filter(avainsana => 
                    avainsana !== 'syntymavuosi' && 
                    avainsana !== 'alle_6kk_tyossa' && 
                    (selection[avainsana] === true || (typeof selection[avainsana] === 'object' && selection[avainsana] !== null && selection[avainsana].avainsana === avainsana))
                );
                selectedKeys.forEach(avainsana => {
                    const phraseState = selection[avainsana];
                    const phraseData = section.fraasit?.find(f => f.avainsana === avainsana);
                    if (phraseData) {
                        let processedText = '';
                        if (typeof phraseState === 'object' && phraseState !== null) { processedText = processPhrase(phraseData, phraseState); }
                        else if (phraseState === true) { processedText = processPhrase(phraseData, {}); }
                        if (processedText) generatedParts.push(processedText);
                    }
                });
                generated = generatedParts.join('. ');
            }
        } else if (selection.avainsana) {
            const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
            if (phraseData) {
                generated = processPhrase(phraseData, selection);
            }
        }
    }
    else if (['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(section.id)) {
        let generatedParts = [];
         if (section.monivalinta) {
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

    return generated.trim();
};


// --- EXPORT 2: generateFullSummary ---
export const generateFullSummary = (state) => {
    console.log("[generateFullSummary] Calculating full copy-text with state:", state);
    let textParts = [];
    let tyottomyysturvaFraasi = '';
    let koulutusJaYrittajyysKoonti = '';

    planData.aihealueet.forEach(section => {
        const selection = state[section.id];
        const customKey = section.id === 'kielitaso' ? 'custom-kielitaso' : `custom-${section.id}`;
        const customText = state[customKey]?.trim() || '';
        let generatedContent = '';

        if (section.id === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
            tyottomyysturvaFraasi = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
            return;
        }

        if (['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(section.id)) {
             const generatedValinnat = generateSectionContent(section, selection, state);
             let combinedText = generatedValinnat;
            if (customText && !generatedValinnat.includes(customText)) {
                combinedText += (combinedText ? '\n\n' : '') + customText;
            }
             if (combinedText) {
                koulutusJaYrittajyysKoonti += (koulutusJaYrittajyysKoonti ? '\n\n' : '') + combinedText;
             }
            return;
        }

        // Muut osiot
        generatedContent = generateSectionContent(section, selection, state);
        
        // Vanha Summary.js lisäsi customTextin tässä vain muille osioille
        // (generateSectionContent hoitaa tämän jo, joten poistetaan duplikaatti)
        // if (customText) {
        //     generatedContent += (generatedContent ? '\n\n' : '') + customText;
        // }
        
        let finalContent = generatedContent;
        if (finalContent === '.') finalContent = '';
        
        if (finalContent) {
            const lastLine = finalContent.split('\n').pop() || '';
            if (!/[.!?]$/.test(lastLine.trim()) && !finalContent.endsWith('\n\n')) {
                finalContent += '.';
            }
            textParts.push(`**${section.otsikko}**\n${finalContent}`);
        }
    }); 

    let koulutusJaYrittajyysFinalContent = koulutusJaYrittajyysKoonti.trim(); 
    if (koulutusJaYrittajyysFinalContent) {
        const lastLine = koulutusJaYrittajyysFinalContent.split('\n').pop() || '';
        if (!/[.!?]$/.test(lastLine.trim()) && !koulutusJaYrittajyysFinalContent.endsWith('\n\n')) {
            koulutusJaYrittajyysFinalContent += '.';
        }
        let tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Asiakkaan työtilanne**'));
        if (tyotilanneIndex === -1) { 
            tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));
        }
        const insertIndex = tyotilanneIndex > -1 ? tyotilanneIndex + 1 : 0;
        const koulutusOtsikko = planData.aihealueet.find(s => s.id === 'koulutus')?.otsikko || 'Koulutus ja yrittäjyys';
        textParts.splice(insertIndex, 0, `**${koulutusOtsikko}**\n${koulutusJaYrittajyysFinalContent}`);
    }

    if (tyottomyysturvaFraasi) {
        const formattedTtFraasi = tyottomyysturvaFraasi.endsWith('.') ? tyottomyysturvaFraasi : tyottomyysturvaFraasi + '.';
        const perustiedotIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));
        if (perustiedotIndex > -1) {
            const existingPerustiedot = textParts[perustiedotIndex];
            textParts[perustiedotIndex] = existingPerustiedot + `\n${formattedTtFraasi}`;
        } else {
            const tyyppiIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman tyyppi**'));
            textParts.splice(tyyppiIndex > -1 ? tyyppiIndex + 1 : 0, 0, `**Työttömyysturva**\n${formattedTtFraasi}`);
        }
    }
    
    let cleanedTextParts = textParts.map(part => part.replace(/\n\s*\.\s*$/, '').trim()).filter(Boolean); 
    const finalText = FINGERPRINT + cleanedTextParts.join('\n\n');
    
    console.log("[generateFullSummary] Final fullSummaryText for copy:", finalText);
    return finalText;
};