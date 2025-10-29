import React, { useMemo, useState } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';
import { kielitaitoTasot } from '../../data/guide'; 
import Ammattikortit from '../Ammattikortit'; // <-- Korjattu polku

// Aputoiminto: Muuttaa lauseen ensimmäisen kirjaimen pieneksi
const toLowerFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
};

// Aputoiminto: Muodostaa listasta siistin lauseen
const createListSentence = (items) => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' ja ');
    
    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return `${allButLast} ja ${last}`;
};

const KoulutusJaYrittajyys = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'koulutus_yrittajyys');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const [actionFeedback, setActionFeedback] = useState(''); 

    // --- Suodattimet (Nämä vaativat, että planData.js on kunnossa) ---
    const koulutusFraasit = sectionData.fraasit.filter(p => p.ryhma === 'koulutus');
    const yrittajyysFraasit = sectionData.fraasit.filter(p => p.ryhma === 'yrittajyys');
    const ammattikorttiFraasit = sectionData.fraasit.filter(p => p.ryhma === 'ammattikortit');


    // --- YHTEENVETOLAUSEEN GENERONTI (Pysyy ennallaan) ---
    const generatedSummarySentence = useMemo(() => {
        const koulutusState = state.koulutus_yrittajyys || {};
        const kielitasoState = state.kielitaso;
        const customKoulutusText = state['custom-koulutus_yrittajyys'];
        const customKielitasoText = state['custom-kielitaso'];
        const allFraasit = sectionData.fraasit; 

        let summaryParts = [];

        // 1. Käsittele Koulutus/Yrittäjyys -valinnat (Yksivalinnat)
        if (koulutusState && koulutusState.avainsana) {
            const phrase = allFraasit.find(f => f.avainsana === koulutusState.avainsana);
            if (phrase && (phrase.ryhma === 'koulutus' || phrase.ryhma === 'yrittajyys')) {
                let text = phrase.teksti || '';
                if (koulutusState.muuttujat) {
                    Object.entries(koulutusState.muuttujat).forEach(([key, value]) => {
                        if (value || typeof value === 'number') {
                            text = text.replace(`[${key}]`, value);
                        }
                    });
                }
                summaryParts.push(text.replace(/\s*\[.*?\]/g, '').trim());
            }
        }

        // 2. Käsittele Ammattikortit (Monivalinnat)
        const selectedCards = Object.keys(koulutusState)
            .map(avainsana => {
                if (koulutusState[avainsana] === true) { 
                    const fraasi = allFraasit.find(f => f.avainsana === avainsana);
                    if (fraasi && fraasi.ryhma === 'ammattikortit') {
                        return fraasi.teksti; 
                    }
                }
                return null;
            })
            .filter(Boolean); 

        if (selectedCards.length > 0) {
            const cardListString = createListSentence(selectedCards);
            summaryParts.push(`Asiakkaalla on voimassa mm. ${cardListString}.`);
        }
        
        // 3. Käsittele Kielitaito 
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
            summaryParts.push(lause.endsWith('.') ? lause : lause + '.');
        }

        // 4. Lisää Custom-tekstit
        const combinedGenerated = summaryParts.filter(part => part && part.trim() !== '').join(' ').replace(/\.\./g, '.').trim();
        let finalTextParts = [];
        if (combinedGenerated) finalTextParts.push(combinedGenerated);
         if (customKoulutusText && customKoulutusText !== combinedGenerated) {
             if(!finalTextParts.some(p => p === customKoulutusText)) {
                finalTextParts.push(customKoulutusText);
             }
        }
        if (customKielitasoText && customKielitasoText !== customKoulutusText && customKielitasoText !== combinedGenerated) {
             if(!finalTextParts.some(p => p === customKielitasoText)) {
                finalTextParts.push(customKielitasoText);
             }
        }

        return finalTextParts.join('. ').replace(/\.\./g, '.').trim();

    }, [state.koulutus_yrittajyys, state.kielitaso, state['custom-koulutus_yrittajyys'], state['custom-kielitaso'], sectionData.fraasit]);

    const handleUseSummary = () => {
        if (!generatedSummarySentence) return;
        onUpdateCustomText(sectionData.id, generatedSummarySentence);
        setActionFeedback('Ehdotus siirretty lisätietoihin!');
        setTimeout(() => setActionFeedback(''), 2500);
    };

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>

            {/* --- 1. Koulutusosio --- */}
            <div className="subsection">
                <h3 className="subsection-title">Koulutus</h3>
                <div className="options-container">
                    {koulutusFraasit.map(phrase => {
                        const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                        return (
                            <PhraseOption
                                key={phrase.avainsana}
                                phrase={phrase}
                                // --- KORJAUS TÄSSÄ ---
                                // Pakotetaan YKSIVALINTA-logiikka
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
                    sectionId={sectionData.id}
                    sectionState={state[sectionData.id] || {}}
                    korttiFraasit={ammattikorttiFraasit} 
                    actions={{ onSelect, onUpdateVariable }}
                />

                {/* Kielitaidon esikatselulaatikko */}
                {generatedSummarySentence && (
                    <div className="summary-preview language-summary-preview">
                        <h4>Ehdotus yhteenvetoon:</h4>
                        <p>{generatedSummarySentence}</p>
                        <button
                            onClick={handleUseSummary}
                            title="Siirrä ehdotus alla olevaan lisätietokenttään"
                            className='button-neg' 
                        >
                            Käytä tätä yhteenvetona
                        </button>
                        {actionFeedback && <span className='feedback-text'> {actionFeedback}</span>}
                    </div>
                )}
            </div>

            {/* --- 3. Yrittäjyysosio --- */}
            <div className="subsection">
                 <h3 className="subsection-title">Yrittäjyys</h3>
                 <div className="options-container">
                    {yrittajyysFraasit.map(phrase => {
                        const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                        return (
                            <PhraseOption
                                key={phrase.avainsana}
                                phrase={phrase}
                                // --- KORJAUS TÄSSÄ ---
                                // Pakotetaan YKSIVALINTA-logiikka
                                section={{ ...sectionData, monivalinta: false }}
                                isSelected={isSelected}
                                onSelect={onSelect}
                                onUpdateVariable={onUpdateVariable}
                            />
                        );
                    })}
                 </div>
            </div>

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