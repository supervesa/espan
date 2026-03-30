import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';
import { PALKKATUKI_LISAHUOMIOT, YLEISET_SUUNNITELMA_FRAASIT } from '../data/constants.js';

const FINGERPRINT = '\u200B\u200D\u200C';
const FREE_TEXT_SEPARATOR = '\n\n---\n\n';

const processPhrase = (phraseData, specificSelectionState) => {
    if (!phraseData || !phraseData.teksti) return '';
    let text = phraseData.teksti;
    const variableSource = specificSelectionState?.muuttujat || {};
    if (phraseData.muuttujat && typeof variableSource === 'object') {
        Object.keys(phraseData.muuttujat).forEach((key) => {
            const value = variableSource[key];
            if (value !== undefined && value !== null && value !== '') {
                try {
                    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`\\[${escapedKey}\\]`, 'g');
                    text = text.replace(regex, String(value));
                } catch (e) { console.error(`Error replacing variable [${key}]:`, e); }
            }
        });
    }
    text = text.replace(/\(\s*v\.\s*\)/g, '').replace(/\s*\[[A-Z_ÄÖÅ0-9]+\]/g, '').trim();
    return text.replace(/\.$/, '').trim();
};

export const generateHybridSectionContent = (section, selection, state, dbKnowledge) => {
    let generated = '';
    const sectionId = section.id;

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
        if (s.koonti && s.koonti.trim()) { const koontiFormatted = `Koonti keskustelusta:\n${s.koonti.trim()}`; generated = combinedSelectionsText ? combinedSelectionsText + '\n\n' + koontiFormatted : koontiFormatted; }
        else { generated = combinedSelectionsText; }
    }
    else if (sectionId === 'palkkatuki' && state.palkkatuki) {
        generated = state.palkkatuki.puoltoKappale?.replace(/\.$/, '').trim() || '';
        if (state.palkkatuki.lisahuomiot && typeof PALKKATUKI_LISAHUOMIOT === 'object' && Object.values(state.palkkatuki.lisahuomiot).some(v => v)) {
            const lisahuomiotText = Object.entries(state.palkkatuki.lisahuomiot)
                .filter(([key, value]) => value && PALKKATUKI_LISAHUOMIOT[key])
                .map(([key]) => PALKKATUKI_LISAHUOMIOT[key].teksti) 
                .join('\n\n');
             if(lisahuomiotText) {
                 generated += (generated ? '\n\n' : '') + lisahuomiotText;
             }
        }
    }
    // --- KORJATTU THV-LUKU: Poistettu '&& selection' rajoite ---
    else if (sectionId === 'tyonhakuvelvollisuus') {
        let koottuTeksti = '';
        
        // 1. Jos numeerinen pääfraasi ON valittu, käsitellään se
        if (selection && selection.avainsana) {
            const phraseData = section.fraasit?.find(f => f.avainsana === selection.avainsana);
            if (phraseData) {
                koottuTeksti = processPhrase(phraseData, selection);
                
                // Alennusten perustelut
                if (selection.alentamisenPerustelut || selection.alentamisenVapaaTeksti) {
                    const perustelut = Object.entries(selection.alentamisenPerustelut || {}).filter(([, v]) => v).map(([k]) => k);
                    let alennusTeksti = '\n\nTyönhakuvelvollisuutta on alennettu.';
                    if (perustelut.length > 0) alennusTeksti += ` Perusteet: ${perustelut.join(', ')}.`;
                    if (selection.alentamisenVapaaTeksti) alennusTeksti += ` ${selection.alentamisenVapaaTeksti}`;
                    koottuTeksti += alennusTeksti;
                }
            }
        }

        // 2. AINA MUKAAN: Aikatauluehdotus + Lakisääteiset tekstit
        if (selection && selection.vakiotekstitYhdistetty) {
            // Jos asiantuntija on käynyt THV-välilehdellä, sieltä löytyy valmiiksi puristettu paketti
            koottuTeksti += (koottuTeksti ? '\n\n' : '') + selection.vakiotekstitYhdistetty.trim();
        } else {
            // HÄTÄVARA: Jos asiantuntija ei koskaan edes avannut THV-välilehteä, 
            // haetaan aikataulu suoraan Master-profiilista ja peruslait tietokannasta.
            const aikataulu = state.asiakas?.aikataulu_teksti;
            if (aikataulu && !koottuTeksti.includes(aikataulu)) {
                koottuTeksti += (koottuTeksti ? '\n\n' : '') + aikataulu.trim();
            }
            
            if (dbKnowledge && !koottuTeksti.includes("Oikeudet ja velvollisuudet")) {
                const luvat = dbKnowledge.find(k => k.title === 'Oikeudet ja velvollisuudet')?.content_text || '';
                const keskustelut = dbKnowledge.find(k => k.title === 'Täydentävät- ja Työnhakukeskustelut')?.content_text || '';
                const fallbackLait = [luvat, keskustelut].filter(Boolean).join('\n\n');
                if (fallbackLait) {
                    koottuTeksti += (koottuTeksti ? '\n\n' : '') + fallbackLait;
                }
            }
        }

        generated = koottuTeksti.trim();
    }
    else if (section.id === 'suunnitelma' && state.suunnitelma) {
         Object.values(YLEISET_SUUNNITELMA_FRAASIT).forEach(phrase => {
             if (state.suunnitelma[phrase.id]) {
                 generated += (generated ? '\n' : '') + phrase.teksti;
             }
         });
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

    return generated.trim();
};

export const generateHybridSummary = (state, dbPlanData, dbKnowledge) => {
    let textParts = [];
    let tyottomyysturvaFraasi = '';
    let koulutusJaYrittajyysCustomText = ''; 

    let mergedSections = planData.aihealueet.map(staticSection => {
        const dbOverride = dbPlanData?.aihealueet?.find(s => s.id === staticSection.id);
        return dbOverride || staticSection;
    });

    if (dbPlanData?.aihealueet) {
        const purelyNewSections = dbPlanData.aihealueet.filter(dbSec => !planData.aihealueet.some(s => s.id === dbSec.id));
        mergedSections = [...mergedSections, ...purelyNewSections];
    }

    mergedSections.forEach(section => {
        const selection = state[section.id];
        const customKey = section.id === 'kielitaso' ? 'custom-kielitaso' : `custom-${section.id}`;
        const customText = state[customKey]?.trim() || '';
        let generatedContent = '';

        if (section.id === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
            tyottomyysturvaFraasi = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
            return;
        }

        if (['koulutus', 'ammattikortit', 'yrittajyys', 'kielitaso'].includes(section.id)) {
            if (customText) {
                koulutusJaYrittajyysCustomText += (koulutusJaYrittajyysCustomText ? '\n\n' : '') + customText;
            }
            return; 
        }

        generatedContent = generateHybridSectionContent(section, selection, state, dbKnowledge);
        
        if (customText) {
            generatedContent += (generatedContent ? FREE_TEXT_SEPARATOR : '') + customText;
        }
        
        let finalContent = generatedContent;
        if (finalContent === '.') finalContent = '';
        
        if (finalContent) {
            const lastLine = finalContent.split('\n').pop() || '';
            if (!/[.!?]$/.test(lastLine.trim()) && !finalContent.endsWith('\n\n') && !finalContent.endsWith('---')) {
                finalContent += '.';
            }
            textParts.push(`**${section.otsikko}**\n${finalContent}`);
        }
    }); 

    let koulutusJaYrittajyysFinalContent = koulutusJaYrittajyysCustomText.trim(); 
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
        textParts.splice(insertIndex, 0, `**Koulutus ja yrittäjyys**\n${koulutusJaYrittajyysFinalContent}`);
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
    
    return finalText;
};