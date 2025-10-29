# Luo uusi ominaisuuskansio
mkdir -p src/components/koulutusYrittajyys

# Luo utils-kansio ja aputiedosto
mkdir -p src/utils
cat <<EOF > src/utils/stringUtils.js
// Aputoiminto: Muuttaa lauseen ensimmäisen kirjaimen pieneksi
export const toLowerFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
};

// Aputoiminto: Muodostaa listasta siistin lauseen (esim. "a, b ja c")
export const createListSentence = (items) => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' ja ');
    
    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return \`\${allButLast} ja \${last}\`;
};
EOF

# Luo logiikka-hook (useKoulutusSummary.js)
cat <<EOF > src/components/koulutusYrittajyys/useKoulutusSummary.js
import { useMemo } from 'react';
import { kielitaitoTasot } from '../../data/guide'; // Varmista polku
import { toLowerFirst, createListSentence } from '../../utils/stringUtils';

export const useKoulutusSummary = (koulutusState, kielitasoState, customTekstit, sectionData) => {
    
    const generatedSummarySentence = useMemo(() => {
        koulutusState = koulutusState || {};
        const { customKoulutusText, customKielitasoText } = customTekstit || {};
        const allFraasit = sectionData.fraasit || [];

        let summaryParts = [];

        // 1. Käsittele Koulutus/Yrittäjyys -valinnat (Yksivalinnat)
        if (koulutusState && koulutusState.avainsana) {
            const phrase = allFraasit.find(f => f.avainsana === koulutusState.avainsana);
            if (phrase && (phrase.ryhma === 'koulutus' || phrase.ryhma === 'yrittajyys')) {
                let text = phrase.teksti || '';
                if (koulutusState.muuttujat) {
                    Object.entries(koulutusState.muuttujat).forEach(([key, value]) => {
                        if (value || typeof value === 'number') {
                            text = text.replace(\`[\${key}]\`, value);
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
            summaryParts.push(\`Asiakkaalla on voimassa mm. \${cardListString}.\`);
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
            const suomiTiedotSuomeksi = suomiTiedot.replace(/^(\w+)/, '\$1 suomeksi');
            languageParts.push(\`Asiakkaan äidinkieli on \${kielitasoState.aidinkieli}, asiakas \${suomiTiedotSuomeksi}\`);
        } else if (kielitasoState?.aidinkieli) {
            languageParts.push(\`Asiakkaan äidinkieli on \${kielitasoState.aidinkieli}.\`);
        } else if (suomiTiedot) {
            const suomiTiedotSuomeksi = suomiTiedot.replace(/^(\w+)/, '\$1 suomeksi');
            languageParts.push(\`Asiakas \${suomiTiedotSuomeksi}\`);
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

    }, [koulutusState, kielitasoState, customTekstit, sectionData]);

    return generatedSummarySentence;
};
EOF

# Luo RadioPhraseSection.jsx (Yksivalinnoille)
cat <<EOF > src/components/koulutusYrittajyys/RadioPhraseSection.jsx
import React from 'react';
import { PhraseOption } from '../PhraseOption'; // Tuodaan ylemmältä tasolta

/**
 * Komponentti yksittäisen osion renderöintiin, joka tukee YKSIVALINTOJA (radio).
 * Esim. Koulutus tai Yrittäjyys.
 */
const RadioPhraseSection = ({ title, phrases, sectionId, sectionState, actions }) => {
    
    if (!phrases || phrases.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    const renderRadioPhrase = (phrase) => {
        // YKSIVALINTA-logiikka: tarkistetaan, onko fraasin avainsana se,
        // joka on tallennettu osion stateen.
        const isSelected = sectionState?.avainsana === phrase.avainsana ? sectionState : null;

        return (
            <PhraseOption
                key={phrase.avainsana}
                phrase={phrase}
                // Pakotetaan PhraseOption käyttämään yksivalinta-logiikkaa
                section={{ id: sectionId, monivalinta: false }}
                isSelected={isSelected}
                onSelect={onSelect}
                onUpdateVariable={onUpdateVariable}
            />
        );
    };

    return (
        <div className="subsection">
            <h3 className="subsection-title">{title}</h3>
            <div className="options-container">
                {phrases.map(renderRadioPhrase)}
            </div>
        </div>
    );
};

export default RadioPhraseSection;
EOF

# Luo Ammattikortit.jsx (Monivalinnoille)
cat <<EOF > src/components/koulutusYrittajyys/Ammattikortit.jsx
import React from 'react';
import { PhraseOption } from '../PhraseOption'; // Tuodaan ylemmältä tasolta

/**
 * Komponentti ammattikorttien valintojen renderöintiä varten (MONIVALINTA).
 */
const Ammattikortit = ({ sectionId, sectionState, korttiFraasit, actions }) => {
    
    if (!korttiFraasit || korttiFraasit.length === 0) {
        return null;
    }

    const { onSelect, onUpdateVariable } = actions;

    const renderCardPhrase = (phrase) => {
        // MONIVALINTA-logiikka: tarkistetaan, onko avainsanalle
        // tallennettu stateen arvo 'true'.
        const isSelected = !!sectionState?.[phrase.avainsana];

        return (
            <PhraseOption
                key={phrase.avainsana}
                phrase={phrase}
                // Pakotetaan PhraseOption käyttämään monivalinta-logiikkaa
                section={{ id: sectionId, monivalinta: true }} 
                isSelected={isSelected}
                onSelect={onSelect}
                onUpdateVariable={onUpdateVariable}
            />
        );
    };

    return (
        <div className="options-container card-options">
            <h4 className="subsection-subtitle" style={{ width: '100%', marginBottom: '0.5rem' }}>Ammattikortit</h4>
            {korttiFraasit.map(renderCardPhrase)}
        </div>
    );
};

export default Ammattikortit;
EOF

# Luo SummaryPreview.jsx (Koontilaatikko)
cat <<EOF > src/components/koulutusYrittajyys/SummaryPreview.jsx
import React, { useState } from 'react';

/**
 * Komponentti "Ehdotus yhteenvetoon" -laatikon näyttämiseen.
 * Hallitsee oman "Käytä tätä" -napin palautteen.
 */
const SummaryPreview = ({ sentence, sectionId, onUpdateCustomText }) => {
    const [actionFeedback, setActionFeedback] = useState('');

    const handleUseSummary = () => {
        if (!sentence || !onUpdateCustomText) return;
        
        // Kutsutaan ylempää annettua actionia
        onUpdateCustomText(sectionId, sentence);
        
        // Asetetaan palaute
        setActionFeedback('Ehdotus siirretty lisätietoihin!');
        setTimeout(() => setActionFeedback(''), 2500);
    };

    // Jos lausetta ei ole, älä näytä mitään
    if (!sentence) {
        return null;
    }

    return (
        <div className="summary-preview language-summary-preview">
            <h4>Ehdotus yhteenvetoon:</h4>
            <p>{sentence}</p>
            <button
                onClick={handleUseSummary}
                title="Siirrä ehdotus alla olevaan lisätietokenttään"
                className='copy-suggestion-button' 
            >
                Käytä tätä yhteenvetona
            </button>
            {actionFeedback && <span className='feedback-text'> {actionFeedback}</span>}
        </div>
    );
};

export default SummaryPreview;
EOF

echo "Kaikki tiedostot luotu."