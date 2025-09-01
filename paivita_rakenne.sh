#!/bin/bash

# Espan-projektin tyylien refaktorointiskripti (Kaksiosainen CSS)
# Tämä skripti siirtää tyylit kahteen tiedostoon: rakenteet.css ja tyylit.css.

echo "Aloitetaan tyylien refaktorointi..."

# --- 1. SIIVOTAAN VANHA RAKENNE ---
echo "Poistetaan vanhat komponentit ja tyylit valmisteluna..."
rm -f src/App.jsx
rm -f src/data/planData.js
rm -rf src/components
rm -rf src/styles

# --- 2. LUODAAN UUSI KANSIORAKENNE ---
echo "Luodaan uusi kansiorakenne: src/styles, src/components/sections, src/data..."
mkdir -p src/styles
mkdir -p src/components/sections
mkdir -p src/data

# --- 3. LUODAAN CSS-TIEDOSTOT ---

# A) RAKENTEET.CSS
echo "Luodaan rakenteelliset tyylit: src/styles/rakenteet.css..."
cat <<'EOF' > src/styles/rakenteet.css
/* --- RAKENTEET.CSS --- */
/* Tässä tiedostossa määritellään kaikki asetteluun, sijoitteluun ja rakenteeseen liittyvä. */

.app-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem;
}

.main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
}

@media (min-width: 1024px) {
    .main-grid {
        grid-template-columns: 2fr 1fr;
    }
}

.sections-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.section-container {
    padding: 1.5rem;
}

.options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.variables-container {
    margin-top: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.custom-text-container {
    margin-top: 1.5rem;
}

/* Palkkatukilaskurin rakenteet */
.info-box {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.questions-container {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.boolean-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 0.25rem;
}

.analysis-container {
    margin-top: 1.5rem;
    padding-top: 1rem;
}

/* Yhteenvedon rakenteet */
.summary-sticky-container {
    position: sticky;
    top: 2rem;
}

.summary-box {
    padding: 1.5rem;
}

.summary-content {
    padding: 1rem;
    min-height: 200px;
    max-height: 60vh;
    overflow-y: auto;
}

.copy-button {
    margin-top: 1rem;
    width: 100%;
    padding: 0.5rem 1rem;
}

.feedback-text {
    margin-top: 0.5rem;
    height: 1.25rem; /* 20px */
    text-align: center;
}
EOF

# B) TYYLIT.CSS
echo "Luodaan visuaaliset tyylit: src/styles/tyylit.css..."
cat <<'EOF' > src/styles/tyylit.css
/* --- TYYLIT.CSS --- */
/* Tässä tiedostossa määritellään kaikki visuaaliseen ilmeeseen liittyvä: värit, fontit, varjostukset jne. */

:root {
    --color-primary: #2563eb; /* sininen */
    --color-primary-hover: #1d4ed8;
    --color-background: #f9fafb; /* hyvin vaalea harmaa */
    --color-surface: #ffffff; /* valkoinen */
    --color-text-primary: #111827; /* tumma harmaa */
    --color-text-secondary: #4b5563;
    --color-border: #e5e7eb;
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --border-radius: 0.75rem; /* 12px */
}

body {
    font-family: 'Inter', sans-serif;
    background-color: var(--color-background);
    color: var(--color-text-primary);
    margin: 0;
}

.app-header {
    text-align: center;
    margin-bottom: 2rem;
}

h1 {
    font-size: 2.25rem;
    font-weight: 700;
}

h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--color-text-primary);
}

h3 {
    font-weight: 600;
    color: var(--color-text-primary);
}

p, label, li {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.app-header p {
    margin-top: 0.5rem;
}

/* Yleiset komponenttityylit */
.section-container, .summary-box {
    background-color: var(--color-surface);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    border: 1px solid var(--color-border);
}

.phrase-option {
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    background-color: #fff;
}

.phrase-option:hover {
    border-color: var(--color-primary);
}

.phrase-option.selected {
    border-color: var(--color-primary);
    background-color: #eff6ff;
    box-shadow: 0 0 0 1px var(--color-primary);
}

.variables-container {
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #f3f4f6;
}

input, select, textarea {
    margin-top: 0.25rem;
    display: block;
    width: 100%;
    box-sizing: border-box; /* Varmistaa, että padding ei kasvata leveyttä */
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    padding: 0.5rem 0.75rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* Palkkatukilaskurin tyylit */
.info-box {
    border-left: 4px solid var(--color-primary);
    background-color: #eff6ff;
    border-radius: 0rem 0.5rem 0.5rem 0rem;
}

.boolean-buttons button {
    border: 1px solid transparent;
    cursor: pointer;
    background-color: #e5e7eb;
    border-radius: 0.375rem;
}

.boolean-buttons button.selected {
    background-color: var(--color-primary);
    color: white;
}

.analysis-container {
    border-top: 2px solid var(--color-border);
}

.analysis-container .ehdotus {
    font-weight: 700;
    color: var(--color-primary);
    padding-top: 0.5rem;
}

/* Yhteenvedon tyylit */
.summary-content {
    background-color: #f3f4f6;
    border-radius: 0.5rem;
}

.summary-content strong {
    display: block;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 0.25rem;
}

.copy-button {
    background-color: var(--color-primary);
    color: white;
    font-weight: 600;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
}

.copy-button:hover {
    background-color: var(--color-primary-hover);
}

.copy-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
}

.feedback-text {
    color: #16a34a; /* vihreä */
    font-weight: 500;
}
EOF

# --- 4. LUODAAN JSX-TIEDOSTOT ---

# Luodaan datatiedosto
echo "Luodaan src/data/planData.js..."
cat <<'EOF' > src/data/planData.js
// --- DATA ---
// Tämä tiedosto sisältää kaiken staattisen datan ja logiikan sovellukselle.
export const planData = {
  "aihealueet": [
    {
      "otsikko": "Suunnitelman tyyppi",
      "id": "suunnitelman_tyyppi",
      "fraasit": [
        { "teksti": "Laaditaan työllistymissuunnitelma.", "avainsana": "tyollisyyssuunnitelma" }
      ]
    },
    {
      "otsikko": "Suunnitelman perustiedot",
      "id": "suunnitelman_perustiedot",
      "monivalinta": true,
      "fraasit": [
        { 
          "teksti": "Tämä suunnitelma laadittiin [YHTEYDENOTTOTAPA] [PÄIVÄMÄÄRÄ].", 
          "avainsana": "laadittu",
          "muuttujat": { 
              "YHTEYDENOTTOTAPA": { "tyyppi": "valinta", "vaihtoehdot": ["puhelinajalla", "käyntiajalla"], "oletus": "puhelinajalla" },
              "PÄIVÄMÄÄRÄ": { "tyyppi": "teksti", "oletus": new Date().toLocaleDateString('fi-FI') } 
          }
        },
        { "teksti": "Asiakas hyväksyi suunnitelman käynnillä.", "avainsana": "hyvaksynta_kaynnilla" },
        { "teksti": "Asiakas hyväksyi suunnitelman luettuna puhelimitse.", "avainsana": "hyvaksynta_puhelimitse" },
        { "teksti": "Asiakas hyväksyy suunnitelman Oma asiointi -palvelussa.", "avainsana": "hyvaksynta_oma" }
      ]
    },
    {
      "otsikko": "Työttömyysturva",
      "id": "tyottomyysturva",
      "monivalinta": true,
      "fraasit": [
        { "teksti": "Asiakas ei ole yrittäjä.", "avainsana": "ei_yrittaja" },
        { "teksti": "Asiakkaalla ei ole opintoja.", "avainsana": "ei_opintoja" },
        { "teksti": "Asiakkaalla ei ole merkittäviä sijoituksia.", "avainsana": "ei_sijoituksia" },
        { "teksti": "Asiakas ei ole omaishoitaja.", "avainsana": "ei_omaishoitaja" }
      ]
    },
    {
      "otsikko": "Asiakkaan työtilanne",
      "id": "tyotilanne",
      "monivalinta": true,
      "fraasit": [
        { 
          "teksti": "Asiakkaan työnhaku on alkanut [PÄIVÄMÄÄRÄ].", 
          "avainsana": "tyonhaku_alkanut",
          "muuttujat": { "PÄIVÄMÄÄRÄ": { "tyyppi": "teksti", "oletus": new Date().toLocaleDateString('fi-FI') } }
        },
        { "teksti": "Asiakas on työtön työnhakija.", "avainsana": "tyoton" },
        { "teksti": "Asiakas ei ole ollut ansiotyössä kuuden edellisen kuukauden aikana.", "avainsana": "alle_6kk_tyossa"},
        { 
          "teksti": "Asiakas on irtisanottu (työnantajan toimesta) yrityksestä [YRITYS] [AMMATTI]-tehtävistä [PVM].", 
          "avainsana": "irtisanottu",
          "muuttujat": { "YRITYS": { "tyyppi": "teksti" }, "AMMATTI": { "tyyppi": "teksti" }, "PVM": { "tyyppi": "teksti" } }
        },
        { "teksti": "Asiakas on lomautettu.", "avainsana": "lomautettu" },
        { "teksti": "Asiakas on osa-aikatyössä.", "avainsana": "osa-aikainen" },
        { "teksti": "Asiakas on palkkatuetussa työssä.", "avainsana": "palkkatuki" },
        { "teksti": "Asiakas on työkokeilussa.", "avainsana": "tyokokeilu" },
        { "teksti": "Asiakas on työvoimakoulutuksessa.", "avainsana": "koulutus" },
        { "teksti": "Asiakas on kuntoutuksessa.", "avainsana": "kuntoutus" }
      ]
    },
    {
      "otsikko": "Koulutus ja yrittäjyys",
      "id": "koulutus_yrittajyys",
      "monivalinta": true,
      "fraasit": [
         { 
          "teksti": "Asiakas on koulutukseltaan [KOULUTUS] (v. [VUOSI]).", 
          "avainsana": "koulutus_tausta",
          "muuttujat": { "KOULUTUS": { "tyyppi": "teksti" }, "VUOSI": { "tyyppi": "teksti" } }
        },
        { "teksti": "Asiakkaalla ei ole toisen asteen tutkintoa.", "avainsana": "ei_tutkintoa" },
        { "teksti": "Asiakas on oppisopimuskoulutuksessa.", "avainsana": "oppisopimus" },
        { "teksti": "Asiakkaalla ei ole yrittäjyysajatuksia.", "avainsana": "ei_yrittajyysajatuksia" }
      ]
    },
    {
      "otsikko": "Työkyky",
      "id": "tyokyky",
      "monivalinta": true,
      "fraasit": [
        { "teksti": "Asiakkaan työkyvyssä ei ole muutoksia.", "avainsana": "tyokyky_normaali" },
        { "teksti": "Asiakkaan työkykyä selvitetään ja hän on hakeutunut työkykyselvitykseen.", "avainsana": "tyokyky_selvityksessa" },
        { 
          "teksti": "Asiakkaalla on työkyvyn alentuma: [ALENTUMA].", 
          "avainsana": "alentuma",
          "muuttujat": { "ALENTUMA": { "tyyppi": "teksti" } }
        }
      ]
    },
    {
      "otsikko": "Palkkatuki",
      "id": "palkkatuki",
      "tyyppi": "laskuri",
      "kysymykset": [
        { "id": "syntymavuosi", "label": "Asiakkaan syntymävuosi:", "tyyppi": "numero", "oletus": 1980 },
        { "id": "onko_tutkintoa", "label": "Onko asiakkaalla toisen asteen tutkintoa?", "tyyppi": "boolean", "oletus": true },
        { "id": "tyossa_6kk", "label": "Onko asiakas ollut ansiotyössä viimeisen 6kk aikana?", "tyyppi": "boolean", "oletus": true },
        { "id": "onko_oppisopimus", "label": "Onko kyseessä oppisopimus?", "tyyppi": "boolean", "oletus": false },
        { "id": "tyonantaja_yhdistys", "label": "Onko työnantaja yhdistys/säätiö/uskonnollinen yhdyskunta?", "tyyppi": "boolean", "oletus": false }
      ]
    },
    {
      "otsikko": "Palveluunohjaus",
      "id": "palveluunohjaus",
      "monivalinta": true,
      "fraasit": [
        { "teksti": "Asiakas ohjattu CV-pajaan.", "avainsana": "cv_paja" },
        { "teksti": "Asiakas ohjattu uraohjaukseen.", "avainsana": "uraohjaus" }
      ]
    },
    {
      "otsikko": "Suunnitelma",
      "id": "suunnitelma",
      "monivalinta": true,
      "fraasit": [
        { "teksti": "Tarvittavat toimenpiteet: CV:n päivittäminen.", "avainsana": "toimenpide_cv" },
        { "teksti": "Tarvittavat toimenpiteet: Työhakemuksen laatiminen.", "avainsana": "toimenpide_hakemus" },
        { "teksti": "Tarvittavat toimenpiteet: Yhteydenotto työnantajiin.", "avainsana": "toimenpide_yhteydenotto" }
      ]
    },
    {
      "otsikko": "Työnhakuvelvollisuus",
      "id": "tyonhakuvelvollisuus",
      "fraasit": [
        {
          "teksti": "Palvelumallin mukaisesti asiakkaan suunnitelmaan on kirjattu työnhakuvelvollisuus...",
          "avainsana": "paasaanto",
          "ehdot": { "tyotilanne": ["tyoton", "irtisanottu"], "tyokyky": ["tyokyky_normaali"] },
          "muuttujat": {
            "LKM": { "tyyppi": "numero", "oletus": 4 },
            "AIKAJAKSO": { "tyyppi": "valinta", "vaihtoehdot": ["kuukaudessa", "kolmen kuukauden aikana"] }
          }
        },
        {
          "teksti": "Asiakkaalle asetettu työnhakuvelvollisuus osa-aikatyöntekijän mukaisesti...",
          "avainsana": "alennettu_osa_aikainen",
          "ehdot": { "tyotilanne": ["osa-aikainen"] }
        },
        {
          "teksti": "Manuaalinen asetus: Asiakkaan tulee hakea [LKM] työmahdollisuutta [AIKAJAKSO]...",
          "avainsana": "manuaalinen",
          "muuttujat": {
            "LKM": { "tyyppi": "numero", "oletus": 0 },
            "AIKAJAKSO": { "tyyppi": "valinta", "vaihtoehdot": ["kuukaudessa", "kahden kuukauden aikana", "kolmen kuukauden aikana"] }
          }
        }
      ]
    }
  ]
};
EOF

# --- SectionRenderer, joka on nyt jaettu geneerisiin komponentteihin ---
echo "Luodaan geneeriset komponentit: src/components/Inputs.jsx ja src/components/PhraseOption.jsx..."

cat <<'EOF' > src/components/Inputs.jsx
import React from 'react';

// Geneerinen syöttökenttä muuttujille
export const VariableInput = ({ sectionId, avainsana, config, variableKey, value, onUpdate }) => {
    const handleChange = (e) => onUpdate(sectionId, avainsana, variableKey, e.target.value);
    const id = `${sectionId}-${avainsana}-${variableKey}`;

    if (config.tyyppi === 'numero') {
        return (
            <div>
                <label htmlFor={id}>{variableKey}</label>
                <input type="number" id={id} value={value ?? (config.oletus || '')} onChange={handleChange} />
            </div>
        );
    }
    if (config.tyyppi === 'valinta') {
        return (
            <div>
                <label htmlFor={id}>{variableKey}</label>
                <select id={id} value={value || config.oletus} onChange={handleChange}>
                    {config.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        );
    }
    return (
        <div>
            <label htmlFor={id}>{variableKey}</label>
            <input type="text" id={id} value={value || ''} placeholder={config.oletus || ''} onChange={handleChange} />
        </div>
    );
};
EOF

cat <<'EOF' > src/components/PhraseOption.jsx
import React from 'react';
import { VariableInput } from './Inputs';

// Geneerinen komponentti yhdelle fraasivaihtoehdolle
export const PhraseOption = ({ phrase, section, isSelected, onSelect, onUpdateVariable }) => {
    const { id: sectionId, monivalinta } = section;
    const { avainsana } = phrase;
    const displayText = phrase.teksti.replace(/\[.*?\]/g, '...');
    
    return (
        <div>
            <div 
                onClick={() => onSelect(sectionId, avainsana, monivalinta)} 
                className={`phrase-option ${isSelected ? 'selected' : ''}`}
            >
                <p>{displayText}</p>
            </div>
            {isSelected && phrase.muuttujat && (
                <div className="variables-container">
                    {Object.entries(phrase.muuttujat).map(([key, config]) => 
                        <VariableInput 
                            key={key} 
                            sectionId={sectionId} 
                            avainsana={avainsana} 
                            config={config} 
                            variableKey={key} 
                            value={isSelected.muuttujat?.[key]} 
                            onUpdate={onUpdateVariable} 
                        />
                    )}
                </div>
            )}
        </div>
    );
};
EOF


# --- Luodaan Section-komponentit ---
echo "Luodaan yksittäiset komponentit sections-kansioon..."
SECTIONS=("SuunnitelmanTyyppi" "Perustiedot" "Tyottomyysturva" "Tyotilanne" "KoulutusJaYrittajyys" "Tyokyky" "Palveluunohjaus" "Suunnitelma" "Tyonhakuvelvollisuus")
IDS=("suunnitelman_tyyppi" "suunnitelman_perustiedot" "tyottomyysturva" "tyotilanne" "koulutus_yrittajyys" "tyokyky" "palveluunohjaus" "suunnitelma" "tyonhakuvelvollisuus")

for i in ${!SECTIONS[@]}; do
  NAME=${SECTIONS[$i]}
  ID=${IDS[$i]}
  echo "Luodaan src/components/sections/${NAME}.jsx..."
  cat <<EOF > src/components/sections/${NAME}.jsx
import React, { useMemo } from 'react';
import { planData } from '../../data/planData';
import { PhraseOption } from '../PhraseOption';

const ${NAME} = ({ state, actions }) => {
    const sectionData = planData.aihealueet.find(s => s.id === '${ID}');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    const visiblePhrases = useMemo(() => {
        if (!sectionData.fraasit) return [];
        return sectionData.fraasit.filter(phrase => {
            if (phrase.avainsana === 'manuaalinen' || !phrase.ehdot) return true;
            return Object.entries(phrase.ehdot).every(([key, values]) => {
                const selection = state[key];
                if (!selection) return false;
                const selectedKeywords = sectionData.monivalinta ? Object.keys(selection) : [selection.avainsana];
                return values.some(v => selectedKeywords.includes(v));
            });
        });
    }, [sectionData, state]);

    return (
        <section className="section-container">
            <h2>{sectionData.otsikko}</h2>
            <div className="options-container">
                {visiblePhrases.map(phrase => {
                    const isSelected = sectionData.monivalinta 
                        ? state[sectionData.id]?.[phrase.avainsana] 
                        : state[sectionData.id]?.avainsana === phrase.avainsana ? state[sectionData.id] : null;
                    return (
                        <PhraseOption 
                            key={phrase.avainsana} 
                            phrase={phrase} 
                            section={sectionData} 
                            isSelected={isSelected} 
                            onSelect={onSelect} 
                            onUpdateVariable={onUpdateVariable} 
                        />
                    );
                })}
            </div>
            <div className="custom-text-container">
                <label htmlFor={\`custom-text-\${sectionData.id}\`}>Lisätiedot tai omat muotoilut:</label>
                <textarea 
                    id={\`custom-text-\${sectionData.id}\`} 
                    rows="3" 
                    placeholder="Kirjoita tähän vapaata tekstiä..." 
                    value={state[\`custom-\${sectionData.id}\`] || ''} 
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)} 
                />
            </div>
        </section>
    );
};

export default ${NAME};
EOF
done

# --- PalkkatukiCalculator.jsx ---
echo "Luodaan src/components/sections/PalkkatukiCalculator.jsx..."
cat <<'EOF' > src/components/sections/PalkkatukiCalculator.jsx
import React, { useMemo } from 'react';
import { planData } from '../../data/planData';

const PalkkatukiCalculator = ({ state, actions }) => {
    const { onUpdateCalculatorValue } = actions;
    const sectionData = planData.aihealueet.find(s => s.id === 'palkkatuki');

    const tyottomyysKuukausia = useMemo(() => {
        const tyonhakuAlkanut = state.tyotilanne?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!tyonhakuAlkanut) return null;
        const parts = tyonhakuAlkanut.split('.');
        if (parts.length < 3) return null;
        const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const diffDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
        return Math.round(diffDays / 30.44);
    }, [state.tyotilanne]);

    const tyokykyStatus = useMemo(() => {
        const tyokyky = state.tyokyky || {};
        if (tyokyky.alentuma || tyokyky.tyokyky_selvityksessa) return "Alentunut";
        return "Normaali";
    }, [state.tyokyky]);

    const analysisResult = useMemo(() => {
        const calculatorState = state.palkkatuki || {};
        const tyokyky = state.tyokyky || {};
        let age = -1;
        if (calculatorState.syntymavuosi) {
            age = new Date().getFullYear() - parseInt(calculatorState.syntymavuosi, 10);
        }
        const conditionsMet = [];
        if (age >= 15 && age <= 24) conditionsMet.push("15-24-vuotias");
        if (age >= 50) conditionsMet.push("50 vuotta täyttänyt");
        if (calculatorState.onko_tutkintoa === false) conditionsMet.push("Ei toisen asteen tutkintoa");
        if (calculatorState.tyossa_6kk === false) conditionsMet.push("Ei ansiotyössä 6kk aikana");
        if (tyokyky.alentuma || tyokyky.tyokyky_selvityksessa) conditionsMet.push("Alentunut työkyky");
        if (age >= 60 && tyottomyysKuukausia >= 12) conditionsMet.push("60v täyttänyt pitkäaikaistyötön");
        if (calculatorState.onko_oppisopimus) conditionsMet.push("Oppisopimuskoulutus");
        let ehdotus = "Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.";
        if (conditionsMet.includes("Alentunut työkyky")) ehdotus = "Alentuneesti työkykyisen palkkatuki: 70%, kesto 10kk (jatkettavissa).";
        else if (conditionsMet.includes("Oppisopimuskoulutus")) ehdotus = "Palkkatuki oppisopimukseen: 50%, kesto koko koulutuksen ajan.";
        else if (tyottomyysKuukausia >= 24 && calculatorState.tyonantaja_yhdistys) ehdotus = "100% palkkatuki (yhdistys/säätiö): 100%, kesto 10kk.";
        else if (conditionsMet.includes("60v täyttänyt pitkäaikaistyötön")) ehdotus = "60v täyttänyt, pitkään työtön: 50%, kesto enintään 24kk.";
        else if (tyottomyysKuukausia >= 12) ehdotus = "Ammatillisen osaamisen parantaminen: 50%, kesto enintään 10kk.";
        else if (tyottomyysKuukausia >= 0) ehdotus = "Ammatillisen osaamisen parantaminen: 50%, kesto enintään 5kk.";
        return { conditionsMet, ehdotus };
    }, [state.palkkatuki, state.tyokyky, tyottomyysKuukausia]);

    return (
        <section className="section-container">
            <h2>{sectionData.otsikko}</h2>
            <p>Tämä työkalu arvioi asiakkaan tilannetta ja ehdottaa sopivinta palkkatukimuotoa.</p>
            <div className="info-box">
                <h3>Automaattisesti täytetyt tiedot:</h3>
                <p><b>Työttömyyden kesto:</b> {tyottomyysKuukausia !== null ? `${tyottomyysKuukausia} kk` : 'Ei määritetty'}</p>
                <p><b>Työkyky:</b> {tyokykyStatus}</p>
            </div>
            <div className="questions-container">
                <h3>Tarkentavat kysymykset:</h3>
                {sectionData.kysymykset.map(q => (
                    <div key={q.id}>
                        <label>{q.label}</label>
                        {q.tyyppi === 'numero' && <input type="number" value={state.palkkatuki?.[q.id] || q.oletus} onChange={(e) => onUpdateCalculatorValue(q.id, parseInt(e.target.value, 10))} />}
                        {q.tyyppi === 'boolean' && (
                            <div className="boolean-buttons">
                                <button onClick={() => onUpdateCalculatorValue(q.id, true)} className={state.palkkatuki?.[q.id] === true ? 'selected' : ''}>Kyllä</button>
                                <button onClick={() => onUpdateCalculatorValue(q.id, false)} className={state.palkkatuki?.[q.id] === false ? 'selected' : ''}>Ei</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="analysis-container">
                <h3>Analyysin tulos:</h3>
                {analysisResult.conditionsMet.length > 0 ? <ul>{analysisResult.conditionsMet.map(c => <li key={c}>{c}</li>)}</ul> : <p>Ei erityisiä kriteerejä täyty.</p>}
                <p className="ehdotus">{analysisResult.ehdotus}</p>
            </div>
        </section>
    );
};

export default PalkkatukiCalculator;
EOF

# --- Summary.jsx ---
echo "Luodaan src/components/Summary.jsx..."
cat <<'EOF' > src/components/Summary.jsx
import React, { useState, useMemo } from 'react';
import { planData } from '../data/planData.js';

const Summary = ({ state }) => {
    const [feedback, setFeedback] = useState('');
    
    const summaryText = useMemo(() => {
        let text = '';
        planData.aihealueet.forEach(section => {
            const selection = state[section.id];
            const customText = state[`custom-${section.id}`];
            let sectionHasContent = false;
            let sectionText = '';
            
            const processPhrase = (phraseObject) => {
                let phraseText = phraseObject.teksti;
                if (phraseObject.muuttujat) {
                    Object.entries(phraseObject.muuttujat).forEach(([key, value]) => {
                         const val = phraseObject.muuttujat[key];
                         let selectedVal = section.monivalinta ? state[section.id]?.[phraseObject.avainsana]?.muuttujat?.[key] : state[section.id]?.muuttujat?.[key];
                         phraseText = phraseText.replace(`[${key}]`, selectedVal || val.oletus || `[${key}]`);
                    });
                }
                return phraseText;
            };

            if (section.tyyppi === 'laskuri' && state.palkkatuki) {
                 const tyonhakuAlkanut = state.tyotilanne?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
                const calculatorState = state.palkkatuki || {};
                const tyokyky = state.tyokyky || {};
                let tyottomyysKuukausia = -1;
                if (tyonhakuAlkanut) {
                    const parts = tyonhakuAlkanut.split('.');
                    if(parts.length > 2) {
                        const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        const diffDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
                        tyottomyysKuukausia = diffDays / 30.44;
                    }
                }
                let age = -1;
                if (calculatorState.syntymavuosi) {
                    age = new Date().getFullYear() - parseInt(calculatorState.syntymavuosi, 10);
                }
                const conditionsMet = [];
                if (age >= 15 && age <= 24) conditionsMet.push("15-24-vuotias");
                if (age >= 50) conditionsMet.push("50 vuotta täyttänyt");
                if (calculatorState.onko_tutkintoa === false) conditionsMet.push("Ei toisen asteen tutkintoa");
                if (calculatorState.tyossa_6kk === false) conditionsMet.push("Ei ansiotyössä 6kk aikana");
                if (tyokyky.alentuma || tyokyky.tyokyky_selvityksessa) conditionsMet.push("Alentunut työkyky");
                if (age >= 60 && tyottomyysKuukausia >= 12) conditionsMet.push("60v täyttänyt pitkäaikaistyötön");
                if (calculatorState.onko_oppisopimus) conditionsMet.push("Oppisopimuskoulutus");
                let ehdotus = "Ei erityisiä palkkatukiehtoja täyty annettujen tietojen perusteella.";
                if (conditionsMet.includes("Alentunut työkyky")) ehdotus = "Ehdotus: Alentuneesti työkykyisen palkkatuki (70%, 10kk, jatkettavissa).";
                else if (conditionsMet.includes("Oppisopimuskoulutus")) ehdotus = "Ehdotus: Palkkatuki oppisopimukseen (50%, koko koulutuksen ajan).";
                else if (tyottomyysKuukausia >= 24 && calculatorState.tyonantaja_yhdistys) ehdotus = "Ehdotus: 100% palkkatuki (100%, 10kk).";
                else if (conditionsMet.includes("60v täyttänyt pitkäaikaistyötön")) ehdotus = "Ehdotus: 60v täyttänyt, pitkään työtön (50%, max 24kk).";
                else if (tyottomyysKuukausia >= 12) ehdotus = "Ehdotus: Ammatillisen osaamisen parantaminen (50%, max 10kk).";
                else if (tyottomyysKuukausia >= 0) ehdotus = "Ehdotus: Ammatillisen osaamisen parantaminen (50%, max 5kk).";
                sectionText = `Palkkatuen arviointi:\n- Täyttyvät kriteerit: ${conditionsMet.join(', ') || 'Ei erityisiä'}\n- ${ehdotus}`;
                sectionHasContent = true;
            } else if (selection) {
                if (section.monivalinta) {
                    sectionText = Object.values(selection).map(processPhrase).join('\n');
                } else {
                    sectionText = processPhrase(selection);
                }
                if(sectionText) sectionHasContent = true;
            }

            if (customText) {
                sectionText += (sectionHasContent ? '\n' : '') + customText;
                sectionHasContent = true;
            }
            if (sectionHasContent) text += `**${section.otsikko}**\n${sectionText}\n\n`;
        });
        return text.trim().replace(/\n\n+/g, '\n\n');
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
                                    if (line.startsWith('**') && line.endsWith('**')) {
                                        return <strong key={lIndex}>{line.replace(/\*\*/g, '')}</strong>;
                                    }
                                    return <React.Fragment key={lIndex}>{line}<br/></React.Fragment>;
                                })}
                            </p>
                        ))
                    ) : (
                        <p>Valitse osioita aloittaaksesi...</p>
                    )}
                </div>
                <button onClick={handleCopy} className="copy-button" disabled={!summaryText}>
                    Kopioi leikepöydälle
                </button>
                <p className="feedback-text">{feedback}</p>
            </div>
        </aside>
    );
};

export default Summary;
EOF


# --- App.jsx ---
echo "Luodaan pääkomponentti: src/App.jsx..."
cat <<'EOF' > src/App.jsx
import React, { useState, useCallback } from 'react';
import Summary from './components/Summary';

// Tuodaan kaikki osio-komponentit
import SuunnitelmanTyyppi from './components/sections/SuunnitelmanTyyppi';
import Perustiedot from './components/sections/Perustiedot';
import Tyottomyysturva from './components/sections/Tyottomyysturva';
import Tyotilanne from './components/sections/Tyotilanne';
import KoulutusJaYrittajyys from './components/sections/KoulutusJaYrittajyys';
import Tyokyky from './components/sections/Tyokyky';
import PalkkatukiCalculator from './components/sections/PalkkatukiCalculator';
import Palveluunohjaus from './components/sections/Palveluunohjaus';
import Suunnitelma from './components/sections/Suunnitelma';
import Tyonhakuvelvollisuus from './components/sections/Tyonhakuvelvollisuus';
import { planData } from './data/planData';

// Tuodaan CSS-tiedostot
import './styles/rakenteet.css';
import './styles/tyylit.css';

function App() {
    const [state, setState] = useState({});

    const handleSelectPhrase = useCallback((sectionId, avainsana, isMultiSelect) => {
        setState(currentState => {
            const newState = { ...currentState };
            const section = planData.aihealueet.find(s => s.id === sectionId);
            const phrase = section.fraasit.find(f => f.avainsana === avainsana);
            const newPhraseObject = {
                avainsana: phrase.avainsana,
                teksti: phrase.teksti,
                muuttujat: {},
            };
            if (phrase.muuttujat) {
                Object.entries(phrase.muuttujat).forEach(([key, config]) => {
                    newPhraseObject.muuttujat[key] = config.oletus !== undefined ? config.oletus : (config.vaihtoehdot ? config.vaihtoehdot[0] : '');
                });
            }

            if (isMultiSelect) {
                const currentSelections = { ...(newState[sectionId] || {}) };
                if (currentSelections[avainsana]) {
                    delete currentSelections[avainsana];
                } else {
                    currentSelections[avainsana] = newPhraseObject;
                }
                newState[sectionId] = currentSelections;
            } else {
                if (newState[sectionId]?.avainsana === avainsana) {
                    delete newState[sectionId];
                } else {
                    newState[sectionId] = newPhraseObject;
                }
            }
            return newState;
        });
    }, []);

    const handleUpdateVariable = useCallback((sectionId, avainsana, variableKey, value) => {
        setState(currentState => {
            const section = planData.aihealueet.find(s => s.id === sectionId);
            const newState = JSON.parse(JSON.stringify(currentState));
            const target = section.monivalinta ? newState[sectionId]?.[avainsana] : newState[sectionId];
            if (target) {
                if(!target.muuttujat) target.muuttujat = {};
                target.muuttujat[variableKey] = value;
            }
            return newState;
        });
    }, []);
    
    const handleUpdateCustomText = useCallback((sectionId, value) => {
        setState(currentState => ({ ...currentState, [`custom-${sectionId}`]: value }));
    }, []);

    const handleUpdateCalculatorValue = useCallback((key, value) => {
        setState(currentState => ({
            ...currentState,
            palkkatuki: {
                ...(currentState.palkkatuki || {}),
                [key]: value
            }
        }));
    }, []);
    
    const actions = {
      onSelect: handleSelectPhrase,
      onUpdateVariable: handleUpdateVariable,
      onUpdateCustomText: handleUpdateCustomText,
      onUpdateCalculatorValue: handleUpdateCalculatorValue
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Työllisyyssuunnitelman rakennustyökalu</h1>
                <p>Valitse sopivat vaihtoehdot ja lisää omaa tekstiä rakentaaksesi suunnitelman.</p>
            </header>
            <div className="main-grid">
                <main className="sections-container">
                    <SuunnitelmanTyyppi state={state} actions={actions} />
                    <Perustiedot state={state} actions={actions} />
                    <Tyottomyysturva state={state} actions={actions} />
                    <Tyotilanne state={state} actions={actions} />
                    <KoulutusJaYrittajyys state={state} actions={actions} />
                    <Tyokyky state={state} actions={actions} />
                    <PalkkatukiCalculator state={state} actions={actions} />
                    <Palveluunohjaus state={state} actions={actions} />
                    <Suunnitelma state={state} actions={actions} />
                    <Tyonhakuvelvollisuus state={state} actions={actions} />
                </main>
                <Summary state={state} />
            </div>
        </div>
    );
}

export default App;
EOF

# --- Päivitetään index.html ja index.jsx ---
echo "Päivitetään index.html ja index.jsx..."

# index.html
cat <<'EOF' > index.html
<!DOCTYPE html>
<html lang="fi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Espan - Työllisyyssuunnitelman rakennustyökalu</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.jsx"></script>
  </body>
</html>
EOF

# index.jsx (varmistetaan, että App.jsx:ää kutsutaan ja CSS tuodaan)
# Poistetaan vanha index.jsx jos on olemassa
rm -f src/index.js
rm -f src/index.jsx
cat <<'EOF' > src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Tuodaan molemmat CSS-tiedostot, jotta ne ovat globaalisti saatavilla
import './styles/tyylit.css';
import './styles/rakenteet.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF


echo "Refaktorointi valmis! Projektisi käyttää nyt kahta erillistä CSS-tiedostoa."
echo "Voit käynnistää sovelluksen komennolla: npm run dev"
