import React, { useState, useEffect } from 'react';

const AikatauluEhdotus = ({ state }) => {
  const [count, setCount] = useState(1);
  const [period, setPeriod] = useState(3);
  const [meetingType, setMeetingType] = useState("täydentävää työnhakukeskustelua");
  const [showLawInfo, setShowLawInfo] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [manualEndDate, setManualEndDate] = useState(null);

  // --- HAKU: Suoraan ja turvallisesti ---
  const findActiveServiceDate = () => {
    const section = state['tyotilanne'] || {};
    const directDate = section.palvelu_loppu || section.muuttujat?.palvelu_loppu;
    if (directDate) return directDate;

    for (const key in state) {
      const data = state[key];
      if (!data) continue;
      if (data.palvelu_loppu) return data.palvelu_loppu;
      if (data.muuttujat?.palvelu_loppu) return data.muuttujat.palvelu_loppu;
    }
    return "";
  };

  const autoEndDate = findActiveServiceDate();

  // --- TURVALLINEN PARSERI ---
  const parseDate = (val) => {
    if (!val) return null;
    let d;
    if (typeof val === 'string') {
      const s = val.trim();
      if (s.includes('T')) return new Date(s);
      if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 3) {
          let y = parseInt(parts[2].trim(), 10);
          let m = parseInt(parts[1].trim(), 10) - 1;
          let day = parseInt(parts[0].trim(), 10);
          if (y < 100) y += 2000; 
          d = new Date(y, m, day);
        }
      } else if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3) {
          d = new Date(parseInt(parts[0].trim(), 10), parseInt(parts[1].trim(), 10) - 1, parseInt(parts[2].trim(), 10));
        }
      }
    } else if (val instanceof Date) {
      d = val;
    }
    return (d && !isNaN(d.getTime())) ? d : null;
  };

  const formatDate = (date) => {
    const d = parseDate(date);
    return d ? d.toLocaleDateString('fi-FI') : "";
  };

  const activeDateRaw = manualEndDate !== null ? manualEndDate : autoEndDate;
  const displayValue = manualEndDate !== null ? manualEndDate : formatDate(autoEndDate);

  // --- KORJATTU ÄLYKÄS ANALYYSI (Ei enää ikiliikkujaa!) ---
  // Riippuvuutena on nyt pelkkä merkkijono (activeDateRaw), ei Date-objekti
  useEffect(() => {
    const parsed = parseDate(activeDateRaw);
    if (parsed) {
      setRecommendation({
        type: "työnhakukeskustelu",
        count: 1,
        period: 1,
        label: "Palvelu päättyy (46 §)",
        note: "Varaa työnhakukeskustelu 1 kk ennen loppua."
      });
    } else {
      setRecommendation(null);
    }
  }, [activeDateRaw]); 

  const applyRecommendation = () => {
    if (recommendation) {
      setCount(recommendation.count);
      setPeriod(recommendation.period);
      setMeetingType(recommendation.type);
    }
  };

  // --- FRAASIGENERAATTORI ---
  const generatePhrase = () => {
    if (count === 0) {
      return "Asiakkaan palvelutarve on arvioitu, eikä säännöllisille täydentäville työnhakukeskusteluille ole tarvetta alkavalla jaksolla. Asiakkaalla on kuitenkin lakisääteinen oikeus keskusteluihin; tarvittaessa asiakas voi jättää yhteydenottopyynnön Työmarkkinatorin Oma asiointi -palvelussa.";
    }

    const parsed = parseDate(activeDateRaw);
    if (parsed && meetingType.includes("työnhakukeskustelu")) {
      const targetDate = new Date(parsed);
      targetDate.setMonth(targetDate.getMonth() - 1);
      return `Asiakkaalle järjestetään 46 §:n mukainen työnhakukeskustelu kuukautta ennen palvelun päättymistä (arviolta ${formatDate(targetDate)}), jossa asetetaan palvelun päättymisen jälkeinen työnhakuvelvollisuus ja sovitaan jatkoaskeleista.`;
    }

    return `Asiakkaalle järjestetään ${count} (${count}) ${meetingType} ${period} (${period}) kuukauden aikana.`;
  };

  const handleCopyText = () => {
    const text = generatePhrase();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('kopioi-btn');
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "✓ Kopioitu!";
          setTimeout(() => { btn.innerText = originalText; }, 2000);
        }
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        const btn = document.getElementById('kopioi-btn');
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "✓ Kopioitu!";
          setTimeout(() => { btn.innerText = originalText; }, 2000);
        }
      } catch (err) {
        alert("Selaimesi estää automaattisen kopioinnin. Maalaa teksti käsin.");
      }
      textArea.remove();
    }
  };

  return (
    <div className="section-container">
      <div className="section-header">
        <h2 className="section-title">Sentinel Guardian: Aikatauluavustaja</h2>
        <button className="btn--secondary" onClick={() => setShowLawInfo(!showLawInfo)}>Lakiopas</button>
      </div>

      {recommendation && (
        <div className="smart-analysis-box" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="smart-analysis-grid">
            <div className="smart-analysis-column">
              <p className="smart-analysis-title">🔍 {recommendation.label}</p>
              <p style={{fontSize: '0.8rem', margin: 0}}>{recommendation.note}</p>
            </div>
            <div className="smart-analysis-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={applyRecommendation}>Aseta ehdotus</button>
            </div>
          </div>
        </div>
      )}

      <div className="subsection">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <label htmlFor="meeting-type-select">Keskustelun tyyppi:</label>
            <select id="meeting-type-select" className="modern-select" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
              <option value="täydentävää työnhakukeskustelua">Täydentävä (32 §)</option>
              <option value="työnhakukeskustelu">Työnhakukeskustelu (46 §)</option>
            </select>

            <label style={{ marginTop: '1rem', display: 'block' }}>Määrä:</label>
            <div className="boolean-buttons">
              {[0, 1, 2, 3, 5].map(num => (
                <button key={num} className={count === num ? "selected" : ""} onClick={() => setCount(num)}>{num}</button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="period-select">Aikaikkuna (kk):</label>
            <select id="period-select" className="modern-select" value={period} onChange={(e) => setPeriod(parseInt(e.target.value))}>
              <option value={1}>1 kk</option>
              <option value={3}>3 kk</option>
              <option value={6}>6 kk</option>
              <option value={12}>12 kk</option>
            </select>

            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="service-end-date">Palvelun päättymispäivä:</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  id="service-end-date"
                  type="text" 
                  className="modern-select" 
                  placeholder="esim. 15.4.2026"
                  value={displayValue} 
                  onChange={(e) => setManualEndDate(e.target.value)} 
                />
                {manualEndDate !== null && (
                  <button className="btn--secondary" onClick={() => setManualEndDate(null)} style={{color: 'var(--color-danger)'}} title="Palauta automaattinen">X</button>
                )}
              </div>
              {manualEndDate === null && autoEndDate && <span className="tag tag--success" style={{marginTop: '5px', display: 'inline-block'}}>✓ Haettu työtilanteesta</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="summary-preview language-summary-preview">
        <h4>Suunnitelmaan kopioitava teksti:</h4>
        <p>"{generatePhrase()}"</p>
        <button 
          id="kopioi-btn"
          className="btn" 
          style={{ width: '100%', marginTop: '1rem', backgroundColor: '#f43f5e', color: '#fff', border: 'none', transition: 'all 0.3s ease' }} 
          onClick={handleCopyText}
        >
          Kopioi teksti
        </button>
      </div>

      {showLawInfo && (
        <div className="guidance-box a-tmt-guidance" style={{marginTop: '1rem'}}>
           <p><strong>46 §:</strong> Työnhakuvelvollisuus alkaa vasta, kun 1 kk ennen palvelun päättymistä on pidetty työnhakukeskustelu.</p>
        </div>
      )}
    </div>
  );
};

export default AikatauluEhdotus;