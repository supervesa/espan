import React, { useState } from 'react';

/**
 * Komponentti "Ehdotus yhteenvetoon" -laatikon näyttämiseen.
 * Hallitsee oman "Käytä tätä" -napin palautteen.
 * Näyttää yhteenvedon osat erillisinä kappaleina.
 * On aina näkyvissä.
 */
const SummaryPreview = ({ summaryData, sectionId, onUpdateCustomText, customTekstit }) => {
    const [actionFeedback, setActionFeedback] = useState('');

    const handleUseSummary = () => {
        // Varmistetaan, että dataa on ja että 'yhdistettyLause' on olemassa
        // summaryData voi olla aluksi undefined, joten käytetään optional chainingia (?.)
        if (!summaryData?.yhdistettyLause || !onUpdateCustomText) return;

        // Kutsutaan ylempää annettua actionia ja annetaan sille VAIN yhdistetty lause
        onUpdateCustomText(sectionId, summaryData.yhdistettyLause);

        // Asetetaan palaute
        setActionFeedback('Ehdotus siirretty lisätietoihin!');
        setTimeout(() => setActionFeedback(''), 2500);
    };

    // Ehto komponentin piilottamiselle on poistettu.

    return (
        <div className="summary-preview language-summary-preview">
            <h4>Ehdotus yhteenvetoon:</h4>

            {/* Renderöidään jokainen lause omana kappaleenaan.
              Käytetään optional chainingia (summaryData?.) varmuuden vuoksi.
            */}
            {summaryData?.koulutusLause && (
                <p className="summary-part">{summaryData.koulutusLause}</p>
            )}
            {summaryData?.yrittajyysLause && (
                <p className="summary-part">{summaryData.yrittajyysLause}</p>
            )}
            {summaryData?.ammattikorttiLause && (
                <p className="summary-part">{summaryData.ammattikorttiLause}</p>
            )}
            {summaryData?.kielitaitoLause && (
                <p className="summary-part">{summaryData.kielitaitoLause}</p>
            )}

            {/* Näytä myös custom-kielitieto, jos se on olemassa */}
            {customTekstit?.customKielitasoText && (
                 <p className="summary-part custom-text-preview"><i>{customTekstit.customKielitasoText}</i></p>
            )}


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
}; // <--- Varmista, että tämä sulku on paikallaan ja vastaa rivin 9 alkusulkua.

export default SummaryPreview;