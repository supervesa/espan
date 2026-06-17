import React, { useState } from 'react';

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

            {summaryData?.koulutusLause && <p className="summary-part">{summaryData.koulutusLause}</p>}
            {summaryData?.yrittajyysLause && <p className="summary-part">{summaryData.yrittajyysLause}</p>}
            {summaryData?.ammattikorttiLause && <p className="summary-part">{summaryData.ammattikorttiLause}</p>}
            {summaryData?.kielitaitoLause && <p className="summary-part">{summaryData.kielitaitoLause}</p>}
            {summaryData?.digitaidotLause && <p className="summary-part">{summaryData.digitaidotLause}</p>}
            {summaryData?.ideatLause && <p className="summary-part">{summaryData.ideatLause}</p>}
            
            {/* Tuettu Opiskelu lohko */}
            {summaryData?.tuettuOpiskeluLause && (
                <p className="summary-part tuettu-summary-highlight">
                    {summaryData.tuettuOpiskeluLause}
                </p>
            )}

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