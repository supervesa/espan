import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const WeekGrid = ({ weekDays, renderDayHeader, minHour = 8, maxHour = 16, children }) => {
    // Haitarit ovat oletuksena kiinni, koska dynaaminen ikkuna näyttää jo kaiken olennaisen
    const [showMorning, setShowMorning] = useState(false);
    const [showEvening, setShowEvening] = useState(false);

    // Suljetaan haitarit automaattisesti kun viikko tai datan laajuus muuttuu
    useEffect(() => {
        setShowMorning(false);
        setShowEvening(false);
    }, [minHour, maxHour]);

    // Lasketaan kuinka monta 15-minuutin riviä kuhunkin osioon tulee
    const morningRowsCount = (minHour - 7) * 4;
    const coreRowsCount = (maxHour - minHour) * 4;
    const eveningRowsCount = (19 - maxHour) * 4;

    // CSS Gridin dynaamiset rivimääritykset (piilotetut osiot ovat 0px)
    const morningRows = showMorning ? 'minmax(26px, 1fr) '.repeat(morningRowsCount) : '0px '.repeat(morningRowsCount);
    const coreRows = 'minmax(26px, 1fr) '.repeat(coreRowsCount);
    const eveningRows = showEvening ? 'minmax(26px, 1fr) '.repeat(eveningRowsCount) : '0px '.repeat(eveningRowsCount);

    const toggleButtonStyle = {
        width: '100%', backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)',
        color: 'var(--color-text-secondary)', padding: '6px', fontSize: '0.75rem', fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer',
        borderRadius: '4px', transition: 'all 0.2s ease'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            
            {/* AAMUN HAITARI (Näkyy vain, jos dynaaminen aloitus on klo 07:00 jälkeen) */}
            {minHour > 7 && (
                <button 
                    onClick={() => setShowMorning(!showMorning)}
                    style={{ ...toggleButtonStyle, marginBottom: showMorning ? '4px' : '0' }}
                >
                    {showMorning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showMorning ? `Piilota aamu (07:00 - ${minHour.toString().padStart(2, '0')}:00)` : `Näytä aamu (07:00 - ${minHour.toString().padStart(2, '0')}:00)`}
                </button>
            )}

            {/* VARSINAINEN RUUDUKKO */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '60px repeat(5, minmax(0, 1fr))', 
                gridTemplateRows: `auto ${morningRows}${coreRows}${eveningRows}`, 
                gap: '1px', backgroundColor: 'var(--color-border)', border: '1px solid var(--color-border)', 
                borderRadius: '4px', position: 'relative', overflow: 'hidden' 
            }}>
                {/* Tyhjä yläkulma */}
                <div style={{ backgroundColor: 'var(--color-surface)' }}></div>
                
                {/* Päivien otsikot */}
                {weekDays.map((date, index) => (
                    <div key={`header-${index}`} className="text-center" style={{ backgroundColor: 'var(--color-surface)', padding: '0.5rem 0', position: 'relative', borderBottom: '1px solid var(--color-border)' }}>
                        {renderDayHeader && renderDayHeader(date, index)}
                    </div>
                ))}

                {/* Taustasolut ja kellonajat (07-19) */}
                {Array.from({ length: 48 }).map((_, rowIndex) => {
                    const actualRow = rowIndex + 2; 
                    const isFullHour = rowIndex % 4 === 0;
                    const hour = 7 + Math.floor(rowIndex / 4);
                    const isCoreOfficeHour = hour >= 9 && hour < 15;

                    // Jos haitari on kiinni, ohitetaan näiden tuntien taustojen renderöinti
                    if (!showMorning && hour < minHour) return null;
                    if (!showEvening && hour >= maxHour) return null;

                    return (
                        <React.Fragment key={`row-${rowIndex}`}>
                            {isFullHour ? (
                                <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)', position: 'relative' }}>
                                    <span className="text-xs text-secondary fw-medium" style={{ position: 'absolute', right: '8px', top: '-8px' }}>
                                        {hour.toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                            ) : (
                                <div style={{ gridColumn: 1, gridRow: actualRow, backgroundColor: 'var(--color-surface)' }} />
                            )}
                            
                            {weekDays.map((_, colIndex) => (
                                <div 
                                    key={`cell-${rowIndex}-${colIndex}`} 
                                    style={{ 
                                        gridColumn: colIndex + 2, gridRow: actualRow, 
                                        backgroundColor: isCoreOfficeHour ? '#ffffff' : 'var(--color-background)', 
                                        borderBottom: isFullHour ? '1px solid var(--color-border)' : '1px dashed rgba(0,0,0,0.03)' 
                                    }} 
                                />
                            ))}
                        </React.Fragment>
                    );
                })}

                {/* Tapahtumat (Säännöt, Varaukset, ICS) */}
                {children}
            </div>

            {/* ILLAN HAITARI (Näkyy vain, jos dynaaminen lopetus on ennen klo 19:00) */}
            {maxHour < 19 && (
                <button 
                    onClick={() => setShowEvening(!showEvening)}
                    style={{ ...toggleButtonStyle, marginTop: showEvening ? '4px' : '0' }}
                >
                    {showEvening ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showEvening ? `Piilota ilta (${maxHour.toString().padStart(2, '0')}:00 - 19:00)` : `Näytä ilta (${maxHour.toString().padStart(2, '0')}:00 - 19:00)`}
                </button>
            )}
        </div>
    );
};

export default WeekGrid;