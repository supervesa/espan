import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const FINGERPRINT = '\u200B\u200D\u200C';

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
                } catch (e) {
                    console.error(`Error replacing variable [${key}]:`, e);
                }
            }
        });
    }
    text = text.replace(/\(\s*v\.\s*\)/g, '').replace(/\s*\[[A-Z_ÄÖÅ0-9]+\]/g, '').trim();
    return text.replace(/\.$/, '').trim();
};

const SummaryDatabase = ({ state, dbPlanData, dbKnowledge }) => {
    const [feedback, setFeedback] = useState('');

    const getSectionData = (sectionId) => {
        let section = dbPlanData?.aihealueet?.find(s => s.id === sectionId);
        if (!section) {
            section = planData.aihealueet.find(s => s.id === sectionId);
        }
        return section;
    };

    const generateSectionContent = (sectionId) => {
        const section = getSectionData(sectionId);
        const selection = state[sectionId];
        let generated = '';

        if (!section || !selection) return '';

        if (sectionId === 'tyokyky' && state.tyokyky) {
            const s = state.tyokyky;
            let tyokykyParts = [];

            if (s.paavalinta) {
                if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                    tyokykyParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`);
                } else if (s.paavalinta.avainsana === 'tyokyky_selvityksessa') {
                    tyokykyParts.push("Työkyky vaatii lisäselvitystä");
                } else if (s.paavalinta.avainsana === 'tyokyky_normaali') {
                    tyokykyParts.push("Työkyky on normaali");
                }
            }
            if (s.omaArvio) {
                tyokykyParts.push(`Hän arvioi oman työkykynsä pistemääräksi ${s.omaArvio}/10`);
            }
            if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                const ohjaukset = Object.values(s.palveluohjaukset).map(p => p.teksti.toLowerCase().replace(/\.$/, '')).join(', ');
                tyokykyParts.push(`Tilanteen selvittämiseksi asiakas on ohjattu seuraaviin palveluihin: ${ohjaukset}`);
            }

            let combinedSelectionsText = tyokykyParts.join('. ').trim();
            if (s.koonti && s.koonti.trim()) {
                const koontiFormatted = `Koonti keskustelusta:\n${s.koonti.trim()}`;
                generated = combinedSelectionsText ? combinedSelectionsText + '\n\n' + koontiFormatted : koontiFormatted;
            } else {
                generated = combinedSelectionsText;
            }
        } else if (sectionId === 'palkkatuki' && state.palkkatuki?.puoltoKappale) {
            generated = state.palkkatuki.puoltoKappale.replace(/\.$/, '').trim();
        } else if (sectionId === 'tyonhakuvelvollisuus' && selection) {
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
                generated = koottuTeksti;
            }
        } else if (typeof selection === 'object' && !['koulutus', 'ammattikortit', 'yrittajyys'].includes(sectionId)) {
            let generatedParts = [];
            if (section.monivalinta) {
                const selectedKeys = Object.keys(selection).filter(avainsana => 
                    avainsana !== 'syntymavuosi' && 
                    avainsana !== 'alle_6kk_tyossa' && 
                    (selection[avainsana] === true || (typeof selection[avainsana] === 'object' && selection[avainsana] !== null && Object.keys(selection[avainsana]).length > 0))
                );

                if (selectedKeys.length > 0) {
                    selectedKeys.forEach(avainsana => {
                        const phraseState = selection[avainsana];
                        const phraseData = section.fraasit?.find(f => f.avainsana === avainsana);

                        if (phraseData) {
                            let processedText = '';
                            if (typeof phraseState === 'object' && phraseState !== null && phraseState.avainsana === avainsana) {
                                processedText = processPhrase(phraseData, phraseState);
                            } else if (phraseState === true) {
                                processedText = processPhrase(phraseData, {});
                            }
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

    const dbSummaryText = useMemo(() => {
        let textParts = [];
        let tyottomyysturvaFraasi = '';
        let koulutusJaYrittajyysCustomText = ''; 

        const allKnownSections = dbPlanData?.aihealueet?.length > 0 ? dbPlanData.aihealueet : planData.aihealueet;

        allKnownSections.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`]?.trim() || '';

            if (section.id === 'tyottomyysturva' && state.tyottomyysturva?.yhteenvetoFraasi) {
                tyottomyysturvaFraasi = state.tyottomyysturva.yhteenvetoFraasi.replace(/\.$/, '').trim();
                return;
            }

            if (['koulutus', 'ammattikortit', 'yrittajyys'].includes(section.id)) {
                if (customText) {
                    koulutusJaYrittajyysCustomText += (koulutusJaYrittajyysCustomText ? '\n\n' : '') + customText;
                }
                return; 
            }

            let finalContent = generateSectionContent(section.id);

            if (customText) {
                finalContent += (finalContent ? '\n\n' : '') + customText;
            }
            if (finalContent === '.') finalContent = '';

            if (finalContent) {
                const lastLine = finalContent.split('\n').pop();
                if (!/[.!?]$/.test(lastLine) && !finalContent.endsWith('\n\n')) {
                    finalContent += '.';
                }
                textParts.push(`**${section.otsikko}**\n${finalContent}`);

                if (section.id === 'tyonhakuvelvollisuus' && selection) {
                    let lopputeksti = TYONHAKUVELVOLLISUUS_LOPPUTEKSTI; 
                    if (dbKnowledge && dbKnowledge.length > 0) {
                        const dbTeksti = dbKnowledge.find(k => k.title === 'THV Lopputeksti');
                        if (dbTeksti && dbTeksti.content_text) {
                            lopputeksti = dbTeksti.content_text;
                        }
                    }
                    textParts[textParts.length - 1] += `\n\n${lopputeksti.trim()}`;
                }
            }
        });

        let koulutusJaYrittajyysFinalContent = koulutusJaYrittajyysCustomText.trim(); 
        if (koulutusJaYrittajyysFinalContent) {
            const lastLine = koulutusJaYrittajyysFinalContent.split('\n').pop();
            if (!/[.!?]$/.test(lastLine) && !koulutusJaYrittajyysFinalContent.endsWith('\n\n')) {
                koulutusJaYrittajyysFinalContent += '.';
            }
            let tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Asiakkaan työtilanne**'));
            if (tyotilanneIndex === -1) tyotilanneIndex = textParts.findIndex(p => p.startsWith('**Suunnitelman perustiedot**'));
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

        return FINGERPRINT + cleanedTextParts.join('\n\n');

    }, [state, dbPlanData, dbKnowledge]); 

    const handleCopyKokeilu = () => {
        try {
            const plainText = dbSummaryText.replace(FINGERPRINT, '').replace(/\*\*/g, '');
            const htmlText = dbSummaryText.replace(FINGERPRINT,'').split('\n\n').map(paragraph => {
                const lines = paragraph.split('\n'); 
                const header = lines[0] ? `<strong>${lines[0].replace(/\*\*/g, '')}</strong>` : ''; 
                const body = lines.slice(1).filter(line => line.trim() !== '').join('<br>'); 
                return `<p>${header}${body ? (header ? '<br>' : '') + body : ''}</p>`;
            }).join(''); 
            
            const blobHtml = new Blob([htmlText], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({'text/html': blobHtml,'text/plain': blobText,}); 
            
            navigator.clipboard.write([clipboardItem]).then(
                () => { setFeedback('Tietokanta-versio kopioitu!'); setTimeout(() => setFeedback(''), 2500); }, 
                (rejectReason) => { throw new Error("Formatted copy failed"); }
            ); 
        } catch (err) {
            navigator.clipboard.writeText(dbSummaryText.replace(FINGERPRINT, '').replace(/\*\*/g, '')).then(
                () => { setFeedback('Tietokanta-versio kopioitu (ei-muotoiltuna)!'); setTimeout(() => setFeedback(''), 2500); }, 
                (rejectErr) => { setFeedback('Kopiointi epäonnistui.'); setTimeout(() => setFeedback(''), 2500); }
            ); 
        }
    };

    return (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column' }}>
            <button 
                onClick={handleCopyKokeilu} 
                className="copy-button" 
                style={{ 
                    backgroundColor: 'var(--color-background)', 
                    color: 'var(--color-primary)', 
                    border: '2px dashed var(--color-primary)' 
                }}
                disabled={!dbSummaryText || dbSummaryText === FINGERPRINT}
            >
                🚀 Kopioi kokeilu (Supabase)
            </button>
            {feedback && <p className="feedback-text" style={{ textAlign: 'center', marginTop: '0.5rem', fontWeight: 'bold' }}>{feedback}</p>}
        </div>
    );
};

export default SummaryDatabase;