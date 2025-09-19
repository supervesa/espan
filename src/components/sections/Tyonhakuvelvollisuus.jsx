import React from 'react';
import { useMemo } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';

const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyonhakuvelvollisuus');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    
    // VAIHE 1: Kontekstin kerääminen scraperin datasta
    const previousThvText = state.previousThvText;

    // VAIHE 2: Läpinäkyvä sääntömoottori
    const analysis = useMemo(() => {
        const tilanneAvainsanat = state.tyotilanne ? Object.keys(state.tyotilanne) : [];
        const tyokykyAvainsana = state.tyokyky?.paavalinta?.avainsana;

        let detectedConditions = [];
        let ruleText = "Yleinen harkinta.";
        let recommendation = null;
        
        if (tilanneAvainsanat.includes('lomautettu')) detectedConditions.push("Asiakkaan työtilanne: Lomautettu");
        else if (tilanneAvainsanat.includes('osa-aikainen')) detectedConditions.push("Asiakkaan työtilanne: Osa-aikatyössä");
        else if (tilanneAvainsanat.includes('tyoton')) detectedConditions.push("Asiakkaan työtilanne: Työtön");
        
        if (tyokykyAvainsana === 'tyokyky_selvityksessa' || tyokykyAvainsana === 'tyokyky_alentunut') detectedConditions.push("Työkyky: Alentunut / Selvityksessä");
        else if (tyokykyAvainsana === 'tyokyky_normaali') detectedConditions.push("Työkyky: Normaali");

        if (tilanneAvainsanat.length > 0 && tyokykyAvainsana) {
            for (const phrase of sectionData.fraasit) {
                if (!phrase.ehdot) continue;
                const tyotilanneEhtoOk = phrase.ehdot.tyotilanne ? phrase.ehdot.tyotilanne.some(ehto => tilanneAvainsanat.includes(ehto)) : true;
                const tyokykyEhtoOk = phrase.ehdot.tyokyky ? phrase.ehdot.tyokyky.includes(tyokykyAvainsana) : true;
                if (tyotilanneEhtoOk && tyokykyEhtoOk) {
                    recommendation = phrase;
                    break;
                }
            }
        }
        
        let ehdotusTeksti = "Ehdotus: Valitse manuaalinen asetus tai tarkista aiemmat valinnat.";
        if (recommendation) {
            if (recommendation.avainsana === 'paasaanto') {
                ehdotusTeksti = "Ehdotus: Asetetaan palvelumallin mukainen pääsääntö.";
                ruleText = "Asiakas on työtön ja työkyky on normaali.";
            } else if (recommendation.avainsana === 'alennettu_osa_aikainen') {
                 ehdotusTeksti = "Ehdotus: Asetetaan alennettu velvollisuus osa-aikatyön vuoksi.";
                 ruleText = "Lain mukaan osa-aikatyössä olevalle voidaan asettaa alennettu velvoite.";
            } else if (recommendation.avainsana === 'ei_velvoitetta_lomautus') {
                ehdotusTeksti = "Ehdotus: Ei aseteta työnhakuvelvoitetta.";
                ruleText = "Lain mukaan lomautetulle ei aseteta työnhakuvelvoitetta ensimmäisen kolmen kuukauden aikana.";
            } else if (recommendation.avainsana === 'ei_velvoitetta_tyokyky') {
                ehdotusTeksti = "Ehdotus: Ei aseteta työnhakuvelvoitetta.";
                ruleText = "Työkyvyn selvittäminen on peruste jättää velvoite asettamatta.";
            }
        }

        return {
            conditions: detectedConditions,
            ruleText,
            proposalText: ehdotusTeksti,
            recommendedKeyword: recommendation ? recommendation.avainsana : null
        };

    }, [state.tyotilanne, state.tyokyky, sectionData.fraasit]);

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            
            {previousThvText && (
                <div className="context-box">
                    <h3>Edellisessä suunnitelmassa asetettu:</h3>
                    <p>{previousThvText}</p>
                </div>
            )}

            <div className="analysis-box">
                <div className="analysis-header">Analyysi ja ehdotus</div>
                <div className="analysis-content">
                    {analysis.conditions.length > 0 && (
                        <>
                            <h4>Havaittu tila:</h4>
                            <ul>{analysis.conditions.map((cond, i) => <li key={i}>{cond}</li>)}</ul>
                        </>
                    )}
                    <h4>Sovellettu sääntö:</h4>
                    <p><i>{analysis.ruleText}</i></p>
                    <p className="ehdotus">{analysis.proposalText}</p>
                </div>
            </div>

            <div className="options-container">
                {sectionData.fraasit.map(phrase => {
                    const isSelected = state[sectionData.id]?.avainsana === phrase.avainsana;
                    return <PhraseOption 
                        key={phrase.avainsana}
                        phrase={phrase} 
                        section={sectionData} 
                        isSelected={isSelected} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                        isRecommended={phrase.avainsana === analysis.recommendedKeyword}
                    />;
                })}
            </div>

            <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={`custom-text-${sectionData.id}`} 
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[`custom-${sectionData.id}`] || ''} 
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default Tyonhakuvelvollisuus;
