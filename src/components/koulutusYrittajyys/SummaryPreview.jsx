// --- src/components/koulutusYrittajyys/SummaryPreview.jsx ---
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
        if (!summaryData?.yhdistettyLause || !onUpdateCustomText) return;

        onUpdateCustomText(sectionId, summaryData.yhdistettyLause);

        setActionFeedback('Ehdotus siirretty lisätietoihin!');
        setTimeout(() => setActionFeedback(''), 2500);
    };

    return (
        <div className="summary-preview language-summary-preview">
            <h4>Ehdotus yhteenvetoon:</h4>

            {/* Normaali koulutusvalinta */}
            {summaryData?.koulutusLause && (
                <p className="summary-part">{summaryData.koulutusLause}</p>
            )}
            {/* Yrittäjyys */}
            {summaryData?.yrittajyysLause && (
                <p className="summary-part">{summaryData.yrittajyysLause}</p>
            )}
            {/* Kortit */}
            {summaryData?.ammattikorttiLause && (
                <p className="summary-part">{summaryData.ammattikorttiLause}</p>
            )}
            {/* Kielitaito */}
            {summaryData?.kielitaitoLause && (
                <p className="summary-part">{summaryData.kielitaitoLause}</p>
            )}
            {/* Digitaidot ja asiointi */}
            {summaryData?.digitaidotLause && (
                <p className="summary-part">{summaryData.digitaidotLause}</p>
            )}
            {/* AI-Koulutusehdotukset / Ideat */}
            {summaryData?.ideatLause && (
                <p className="summary-part">{summaryData.ideatLause}</p>
            )}
            {/* Tuettu Opiskelu (AKTIIVINEN TOIMINTA - VIIMEISENÄ) */}
            {summaryData?.tuettuOpiskeluLause && (
                <p className="summary-part">{summaryData.tuettuOpiskeluLause}</p>
            )}

            {/* Näytä myös custom-kielitieto, jos se on olemassa */}
            {customTekstit?.customKielitasoText && (
                 <p className="summary-part custom-text-preview"><i>{customTekstit.customKielitasoText}</i></p>
            )}

            <button
                onClick={handleUseSummary}
                title="Siirrä ehdotus alla olevaan lisätietokenttään"
                className='button-neg'
            >
                Käytä tätä yhteenvetona
            </button>
            {actionFeedback && <span className='feedback-text'> {actionFeedback}</span>}
        </div>
    );
};

export default SummaryPreview;