#!/bin/bash

# Espan-projektin viimeistelyskripti
# Tämä skripti korjaa scraperin ja yhteenvedon logiikan,
# poistaa tuplakirjaukset ja parantaa datan lajittelua.

echo "Viimeistellään scraperin ja yhteenvedon logiikka..."

# --- 1. PÄIVITETÄÄN SCRAPERIN LOGIIKKA (scraper.js) ---
echo "Kirjoitetaan src/utils/scraper.js kokonaan uudelleen..."
cat <<'EOF' > src/utils/scraper.js
import { planData } from '../data/planData';

const createPhraseObject = (sectionId, avainsana, muuttujat = {}) => {
    const section = planData.aihealueet.find(s => s.id === sectionId);
    if (!section || !section.fraasit) return null;
    const phraseTemplate = section.fraasit.find(f => f.avainsana === avainsana);
    if (!phraseTemplate) return null;

    const newPhrase = { avainsana, teksti: phraseTemplate.teksti, muuttujat: {} };
    if (phraseTemplate.muuttujat) {
        Object.entries(phraseTemplate.muuttujat).forEach(([key, config]) => {
            newPhrase.muuttujat[key] = muuttujat[key] || config.oletus || '';
        });
    }
    return newPhrase;
};

// --- SÄÄNTÖMOOTTORI V6 ---
export const parseTextToState = (text) => {
    let state = {};
    
    const sectionTriggers = {
        suunnitelman_perustiedot: /Suunnitelma on päivitetty/i,
        tyotilanne: /NYKYTILANNE:|Asiakas on (rakennusmies|työtön)/i,
        koulutus_yrittajyys: /OSAAMINEN:|Asiakas on koulutukseltaan|Asiakkaalla peruskoulutus/i,
        suunnitelma: /TAVOITTEET JA SUUNNITELMA:|Työnhaun tavoite:/i,
        tyokyky: /TYÖKYKYARVIO:|Asiakkaan työkyky/i,
        tyonhakuvelvollisuus: /TYÖNHAKUVELVOITE:|Työnhakuvelvollisuus on|Palvelumallin mukaisesti/i
    };

    const rules = {
        suunnitelman_perustiedot: [
            {
                regex: /päivitetty\s+(puhelimitse)\s+(\d{1,2}\.\d{1,2}\.\d{4})/i,
                action: (match, s) => {
                    s.laadittu = createPhraseObject('suunnitelman_perustiedot', 'laadittu', { YHTEYDENOTTOTAPA: 'puhelinajalla', PÄIVÄMÄÄRÄ: match[2] });
                    return match[0];
                }
            }
        ],
        tyotilanne: [
            {
                regex: /työtön työhakija/i,
                action: (match, s) => {
                    s.tyoton = createPhraseObject('tyotilanne', 'tyoton');
                    return match[0];
                }
            },
            {
                regex: /(lomautettu)/i,
                action: (match, s) => {
                    s.lomautettu = createPhraseObject('tyotilanne', 'lomautettu');
                    return match[0];
                }
            }
        ],
        koulutus_yrittajyys: [
            {
                regex: /koulutukseltaan\s+([a-zA-ZåäöÅÄÖ-]+)/i,
                action: (match, s) => {
                    s.koulutus_tausta = createPhraseObject('koulutus_yrittajyys', 'koulutus_tausta', { KOULUTUS: match[1] });
                    return match[0];
                }
            },
            {
                regex: /peruskoulutus/i,
                action: (match, s) => {
                    s.ei_tutkintoa = createPhraseObject('koulutus_yrittajyys', 'ei_tutkintoa');
                    return match[0];
                }
            },
            {
                regex: /Ei yritystä tai yrittäjyysajatuksia/i,
                action: (match, s) => {
                     s.ei_yrittajyysajatuksia = createPhraseObject('koulutus_yrittajyys', 'ei_yrittajyysajatuksia');
                     return match[0];
                }
            }
        ],
        tyokyky: [
             {
                regex: /pistemääräkseen\s+(\d+)/i,
                action: (match, s) => {
                    s.omaArvio = match[1];
                    return match[0];
                }
            },
            {
                regex: /Elämässäni ei ole tällä hetkellä asioita, jotka vaikeuttavat työllistymistäni/i,
                action: (match, s) => {
                    s.paavalinta = { teksti: "Työkyky on normaali.", avainsana: "tyokyky_normaali" };
                    return match[0];
                }
            }
        ],
        tyonhakuvelvollisuus: [
            {
                regex: /(\d+)\s+kpl\/kk/i,
                action: (match, s) => {
                    s.paasaanto = createPhraseObject('tyonhakuvelvollisuus', 'paasaanto', { LKM: match[1], AIKAJAKSO: 'kuukaudessa' });
                    return match[0];
                }
            },
            {
                regex: /hakea vähintään (neljää)\s*\(?(\d+)?\)? työmahdollisuutta (kuukaudessa)/i,
                action: (match, s) => {
                    s.paasaanto = createPhraseObject('tyonhakuvelvollisuus', 'paasaanto', { LKM: 4, AIKAJAKSO: 'kuukaudessa' });
                    return match[0];
                }
            }
        ]
    };
    
    // Etsitään kaikkien triggerien sijainnit tekstistä
    const foundTriggers = Object.entries(sectionTriggers)
        .map(([id, regex]) => ({ id, match: text.match(regex) }))
        .filter(item => item.match)
        .sort((a, b) => a.match.index - b.match.index);

    if (foundTriggers.length === 0) {
        // Jos triggereitä ei löydy, käytetään vanhaa yleistä logiikkaa
        state['custom-suunnitelma'] = text;
        return state;
    }

    // Pilkotaan teksti osiin triggerien perusteella
    let lastIndex = 0;
    const textChunks = {};
    foundTriggers.forEach((trigger, i) => {
        const nextTrigger = foundTriggers[i + 1];
        const endIndex = nextTrigger ? nextTrigger.match.index : text.length;
        textChunks[trigger.id] = text.substring(trigger.match.index, endIndex);
    });

    // Käydään läpi jokainen tekstikappale ja sovelletaan sääntöjä
    Object.entries(textChunks).forEach(([sectionId, chunkText]) => {
        let remainingText = chunkText;
        const sectionState = {};
        
        if (rules[sectionId]) {
            rules[sectionId].forEach(rule => {
                const globalRegex = new RegExp(rule.regex.source, 'gi');
                const matches = [...remainingText.matchAll(globalRegex)];
                if (matches.length > 0) {
                    matches.forEach(match => {
                        const consumedText = rule.action(match, sectionState);
                        if(consumedText) remainingText = remainingText.replace(consumedText, '');
                    });
                }
            });
        }

        // Siivotaan jäljelle jäänyt teksti ja lisätään se lisätietoihin
        const cleanRemainingText = remainingText.replace(sectionTriggers[sectionId], '').trim();
        if (cleanRemainingText.length > 5) {
            state[`custom-${sectionId}`] = cleanRemainingText;
        }

        // Yhdistetään osion tila pää-stateen
        if (Object.keys(sectionState).length > 0) {
            state[sectionId] = { ...(state[sectionId] || {}), ...sectionState };
        }
    });

    return state;
};
EOF


# --- 2. PÄIVITETÄÄN Summary.jsx ---
echo "Päivitetään src/components/Summary.jsx tulostamaan tiedot siistimmin..."
cat <<'EOF' > src/components/Summary.jsx
import React, { useState, useMemo } from 'react';
import { planData, TYONHAKUVELVOLLISUUS_LOPPUTEKSTI } from '../data/planData.js';

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let textParts = [];
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionTextParts = [];
            
            const processPhrase = (phraseObject) => {
                let phraseText = phraseObject.teksti;
                const phraseState = section.monivalinta ? state[section.id]?.[phraseObject.avainsana] : state[section.id];
                if (phraseState?.muuttujat) {
                    Object.entries(phraseState.muuttujat).forEach(([key, value]) => {
                         phraseText = phraseText.replace(`[${key}]`, value || `[${key}]`);
                    });
                }
                return phraseText;
            };

            // Erikoiskomponenttien käsittely
            if (section.id === 'tyokyky' && state.tyokyky) {
                const s = state.tyokyky;
                if (s.paavalinta) {
                    if (s.paavalinta.avainsana === 'tyokyky_alentunut' && s.alentumaKuvaus) {
                        sectionTextParts.push(`Asiakkaalla on työkyvyn alentuma: ${s.alentumaKuvaus}`);
                    } else {
                        sectionTextParts.push(s.paavalinta.teksti);
                    }
                }
                if (s.omaArvio) sectionTextParts.push(`Asiakkaan oma arvio työkyvystään: ${s.omaArvio}/10.`);
                if (s.palveluohjaukset && Object.keys(s.palveluohjaukset).length > 0) {
                     const ohjaukset = Object.values(s.palveluohjaukset).map(p => `- ${p.teksti}`).join('\n');
                     sectionTextParts.push(`Palveluohjaus:\n${ohjaukset}`);
                 }
                if (s.koonti) sectionTextParts.push(`Koonti työkykykeskustelusta:\n${s.koonti}`);
            } 
            else if (selection) {
                if (section.monivalinta) {
                    Object.values(selection).forEach(phrase => sectionTextParts.push(processPhrase(phrase)));
                } else if (selection.teksti) {
                    let text = processPhrase(selection);
                    // Lisätään pitkä lopputeksti vain, jos se ei ole jo osa fraasia
                    if (section.id === 'tyonhakuvelvollisuus' && !text.includes("Haetut paikat")) {
                        text += TYONHAKUVELVOLLISUUS_LOPPUTEKSTI;
                    }
                    sectionTextParts.push(text);
                }
            }

            if (customText) {
                sectionTextParts.push(customText);
            }

            if (sectionTextParts.length > 0) {
                textParts.push(`**${section.otsikko}**\n${sectionTextParts.join('\n')}`);
            }
        });
        return textParts.join('\n\n');
    }, [state]);

    const handleCopy = () => {
        const plainText = summaryText.replace(/\*\*/g, '');
        navigator.clipboard.writeText(plainText).then(() => {
            setFeedback('Kopioitu!');
            setTimeout(() => setFeedback(''), 2000);
        });
    };
    return (
        <aside className="summary-sticky-container">
            <div className="summary-box">
                <h2>Koottu suunnitelma</h2>
                <div className="summary-content">
                    {summaryText ? (
                        summaryText.split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex}>
                                {paragraph.split('\n').map((line, lIndex) => {
                                    if (lIndex === 0 && line.startsWith('**') && line.endsWith('**')) {
                                        return <strong key={lIndex}>{line.replace(/\*\*/g, '')}</strong>;
                                    }
                                    return <React.Fragment key={lIndex}><br />{line}</React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi...</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>Kopioi leikepöydälle</button>
                <p className="feedback-text">{feedback}</p>
            </div>
        </aside>
    );
};
export default Summary;
EOF


echo "Päivitys valmis! Scraperin ja yhteenvedon logiikka on nyt viimeistelty."
echo "Voit käynnistää sovelluksen komennolla: npm run dev"