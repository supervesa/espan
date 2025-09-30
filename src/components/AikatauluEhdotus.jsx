import React, { useState } from 'react';

const AikatauluEhdotus = ({ state }) => {
    const [result, setResult] = useState(null);

    const calculateNextMeeting = () => {
        const lastMeetingDateStr = state.suunnitelman_perustiedot?.laadittu?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!lastMeetingDateStr) {
            setResult("Edellisen tapaamisen päivämäärä puuttuu perustiedoista.");
            return;
        }

        const parts = lastMeetingDateStr.split('.');
        if (parts.length < 3) {
             setResult("Päivämäärä on virheellisessä muodossa.");
             return;
        }
        const lastMeetingDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (isNaN(lastMeetingDate.getTime())) {
            setResult("Päivämäärä on virheellinen.");
            return;
        }
        
        const nextMeetingDate = new Date(lastMeetingDate);
        nextMeetingDate.setMonth(nextMeetingDate.getMonth() + 3);

        let recommendationText = `Edellinen tapaaminen oli ${lastMeetingDate.toLocaleDateString('fi-FI')}. Seuraava lakisääteinen työnhakukeskustelu tulee järjestää viimeistään ${nextMeetingDate.toLocaleDateString('fi-FI')}.`;

        const aiempiTyonhaku = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (aiempiTyonhaku) {
            const hakuParts = aiempiTyonhaku.split('.');
             if (hakuParts.length > 2) {
                const hakuStartDate = new Date(parseInt(hakuParts[2]), parseInt(hakuParts[1]) - 1, parseInt(hakuParts[0]));
                if (!isNaN(hakuStartDate.getTime())) {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    if (hakuStartDate > sixMonthsAgo) {
                        recommendationText += " Koska työnhaku on alkanut alle 6kk sitten, asiakkaalle tulee järjestää myös kaksi täydentävää keskustelua.";
                    }
                }
             }
        }
        setResult(recommendationText);
    };

    return (
        <div className="next-meeting-container">
            <div className="next-meeting-controls">
                <button onClick={calculateNextMeeting}>Ehdota seuraavaa tapaamista</button>
                <a href="#" className="rules-link" onClick={(e) => { e.preventDefault(); alert("Yksityiskohtaiset säännöt (modaali) toteutetaan myöhemmin."); }}>
                    Näytä yksityiskohtaiset säännöt
                </a>
            </div>
            {result && (
                <div className="next-meeting-result">
                    <p>{result}</p>
                </div>
            )}
        </div>
    );
};

export default AikatauluEhdotus;

