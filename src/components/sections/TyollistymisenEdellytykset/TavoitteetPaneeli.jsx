// --- src/components/sections/TyollistymisenEdellytykset/TavoitteetPaneeli.jsx ---

import React, { useState, useEffect, useMemo } from 'react';
import Tag from '../../common/Tag';
import { useSmartText } from './useSmartText';
import TavoiteAmmattiValitsin from './TavoiteAmmattiValitsin';

const TavoitteetPaneeli = ({ data, updateData, dbPhrases, actions, globalSignals }) => {
    const { buildSentence } = useSmartText();
    const [activeTags, setActiveTags] = useState([]);

    const hakuPhrases = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'vahvuus_haku'), [dbPhrases]);

    const onYrittajyysKiinnostus = Object.keys(globalSignals).some(key => key.includes('yritta') || key.includes('yritys'));
    const onHyvatDigitaidot = globalSignals['hyvat_digitaidot']; 

    // --- UUSI LISÄYS: Synkronoidaan imurin asettamat signaalit takaisin UI-valinnoiksi ---
    useEffect(() => {
        if (globalSignals && hakuPhrases.length > 0) {
            const imuroidutTags = hakuPhrases
                .filter(phrase => globalSignals[phrase.phrase_key] === true)
                .map(phrase => ({
                    id: phrase.phrase_key,
                    frag: phrase.base_text
                }));
                
            if (imuroidutTags.length > 0) {
                setActiveTags(prev => {
                    // Estetään turha päivitys, jos tilat ovat samat
                    const prevIds = prev.map(t => t.id).sort().join(',');
                    const newIds = imuroidutTags.map(t => t.id).sort().join(',');
                    return prevIds === newIds ? prev : imuroidutTags;
                });
            }
        }
    }, [globalSignals, hakuPhrases]);

    useEffect(() => {
        let sentences = [];
        let tavoiteTeksti = "Asiakkaan ensisijaisena tavoitteena on työllistyä avoimille markkinoille";
        
        if (onYrittajyysKiinnostus) tavoiteTeksti += " tai työllistää itsensä yrittäjänä";

        if (data.escoNimi && data.finescoAla && data.finescoAla !== 'Ei määritelty') {
            tavoiteTeksti += `, erityisesti ${data.finescoAla.toLowerCase()} -alan ${data.escoNimi.toLowerCase()} -tehtäviin.`;
        } else if (data.escoNimi) {
            tavoiteTeksti += `, erityisesti ${data.escoNimi.toLowerCase()} -tehtäviin.`;
        } else if (data.finescoAla && data.finescoAla !== 'Ei määritelty') {
            tavoiteTeksti += ` ${data.finescoAla.toLowerCase()} -alalle.`;
        } else {
            tavoiteTeksti += ".";
        }
        sentences.push(tavoiteTeksti);

        if (data.vaihtoehtoisetAlat && data.vaihtoehtoisetAlat.length > 0) {
            const alatNimet = data.vaihtoehtoisetAlat.map(a => a.nimi);
            sentences.push(buildSentence(alatNimet, "Vaihtoehtoisina tavoitteina on kartoitettu ", "."));
        }

        if (activeTags.length > 0) {
            const tagFragments = activeTags.map(t => t.frag);
            sentences.push(buildSentence(tagFragments, "Asiakas hyödyntää työnhaussaan ", "."));
        }

        if (onHyvatDigitaidot) {
            sentences.push("Asiakkaalla on hyvät valmiudet sähköiseen asiointiin ja itsenäiseen tiedonhakuun digitaalisissa kanavissa.");
        }

        const uusiTeksti = sentences.join(" ");
        if (data.freeText.box1 !== uusiTeksti) {
            updateData('freeText', { ...data.freeText, box1: uusiTeksti });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.escoNimi, data.finescoAla, data.vaihtoehtoisetAlat, activeTags, buildSentence, onYrittajyysKiinnostus, onHyvatDigitaidot]);

    const toggleTag = (phrase_key, base_text) => {
        let newTags;
        let isNowActive = false;
        if (activeTags.some(t => t.id === phrase_key)) {
            newTags = activeTags.filter(t => t.id !== phrase_key);
            isNowActive = false;
        } else {
            newTags = [...activeTags, { id: phrase_key, frag: base_text }];
            isNowActive = true;
        }
        setActiveTags(newTags);
        if (actions && actions.setSignal) actions.setSignal(phrase_key, isNowActive);
    };

    return (
        <div className="panel-gray">
            <h3 className="subsection-title">1. Tavoitteet, työnhaku ja aktiivisuus</h3>
            
            <TavoiteAmmattiValitsin 
                data={data} 
                updateData={updateData} 
                actions={actions} 
                globalSignals={globalSignals} 
            />

            <label className="stat-label" style={{ marginTop: '1.5rem' }}>Hakukanavat ja taidot (Vahvuudet)</label>
            <div className="chip-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {hakuPhrases.map(phrase => {
                    const isActive = activeTags.some(t => t.id === phrase.phrase_key);
                    const tagType = isActive ? 'success' : 'primary';
                    return (
                        <div key={phrase.phrase_key} onClick={() => toggleTag(phrase.phrase_key, phrase.base_text)} style={{ cursor: 'pointer' }}>
                            <Tag type={tagType}>{isActive ? '✓' : '+'} {phrase.short_title}</Tag>
                        </div>
                    );
                })}
            </div>

            <label className="icon-label">Tavoitteiden ja aktiivisuuden kooste (Tallennettava teksti)</label>
            <textarea className="modern-input" value={data.freeText.box1} onChange={(e) => updateData('freeText', { ...data.freeText, box1: e.target.value })} rows={4} />
        </div>
    );
};

export default TavoitteetPaneeli;