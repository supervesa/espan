import React, { useMemo, useState } from 'react';
import { CalendarCheck, Lock, ChevronLeft, ChevronRight, Phone, MapPin, Trash2, AlertTriangle, CalendarX, Star, Info, AlertCircle, Clock } from 'lucide-react';

const IntelBasketSlotPicker = ({ 
    slots, basket, setBasket, onBook, isAktivointi, confirmedCount, 
    weekOffset = 0, onOffsetChange, bookedSlots = [], currentMode, onModeChange 
}) => {

    const SLOTS_LIMIT = 8;
    const [expandedDates, setExpandedDates] = useState({});

    // SUODATUS: Näytetään vain valitun moodin mukaiset ajat
    const filteredSlots = useMemo(() => {
        return slots.filter(s => s.mode === currentMode);
    }, [slots, currentMode]);

    // Ryhmitellään vapaat ajat päivämäärän mukaan
    const groupedSlots = useMemo(() => {
        const groups = {};
        filteredSlots.forEach(s => {
            const dateKey = s.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
            if (!groups[dateKey]) {
                groups[dateKey] = { dateObj: s.time, slots: [] };
            }
            groups[dateKey].slots.push(s);
        });
        return Object.entries(groups).sort(([, a], [, b]) => a.dateObj - b.dateObj);
    }, [filteredSlots]);

    // Varatut ajat
    const visibleBookedSlots = useMemo(() => {
        if (!bookedSlots || bookedSlots.length === 0) return [];
        let referenceDate = new Date();
        if (slots.length > 0) referenceDate = new Date(slots[0].time);
        else referenceDate.setDate(referenceDate.getDate() + (weekOffset * 7));

        const startOfWeek = new Date(referenceDate);
        const day = startOfWeek.getDay() || 7; 
        startOfWeek.setDate(startOfWeek.getDate() - day + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const currentWeekBookings = bookedSlots.filter(booking => {
            const bookingTime = new Date(booking.start_time);
            return bookingTime >= startOfWeek && bookingTime <= endOfWeek;
        });

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

    const hasSpecialSlots = useMemo(() => {
        return filteredSlots.some(s => s.isAnchor || s.isBorrowed);
    }, [filteredSlots]);

    const toggleSlot = (slotObj) => {
        const existingIndex = basket.findIndex(b => b.time.getTime() === slotObj.time.getTime());
        if (existingIndex >= 0) {
            setBasket(basket.filter((_, i) => i !== existingIndex));
        } else {
            setBasket([...basket, { 
                time: slotObj.time, 
                mode: slotObj.mode || currentMode,
                isAnchor: slotObj.isAnchor,
                isBorrowed: slotObj.isBorrowed,
                label: slotObj.label,
                locationName: slotObj.locationName,
                duration_minutes: slotObj.duration || 60,
                // 🟢 LISÄTTY: Viedään huonetieto mukaan ostoskoriin!
                hasRoom: slotObj.hasRoom,
                roomName: slotObj.roomName
            }]);
        }
    };

    const updateBasketMode = (time, newMode) => {
        setBasket(basket.map(b => b.time.getTime() === time.getTime() ? { ...b, mode: newMode } : b));
    };

    const toggleDateExpand = (dateKey) => {
        setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
    };

    return (
        <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            
            {/* YLÄPALKKI: Moodin ja viikon valinta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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

            {/* SELITELAATIKKO */}
            {hasSpecialSlots && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}><Info size={14} color="#64748b" /> Huomioi:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={12} fill="#fbbf24" color="#d97706" /> Vain alkuhaastatteluille</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} color="#f97316" /> Lainattu muualta (Rutiini)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} color="#ef4444" /> Lainattu muualta (Prioriteetti)</div>
                </div>
            )}

            {/* AIKALISTAUS: Päivä kerrallaan ryhmiteltynä */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {groupedSlots.length > 0 ? (
                    groupedSlots.map(([dateKey, group]) => {
                        const isExpanded = expandedDates[dateKey];
                        const displaySlots = isExpanded ? group.slots : group.slots.slice(0, SLOTS_LIMIT);
                        const hiddenCount = group.slots.length - SLOTS_LIMIT;
                        const formattedDateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);

                        return (
                            <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Päivän otsikko */}
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                    {formattedDateKey}
                                </div>
                                
                                {/* Päivän aikojen napit */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {displaySlots.map((s, i) => {
                                        const inBasket = basket.some(b => b.time.getTime() === s.time.getTime());
                                        const h = s.time.getHours();
                                        const m = String(s.time.getMinutes()).padStart(2, '0');
                                        
                                        let bg = '#fff';
                                        let borderColor = '#cbd5e1';
                                        let textColor = '#334155';
                                        let hoverBg = '#f1f5f9';
                                        const isSevere = s.label?.includes('aktivoinnista');
                                        
                                        if (inBasket) {
                                            bg = '#22c55e'; borderColor = '#16a34a'; textColor = '#fff'; hoverBg = '#16a34a';
                                        } else if (s.isAnchor) {
                                            bg = '#fffbeb'; borderColor = '#fcd34d'; textColor = '#92400e'; hoverBg = '#fef3c7';
                                        } else if (s.isBorrowed) {
                                            bg = isSevere ? '#fef2f2' : '#fff7ed';
                                            borderColor = isSevere ? '#fca5a5' : '#fdba74';
                                            textColor = isSevere ? '#b91c1c' : '#c2410c';
                                            hoverBg = isSevere ? '#fee2e2' : '#ffedd5';
                                        }

                                        return (
                                            <button 
                                                key={`slot-${i}`} 
                                                onClick={() => toggleSlot(s)}
                                                className="intel-slot-btn" 
                                                title={s.locationName ? `Lokaatio: ${s.locationName}` : "Vapaa aika"}
                                                style={{ 
                                                    padding: '6px 12px', background: bg, border: `1px solid ${borderColor}`, borderRadius: '6px', 
                                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: textColor, transition: 'all 0.15s',
                                                    display: 'flex', alignItems: 'center', gap: '6px', boxShadow: inBasket ? '0 2px 4px rgba(34,197,94,0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                                onMouseOver={(e) => !inBasket && (e.currentTarget.style.background = hoverBg)}
                                                onMouseOut={(e) => !inBasket && (e.currentTarget.style.background = bg)}
                                            >
                                                {`${h}:${m}`}
                                                {!inBasket && s.isAnchor && <Star size={12} fill="#fbbf24" color="#d97706" />}
                                                {!inBasket && s.isBorrowed && (isSevere ? <AlertCircle size={12} color="#ef4444" /> : <AlertTriangle size={12} color="#f97316" />)}
                                                {inBasket && <CalendarCheck size={12} />}
                                            </button>
                                        );
                                    })}

                                    {/* Näytä lisää / Piilota */}
                                    {hiddenCount > 0 && !isExpanded && (
                                        <button 
                                            onClick={() => toggleDateExpand(dateKey)}
                                            style={{ padding: '6px 10px', background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                                        >
                                            + {hiddenCount} lisää
                                        </button>
                                    )}
                                    {isExpanded && hiddenCount > 0 && (
                                        <button 
                                            onClick={() => toggleDateExpand(dateKey)}
                                            style={{ padding: '6px 10px', background: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Piilota
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        Ei vapaita {currentMode === 'puhelu' ? 'puheluita' : 'käyntejä'} valitulle viikolle.
                    </div>
                )}
            </div>

            {/* VANHA TUTTU BETA-OSIO: Varatut ajat */}
            {visibleBookedSlots.length > 0 && (
                <div style={{ marginBottom: '1.5rem', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                    <h5 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CalendarX size={14} /> Varatut ajat tällä viikolla
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {visibleBookedSlots.map((booking, i) => {
                            const bTime = new Date(booking.start_time);
                            const isAllDay = booking.start_time.includes('00:00:00'); 
                            const h = bTime.getHours();
                            const m = String(bTime.getMinutes()).padStart(2, '0');
                            
                            return (
                                <div 
                                    key={`booked-${i}`}
                                    style={{ 
                                        padding: '4px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', 
                                        fontSize: '0.75rem', fontWeight: 500, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8
                                    }}
                                >
                                    <Lock size={12} />
                                    {bTime.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                    {isAllDay ? ' (Poissaolo)' : ` klo ${h}:${m}`}
                                    {!isAllDay && (booking.contact_method === 'kaynti' ? <MapPin size={12} /> : <Phone size={12} />)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* OSTOSKORI */}
            {basket.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: isHC ? '#fef2f2' : '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: isHC ? '#dc2626' : '#334155' }}>
                            <CalendarCheck size={16} /> 
                            Valitut ajat korissa ({basket.length} kpl)
                        </h4>
                        {isHC && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={14} /> HC-Kuorma
                            </span>
                        )}
                    </div>
                    
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                        {basket.sort((a,b) => a.time - b.time).map((item, idx) => {
                            const h = item.time.getHours();
                            const m = String(item.time.getMinutes()).padStart(2, '0');
                            const isSevere = item.label?.includes('aktivoinnista');
                            
                            return (
                                <div key={idx} style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', 
                                    borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #e2e8f0',
                                    borderLeft: item.isAnchor ? '4px solid #fbbf24' : (item.isBorrowed ? (isSevere ? '4px solid #ef4444' : '4px solid #f97316') : '4px solid transparent')
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                                        <div style={{ marginTop: '2px' }}>
                                            {item.isAnchor && <Star size={14} fill="#fbbf24" color="#d97706" />}
                                            {item.isBorrowed && (isSevere ? <AlertCircle size={14} color="#ef4444" /> : <AlertTriangle size={14} color="#f97316" />)}
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong>{item.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {h}:{m}</strong>
                                            
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <Clock size={10} /> Varataan {item.duration_minutes || 60} min
                                            </span>

                                            {/* 🟢 TÄSSÄ ON UUSI HUONELOGIIKKA! */}
                                            {item.mode === 'kaynti' && (
                                                item.hasRoom ? (
                                                    <span style={{ fontSize: '0.7rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: 600 }}>
                                                        <MapPin size={10} /> {item.roomName}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: 600, background: '#fef3c7', padding: '2px 4px', borderRadius: '4px', border: '1px solid #fde68a', width: 'max-content' }}>
                                                        <AlertTriangle size={10} /> Muista varata tila!
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px' }}>
                                            <button 
                                                onClick={() => updateBasketMode(item.time, 'puhelu')} 
                                                title="Vaihda puheluksi" 
                                                style={{ border: 'none', background: item.mode === 'puhelu' ? '#3b82f6' : 'transparent', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: item.mode === 'puhelu' ? '#fff' : '#94a3b8' }}
                                            ><Phone size={14}/></button>
                                            <button 
                                                onClick={() => updateBasketMode(item.time, 'kaynti')} 
                                                title="Vaihda käynniksi" 
                                                style={{ border: 'none', background: item.mode === 'kaynti' ? '#3b82f6' : 'transparent', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: item.mode === 'kaynti' ? '#fff' : '#94a3b8' }}
                                            ><MapPin size={14}/></button>
                                        </div>
                                        <button onClick={() => toggleSlot(item)} title="Poista korista" style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', padding: '6px' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <button 
                className="btn" 
                style={{ width: '100%', marginTop: '1.5rem', padding: '0.8rem', fontSize: '1rem', opacity: basket.length === 0 ? 0.5 : 1 }} 
                onClick={() => onBook(basket)} 
                disabled={confirmedCount > 0 || basket.length === 0}
            >
                {confirmedCount > 0 ? <><Lock size={16}/> Ajat varattu ja kirjattu</> : `Vahvista valinnat (${basket.length})`}
            </button>
        </div>
    );
};

export default IntelBasketSlotPicker;