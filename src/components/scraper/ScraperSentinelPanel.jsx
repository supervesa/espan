import React from 'react';
import { Fingerprint, MapPin, Calendar, MessageSquare, User, Database, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AdminPanel from '../common/AdminPanel';

const ScraperSentinelPanel = ({ variables, isKnownCustomer, sourceFlags = {}, historia = [] }) => {
    if (!variables || Object.keys(variables).length === 0) return null;

    const dataRows = [
        { key: 'syntymavuosi', label: 'Syntymävuosi', icon: User, value: variables.syntymavuosi },
        { key: 'tyonhaku_alkanut', label: 'Työnhaku alkanut', icon: Calendar, value: variables.tyonhaku_alkanut },
        { key: 'kotikunta', label: 'Sijainti', icon: MapPin, value: variables.postinumero || variables.kotikunta },
    ].filter(item => item.value);

    // --- 6 KK LASKIN LÄHIKÄYNNILLE ---
    let deadlineText = "Ei tiedossa (Kutsu paikalle)";
    let isOverdue = true;

    // Etsitään listasta nimenomaan viimeisin KÄYNTI (KÄY), puhelut (PUH) ohitetaan!
    const lastKaynti = historia.find(h => h.tapa === 'KÄY');

    if (lastKaynti && lastKaynti.kk && lastKaynti.v) {
        // Lasketaan eräpäivä (+ 6 kuukautta)
        let nextKk = lastKaynti.kk + 6;
        let nextV = lastKaynti.v;
        
        if (nextKk > 12) {
            nextKk -= 12;
            nextV += 1;
        }

        deadlineText = `${String(nextKk).padStart(2, '0')} / ${nextV}`;

        // Tarkistetaan onko eräpäivä mennyt (Nykyinen aika: Heinäkuu 2026)
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        if (currentYear < nextV || (currentYear === nextV && currentMonth <= nextKk)) {
            isOverdue = false; // Aikaa on vielä!
        }
    }

    return (
        <AdminPanel 
            title={isKnownCustomer ? "Tunnettu asiakas (Löytyi arkistosta)" : "Tunnistettu identiteetti (Tekstistä)"} 
            icon={<Fingerprint size={18} className={isKnownCustomer ? "text-success" : "text-primary"} />}
            variant="bordered"
            className="mb-4"
            style={isKnownCustomer ? { borderLeftColor: 'var(--color-success)' } : {}}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Yläosa: Henkilötiedot */}
                <div style={{ display: 'flex', gap: '2rem' }}>
                    {dataRows.map(row => (
                        <div key={row.key} className="flex-col">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} className="mb-1">
                                <row.icon size={12} className="text-slate-500" />
                                <span className="text-xs-dense fw-medium text-slate-500 text-uppercase">
                                    {row.label}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="text-md fw-bold text-slate-700">
                                    {row.value}
                                </span>
                                {sourceFlags[row.key] === 'db' && (
                                    <span 
                                        className="tag tag--success text-xxs fw-bold" 
                                        title="Haettu arkistosta"
                                        style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Database size={10} /> Arkistosta
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Alaosa: Tapaamishistoria ja Laskin (Näytetään vain jos historiaa on) */}
                {historia.length > 0 && (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '1rem', 
                        borderTop: '1px solid var(--color-border)', 
                        paddingTop: '1rem' 
                    }}>
                        
                        {/* Vasen: Historialista */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                                <Clock size={14} className="text-slate-500" />
                                <span className="text-sm fw-semibold text-slate-700">Asiointihistoria</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {historia.map((h, idx) => (
                                    <div key={idx} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                        fontSize: '0.85rem', color: idx === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                        fontWeight: idx === 0 ? 600 : 400
                                    }}>
                                        <span style={{ 
                                            padding: '2px 6px', 
                                            borderRadius: '4px', 
                                            backgroundColor: h.tapa === 'KÄY' ? 'var(--color-primary-light)' : '#f1f5f9',
                                            color: h.tapa === 'KÄY' ? 'var(--color-primary)' : '#475569',
                                            fontSize: '0.75rem', fontWeight: 700 
                                        }}>
                                            {h.tapa === 'KÄY' ? 'KÄYNTI' : 'PUHELIN'}
                                        </span>
                                        <span>{String(h.kk).padStart(2, '0')} / {h.v}</span>
                                        {idx === 0 && <span className="text-xs text-muted ml-2">(Uusin)</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Oikea: 6 kk Laskin */}
                        <div style={{ 
                            backgroundColor: isOverdue ? '#fef2f2' : '#f0fdf4', 
                            border: `1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'}`,
                            borderRadius: '8px', 
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem' }}>
                                {isOverdue ? (
                                    <AlertTriangle size={14} color="#dc2626" />
                                ) : (
                                    <CheckCircle2 size={14} color="#16a34a" />
                                )}
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isOverdue ? '#dc2626' : '#16a34a', textTransform: 'uppercase' }}>
                                    Lähikäynnin tila (6 kk)
                                </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                                Seuraava käynti viimeistään: <strong style={{ color: isOverdue ? '#dc2626' : '#16a34a' }}>{deadlineText}</strong>
                            </div>
                            {isOverdue && (
                                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', fontWeight: 500 }}>
                                    Asiakas on kutsuttava paikan päälle!
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </AdminPanel>
    );
};

export default ScraperSentinelPanel;