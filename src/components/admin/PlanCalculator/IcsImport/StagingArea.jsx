// --- src/components/admin/PlanCalculator/IcsImport/StagingArea.jsx ---
import React, { useState } from 'react';
import Button from '../../../common/Button';
import Badge from '../../../common/Badge';
import { Trash2, CheckCircle, CheckSquare, XCircle, BookOpen, AlertTriangle, Briefcase, PhoneCall, Save } from 'lucide-react';

const StagingArea = ({ 
    stagingStats, 
    autoQueue, 
    teachQueue, 
    manualQueue, 
    onCancel, 
    onCommit, 
    isCommitting,
    initialAutoSkips 
}) => {
    const [autoSkips, setAutoSkips] = useState(new Set(initialAutoSkips || [])); 
    const [teachConfigs, setTeachConfigs] = useState({});  
    const [manualConfigs, setManualConfigs] = useState({});

    const formatDateTime = (isoString, isAllDay) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const dateStr = d.toLocaleDateString('fi-FI');
        if (isAllDay) return `${dateStr} (Koko päivä)`;
        const timeStr = d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} klo ${timeStr}`;
    };

    const toggleAutoSkip = (uid) => {
        setAutoSkips(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const updateTeachConf = (prefix, updates) => {
        const current = teachConfigs[prefix] || { category: '', custom: '', method: '', save: false };
        setTeachConfigs(prev => ({ ...prev, [prefix]: { ...current, ...updates } }));
    };

    const updateManualConf = (id, category, method) => {
        setManualConfigs(prev => ({ ...prev, [id]: { category, method } }));
    };

    const handleConfirm = () => {
        onCommit(autoSkips, teachConfigs, manualConfigs);
    };

    return (
        <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <div className="text-sm fw-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={16}/> Piilotettu näkymättömiin:</div>
                {stagingStats.lunches > 0 && <Badge variant="default">Lounaat / Tyhjät varauskuoret ({stagingStats.lunches})</Badge>}
                {stagingStats.autoSkipped > 0 && <Badge variant="default">👻 Harmaa lista ({stagingStats.autoSkipped})</Badge>}
                {stagingStats.lunches === 0 && stagingStats.autoSkipped === 0 && <Badge variant="default" className="text-muted">Ei ohitettua sisältöä</Badge>}
            </div>

            {autoQueue.length > 0 && (
                <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={20} color="#16a34a" />
                        <h3 className="m-0 text-md fw-bold text-success">Automaattisesti tunnistetut ({autoQueue.length})</h3>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                        {autoQueue.map((ev) => {
                            const isSkipped = autoSkips.has(ev.ics_uid);
                            return (
                                <div key={ev.ics_uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed #e2e8f0', opacity: isSkipped ? 0.4 : 1 }}>
                                    <div style={{ textDecoration: isSkipped ? 'line-through' : 'none' }}>
                                        <div className="text-xs text-slate-500 font-mono mb-1">{formatDateTime(ev.start_time, ev.is_all_day)}</div>
                                        <div className="text-sm fw-semibold">{ev.summaryDisplay}</div>
                                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>➔ {ev.category} {ev.method ? `(${ev.method})` : ''} {ev.location_name ? `(${ev.location_name})` : ''}</div>
                                    </div>
                                    <Button 
                                        variant={isSkipped ? "secondary" : "danger"} 
                                        size="small" 
                                        icon={isSkipped ? CheckSquare : XCircle} 
                                        onClick={() => toggleAutoSkip(ev.ics_uid)}
                                        style={{ padding: '4px 8px' }}
                                    >
                                        {isSkipped ? 'Palauta' : 'Hylkää'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {teachQueue.length > 0 && (
                <div style={{ border: '1px solid #fef08a', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#fefce8', padding: '1rem', borderBottom: '1px solid #fef08a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={20} color="#ca8a04" />
                        <h3 className="m-0 text-md fw-bold text-warning">Opetettavat uudet sanat ({teachQueue.length} sääntöä)</h3>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p className="text-sm text-slate-700 m-0">Nämä etuliitteet ovat järjestelmälle uusia. Määritä säännöt, niin ne tallentuvat koko tiimin yhteiseen sanakirjaan!</p>
                        
                        {teachQueue.map(group => {
                            const conf = teachConfigs[group.prefix] || { category: '', custom: '', method: '', save: false };
                            const sampleDates = group.events.slice(0, 3).map(e => formatDateTime(e.start_time, e.is_all_day)).join(', ');
                            const moreCount = group.events.length > 3 ? ` ja ${group.events.length - 3} muuta` : '';

                            return (
                                <div key={group.prefix} style={{ padding: '1rem', backgroundColor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <span className="text-lg fw-bold text-primary">"{group.prefix}"</span>
                                        <span className="text-xs text-muted ml-2">({group.events.length} tapahtumaa tässä tuonnissa)</span>
                                        <div className="text-xs text-slate-500 font-mono mt-1">Koskee aikoja: {sampleDates}{moreCount}</div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label className="text-xs fw-bold">Miten tämä luokitellaan?</label>
                                            <select className="modern-select" value={conf.category} onChange={(e) => updateTeachConf(group.prefix, { category: e.target.value })}>
                                                <option value="">-- Valitse --</option>
                                                <option value="tapaaminen">Asiakastapaaminen</option>
                                                <option value="muu_tyo">Muu työ</option>
                                                <option value="sisainen_palaveri">Sisäinen palaveri</option>
                                                <option value="koulutus">Koulutus / Kehitys</option>
                                                <option value="peruttu">Peruttu (Tapahtuma peruttu)</option>
                                                <option value="noshow">No-show (Asiakas ei saapunut)</option>
                                                <option value="vapaa">✏️ Muu (Vapaa sana) ➔</option>
                                                <option disabled>──────────</option>
                                                <option value="hylatty">❌ Hylkää / Ohita (Tälle kerralle)</option>
                                                <option value="piilotettu">👻 Harmaa lista (Piilota ja ohita aina taustalla)</option>
                                            </select>
                                            {conf.category === 'vapaa' && (
                                                <input type="text" className="form-input" placeholder="Kirjoita oma kategoria..." value={conf.custom} onChange={(e) => updateTeachConf(group.prefix, { custom: e.target.value })} style={{ padding: '0.45rem', fontSize: '0.85rem' }} />
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs fw-bold">Toteutustapa</label>
                                            <select className="modern-select" value={conf.method} onChange={(e) => updateTeachConf(group.prefix, { method: e.target.value })} disabled={conf.category !== 'tapaaminen'}>
                                                <option value="">-</option>
                                                <option value="lasna">Läsnä</option>
                                                <option value="soitto">Puhelu / Etä</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input type="checkbox" checked={conf.save} onChange={(e) => updateTeachConf(group.prefix, { save: e.target.checked })} />
                                            <span style={{ color: '#0369a1', fontWeight: 'bold' }}>Tallenna tämä sääntö koko tiimin yhteiseen sanakirjaan!</span>
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 🟠 LAATIKKO 3: MANUAALINEN JONO */}
            {manualQueue.length > 0 && (
                <div style={{ border: '1px solid #fed7aa', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#ffedd5', padding: '1rem', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={20} color="#ea580c" />
                        <h3 className="m-0 text-md fw-bold" style={{ color: '#9a3412' }}>Manuaalinen ratkaisukeskus ({manualQueue.length})</h3>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                        <p className="text-sm text-slate-700 m-0 mb-2">Näistä puuttuu viivaerotin, tai ne ovat vanhoja merkintöjä. Valitse kategoria yksitellen.</p>
                        
                        {manualQueue.map(ev => {
                            const conf = manualConfigs[ev.id] || { category: '', method: '' };
                            
                            return (
                                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: conf.category === 'hylatty' ? '#f1f5f9' : '#fff' }}>
                                    <div style={{ textDecoration: conf.category === 'hylatty' ? 'line-through' : 'none', color: conf.category === 'hylatty' ? '#94a3b8' : '#0f172a' }}>
                                        <div className="text-xs text-slate-500 font-mono mb-1">{formatDateTime(ev.start_time, ev.is_all_day)}</div>
                                        <div className="text-sm fw-semibold">{ev.summaryDisplay}</div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <Button variant={conf.category === 'tapaaminen' && conf.method === 'lasna' ? 'primary' : 'secondary'} size="small" onClick={() => updateManualConf(ev.id, 'tapaaminen', 'lasna')} icon={Briefcase}>Läsnä</Button>
                                        <Button variant={conf.category === 'tapaaminen' && conf.method === 'soitto' ? 'primary' : 'secondary'} size="small" onClick={() => updateManualConf(ev.id, 'tapaaminen', 'soitto')} icon={PhoneCall}>Soitto</Button>
                                        <Button variant={conf.category === 'muu_tyo' ? 'primary' : 'secondary'} size="small" onClick={() => updateManualConf(ev.id, 'muu_tyo', null)}>Muu työ</Button>
                                        <div style={{ width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>
                                        <Button variant={conf.category === 'hylatty' ? 'danger' : 'secondary'} size="small" onClick={() => updateManualConf(ev.id, 'hylatty', null)} icon={Trash2}>Hylkää</Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VAHVISTUS-ALUE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                <div>
                    <Button variant="secondary" onClick={onCancel}>Peruuta ja tyhjennä näkymä</Button>
                </div>
                <div>
                    <Button variant="primary" icon={Save} disabled={isCommitting} onClick={handleConfirm}>
                        {isCommitting ? 'Tallennetaan...' : 'Vahvista ja tallenna valinnat'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StagingArea;