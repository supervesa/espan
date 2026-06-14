import React, { useMemo, useState } from 'react';
import { CalendarCheck, Lock, ChevronLeft, ChevronRight, Phone, MapPin, Trash2, AlertTriangle } from 'lucide-react';

const BasketSlotPicker = ({ slots, basket, setBasket, onBook, isAktivointi, confirmedCount, weekOffset = 0, onOffsetChange }) => {
    const [currentMode, setCurrentMode] = useState('puhelu');

    // SUODATUS: Näytetään vain valitun moodin mukaiset ajat
    const filteredSlots = useMemo(() => {
        return slots.filter(s => s.mode === currentMode);
    }, [slots, currentMode]);

    const dailyCounts = useMemo(() => {
        const counts = {};
        basket.forEach(item => {
            const dateStr = item.time.toLocaleDateString('fi-FI');
            counts[dateStr] = (counts[dateStr] || 0) + 1;
        });
        return counts;
    }, [basket]);

    const isHC = Math.max(0, ...Object.values(dailyCounts)) > 3;

    const toggleSlot = (slotObj) => {
        const existingIndex = basket.findIndex(b => b.time.getTime() === slotObj.time.getTime());
        if (existingIndex >= 0) {
            setBasket(basket.filter((_, i) => i !== existingIndex));
        } else {
            setBasket([...basket, { time: slotObj.time, mode: slotObj.mode || currentMode }]);
        }
    };

    const updateBasketMode = (time, newMode) => {
        setBasket(basket.map(b => b.time.getTime() === time.getTime() ? { ...b, mode: newMode } : b));
    };

    return (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
                    <button onClick={() => setCurrentMode('puhelu')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', background: currentMode === 'puhelu' ? '#fff' : 'transparent', color: currentMode === 'puhelu' ? '#0f172a' : '#64748b', fontWeight: currentMode === 'puhelu' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: currentMode === 'puhelu' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
                        <Phone size={14} /> Puhelu
                    </button>
                    <button onClick={() => setCurrentMode('kaynti')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', background: currentMode === 'kaynti' ? '#fff' : 'transparent', color: currentMode === 'kaynti' ? '#0f172a' : '#64748b', fontWeight: currentMode === 'kaynti' ? 'bold' : 'normal', cursor: 'pointer', boxShadow: currentMode === 'kaynti' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
                {filteredSlots.length > 0 ? (
                    filteredSlots.map((s, i) => {
                        const inBasket = basket.some(b => b.time.getTime() === s.time.getTime());
                        const h = s.time.getHours();
                        const m = String(s.time.getMinutes()).padStart(2, '0');
                        
                        return (
                            <button 
                                key={i} 
                                onClick={() => toggleSlot(s)}
                                style={{ padding: '6px 10px', background: inBasket ? '#dcfce7' : '#fff', border: `1px solid ${inBasket ? '#22c55e' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: inBasket ? '#166534' : '#334155', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {s.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {h}:{m} 
                                {s.mode === 'kaynti' ? <MapPin size={12} /> : <Phone size={12} />}
                            </button>
                        );
                    })
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei {currentMode === 'puhelu' ? 'puheluita' : 'käyntejä'} tälle viikolle.</span>
                )}
            </div>

            {/* Ostoskori-osio pysyy ennallaan */}
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
                            return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                                    <strong>{item.time.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {h}:{m}</strong>
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