import React from 'react';

// Pieni apukomponentti, joka tekee koodista siistimmän
const KeskusteluOsa = ({ title, questions, answers, onAnswerChange }) => {
    return (
        <details className="discussion-accordion">
            <summary>{title}</summary>
            <div className="discussion-content">
                {questions.map(q => (
                    <div key={q.id} className="question-row">
                        <label htmlFor={q.id}>{q.teksti}</label>
                        {q.tyyppi === 'boolean' && (
                            <div className="boolean-buttons">
                                <button onClick={() => onAnswerChange(q.id, 'Kyllä')} className={answers[q.id] === 'Kyllä' ? 'selected' : ''}>Kyllä</button>
                                <button onClick={() => onAnswerChange(q.id, 'Ei')} className={answers[q.id] === 'Ei' ? 'selected' : ''}>Ei</button>
                            </div>
                        )}
                        {q.tyyppi === 'teksti' && <input type="text" id={q.id} value={answers[q.id] || ''} onChange={(e) => onAnswerChange(q.id, e.target.value)} />}
                        {q.tyyppi === 'valinta' && (
                            <select id={q.id} value={answers[q.id] || ''} onChange={(e) => onAnswerChange(q.id, e.target.value)}>
                                <option value="">Valitse...</option>
                                {q.vaihtoehdot.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        )}
                    </div>
                ))}
            </div>
        </details>
    );
};

const Tyokyky = ({ state, actions }) => {
    // Haetaan staattinen data ja tilatiedot
    const sectionData = {
        paavalinnat: [
            { teksti: "Työkyky on normaali.", avainsana: "tyokyky_normaali" },
            { teksti: "Asiakkaalla on työkyvyn alentuma.", avainsana: "tyokyky_alentunut" },
            { teksti: "Työkyky vaatii lisäselvitystä.", avainsana: "tyokyky_selvityksessa" },
        ],
        palveluohjaukset: [
            { teksti: "Ohjataan työterveystarkastukseen", avainsana: "ohjaus_terveystarkastus" },
            { teksti: "Ohjataan toimintaterapian työkyvyn arvioon", avainsana: "ohjaus_toimintaterapia" },
            { teksti: "Ohjataan työkokeiluun", avainsana: "ohjaus_tyokokeilu" },
        ],
        keskustelukysymykset: {
            "Tilanteen jäsentäminen": [
                { id: "arki_rutiinit", teksti: "Miten arki, rutiinit ja toimintakyky sujuvat?", tyyppi: "boolean" },
                { id: "saannollisyys", teksti: "Onko arjessa säännöllisyyttä (nukkuminen, syönti)?", tyyppi: "boolean" },
                { id: "harrastukset", teksti: "Onko harrastuksia tai mielekkäitä ajanviettotapoja?", tyyppi: "teksti" },
                { id: "paihteet", teksti: "Päihteiden käyttö (Mitä, kuinka usein, määrä)?", tyyppi: "teksti" },
                { id: "mieliala", teksti: "Viime aikojen mieliala?", tyyppi: "valinta", vaihtoehdot: ["Hyvä", "Iloinen", "Rauhallinen", "Energinen", "Stressaantunut", "Ahdistunut", "Surullinen", "Ärtynyt", "Väsynyt", "Alakuloinen", "Ei mikään näistä"] },
            ],
            "Palvelutarpeen selvittäminen": [
                { id: "hoitokontakti", teksti: "Onko hoitokontaktia tai haluaisitko sellaisen?", tyyppi: "teksti" },
                { id: "terveyshaasteiden_vaikutus", teksti: "Miten terveydelliset haasteet vaikuttavat toimintakykyyn?", tyyppi: "teksti" },
                { id: "vahvuudet", teksti: "Mitkä osa-alueet elämässä toimivat hyvin?", tyyppi: "teksti" },
                { id: "tulevaisuuden_toiveet", teksti: "Mitä toiveita tai suunnitelmia on tulevaisuudelle?", tyyppi: "teksti" },
            ]
        }
    };
    
    const { onUpdateTyokyky } = actions;
    const tyokykyState = state.tyokyky || {};

    // Funktio, joka kokoaa vastaukset tekstiksi
    const handleKoontiUpdate = () => {
        const answers = tyokykyState.keskustelunTiedot || {};
        let koontiText = '';
        Object.entries(sectionData.keskustelukysymykset).forEach(([_, questions]) => {
            questions.forEach(q => {
                if (answers[q.id]) {
                    koontiText += `- ${q.teksti}: ${answers[q.id]}\n`;
                }
            });
        });
        onUpdateTyokyky('koonti', koontiText.trim());
    };

    return (
        <section className="section-container">
            <h2 className="section-title">Työkyky</h2>
            
            {/* PÄÄVALINNAT */}
            <div className="options-container">
                {sectionData.paavalinnat.map(p => (
                    <div key={p.avainsana} onClick={() => onUpdateTyokyky('paavalinta', p)} className={`phrase-option ${tyokykyState.paavalinta?.avainsana === p.avainsana ? 'selected' : ''}`}>
                        {p.teksti}
                    </div>
                ))}
            </div>

            {/* LISÄTIETOKENTTÄ TYÖKYVYN ALENTUMALLE */}
            {tyokykyState.paavalinta?.avainsana === 'tyokyky_alentunut' && (
                <div className="subsection">
                    <label htmlFor="alentuma-kuvaus">Kuvaus työkyvyn alentumasta:</label>
                    <textarea 
                        id="alentuma-kuvaus" 
                        rows="3" 
                        placeholder="Kirjaa tähän havainnot tai asiakkaan kertomus..."
                        value={tyokykyState.alentumaKuvaus || ''} 
                        onChange={(e) => onUpdateTyokyky('alentumaKuvaus', e.target.value)} 
                    />
                </div>
            )}

            {/* PALVELUOHJAUS (NÄYTETÄÄN VAIN TARVITTAESSA) */}
            {tyokykyState.paavalinta?.avainsana === 'tyokyky_selvityksessa' && (
                <div className="subsection">
                    <h3>Palveluohjaus</h3>
                    <div className="options-container">
                         {sectionData.palveluohjaukset.map(p => (
                            <div key={p.avainsana} onClick={() => onUpdateTyokyky('togglePalveluohjaus', p)} className={`phrase-option ${tyokykyState.palveluohjaukset?.[p.avainsana] ? 'selected' : ''}`}>
                                {p.teksti}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* ASIAKKAAN OMA ARVIO */}
            <div className="subsection">
                <h3>Asiakkaan oma arvio työkyvystään (0-10)</h3>
                <div className="slider-container">
                    <span>{tyokykyState.omaArvio || 5}</span>
                    <input type="range" min="0" max="10" value={tyokykyState.omaArvio || 5} onChange={(e) => onUpdateTyokyky('omaArvio', e.target.value)} />
                </div>
            </div>

            {/* KESKUSTELUN TUKI */}
            <div className="subsection">
                <h3>Keskustelun tuki (vapaaehtoinen)</h3>
                {Object.entries(sectionData.keskustelukysymykset).map(([title, questions]) => (
                    <KeskusteluOsa 
                        key={title} 
                        title={title} 
                        questions={questions} 
                        answers={tyokykyState.keskustelunTiedot || {}}
                        onAnswerChange={(id, value) => onUpdateTyokyky('updateKeskustelutieto', { id, value })}
                    />
                ))}
                <div className="koonti-container">
                    <label htmlFor="koonti-textarea">Koonti keskustelusta</label>
                    <textarea id="koonti-textarea" rows="5" placeholder="Tähän kerätään muistiinpanot keskustelusta..." value={tyokykyState.koonti || ''} onChange={(e) => onUpdateTyokyky('koonti', e.target.value)} />
                    <button onClick={handleKoontiUpdate}>Päivitä koonti vastauksista</button>
                </div>
            </div>

        </section>
    );
};

export default Tyokyky;
