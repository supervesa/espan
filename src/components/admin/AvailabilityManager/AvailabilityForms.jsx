// --- src/components/admin/AvailabilityManager/AvailabilityForms.jsx ---
import React, { useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import DataTable from '../../common/DataTable';
import { Clock, Palmtree, MapPin, Phone, Plus, Trash2 } from 'lucide-react';

// Apufunktiot ja vakiot (kopioitu pääkomponentista riippuvuuksien välttämiseksi)
const meetingTypes = [
    { id: 'normi', label: 'Normaali' },
    { id: 'aktivointi', label: 'Aktivointi' },
    { id: 'taydentava', label: 'Täydentävä' }
];

const getMeetingLabel = (typeId) => meetingTypes.find(t => t.id === typeId)?.label || typeId;
const renderContactIcon = (method, size = 14) => method === 'puhelu' ? <Phone size={size} /> : <MapPin size={size} />;

const parseDBDateLocal = (dbString) => {
    if (!dbString) return { datePart: '', timeStr: '', isWholeDay: false };
    if (dbString.includes('00:00:00')) return { datePart: dbString.substring(0, 10), timeStr: '00:00', isWholeDay: true };
    const d = new Date(dbString);
    return {
        datePart: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        timeStr: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        isWholeDay: false
    };
};

const addMinutes = (timeStr, minsToAdd) => {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minsToAdd, 0);
    return date.toTimeString().substring(0, 5);
};

const timeToMins = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const AvailabilityForms = ({ expertId, rules, exceptions, fetchData }) => {
    const [saving, setSaving] = useState(false);

    const [newRule, setNewRule] = useState({ 
        day_of_week: 1, meeting_type: 'normi', start_time: '09:00', end_time: '10:00', 
        useBatch: false, duration: 60, pause: 15, valid_until: '',
        contact_method: 'kaynti'
    });
    
    const [newException, setNewException] = useState({ 
        startDate: '', time: '09:00', meeting_type: 'aktivointi', is_blocked: false,
        contact_method: 'kaynti'
    });

    const handleStartTimeChange = (val) => {
        setNewRule(prev => ({
            ...prev,
            start_time: val,
            end_time: prev.useBatch ? prev.end_time : addMinutes(val, 60)
        }));
    };

    const handleAddRule = async () => {
        if (!newRule.start_time || !newRule.end_time) return alert("Aseta ajat!");
        if (newRule.start_time >= newRule.end_time) return alert("Loppuajan pitää olla alkuajan jälkeen.");

        setSaving(true);
        try {
            const inserts = [];
            if (newRule.useBatch) {
                let currentStart = newRule.start_time;
                const endLimitMins = timeToMins(newRule.end_time);

                while (true) {
                    const currentEnd = addMinutes(currentStart, newRule.duration);
                    if (timeToMins(currentEnd) > endLimitMins) break;
                    inserts.push({
                        expert_id: expertId, day_of_week: parseInt(newRule.day_of_week),
                        meeting_type: newRule.meeting_type, start_time: currentStart + ':00',
                        end_time: currentEnd + ':00', is_active: true, valid_until: newRule.valid_until || null,
                        contact_method: newRule.contact_method
                    });
                    currentStart = addMinutes(currentEnd, newRule.pause);
                    if (timeToMins(currentStart) >= endLimitMins) break;
                }
            } else {
                inserts.push({
                    expert_id: expertId, day_of_week: parseInt(newRule.day_of_week),
                    meeting_type: newRule.meeting_type, start_time: newRule.start_time + ':00',
                    end_time: newRule.end_time + ':00', is_active: true, valid_until: newRule.valid_until || null,
                    contact_method: newRule.contact_method
                });
            }
            if (inserts.length === 0) { alert("Aikaväliin ei mahtunut yhtään tapaamista!"); setSaving(false); return; }

            const { error } = await supabase.schema('espan').from('expert_availability_rules').insert(inserts);
            if (error) throw error;
            fetchData(); // Päivittää kalenterin
        } catch (error) { console.error(error); } finally { setSaving(false); }
    };

    const handleAddSingleOrException = async () => {
        if (!newException.startDate || !newException.time) return alert("Aseta päivä ja aika!");

        setSaving(true);
        try {
            const timestamp = `${newException.startDate} ${newException.time}:00`;
            const { error } = await supabase.schema('espan').from('availability').upsert([{
                expert_id: expertId, start_time: timestamp,
                meeting_type: newException.meeting_type, is_blocked: newException.is_blocked,
                contact_method: newException.contact_method
            }], { onConflict: 'expert_id, start_time' }); 
            if (error) throw error;
            
            setNewException(prev => ({ ...prev, startDate: '' }));
            fetchData(); // Päivittää kalenterin
        } catch (error) { console.error(error); alert("Tallennus epäonnistui."); } finally { setSaving(false); }
    };

    const handleDeleteRecord = async (table, id) => {
        if (!window.confirm("Haluatko varmasti poistaa tämän merkinnän?")) return;
        try {
            await supabase.schema('espan').from(table).delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="grid-cols-2">
            <div className="flex-col-gap">
                <Card title="Toistuvat viikkosäännöt (Runkosuunnitelma)" icon={Clock} variant="bordered">
                    <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Päivä</label>
                                <select className="modern-select mt-2" value={newRule.day_of_week} onChange={e => setNewRule({...newRule, day_of_week: e.target.value})}>
                                    {['Ma', 'Ti', 'Ke', 'To', 'Pe'].map((name, i) => <option key={i} value={i+1}>{name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Tyyppi</label>
                                <select className="modern-select mt-2" value={newRule.meeting_type} onChange={e => setNewRule({...newRule, meeting_type: e.target.value})}>
                                    {meetingTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Alkaa klo</label>
                                <input type="time" className="modern-input mt-2" value={newRule.start_time} onChange={e => handleStartTimeChange(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Päättyy klo</label>
                                <input type="time" className="modern-input mt-2" value={newRule.end_time} onChange={e => setNewRule({...newRule, end_time: e.target.value})} />
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '1rem' }}>
                            <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.5rem' }}>Oletustoteutustapa säännölle</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" onClick={() => setNewRule({...newRule, contact_method: 'kaynti'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newRule.contact_method === 'kaynti' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newRule.contact_method === 'kaynti' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newRule.contact_method === 'kaynti' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><MapPin size={16} /><span className="fw-semibold text-sm">Lähitapaaminen</span></button>
                                <button type="button" onClick={() => setNewRule({...newRule, contact_method: 'puhelu'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newRule.contact_method === 'puhelu' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newRule.contact_method === 'puhelu' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newRule.contact_method === 'puhelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><Phone size={16} /><span className="fw-semibold text-sm">Puhelu/Etä</span></button>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <label className="text-sm fw-semibold text-primary">Sääntö voimassa asti (Valinnainen)</label>
                            <input type="date" className="modern-input mt-2" value={newRule.valid_until} onChange={e => setNewRule({...newRule, valid_until: e.target.value})} style={{ width: '100%' }} />
                        </div>
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-border)' }}>
                            <label className="modern-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input type="checkbox" className="modern-checkbox" checked={newRule.useBatch} onChange={e => setNewRule({...newRule, useBatch: e.target.checked})} />
                                <span className="fw-semibold">Paloittele aikaväli (Batch-eräajo 60min)</span>
                            </label>
                        </div>
                        <Button variant="primary" icon={Plus} disabled={saving} onClick={handleAddRule} fullWidth>Tallenna runkoaika</Button>
                    </div>
                    
                    {/* Vanha kunnon sääntötaulukko */}
                    <DataTable 
                        data={rules} 
                        emptyMessage="Ei asetettuja runkoaikoja."
                        columns={[
                            { label: 'Ajankohta', render: (row) => `${['Ma', 'Ti', 'Ke', 'To', 'Pe'][row.day_of_week - 1]} klo ${row.start_time.substring(0,5)} - ${row.end_time.substring(0,5)}` },
                            { label: 'Tapa', render: (row) => (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                    {renderContactIcon(row.contact_method, 14)} {row.contact_method === 'puhelu' ? 'Puhelu' : 'Käynti'}
                                </div>
                            )},
                            { label: 'Elinkaari', render: (row) => row.valid_until ? <span className="text-xs text-secondary">Asti: {row.valid_until.substring(0,10)}</span> : <span className="text-xs text-secondary">Toistaiseksi</span> },
                            { label: '', render: (row) => <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDeleteRecord('expert_availability_rules', row.id)} className="text-danger" /> }
                        ]}
                    />
                </Card>
            </div>

            <div className="flex-col-gap">
                <Card title="Yksittäiset päivät ja poikkeukset" icon={Palmtree} variant="bordered">
                    <div style={{ backgroundColor: 'var(--color-background)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Valitse päivä</label>
                                <input type="date" className="modern-input mt-2" value={newException.startDate} onChange={e => setNewException({...newException, startDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-sm fw-semibold text-primary">Aika</label>
                                <input type="time" className="modern-input mt-2" value={newException.time} onChange={e => setNewException({...newException, time: e.target.value})} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label className="text-sm fw-semibold text-primary" style={{ display: 'block', marginBottom: '0.5rem' }}>Toteutustapa poikkeukselle</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" onClick={() => setNewException({...newException, contact_method: 'kaynti'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newException.contact_method === 'kaynti' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newException.contact_method === 'kaynti' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newException.contact_method === 'kaynti' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><MapPin size={16} /><span className="fw-semibold text-sm">Lähitapaaminen</span></button>
                                <button type="button" onClick={() => setNewException({...newException, contact_method: 'puhelu'})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: newException.contact_method === 'puhelu' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: newException.contact_method === 'puhelu' ? 'rgba(255, 107, 0, 0.05)' : 'var(--color-surface)', color: newException.contact_method === 'puhelu' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}><Phone size={16} /><span className="fw-semibold text-sm">Puhelu/Etä</span></button>
                            </div>
                        </div>
                        <Button variant="primary" icon={Plus} disabled={saving} onClick={handleAddSingleOrException} fullWidth>Luo yksittäinen palveluaika</Button>
                    </div>

                    {/* Vanha kunnon poikkeustaulukko */}
                    <DataTable 
                        data={exceptions} 
                        emptyMessage="Ei erillisiä aikamerkintöjä."
                        columns={[
                            { label: 'Päivä & Klo', render: (row) => {
                                const { datePart, timeStr } = parseDBDateLocal(row.start_time);
                                const [y, m, d] = datePart.split('-');
                                return `${parseInt(d)}.${parseInt(m)}. ${timeStr === '00:00' ? '(Koko pv)' : 'klo '+timeStr}`;
                            }},
                            { label: 'Tyyppi', render: (row) => {
                                const isBooked = row.is_blocked && row.meeting_type !== 'estetty';
                                return (
                                    <Badge variant={isBooked ? 'warning' : (row.is_blocked ? 'danger' : 'success')}>
                                        {isBooked ? `VARATTU: ${getMeetingLabel(row.meeting_type)}` : (row.is_blocked ? 'LOMA/ESTO' : `Avoin: ${getMeetingLabel(row.meeting_type)}`)}
                                    </Badge>
                                );
                            }},
                            { label: 'Tapa', render: (row) => {
                                if (row.meeting_type === 'estetty') return '-';
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                        {renderContactIcon(row.contact_method, 14)} {row.contact_method === 'puhelu' ? 'Puhelu' : 'Käynti'}
                                    </div>
                                );
                            }},
                            { label: '', render: (row) => <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDeleteRecord('availability', row.id)} className="text-danger" /> }
                        ]}
                    />
                </Card>
            </div>
        </div>
    );
};

export default AvailabilityForms;