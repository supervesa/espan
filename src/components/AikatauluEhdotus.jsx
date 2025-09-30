import React, { useState, useMemo } from 'react';
import RulesModal from './RulesModal';

const AikatauluEhdotus = ({ state }) => {
    const [result, setResult] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const calculateNextMeeting = () => {
        const lastMeetingDateStr = state.suunnitelman_perustiedot?.laadittu?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!lastMeetingDateStr) {
            setResult("Laskenta vaatii 'Laatimistapa'-valinnan ja päivämäärän perustiedoista.");
            return;
        }

        const parts = lastMeetingDateStr.split('.');
        if (parts.length < 3) {
             setResult("Päivämäärä on virheellisessä muodossa.");
             return;
        }
        const lastMeetingDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        if (isNaN(lastMeetingDate.getTime())) {
            setResult("Päivämäärä on virheellinen.");
            return;
        }

        if (state.suunnitelma?.tuleva_poissaolo) {
            setResult("Asiakkaalle on kirjattu tuleva poissaolo. Keskustelua ei tarvitse järjestää, ellei asiakas sitä pyydä.");
            return;
        }
        
        const sixMonthsLater = new Date(lastMeetingDate);
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
        if (new Date() >= sixMonthsLater && state.tyotilanne?.tyoton && !state.tyotilanne?.palkkatuki && !state.tyotilanne?.tyokokeilu) {
             setResult(`Edellisestä tapaamisesta on kulunut 6kk. Asiakkaalle tulee järjestää kaksi täydentävää työnhakukeskustelua. Seuraava viimeistään ${sixMonthsLater.toLocaleDateString('fi-FI')}.`);
             return;
        }

        const threeMonthsLater = new Date(lastMeetingDate);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        if (new Date() >= threeMonthsLater) {
            setResult(`Edellisestä tapaamisesta on kulunut 3kk. Asiakkaalle tulee järjestää työnhakukeskustelu. Seuraava viimeistään ${threeMonthsLater.toLocaleDateString('fi-FI')}.`);
            return;
        }
        
        setResult(`Ei vielä ajankohtainen. Seuraava lakisääteinen 3kk keskustelu tulee ajankohtaiseksi noin ${threeMonthsLater.toLocaleDateString('fi-FI')}.`);
    };

    return (
        <div className="next-meeting-container">
            <div className="next-meeting-controls">
                <button onClick={calculateNextMeeting}>Ehdota seuraavaa tapaamista</button>
                <a href="#" className="rules-link" onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }}>
                    Näytä yksityiskohtaiset säännöt
                </a>
            </div>
            {result && (
                <div className="next-meeting-result">
                    <p>{result}</p>
                </div>
            )}
            {isModalOpen && <RulesModal onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

export default AikatauluEhdotus;
