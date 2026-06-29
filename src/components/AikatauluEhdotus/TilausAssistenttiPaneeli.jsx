import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Calendar, MessageSquare, AlertTriangle, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';

function TilausAssistenttiPaneeli({ basket, virallinenTeksti, virallinenTekstiICS, smsTeksti, selectedRule, expertLocations = [], resolvedAddress = '', interpreterState = {} }) {
  const activeSlot = basket && basket.length > 0 ? basket[0] : null;
  const meetingType = activeSlot?.mode || 'puhelu'; 
  
  const slotDateObj = activeSlot ? new Date(activeSlot.time) : new Date();
  const dateParts = slotDateObj.toLocaleDateString('fi-FI').split('.'); 
  const timeStr = slotDateObj.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'); 

  const currentDayRow = useMemo(() => {
    if (!activeSlot || !expertLocations || expertLocations.length === 0) return null;
    const d = new Date(activeSlot.time);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const activeDateStr = `${yyyy}-${mm}-${dd}`;
    return expertLocations.find(l => l.date === activeDateStr);
  }, [activeSlot, expertLocations]);

  const currentLocType = currentDayRow?.location_type || 'toimisto';
  const currentLocName = currentDayRow?.location_name || '';

  const [tulkkiName, setTulkkiName] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [asiakasId, setAsiakasId] = useState('');

  // 1. TULKKITILAUS-ID KORJATTU (Muoto: MAN-1509-1300-P)
  const generatedTunniste = useMemo(() => {
    if (!interpreterState.needsInterpreter) return '';
    const langCode = interpreterState.displayLanguage && interpreterState.displayLanguage !== 'Määrittelemätön kieli' ? interpreterState.displayLanguage.substring(0, 3).toUpperCase() : 'TUL';
    const dateKoodi = `${dateParts[0].padStart(2, '0')}${dateParts[1].padStart(2, '0')}`;
    const timeKoodi = timeStr.replace(':', '');
    const modeLetter = meetingType === 'kaynti' ? 'K' : 'P';
    
    return `${langCode}-${dateKoodi}-${timeKoodi}-${modeLetter}`;
  }, [dateParts, timeStr, interpreterState, meetingType]);

  const hasLocationConflict = meetingType === 'kaynti' && currentLocType === 'eta';
  const showAddressField = meetingType === 'kaynti' && currentLocType !== 'eta';

  const copyToClipboard = (text, label) => {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showNotification(`${label} kopioitu!`))
        .catch(() => runFallbackCopy(text, label));
    } else {
      runFallbackCopy(text, label);
    }
  };

  const runFallbackCopy = (text, label) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; 
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy') ? showNotification(`${label} kopioitu!`) : showNotification('Kopiointi epäonnistui');
    } catch (err) {
      showNotification('Kopiointi ei onnistunut');
    }
    document.body.removeChild(textArea);
  };

  const showNotification = (message) => {
    setCopySuccess(message);
    setTimeout(() => setCopySuccess(''), 2500);
  };

  const downloadICS = () => {
    if (!activeSlot) return;
    
    const startObj = new Date(activeSlot.time);
    const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); 
    const formatDateForICS = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const actualICSDescriptionText = virallinenTekstiICS || virallinenTeksti || '';
    
    // 2. ICS-KUVAUS KORJATTU (Molemmat viralliset tekstit)
    let description = `--- 1. VIRALLINEN ILMOITUSTEKSTI (Kopioitavaksi) ---\\n${(virallinenTeksti || '').replace(/\n/g, '\\n')}\\n\\n--- 2. VIRALLINEN ILMOITUSTEKSTI (Kalenteriin) ---\\n${actualICSDescriptionText.replace(/\n/g, '\\n')}`;
    let alarmBlock = '';

    const modeText = meetingType === 'kaynti' ? 'läsnä' : 'soitto';
    const rawId = asiakasId.trim();
    const tunnisteStr = interpreterState.needsInterpreter ? ` ${generatedTunniste}` : '';
    const title = `Ajanvaraus/${modeText}${rawId ? ` ${rawId}` : ''}${tunnisteStr}`;

    if (interpreterState.needsInterpreter) {
      description = `--- 0. TILAUSTIEDOT ---\\nViite: ${generatedTunniste}\\nTulkki: ${tulkkiName || 'Ei erityistoivetta'}\\nKieli: ${(interpreterState.displayLanguage || '').toUpperCase()}\\n\\n${description}`;
      alarmBlock = `BEGIN:VALARM\nTRIGGER:-P14D\nACTION:DISPLAY\nDESCRIPTION:Muista tilata tulkkipalvelu. Kieli: ${interpreterState.displayLanguage}. Viite: ${generatedTunniste}\nEND:VALARM\n`;
    }

    const locationLine = resolvedAddress ? `LOCATION:${resolvedAddress.replace(/\n/g, ' ')}\n` : '';

    // 3. STATUS:TENTATIVE LISÄTTY
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Helsingin Työllisyyspalvelut//Espan//FI
BEGIN:VEVENT
UID:${Math.random().toString(36).substr(2, 9)}@espan.hel.fi
DTSTAMP:${formatDateForICS(new Date())}
DTSTART:${formatDateForICS(startObj)}
DTEND:${formatDateForICS(endObj)}
SUMMARY:${title}
STATUS:TENTATIVE
${locationLine}DESCRIPTION:${description}
${alarmBlock}END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `tapaaminen_${dateParts[0]}${dateParts[1]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!activeSlot || !selectedRule) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>
        Valitse sääntö ja kalenteriaika aktivoidaksesi viestintätyökalut.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'system-ui, sans-serif', width: '100%', maxWidth: '400px', margin: '0 auto', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '6px' }}>
        <span style={{ color: '#64748b', fontWeight: 'bold' }}>Työpiste (tietokannasta):</span>
        <span style={{ fontWeight: 'bold', color: '#334155' }}>{currentLocName || 'Ei määritelty'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a' }}>
        {meetingType === 'puhelu' ? <MessageSquare size={16} color="var(--color-primary)" /> : <MapPin size={16} color="var(--color-primary)" />}
        <span>{meetingType === 'puhelu' ? 'Puheluaika' : 'Lähitapaaminen'}: {dateParts[0]}.{dateParts[1]}. klo {timeStr}</span>
      </div>

      {hasLocationConflict && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', fontWeight: 'bold' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>Huom: Kalenterisi mukaan olet tänään etätöissä!</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button 
          onClick={() => copyToClipboard(virallinenTeksti, 'Virallinen kutsu')}
          style={{ width: '100%', padding: '0.65rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.8rem', color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          <ShieldCheck size={14} color="#10b981" /> Kopioi virallinen kutsu
        </button>
        
        <button 
          onClick={() => copyToClipboard(smsTeksti, 'Pika-kutsu')}
          style={{ width: '100%', padding: '0.65rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.8rem', color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          <Copy size={14} /> Kopioi pika-kutsu (SMS)
        </button>
      </div>

      {interpreterState.needsInterpreter && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#166534', fontWeight: 'bold', fontSize: '0.8rem' }}>
            <ExternalLink size={14} /> Tulkkipalvelun tilaus ({interpreterState.displayLanguage})
          </div>

          <input 
            type="text" 
            placeholder="Toivottu vakiotulkki (esim. Ali)" 
            value={tulkkiName} 
            onChange={(e) => setTulkkiName(e.target.value)}
            style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '1px solid #86efac', borderRadius: '4px', boxSizing: 'border-box' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.4rem', borderRadius: '4px', border: '1px solid #dcfce3' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Tilausviite</div>
                <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{generatedTunniste}</div>
              </div>
              <button onClick={() => copyToClipboard(generatedTunniste, 'Viite')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><Copy size={14} /></button>
            </div>

            {showAddressField && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.4rem', borderRadius: '4px', border: '1px solid #dcfce3' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Käyntiosoite tulkille</div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{resolvedAddress}</div>
                </div>
                <button onClick={() => copyToClipboard(resolvedAddress, 'Osoite')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><Copy size={14} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '0.25rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Asiakas ID (viedään vain kalenteriin)
          </label>
          <input
            type="text"
            placeholder="Esim. asiointinumero"
            value={asiakasId}
            onChange={(e) => setAsiakasId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>

        <button 
          onClick={downloadICS}
          style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <Calendar size={16} /> Tallenna kalenteriin (.ics)
        </button>
        {interpreterState.needsInterpreter && (
          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#64748b', marginTop: '0.3rem', fontStyle: 'italic' }}>
            Sisältää tulkkitilausmuistutuksen (14 vrk)
          </div>
        )}
        {copySuccess && <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.4rem' }}>{copySuccess}</div>}
      </div>

    </div>
  );
}

export default TilausAssistenttiPaneeli;