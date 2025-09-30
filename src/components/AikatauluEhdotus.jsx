import React, { useState } from 'react';
import RulesModal from './RulesModal';

const AikatauluEhdotus = ({ state }) => {
    const [schedule, setSchedule] = useState(null);
    const [suggestion, setSuggestion] = useState(null);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Apufunktio päivämäärien käsittelyyn
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('.');
        if (parts.length < 3) return null;
        const date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        return isNaN(date.getTime()) ? null : date;
    };
    
    // Apufunktio arkipäivien lisäämiseen
    const addWorkdays = (date, days) => {
        const newDate = new Date(date);
        let addedDays = 0;
        while (addedDays < days) {
            newDate.setDate(newDate.getDate() + 1);
            if (newDate.getDay() !== 0 && newDate.getDay() !== 6) {
                addedDays++;
            }
        }
        return newDate;
    };

    const calculateAction = () => {
        setSchedule(null);
        setSuggestion(null);
        setError(null);
        
        const startDateStr = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        if (!startDateStr) {
            setError("Laskenta vaatii 'Työnhaun alku'-valinnan ja päivämäärän perustiedoista.");
            return;
        }

        const startDate = parseDate(startDateStr);
        if (!startDate) {
            setError("Työnhaun alkamispäivä on virheellisessä muodossa.");
            return;
        }

        // Tarkista yleiset poikkeukset
        if (state.suunnitelma?.tuleva_poissaolo) {
            setError("Asiakkaalle on kirjattu tuleva poissaolo. Keskusteluja ei tarvitse järjestää, ellei asiakas sitä pyydä.");
            return;
        }
        if (state.tyotilanne?.palkkatuki || state.tyotilanne?.tyokokeilu) {
            setError("Asiakas on palvelussa (palkkatuki/työkokeilu), johon sovelletaan poikkeavia keskustelusääntöjä. Aikataulua ei lasketa automaattisesti.");
            return;
        }
        
        // --- LOGIIKAN VALINTA: UUSI VAI PIDEMPÄÄN TYÖTTÖMÄNÄ OLLUT ---
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);

        if (startDate >= oneMonthAgo) {
            // UUSI ASIAKAS: Laske koko aikataulu
            const newSchedule = [];
            const alkuhaastatteluDate = addWorkdays(startDate, 5);
            newSchedule.push({ title: 'Alkuhaastattelu', date: `viimeistään ${alkuhaastatteluDate.toLocaleDateString('fi-FI')}` });
            
            let lastIntensiveDate = new Date(alkuhaastatteluDate);
            for (let i = 0; i < 5; i++) {
                lastIntensiveDate.setDate(lastIntensiveDate.getDate() + 14);
                newSchedule.push({ title: `Täydentävä keskustelu #${i + 1}`, date: `noin ${lastIntensiveDate.toLocaleDateString('fi-FI')}` });
            }
            const threeMonthsDate = new Date(lastIntensiveDate);
            threeMonthsDate.setMonth(threeMonthsDate.getMonth() + 3);
            newSchedule.push({ title: 'Työnhakukeskustelu (3kk)', date: `noin ${threeMonthsDate.toLocaleDateString('fi-FI')}` });
            const sixMonthsTarget = new Date(lastIntensiveDate);
            sixMonthsTarget.setMonth(sixMonthsTarget.getMonth() + 6);
            newSchedule.push({ title: 'Täydentävät keskustelut (6kk jakso, 2kpl)', date: `alkavat noin ${sixMonthsTarget.toLocaleDateString('fi-FI')}` });
            const nineMonthsDate = new Date(threeMonthsDate);
            nineMonthsDate.setMonth(nineMonthsDate.getMonth() + 3);
            newSchedule.push({ title: 'Työnhakukeskustelu (9kk)', date: `noin ${nineMonthsDate.toLocaleDateString('fi-FI')}` });
            
            setSchedule(newSchedule);

        } else {
            // PIDEMPÄÄN TYÖTTÖMÄNÄ: Ehdota seuraavaa tapaamista
            const lastMeetingDateStr = state.suunnitelman_perustiedot?.laadittu?.muuttujat?.PÄIVÄMÄÄRÄ;
            if (!lastMeetingDateStr) {
                setError("Pidemmissä työnhaussa laskenta vaatii myös 'Laatimistapa'-valinnan ja päivämäärän.");
                return;
            }
            const lastMeetingDate = parseDate(lastMeetingDateStr);
            if (!lastMeetingDate) {
                setError("Laatimistavan päivämäärä on virheellisessä muodossa.");
                return;
            }

            const alkuhaastatteluDate = addWorkdays(new Date(startDate), 5);
            const endOfInitialIntensive = new Date(alkuhaastatteluDate);
            endOfInitialIntensive.setDate(endOfInitialIntensive.getDate() + (5 * 14));

            const threeMonthTarget = new Date(endOfInitialIntensive);
            threeMonthTarget.setMonth(threeMonthTarget.getMonth() + 3);
            
            const sixMonthTarget = new Date(endOfInitialIntensive);
            sixMonthTarget.setMonth(sixMonthTarget.getMonth() + 6);

            const nineMonthTarget = new Date(threeMonthTarget);
            nineMonthTarget.setMonth(nineMonthTarget.getMonth() + 3);

            if (lastMeetingDate < endOfInitialIntensive) {
                setSuggestion("Asiakas on tehostetussa aloitusjaksossa. Keskustelut tulee järjestää noin kahden viikon välein edellisestä.");
            } else if (lastMeetingDate < threeMonthTarget) {
                setSuggestion(`Seuraava lakisääteinen tapaaminen on 3kk Työnhakukeskustelu, joka tulisi pitää noin ${threeMonthTarget.toLocaleDateString('fi-FI')}.`);
            } else if (lastMeetingDate < sixMonthTarget) {
                setSuggestion(`Seuraava lakisääteinen jakso on 6kk täydentävät työnhakukeskustelut (2kpl), jotka tulisi aloittaa noin ${sixMonthTarget.toLocaleDateString('fi-FI')}.`);
            } else if (lastMeetingDate < nineMonthTarget) {
                setSuggestion(`Seuraava lakisääteinen tapaaminen on 9kk Työnhakukeskustelu, joka tulisi pitää noin ${nineMonthTarget.toLocaleDateString('fi-FI')}.`);
            } else {
                const nextRolling = new Date(lastMeetingDate);
                nextRolling.setMonth(nextRolling.getMonth() + 3);
                setSuggestion(`Asiakas on 3kk keskustelurytmissä. Seuraava työnhakukeskustelu tulisi pitää noin ${nextRolling.toLocaleDateString('fi-FI')}.`);
            }
        }
    };

    return (
        <div className="next-meeting-container">
            <div className="next-meeting-controls">
                <button onClick={calculateAction}>Laske aikataulu / Ehdota seuraavaa</button>
                <a href="#" className="rules-link" onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }}>
                    Näytä yksityiskohtaiset säännöt
                </a>
            </div>
            
            {(schedule || suggestion || error) && (
                <div className="next-meeting-result">
                    {error && <p className="error-message">{error}</p>}
                    {schedule && (
                        <>
                            <h4>Ehdotettu aikataulu uudelle työnhakijalle:</h4>
                            <ul>
                                {schedule.map((item, index) => (
                                    <li key={index}><strong>{item.title}:</strong> {item.date}</li>
                                ))}
                            </ul>
                        </>
                    )}
                    {suggestion && (
                         <>
                            <h4>Ehdotettu seuraava tapaaminen:</h4>
                            <p>{suggestion}</p>
                        </>
                    )}
                </div>
            )}
            
            {isModalOpen && <RulesModal onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

export default AikatauluEhdotus;

