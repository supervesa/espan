import React, { useState, useCallback } from 'react'; // Added useState and useCallback
import { planData } from '../../data/planData';

// Paikalliset/sisäiset importit
import Ammattikortit from './Ammattikortit';
import RadioPhraseSection from './RadioPhraseSection';
import SummaryPreview from './SummaryPreview';
import { useKoulutusSummary } from './useKoulutusSummary';
import { PhraseOption } from '../PhraseOption'; // PhraseOption is needed if we render koulutus directly

/**
 * PÄÄKOMPONENTTI: Koulutus, osaaminen ja yrittäjyys
 */
const KoulutusJaYrittajyys = ({ state, actions }) => {

    // 1. Datan alustus
    const sectionData = planData.aihealueet.find(s => s.id === 'koulutus');
    const korttiSectionData = planData.aihealueet.find(s => s.id === 'ammattikortit');
    const yrittajyysSectionData = planData.aihealueet.find(s => s.id === 'yrittajyys');

    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    // --- LISÄTTY: Tila tekstikentälle ja palautteelle ---
    const [pasteText, setPasteText] = useState('');
    const [parseFeedback, setParseFeedback] = useState('');

    // 2. Datan suodatus ryhmiin
    const koulutusFraasit = sectionData.fraasit;
    const yrittajyysFraasit = yrittajyysSectionData.fraasit;
    const ammattikorttiFraasit = korttiSectionData.fraasit;

    // 3. Logiikan kutsu (Custom Hook)
    const generatedSummarySentence = useKoulutusSummary(
        state.koulutus,
        state.ammattikortit,
        state.yrittajyys,
        state.kielitaso,
        {
            customKoulutusText: state['custom-koulutus'],
            customKielitasoText: state['custom-kielitaso']
        },
        sectionData,
        korttiSectionData,
        yrittajyysSectionData
    );

    // --- LISÄTTY: Käsittelijä tekstin poiminnalle ---
    const handleParseAndFill = useCallback(() => {
        setParseFeedback(''); // Clear previous feedback
        if (!pasteText) {
            setParseFeedback('Liitä ensin teksti laatikkoon.');
            return;
        }

        const entries = pasteText.split("Tutkinnon tai koulutuksen nimi").slice(1);
        let foundDegree = null;

        for (const entry of entries) {
            const lines = entry.trim().split('\n');
            if (lines.length < 2) continue;

            const nameLineIndex = 0; // First line after splitting is the name
            const todistusLineIndex = lines.findIndex(line => line.startsWith("Todistus"));

            if (todistusLineIndex !== -1 && lines[todistusLineIndex + 1]?.includes("Olen saanut tutkintotodistuksen")) {
                // Found a completed degree
                foundDegree = lines[nameLineIndex].trim().replace(/.*\//, '').trim(); // Remove prefix like "Eronnut/"
                break; // Stop after finding the first completed one
            }
        }

        if (foundDegree) {
            // 1. Varmista, että 'koulutus_tausta' on valittuna
            onSelect(sectionData.id, 'koulutus_tausta', false); // sectionId 'koulutus', avainsana 'koulutus_tausta', isMultiSelect false

            // 2. Päivitä KOULUTUS-muuttuja (VUOSI-kenttään ei kosketa)
            // Tarvitaan pieni viive varmistamaan, että onSelect ehtii päivittää tilan ensin
            setTimeout(() => {
                onUpdateVariable(sectionData.id, 'koulutus_tausta', 'KOULUTUS', foundDegree);
                setParseFeedback(`Koulutus "${foundDegree}" poimittu!`);
                setPasteText(''); // Tyhjennä laatikko onnistumisen jälkeen
            }, 0);

        } else {
            setParseFeedback('Tekstistä ei löytynyt valmista tutkintoa ("Olen saanut tutkintotodistuksen").');
        }
    }, [pasteText, onSelect, onUpdateVariable, sectionData.id]);


    // 4. Renderöinti
    return (
        <section className="section-container">
            <h2 className="section-title">Koulutus ja yrittäjyys</h2>

            {/* --- 1. Koulutusosio --- */}
            <div className="subsection">
                <h3 className="subsection-title">Koulutus</h3>
                {/* --- LISÄTTY: Tekstikenttä ja nappi --- */}
                <div className="paste-area-container" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <textarea
                        rows="3"
                        placeholder="Liitä koulutustiedot tähän..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        style={{ flexGrow: 1, minHeight: '60px' }}
                    />
                    <button onClick={handleParseAndFill} type="button" style={{ height: '60px', flexShrink: 0 }}>
                        Poimi koulutus
                    </button>
                </div>
                 {parseFeedback && <p style={{ fontSize: '0.9em', color: parseFeedback.includes('!') ? 'green' : 'red', marginTop: '-0.5rem', marginBottom: '1rem' }}>{parseFeedback}</p>}
                 {/* --- LISÄYS LOPPUU --- */}

                <div className="options-container">
                    {/* Käytetään RadioPhraseSectionin sijaan suoraa renderöintiä, jotta nappi tulee oikeaan paikkaan */}
                    {koulutusFraasit.map(phrase => {
                        const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                        return (
                             <PhraseOption
                                key={phrase.avainsana}
                                phrase={phrase}
                                section={{ ...sectionData, monivalinta: false }}
                                isSelected={isSelected}
                                onSelect={onSelect}
                                onUpdateVariable={onUpdateVariable}
                            />
                        );
                    })}
                </div>
            </div>


            {/* --- 2. Osaaminen (ml. kielitaito) -osio --- */}
            <div className="subsection">
                <h3 className="subsection-title">Osaaminen (ml. kielitaito)</h3>

                <Ammattikortit
                    sectionId={korttiSectionData.id} // 'ammattikortit'
                    sectionState={state[korttiSectionData.id] || {}}
                    korttiFraasit={ammattikorttiFraasit}
                    actions={{ onSelect, onUpdateVariable }}
                />

                <SummaryPreview
                    summaryData={generatedSummarySentence}
                    sectionId={sectionData.id} // Tallennetaan 'koulutus'-osion custom-kenttään
                    onUpdateCustomText={onUpdateCustomText}
                    // Välitetään custom-kielitieto SummaryPreviewlle
                     customTekstit={{ customKielitasoText: state['custom-kielitaso'] }}
                />
            </div>

            {/* --- 3. Yrittäjyysosio --- */}
            {/* Käytetään RadioPhraseSectionia yrittäjyydelle */}
            <RadioPhraseSection
                title="Yrittäjyys"
                phrases={yrittajyysFraasit}
                sectionId={yrittajyysSectionData.id} // 'yrittajyys'
                sectionState={state[yrittajyysSectionData.id] || {}}
                actions={{ onSelect, onUpdateVariable }}
            />

            {/* --- 4. Lisätiedot / Koonti -tekstikenttä --- */}
            <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id}`}>Lisätiedot / Koonti (Koulutus, osaaminen, kielitaito, yrittäjyys):</label>
                <textarea
                    id={`custom-text-${sectionData.id}`}
                    rows="4"
                    placeholder="Kirjoita tähän oma koonti tai käytä yllä olevaa ehdotusta pohjana..."
                    value={state[`custom-${sectionData.id}`] || ''}
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)}
                />
            </div>
        </section>
    );
};

export default KoulutusJaYrittajyys;