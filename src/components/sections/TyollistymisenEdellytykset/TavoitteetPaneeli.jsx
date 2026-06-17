import React, { useState, useEffect, useMemo } from 'react';
import Tag from '../../common/Tag';
import { useSmartText } from './useSmartText';
import TavoiteAmmattiValitsin from './TavoiteAmmattiValitsin';

const TavoitteetPaneeli = ({ state, data, updateData, dbPhrases, actions, globalSignals }) => {
    const { buildSentence } = useSmartText();
    const [activeTags, setActiveTags] = useState([]);

    // --- FRAASIT TIETOKANNASTA ---
    // 1. Vahvuudet
    const hakuPhrases = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'vahvuus_haku'), [dbPhrases]);
    // 2. UUSI: Haasteet/Esteet
    const estePhrases = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'este_haku'), [dbPhrases]);

    // --- SIGNAALIT GLOBAALISTA TILASTA ---
    const onYrittajyysKiinnostus = Object.keys(globalSignals || {}).some(key => key.includes('yritta') || key.includes('yritys'));
    const onHyvatDigitaidot = globalSignals?.['hyvat_digitaidot']; 
    // UUSI: Luetaan myös heikot digitaidot
    const onHeikotDigitaidot = globalSignals?.['puutteelliset_digitaidot']; 

    const vaihtoehtoisetAlat = useMemo(() => {
        try { const raw = state?.['custom-vaihtoehtoiset_ammatit']; return raw ? JSON.parse(raw) : []; } 
        catch (e) { return []; }
    }, [state]);

    const valitutEscoTaidot = useMemo(() => {
        try { const raw = state?.['custom-valitut_esco_taidot']; return raw ? JSON.parse(raw) : []; } 
        catch (e) { return []; }
    }, [state]);

    // --- SYNKRONOINTI (Imuri -> UI Raksit) ---
    useEffect(() => {
        // Yhdistetään sekä vahvuudet että esteet synkronointia varten
        const allTargetPhrases = [...hakuPhrases, ...estePhrases];
        
        if (globalSignals && allTargetPhrases.length > 0) {
            const imuroidutTags = allTargetPhrases
                .filter(phrase => globalSignals[phrase.phrase_key] === true)
                .map(phrase => ({ id: phrase.phrase_key, frag: phrase.base_text }));
                
            if (imuroidutTags.length > 0) {
                setActiveTags(prev => {
                    const prevIds = prev.map(t => t.id).sort().join(',');
                    const newIds = imuroidutTags.map(t => t.id).sort().join(',');
                    return prevIds === newIds ? prev : imuroidutTags;
                });
            }
        }
    }, [globalSignals, hakuPhrases, estePhrases]);

    // --- TAVOITELAUSEEN MUODOSTUS ---
    useEffect(() => {
        let sentences = [];
        
        // 1. Perustavoite
        let perusTavoite = "Asiakkaan ensisijaisena tavoitteena on työllistyä avoimille markkinoille";
        if (onYrittajyysKiinnostus) perusTavoite += " tai työllistää itsensä yrittäjänä";
        sentences.push(perusTavoite + ".");

        // 2. Finesco Ala ja ESCO Ammatti
        const escoNimi = state?.asiakas?.tavoiteammatti_esco_nimi;
        const finescoAla = state?.asiakas?.tavoiteammatti_finesco_ala;

        if (escoNimi && finescoAla && finescoAla !== 'Ei määritelty') {
            sentences.push(`Asiakkaan tavoitteena on työllistyä alalle: ${finescoAla.toLowerCase()}. Tarkempana tavoiteammattina on ${escoNimi.toLowerCase()}.`);
        } else if (escoNimi) {
            sentences.push(`Asiakkaan tavoiteammattina on ${escoNimi.toLowerCase()}.`);
        } else if (finescoAla && finescoAla !== 'Ei määritelty') {
            sentences.push(`Asiakkaan tavoitteena on työllistyä alalle: ${finescoAla.toLowerCase()}.`);
        }

        // 3. Vaihtoehtoiset ammatit
        if (vaihtoehtoisetAlat.length > 0) {
            const alatNimet = vaihtoehtoisetAlat.map(a => a.nimi.toLowerCase());
            sentences.push(buildSentence(alatNimet, "Kiinnostusta myös seuraaviin: ", "."));
        }

        // 4. ESCO Taidot
        if (valitutEscoTaidot.length > 0) {
            sentences.push(buildSentence(valitutEscoTaidot, "Asiakkaan ammatillisena ydinosaamisena on ", "."));
        }

        // 5. HAKUKANAVAT JA HAASTEET (Jaotellaan valitut tägit vahvuuksiin ja esteisiin)
        const activeVahvuudet = activeTags.filter(t => hakuPhrases.some(p => p.phrase_key === t.id)).map(t => t.frag);
        const activeEsteet = activeTags.filter(t => estePhrases.some(p => p.phrase_key === t.id)).map(t => t.frag);

        if (activeVahvuudet.length > 0) {
            sentences.push(buildSentence(activeVahvuudet, "Asiakas hyödyntää työnhaussaan ", "."));
        }
        
        if (activeEsteet.length > 0) {
            sentences.push(buildSentence(activeEsteet, "Omatoimista työnhakua haastaa tällä hetkellä ", "."));
        }

        // 6. Digitaidot (Positiivinen vs Negatiivinen)
        if (onHyvatDigitaidot) {
            sentences.push("Asiakkaalla on hyvät valmiudet sähköiseen asiointiin ja itsenäiseen tiedonhakuun digitaalisissa kanavissa.");
        } else if (onHeikotDigitaidot) {
            sentences.push("Puutteelliset digitaidot haastavat omatoimista sähköistä työnhakua ja asiointia.");
        }

        const uusiTeksti = sentences.join(" ");
        
        if (data.freeText?.box1 !== uusiTeksti) {
            updateData('freeText', { ...data.freeText, box1: uusiTeksti });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        state?.asiakas?.tavoiteammatti_esco_nimi, state?.asiakas?.tavoiteammatti_finesco_ala, 
        vaihtoehtoisetAlat, valitutEscoTaidot, activeTags, buildSentence, 
        onYrittajyysKiinnostus, onHyvatDigitaidot, onHeikotDigitaidot
    ]);

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
                state={state}
                actions={actions} 
                data={data}
                updateData={updateData}
            />

            {/* VAHVUUDET */}
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

            {/* UUSI: HAASTEET JA ESTEET */}
            {estePhrases.length > 0 && (
                <>
                    <label className="stat-label" style={{ color: 'var(--color-danger)' }}>Työnhaun haasteet (Esteet)</label>
                    <div className="chip-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {estePhrases.map(phrase => {
                            const isActive = activeTags.some(t => t.id === phrase.phrase_key);
                            // Käytetään varoitusvärejä negatiivisille asioille
                            const tagType = isActive ? 'danger' : 'secondary';
                            return (
                                <div key={phrase.phrase_key} onClick={() => toggleTag(phrase.phrase_key, phrase.base_text)} style={{ cursor: 'pointer' }}>
                                    <Tag type={tagType}>{isActive ? '✓' : '+'} {phrase.short_title}</Tag>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <label className="icon-label">Tavoitteiden ja aktiivisuuden kooste (Tallennettava teksti)</label>
            <textarea className="modern-input" value={data.freeText?.box1 || ''} onChange={(e) => updateData('freeText', { ...data.freeText, box1: e.target.value })} rows={5} />
        </div>
    );
};

export default TavoitteetPaneeli;