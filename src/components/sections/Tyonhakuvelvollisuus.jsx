import React, { useState, useMemo } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';

const Alennustyokalu = ({ sectionData, selection, onUpdate, onCancel }) => {
    const [perustelut, setPerustelut] = useState(selection.alentamisenPerustelut || {});
    const [vapaaTeksti, setVapaaTeksti] = useState(selection.alentamisenVapaaTeksti || '');

    const handlePerusteluChange = (perustelu) => {
        const newPerustelut = { ...perustelut, [perustelu]: !perustelut[perustelu] };
        setPerustelut(newPerustelut);
    };
    
    const handleVapaaTekstiChange = (e) => {
        setVapaaTeksti(e.target.value);
    };

    const handleSave = () => {
        onUpdate({ 
            ...selection, 
            alentamisenPerustelut: perustelut,
            alentamisenVapaaTeksti: vapaaTeksti 
        });
    };

    const esikatselu = useMemo(() => {
        const valitut = Object.entries(perustelut).filter(([, valittu]) => valittu).map(([key]) => key);
        let teksti = '';
        if (valitut.length > 0) {
            teksti += `Perusteet: ${valitut.join(', ')}.`;
        }
        if (vapaaTeksti) {
            teksti += ` ${vapaaTeksti}`;
        }
        return teksti.trim();
    }, [perustelut, vapaaTeksti]);

    return (
        <div className="alennus-tyokalu">
            <h4>Alentamisen perustelut</h4>
            <div className="perustelut-valinnat">
                {sectionData.alentamisenPerustelut.map(p => (
                    <div key={p} className="checkbox-wrapper">
                        <input type="checkbox" id={`perustelu-${p}`} checked={!!perustelut[p]} onChange={() => handlePerusteluChange(p)} />
                        <label htmlFor={`perustelu-${p}`}>{p}</label>
                    </div>
                ))}
            </div>
            <div className="vapaa-teksti-container">
                <label htmlFor="vapaa-teksti-alennus">Tarkemmat perustelut (vapaa sana):</label>
                <textarea id="vapaa-teksti-alennus" rows="3" value={vapaaTeksti} onChange={handleVapaaTekstiChange} />
            </div>
            <div className="esikatselu-laatikko">
                <strong>Esikatselu:</strong>
                <p>{esikatselu || "Ei perusteluja valittu."}</p>
            </div>
            <div className="alennus-tyokalu-actions">
                <button onClick={handleSave} className="save-button">Tallenna perustelut</button>
                <button onClick={onCancel} className="cancel-button">Peruuta</button>
            </div>
        </div>
    );
};


const Tyonhakuvelvollisuus = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyonhakuvelvollisuus');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;
    const [alennusToolVisible, setAlennusToolVisible] = useState(false);
    
    // VAIHE 1: Kontekstin kerääminen scraperin datasta
    const previousThvText = state.previousThvText;
    const selection = state[sectionData.id];

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
                {sectionData.fraasit.map(phrase => (
                    <PhraseOption 
                        key={phrase.avainsana}
                        phrase={phrase} 
                        section={sectionData} 
                        isSelected={selection?.avainsana === phrase.avainsana} 
                        onSelect={onSelect} 
                        onUpdateVariable={onUpdateVariable} 
                        isRecommended={phrase.avainsana === analysis.recommendedKeyword}
                    />
                ))}
            </div>
            
            {selection && (
                 <div className="alennus-nappi-container">
                    <button onClick={() => setAlennusToolVisible(!alennusToolVisible)}>
                        {alennusToolVisible ? 'Piilota perustelut' : 'Alenna velvollisuutta / Kirjaa perustelut'}
                    </button>
                 </div>
            )}
            
            {alennusToolVisible && selection && (
                <Alennustyokalu 
                    sectionData={sectionData} 
                    selection={selection}
                    onUpdate={(updatedSelection) => {
                        onSelect(sectionData.id, updatedSelection.avainsana, false, updatedSelection);
                        setAlennusToolVisible(false); // Suljetaan työkalu tallennuksen jälkeen
                    }}
                    onCancel={() => setAlennusToolVisible(false)}
                />
            )}

            {state.tyonhakuvelvollisuus && (
                <div className="next-steps-box">
                    <h4>Ehdotetut seuraavat askeleet:</h4>
                    <ul>
                        <li>Varmista, että asiakas ymmärtää velvoitteen ehdot ja seuraukset.</li>
                        <li>Jos velvoitteen täyttäminen vaatii tukea, siirry Palveluunohjaus-osioon.</li>
                    </ul>
                </div>
            )}

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
