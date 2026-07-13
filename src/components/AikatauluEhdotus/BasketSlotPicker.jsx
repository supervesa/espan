import React, { useMemo, useState } from 'react';
import { CalendarCheck, Lock, ChevronLeft, ChevronRight, Phone, MapPin, Trash2, AlertTriangle, CalendarX, Star, AlertCircle, Info } from 'lucide-react';

const BasketSlotPicker = ({ slots, basket, setBasket, onBook, isAktivointi, confirmedCount, weekOffset = 0, onOffsetChange, bookedSlots = [], currentMode, onModeChange }) => {

    // SUODATUS: Näytetään vain valitun moodin mukaiset ajat
    const filteredSlots = useMemo(() => {
        return slots.filter(s => s.mode === currentMode);
    }, [slots, currentMode]);

    // UUSI LOGIIKKA: Varatut ajat
    const visibleBookedSlots = useMemo(() => {
        if (!bookedSlots || bookedSlots.length === 0) return [];
        
        // Koska emme tiedä tarkkaan viikon rajoja tässä komponentissa suoraan,
        // päättelemme katseluikkunan ensimmäisen vapaan ajan perusteella (jos niitä on).
        // Muuten näytämme varattuja aikoja noin viikon säteellä tästä päivästä + weekOffset.
        let referenceDate = new Date();
        if (slots.length > 0) {
             referenceDate = new Date(slots[0].time);
        } else {
             referenceDate.setDate(referenceDate.getDate() + (weekOffset * 7));
        }

        // Otetaan referenceDate maanantai ja sunnuntai
        const startOfWeek = new Date(referenceDate);
        const day = startOfWeek.getDay() || 7; // Ma on 1, Su on 7
        startOfWeek.setDate(startOfWeek.getDate() - day + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Suodatetaan tietokannan varatut ajat, jotka osuvat tälle tarkasteltavalle viikolle
        const currentWeekBookings = bookedSlots.filter(booking => {
            const bookingTime = new Date(booking.start_time);
            return bookingTime >= startOfWeek && bookingTime <= endOfWeek;
        });

        // Järjestetään aikajärjestykseen
        return currentWeekBookings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }, [bookedSlots, slots, weekOffset]);

    const dailyCounts = useMemo(() => {
        const counts = {};
        basket.forEach(item => {
            const dateStr = item.time.toLocaleDateString('fi-FI');
            counts[dateStr] = (counts[dateStr] || 0) + 1;
        });
        return counts;
    }, [basket]);

    const isHC = Math.max(0, ...Object.values(dailyCounts)) > 3;

    // Tunnistetaan, onko ruudulla mitään poikkeusaikoja, jotta seliterivi voidaan näyttää
    const hasSpecialSlots = useMemo(() => {
        return filteredSlots.some(s => s.isAnchor || s.isBorrowed);
    }, [filteredSlots]);

    const toggleSlot = (slotObj) => {
        const existingIndex = basket.findIndex(b => b.time.getTime() === slotObj.time.getTime());
        if (existingIndex >= 0) {
            setBasket(basket.filter((_, i) => i !== existingIndex));
        } else {
            // TALLENNETAAN MYÖS TULKIN VAROITUKSET OSTOSKORIIN
            setBasket([...basket, { 
                time: slotObj.time, 
                mode: slotObj.mode || currentMode,
                isAnchor: slotObj.isAnchor,
                isBorrowed: slotObj.isBorrowed,
                label: slotObj.label
            }]);
        }
    };

    const updateBasketMode = (time, newMode) => {
        setBasket(basket.map(b => b.time.getTime() === time.getTime() ? { ...b, mode: newMode } : b));
    };

    return (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
                    <button onClick={() => onModeChange('puhelu')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', background: currentMode === 'puhelu' ? '#fff' : 'transparent', color: currentMode === 'puhelu' ? '#0f172a' : '#64748b', fontWeight: currentMode === 'puhelu' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: currentMode === 'puhelu' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
                        <Phone size={14} /> Puhelu
                    </button>
                    <button onClick={() => onModeChange('kaynti')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', background: currentMode === 'kaynti' ? '#fff' : 'transparent', color: currentMode === 'kaynti' ? '#0f172a' : '#64748b', fontWeight: currentMode === 'kaynti' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: currentMode === 'kaynti' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
                        <MapPin size={14} /> Käynti
                    </button>
                </div>
                
                {onOffsetChange && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '4px 8px', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                        <button onClick={() => onOffsetChange(-1)} disabled={weekOffset <= 0} style={{ border: 'none', background: 'none', cursor: weekOffset <= 0 ? 'default' : 'pointer', opacity: weekOffset <= 0 ? 0.3 : 1, display: 'flex' }}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', minWidth: '65px', textAlign: 'center' }}>
                            {weekOffset === 0 ? 'Tämä viikko' : `+ ${weekOffset} vko`}
                        </span>
                        <button onClick={() => onOffsetChange(1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* UUSI: SELITELAATIKKO (Legend) */}
            {hasSpecialSlots && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.7rem', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><Info size={12} color="#64748b" /> Erikoisajat:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={10} fill="#fbbf24" color="#d97706" /> Vain alkuhaastattelulle</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={10} color="#f97316" /> Lainattu täydentävistä</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={10} color="#ef4444" /> Lainattu aktivoinnista</div>
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
                {filteredSlots.length > 0 ? (
                    filteredSlots.map((s, i) => {
                        const inBasket = basket.some(b => b.time.getTime() === s.time.getTime());
                        const h = s.time.getHours();
                        const m = String(s.time.getMinutes()).padStart(2, '0');
                        
                        // Määritetään värit ja ikonit Tulkin datan perusteella
                        let bg = '#fff';
                        let borderColor = '#cbd5e1';
                        let textColor = '#334155';
                        const isSevere = s.label?.includes('aktivoinnista');
                        
                        if (inBasket) {
                            bg = '#dcfce7';
                            borderColor = '#22c55e';
                            textColor = '#166534';
                        } else if (s.isAnchor) {
                            bg = '#fef3c7'; // vaalea kulta
                            borderColor = '#fbbf24';
                            textColor = '#92400e';
                        } else if (s.isBorrowed) {
                            bg = isSevere ? '#fef2f2' : '#fff7ed'; // punertava tai oranssihtava
                            borderColor = isSevere ? '#fca5a5' : '#fdba74';
                            textColor = isSevere ? '#b91c1c' : '#c2410c';
                        }
                        
                        return (
                            <button 
                                key={`free-${i}`} 
                                onClick={() => toggleSlot(s)}
                                style={{ 
                                    padding: '6px 10px', 
                                    background: bg, 
                                    border: `1px solid ${borderColor}`, 
                                    borderRadius: '6px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    cursor: 'pointer', 
                                    color: textColor, 
                                    transition: 'all 0.2s', 
                                    display: 'flex',
                                    flexDirection: 'column', 
                                    alignItems: 'flex-start', 
                                    gap: '2px',
                                    minWidth: '130px' // Pidetään napit hieman leveämpinä
                                }}>
                                
                                {/* Ylärivi: Kellonaika ja Tyyppi */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {s.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {h}:{m} 
                                    </span>
                                    {s.mode === 'kaynti' ? <MapPin size={12} /> : <Phone size={12} />}
                                </div>

                                {/* Alarivi: Varoitusteksti, jos olemassa */}
                                {(s.isAnchor || s.isBorrowed) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', opacity: 0.9, marginTop: '2px' }}>
                                        {s.isAnchor && <><Star size={10} fill="#fbbf24" color="#d97706" /> Alkuhaastattelu</>}
                                        {s.isBorrowed && !isSevere && <><AlertTriangle size={10} color="#f97316" /> Lainattu: Täydentävä</>}
                                        {s.isBorrowed && isSevere && <><AlertCircle size={10} color="#ef4444" /> Lainattu: Aktivointi</>}
                                    </div>
                                )}
                            </button>
                        );
                    })
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei {currentMode === 'puhelu' ? 'puheluita' : 'käyntejä'} tälle viikolle.</span>
                )}
            </div>

            {/* BETA-OSIO: Varatut ajat katseluikkunassa */}
            {visibleBookedSlots.length > 0 && (
                <div style={{ marginBottom: '1.5rem', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                    <h5 style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarX size={12} /> Varatut ajat tällä viikolla
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {visibleBookedSlots.map((booking, i) => {
                            const bTime = new Date(booking.start_time);
                            const isAllDay = booking.start_time.includes('00:00:00'); 
                            const h = bTime.getHours();
                            const m = String(bTime.getMinutes()).padStart(2, '0');
                            
                            return (
                                <div 
                                    key={`booked-${i}`}
                                    style={{ 
                                        padding: '4px 8px', 
                                        background: '#fef2f2', 
                                        border: '1px solid #fecaca', 
                                        borderRadius: '4px', 
                                        fontSize: '0.7rem', 
                                        color: '#ef4444', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '4px',
                                        opacity: 0.8
                                    }}
                                >
                                    <Lock size={10} />
                                    {bTime.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                    {isAllDay ? ' (Poissaolo)' : ` klo ${h}:${m}`}
                                    {!isAllDay && (booking.contact_method === 'kaynti' ? <MapPin size={10} /> : <Phone size={10} />)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Ostoskori-osio */}
            {basket.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: isHC ? '#fef2f2' : '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '0.75rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: isHC ? '#dc2626' : '#334155' }}>
                            <CalendarCheck size={14} /> 
                            Valitut ajat korissa ({basket.length} kpl)
                        </h4>
                        {isHC && (
                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} /> HC-Kuorma
                            </span>
                        )}
                    </div>
                    
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                        {basket.sort((a,b) => a.time - b.time).map((item, idx) => {
                            const h = item.time.getHours();
                            const m = String(item.time.getMinutes()).padStart(2, '0');
                            const isSevere = item.label?.includes('aktivoinnista');
                            
                            return (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    background: '#f8fafc', 
                                    padding: '6px 10px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.75rem',
                                    borderLeft: item.isAnchor ? '3px solid #fbbf24' : (item.isBorrowed ? (isSevere ? '3px solid #fca5a5' : '3px solid #fdba74') : 'none')
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {item.isAnchor && <Star size={12} fill="#fbbf24" color="#d97706" />}
                                        {item.isBorrowed && (isSevere ? <AlertCircle size={12} color="#ef4444" /> : <AlertTriangle size={12} color="#f97316" />)}
                                        <strong>{item.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {h}:{m}</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button onClick={() => updateBasketMode(item.time, 'puhelu')} title="Vaihda puheluksi" style={{ border: 'none', background: item.mode === 'puhelu' ? '#e2e8f0' : 'transparent', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: item.mode === 'puhelu' ? '#0f172a' : '#94a3b8' }}><Phone size={12}/></button>
                                            <button onClick={() => updateBasketMode(item.time, 'kaynti')} title="Vaihda käynniksi" style={{ border: 'none', background: item.mode === 'kaynti' ? '#e2e8f0' : 'transparent', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: item.mode === 'kaynti' ? '#0f172a' : '#94a3b8' }}><MapPin size={12}/></button>
                                        </div>
                                        <button onClick={() => toggleSlot(item)} title="Poista korista" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <button 
                className="btn" 
                style={{ width: '100%', marginTop: '1rem', opacity: basket.length === 0 ? 0.5 : 1 }} 
                onClick={() => onBook(basket)} 
                disabled={confirmedCount > 0 || basket.length === 0}
            >
                {confirmedCount > 0 ? <><Lock size={14}/> Ajat varattu ja kirjattu</> : `Vahvista valinnat (${basket.length})`}
            </button>
        </div>
    );
};

export default BasketSlotPicker;