// src/components/AikatauluEhdotus/SlotPicker.jsx
import React from 'react';
import { CalendarCheck, Lock, ChevronLeft, ChevronRight } from 'lucide-react';

const SlotPicker = ({ slots, onBook, isAktivointi, confirmedCount, onOffsetChange, weekOffset }) => {
    return (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarCheck size={16} color="var(--color-primary)" /> 
                    {isAktivointi ? 'Aktivointijakson ehdotus' : 'Vapaat ajat'}
                </h4>
                
                {/* VIIKKONAVIGAATIO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '2px 8px', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                    <button 
                        onClick={() => onOffsetChange(-1)} 
                        disabled={weekOffset <= 0}
                        style={{ border: 'none', background: 'none', cursor: weekOffset <= 0 ? 'default' : 'pointer', opacity: weekOffset <= 0 ? 0.3 : 1, display: 'flex' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', minWidth: '60px', textAlign: 'center' }}>
                        {weekOffset === 0 ? 'Tämä viikko' : `+ ${weekOffset} vko`}
                    </span>
                    <button 
                        onClick={() => onOffsetChange(1)} 
                        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {slots.length > 0 ? (
                    slots.map((s, i) => (
                        <div key={i} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {s.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {s.getHours()}:00
                        </div>
                    ))
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Ei vapaita aikoja tällä viikolla.</span>
                )}
            </div>

            <button 
                className="btn" 
                style={{ width: '100%', marginTop: '1rem' }} 
                onClick={() => onBook(slots)} 
                disabled={confirmedCount > 0 || slots.length === 0}
            >
                {confirmedCount > 0 ? <><Lock size={14}/> Ajat varattu ja kirjattu</> : 'Varaa nämä ajat'}
            </button>
        </div>
    );
};

export default SlotPicker;