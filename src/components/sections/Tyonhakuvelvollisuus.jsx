import React, { useState, useMemo, useEffect } from 'react';
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
            // Muotoilu: "Perusteet: [perustelu1], [perustelu2]."
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
    
    const previousThvText = state.previousThvText;
    const selection = state[sectionData.id];

    // UUSI SÄÄNTÖMOOTTORI PRIORITEETILLA JA DATAVEToisilla selitteillä
    const analysis = useMemo(() => {
        const tilanneAvainsanat = state.tyotilanne ? Object.keys(state.tyotilanne).filter(key => state.tyotilanne[key]) : [];
        const tyokykyAvainsana = state.tyokyky?.paavalinta?.avainsana;

        const findRecommendation = () => {
            if (tilanneAvainsanat.length === 0 && !tyokykyAvainsana) return null;

            // Prioriteettijärjestys: vahvin sääntö ensin
            const priorityOrder = [
                "ei_velvoitetta_lomautus", 
                "ei_velvoitetta_palvelu",
                "alennettu_osa_aikainen",
                "ei_velvoitetta_tyokyky",
                "paasaanto"
            ];
            
            const sortedPhrases = [...sectionData.fraasit].sort((a, b) => {
                const aIndex = priorityOrder.indexOf(a.avainsana);
                const bIndex = priorityOrder.indexOf(b.avainsana);
                // Jos ei löydy, pidetään lopussa
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });

            for (const phrase of sortedPhrases) {
                if (!phrase.ehdot) continue;

                const tyotilanneEhtoOk = phrase.ehdot.tyotilanne 
                    ? phrase.ehdot.tyotilanne.some(ehto => tilanneAvainsanat.includes(ehto)) 
                    : true;

                const tyokykyEhtoOk = phrase.ehdot.tyokyky 
                    ? phrase.ehdot.tyokyky.includes(tyokykyAvainsana) 
                    : true;

                if (tyotilanneEhtoOk && tyokykyEhtoOk) {
                    return phrase;
                }
            }
            return null;
        };

        const recommendation = findRecommendation();
        
        const detectedConditions = [];
        if (tilanneAvainsanat.length > 0) detectedConditions.push(`Asiakkaan työtilanne: ${tilanneAvainsanat.join(', ')}`);
        if (tyokykyAvainsana) detectedConditions.push(`Työkyky: ${tyokykyAvainsana.replace('tyokyky_', '')}`);

        return {
            conditions: detectedConditions,
            ruleText: recommendation?.selite || "Ei automaattista sääntöä. Valitse manuaalisesti.",
            proposalText: recommendation ? `Ehdotus: ${recommendation.lyhenne}` : "Tarkista aiemmat valinnat tai valitse manuaalisesti.",
            recommendedKeyword: recommendation?.avainsana || null
        };

    }, [state.tyotilanne, state.tyokyky, sectionData.fraasit]);

    // ALENNUSTYÖKALUN AUTOMAATTINEN AVAAMINEN
    const handleVariableUpdate = (sectionId, phraseKeyword, variableName, newValue) => {
        // 1. Päivitä globaali state
        onUpdateVariable(sectionId, phraseKeyword, variableName, newValue);

        // 2. Tarkista, pitäisikö alennustyökalu avata
        const phrase = sectionData.fraasit.find(p => p.avainsana === phraseKeyword);
        if (phrase && variableName === 'LKM') {
            const defaultValue = phrase.muuttujat?.LKM?.oletus;
            if (typeof defaultValue === 'number' && newValue < defaultValue) {
                setAlennusToolVisible(true);
            }
        }
    };

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
                        // Käytetään uutta, älykkäämpää käsittelijää
                        onUpdateVariable={handleVariableUpdate} 
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
                        // Käytetään onSelect-funktiota päivittämään koko valinta kerralla
                        onSelect(sectionData.id, updatedSelection.avainsana, false, updatedSelection);
                        setAlennusToolVisible(false);
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