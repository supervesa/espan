import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, Clock, X, Zap, CheckCircle2, Info, Phone, Building, Video } from 'lucide-react';

const SmartTimer = ({ onSaveTime, savedKesto, savedDiscrepancy, savedType, savedMode }) => {
    const [status, setStatus] = useState('IDLE');
    const [seconds, setSeconds] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    const [manualMinutes, setManualMinutes] = useState('');
    const [meetingType, setMeetingType] = useState(savedType || '');
    
    // UUSI: Toteutustapa (Kanava)
    const [meetingMode, setMeetingMode] = useState(savedMode || '');

    useEffect(() => {
        setMeetingType(savedType || '');
        setMeetingMode(savedMode || '');
    }, [savedType, savedMode]);

    useEffect(() => {
        let interval = null;
        if (status === 'RUNNING') {
            interval = setInterval(() => setSeconds(prev => prev + 1), 1000);
        } else if (status !== 'RUNNING' && interval) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [status]);

    const handleStart = () => {
        setStatus('RUNNING');
        setIsPanelOpen(false);
        // Oletus: Jos kello käynnistetään, se on luultavasti lähikäynti tai video
        if (!meetingMode) setMeetingMode('Käynti');
    };

    const handlePause = () => setStatus('PAUSED');
    const handleResume = () => setStatus('RUNNING');
    const handleStop = () => {
        setStatus('FINISHED');
        setIsPanelOpen(true);
    };

    const handleReset = () => {
        setStatus('IDLE');
        setSeconds(0);
        setManualMinutes('');
        setIsPanelOpen(false);
    };

    const openPanelIdle = () => setIsPanelOpen(!isPanelOpen);

    const handleSave = (finalMinutesOverride = null) => {
        // Turvalukko: Tyyppi JA Tapa pitää olla valittuna!
        if (!meetingType || !meetingMode) return; 

        let exactMinutes = 0;
        
        // 1. Katsotaan mistä aito aika tulee
        if (status === 'FINISHED') {
            exactMinutes = seconds / 60;
        } else if (manualMinutes !== '') {
            exactMinutes = parseFloat(manualMinutes);
        }
        
        // 🟢 KORJAUS TÄSSÄ: Jos mitään aikaa ei oltu kellotettu tai syötetty, 
        // mutta asiantuntija painoi suoraan pikavalintaa, aito aika = pikavalinta (Erotus = 0).
        if (exactMinutes === 0 && finalMinutesOverride !== null) {
            exactMinutes = finalMinutesOverride;
        }

        let roundedMinutes = finalMinutesOverride !== null 
            ? finalMinutesOverride 
            : (exactMinutes > 0 ? Math.ceil(exactMinutes / 5) * 5 : 15);

        if (roundedMinutes === 0) roundedMinutes = 5;

        const discrepancy = Math.round(exactMinutes - roundedMinutes);

        if (onSaveTime) {
            // Välitetään myös meetingMode!
            onSaveTime(roundedMinutes, discrepancy, meetingType, meetingMode);
        }

        handleReset();
    };

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const trueMinsFinished = Math.floor(seconds / 60);
    const trueSecsFinished = seconds % 60;
    
    const currentExactMinutes = status === 'FINISHED' ? (seconds / 60) : Number(manualMinutes || 0);
    const currentRoundedMinutes = currentExactMinutes > 0 ? Math.ceil(currentExactMinutes / 5) * 5 : 0;
    const currentDiscrepancy = Math.round(currentExactMinutes - currentRoundedMinutes);

    return (
        <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
            
            {isPanelOpen && (
                <div className="smart-analysis-box" style={{ margin: 0, width: '360px', boxShadow: '0 15px 30px rgba(0,0,0,0.15)', animation: 'fadeIn 0.2s ease-out', padding: '1.5rem', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 className="fw-bold text-primary m-0 flex items-center gap-2 text-md">
                            <Clock size={18} /> 
                            {status === 'FINISHED' ? 'Tapaaminen päättyi' : (savedKesto ? 'Muokkaa kestoa' : 'Kirjaa kesto')}
                        </h4>
                        <button onClick={() => setIsPanelOpen(false)} className="btn-tag-dismiss text-muted"><X size={20} /></button>
                    </div>

                    {/* VAIHE 1: Tapaamisen Tyyppi & Toteutustapa (Kanava) */}
                    <div className="mb-3 pb-3" style={{ borderBottom: '1px dashed var(--color-border)' }}>
                        
                        <label className="text-xs fw-semibold text-primary mb-1 block">Tapaamisen tyyppi *</label>
                        <select className="modern-select text-sm mb-3" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                            <option value="" disabled>Valitse tyyppi...</option>
                            <option value="Alkuhaastattelu">Alkuhaastattelu</option>
                            <option value="Työnhakukeskustelu">Työnhakukeskustelu</option>
                            <option value="Täydentävä työnhakukeskustelu">Täydentävä työnhakukeskustelu</option>
                            <option value="Aktivointi">Aktivointi</option>
                            <option value="Aktivointisuunnitelma">Aktivointisuunnitelma</option>
                        </select>

                        {/* UUSI: Toteutustapa */}
                        <label className="text-xs fw-semibold text-primary mb-1 block">Toteutustapa *</label>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button 
                                onClick={() => setMeetingMode('Puhelu')}
                                className={`btn ${meetingMode === 'Puhelu' ? '' : 'btn--secondary'}`}
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '4px', justifyContent: 'center' }}
                            ><Phone size={14}/> Puhelu</button>
                            <button 
                                onClick={() => setMeetingMode('Käynti')}
                                className={`btn ${meetingMode === 'Käynti' ? '' : 'btn--secondary'}`}
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '4px', justifyContent: 'center' }}
                            ><Building size={14}/> Käynti</button>
                            <button 
                                onClick={() => setMeetingMode('Video')}
                                className={`btn ${meetingMode === 'Video' ? '' : 'btn--secondary'}`}
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '4px', justifyContent: 'center' }}
                            ><Video size={14}/> Video</button>
                        </div>
                    </div>

                    {status === 'FINISHED' && (
                        <>
                            <div className="mb-3">
                                <span className="text-sm text-secondary">Kellotettu aika: </span>
                                <strong className="text-primary font-mono text-lg">{trueMinsFinished} min {trueSecsFinished} s</strong>
                            </div>
                            <button onClick={() => handleSave()} disabled={!meetingType || !meetingMode} className="btn-ai w-100" style={{ justifyContent: 'center', padding: '1rem', fontSize: '1.1rem', marginBottom: '1rem' }}>
                                <Zap size={18} /> Tallenna pyöristetty: {currentRoundedMinutes} min
                            </button>
                            <div className="alert-box" style={{ backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.1)', padding: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <Info size={16} color="var(--color-info-text)" style={{ marginTop: '2px' }} />
                                    <div>
                                        <span className="fw-semibold text-sm" style={{ color: 'var(--color-info-dark)' }}>Datatieto:</span>
                                        <p className="text-xs m-0" style={{ color: 'var(--color-info-text)' }}>Pyöristys jättää asiantuntijalle <strong>{Math.abs(currentDiscrepancy)} minuuttia</strong> kalenteripuskuria.</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {status === 'IDLE' && (
                        <>
                            {savedKesto && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(30, 154, 90, 0.05)', border: '1px solid rgba(30, 154, 90, 0.2)', borderRadius: '6px', marginBottom: '1.5rem', color: 'var(--color-success)' }}>
                                    <CheckCircle2 size={18} style={{ marginTop: '2px' }} />
                                    <div>
                                        <strong className="block text-sm">Kalenteriin varattu: {savedKesto} min</strong>
                                        <span className="text-xs">Voit ylikirjoittaa ajan valitsemalla uuden pituuden.</span>
                                    </div>
                                </div>
                            )}

                            <button onClick={handleStart} className="btn" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Play size={18} fill="currentColor" /> Aloita kellotus (Lähikäynti)
                            </button>

                            <div style={{ position: 'relative', textAlign: 'center', marginBottom: '1.5rem' }}>
                                <hr style={{ margin: 0, borderColor: 'var(--color-border)' }} />
                                <span className="text-xs text-secondary px-2" style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)' }}>TAI SYÖTÄ KÄSIN</span>
                            </div>

                            <div className="mb-3">
                                <label className="text-xs fw-semibold text-primary mb-1 block">Toteutunut aika minuuteissa</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input 
                                        type="number" className="form-input text-mono" style={{ flex: 1, padding: '0.5rem' }} placeholder="esim. 17"
                                        value={manualMinutes}
                                        onChange={(e) => {
                                            setManualMinutes(e.target.value);
                                            // Jos asiantuntija syöttää ajan käsin, se on oletuksena puhelu
                                            if (e.target.value && !meetingMode) setMeetingMode('Puhelu');
                                        }} min="1"
                                    />
                                    <button onClick={() => handleSave()} disabled={!manualMinutes || !meetingType || !meetingMode} className="btn btn--secondary" style={{ padding: '0.5rem 1rem' }}>
                                        <CheckCircle2 size={18} />
                                    </button>
                                </div>
                                {manualMinutes > 0 && (
                                    <p className="text-xs text-success mt-2 fw-medium mb-0">
                                        👉 Pyöristetään kalenteriin: <strong>{currentRoundedMinutes} min</strong> (Erotus: {currentDiscrepancy > 0 ? '+' : ''}{currentDiscrepancy} min)
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {!manualMinutes && status !== 'FINISHED' && (
                        <>
                            <div className="text-xs fw-semibold text-secondary mb-2 uppercase">Pikavalinnat kalenteriin:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {[15, 20, 30, 45, 60].map(val => (
                                    <button key={val} onClick={() => handleSave(val)} disabled={!meetingType || !meetingMode} className="chip text-xs-dense">{val} min</button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div style={{
                display: 'flex', alignItems: 'center',
                backgroundColor: status === 'IDLE' ? (savedKesto ? '#f0fdf4' : 'var(--color-surface)') : (status === 'PAUSED' ? '#fffbeb' : '#fff'),
                border: '1px solid', borderColor: status === 'RUNNING' ? 'rgba(227,74,74,0.3)' : (status === 'PAUSED' ? 'rgba(255,176,32,0.3)' : (savedKesto ? 'var(--color-success)' : 'var(--color-border)')),
                borderRadius: '50px', padding: status === 'IDLE' ? '0.4rem 1.25rem' : '0.4rem',
                boxShadow: status !== 'IDLE' ? '0 4px 15px rgba(0,0,0,0.1)' : '0 4px 10px rgba(0,0,0,0.05)',
                cursor: status === 'IDLE' ? 'pointer' : 'default', transition: 'all 0.2s ease',
            }} onClick={status === 'IDLE' ? openPanelIdle : undefined}>
                
                {status === 'IDLE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: savedKesto ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                        {savedKesto ? <CheckCircle2 size={18} /> : <Clock size={18} className="text-primary" />}
                        <span className="fw-semibold text-sm">{savedKesto ? `Tallennettu: ${savedKesto} min` : 'Kesto & Kellotus'}</span>
                    </div>
                )}

                {(status === 'RUNNING' || status === 'PAUSED') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        {status === 'RUNNING' ? (
                            <button onClick={handlePause} className="btn-icon" style={{ border: 'none', background: 'rgba(255,176,32,0.1)', color: 'var(--color-warning)', borderRadius: '50px', padding: '0.5rem 0.8rem' }} title="Tauko"><Pause size={18} fill="currentColor" /></button>
                        ) : (
                            <button onClick={handleResume} className="btn-icon" style={{ border: 'none', background: 'rgba(30,154,90,0.1)', color: 'var(--color-success)', borderRadius: '50px', padding: '0.5rem 0.8rem' }} title="Jatka"><Play size={18} fill="currentColor" /></button>
                        )}
                        <div style={{ padding: '0 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span className={`font-mono fw-bold text-lg lh-tight ${status === 'PAUSED' ? 'text-warning' : 'text-danger'}`}>{formatTime(seconds)}</span>
                            {status === 'PAUSED' && <span className="text-xxs text-warning uppercase fw-bold">Tauolla</span>}
                        </div>
                        <button onClick={handleStop} className="btn" style={{ padding: '0.5rem 1rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--color-danger)', boxShadow: 'none' }}>
                            <Square size={14} fill="currentColor" /> <span className="text-sm">Päätä</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartTimer;