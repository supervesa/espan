import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient';
import Card from '../../../common/Card';
import { Radar, GitMerge, Palmtree, Users, CalendarDays, CheckCircle, AlertTriangle } from 'lucide-react';

// Apufunktio ISO-viikon laskemiseen
const getISOWeek = (dateString) => {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const AjanvarausPoikkeukset = ({ isBalancingEnabled, spreadWeeks, onChange }) => {
    const [loading, setLoading] = useState(true);
    
    // Raakadata poikkeuksista
    const [rawExceptions, setRawExceptions] = useState([]);

    useEffect(() => {
        const fetchRadarData = async () => {
            setLoading(true);
            try {
                // 1. Hae asiantuntija
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';

                // 2. Määritä 3 kuukauden aikaikkuna
                const today = new Date();
                const threeMonthsLater = new Date();
                threeMonthsLater.setMonth(today.getMonth() + 3);

                const startStr = today.toISOString().split('T')[0];
                const endStr = threeMonthsLater.toISOString().split('T')[0];

                // 3. Hae sijaintidata (locations)
                const { data: locationsData, error: locError } = await supabase.schema('espan')
                    .from('expert_daily_locations')
                    .select('*')
                    .eq('expert_id', currentExpertId)
                    .gte('date', startStr)
                    .lte('date', endStr);

                // 4. Hae arkipyhät (holidays)
                const { data: holidaysData, error: holError } = await supabase.schema('espan')
                    .from('national_holidays_cache')
                    .select('*')
                    .gte('date', startStr)
                    .lte('date', endStr);

                // 5. Hae seuranta-data (kapasiteetti ja erääntyvät)
                const currentYear = today.getFullYear();
                const { data: countersData, error: countError } = await supabase.schema('espan')
                    .from('v_tyottomyysturva_seuranta')
                    .select('viikko, vuosi, eraantyvat_suunnitelmat, pbi_tavoitetahti')
                    .eq('asiantuntija_id', currentExpertId)
                    .gte('vuosi', currentYear);

                if (locError) console.error("Virhe locations-haussa:", locError);
                if (holError) console.error("Virhe holidays-haussa:", holError);
                if (countError) console.error("Virhe seuranta-haussa:", countError);

                // 6. Ryhmitellään ja prosessoidaan poikkeukset
                const weekMap = {};
                
                // Käsitellään lomat ja tuuraukset
                if (locationsData) {
                    locationsData.forEach(loc => {
                        const locDate = new Date(loc.date);
                        const week = getISOWeek(loc.date);
                        const year = locDate.getFullYear();
                        const key = `${year}-${week}`;

                        if (!weekMap[key]) {
                            weekMap[key] = { week, year, isLoma: false, isTuuraus: false, holidays: [] };
                        }

                        if (loc.location_type === 'loma' || (loc.location_name && loc.location_name.includes('Loma'))) {
                            weekMap[key].isLoma = true;
                        }
                        if (loc.location_name && loc.location_name.includes('Ei asiakasaikoja')) {
                            weekMap[key].isTuuraus = true;
                        }
                    });
                }

                // Käsitellään arkipyhät
                if (holidaysData) {
                    holidaysData.forEach(hol => {
                        const holDate = new Date(hol.date);
                        const week = getISOWeek(hol.date);
                        const year = holDate.getFullYear();
                        const key = `${year}-${week}`;

                        if (!weekMap[key]) {
                            weekMap[key] = { week, year, isLoma: false, isTuuraus: false, holidays: [] };
                        }
                        
                        if (!weekMap[key].holidays.includes(hol.name)) {
                            weekMap[key].holidays.push(hol.name);
                        }
                    });
                }

                const exceptions = [];
                let idCounter = 1;

                Object.values(weekMap).forEach(w => {
                    const counter = (countersData || []).find(c => c.viikko === w.week && c.vuosi === w.year) || {};
                    const eraantyvat = parseInt(counter.eraantyvat_suunnitelmat || 0, 10);
                    const tavoiteRaw = counter.pbi_tavoitetahti ? parseFloat(counter.pbi_tavoitetahti) : 12;
                    const tavoitetahti_ympari = Math.round(tavoiteRaw);

                    // A) Luodaan oma kortti Arkipyhille
                    if (w.holidays && w.holidays.length > 0) {
                        exceptions.push({
                            id: idCounter++,
                            week: w.week,
                            year: w.year,
                            type: 'pyha',
                            title: `Arkipyhä (${w.holidays.join(', ')})`,
                            icon: CalendarDays,
                            color: 'var(--color-info-text)', 
                            eraantyvat: eraantyvat,
                            tavoitetahti_ympari: tavoitetahti_ympari
                        });
                    }

                    // B) Luodaan oma kortti Lomille ja Tuurauksille
                    if (w.isLoma || w.isTuuraus) {
                        exceptions.push({
                            id: idCounter++,
                            week: w.week,
                            year: w.year,
                            type: w.isLoma ? 'loma' : 'tuuraus',
                            title: w.isLoma ? 'Vuosiloma / Este' : 'Tuurausviikko (Ei omia asiakkaita)',
                            icon: w.isLoma ? Palmtree : Users,
                            color: w.isLoma ? 'var(--color-success)' : 'var(--color-warning)',
                            eraantyvat: eraantyvat,
                            tavoitetahti_ympari: tavoitetahti_ympari
                        });
                    }
                });

                // Järjestetään kronologisesti
                exceptions.sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week);
                setRawExceptions(exceptions);

            } catch (err) {
                console.error("Virhe tutkadatan prosessoinnissa:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRadarData();
    }, []);

    if (loading) {
        return <div className="p-4 text-center text-secondary text-sm">Skannataan kalenterin poikkeuksia (3 kk)...</div>;
    }

    return (
        <Card icon={Radar} title="Poikkeustutka (Seuraavat 3 kk)" variant="bordered">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* OSA 1: 50/50 Kuormantasauksen ohjaus */}
                <div className="side-bordered-panel" style={{ margin: 0 }}>
                    
                    <label className="custom-checkbox-row">
                        <input 
                            type="checkbox" 
                            className="modern-checkbox"
                            checked={isBalancingEnabled}
                            onChange={(e) => onChange('tasaus', e?.target?.checked ?? e)}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <GitMerge className="text-primary" size={16} />
                                <span className="text-sm fw-semibold text-primary">Automaattinen kuormantasaus poikkeusviikoilla</span>
                            </div>
                            <span className="text-xs text-secondary lh-tight mt-1">
                                Kun tutka havaitsee kalenterissasi loman tai tuurausviikon, assistentti purkaa sen aiheuttaman sumpun. Kriittiset asiakkaat (46 §) hoidetaan poikkeuksetta aina ennakkoon. Muiden erääntyvien asiakkaiden massa tasataan valintasi mukaan poikkeusta ympäröiville viikoille.
                            </span>
                        </div>
                    </label>

                    {isBalancingEnabled && (
                        <div style={{ marginTop: '1.25rem', paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="text-xs fw-semibold text-secondary">Sumpun purkaminen poikkeuksen jälkeen:</label>
                            <select 
                                className="modern-select text-sm" 
                                value={spreadWeeks} 
                                onChange={(e) => onChange('purku_viikot', parseInt(e?.target?.value ?? e))}
                                style={{ maxWidth: '450px' }}
                            >
                                <option value={1}>1 viikko ennen ja 1 viikko jälkeen (50 % / 50 %)</option>
                                <option value={2}>1 viikko ennen ja 2 viikkoa jälkeen (50 % / 25 % / 25 %)</option>
                            </select>
                        </div>
                    )}
                </div>

                <hr />

                {/* OSA 2: Tutkan Aikajana */}
                <div>
                    <label className="text-sm fw-semibold text-primary mb-3 block">Havaitut poikkeukset ja kapasiteettiennuste</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        {rawExceptions.map((exc) => {
                            const Icon = exc.icon;

                            // Erikoisnäkymä Arkipyhille (Ei laukaise kuormantasauksen keltaisia varoituksia)
                            if (exc.type === 'pyha') {
                                return (
                                    <div key={exc.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                            <div style={{ backgroundColor: 'var(--color-background)', color: exc.color, padding: '8px', borderRadius: '50%', marginBottom: '4px' }}>
                                                <Icon size={20} />
                                            </div>
                                            <span className="text-xs fw-bold text-secondary">Vko {exc.week}</span>
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <span className="text-sm fw-semibold mb-1">{exc.title}</span>
                                            <span className="text-xs text-secondary lh-tight">
                                                Viikon tavoitemäärää on madallettu automaattisesti arkipyhän vuoksi. Normaali ajanvaraus ja lykkäystoleranssit jatkuvat <strong>Ajanvaraus</strong>-sääntöjen puitteissa.
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                            
                            // Normaali näkymä Lomille ja Tuurauksille
                            const eraantyvat = exc.eraantyvat;
                            const beforeLoad = Math.ceil(eraantyvat / 2);
                            const totalAfterLoad = Math.floor(eraantyvat / 2);
                            
                            const afterLoadPerWeek = spreadWeeks === 2 ? Math.ceil(totalAfterLoad / 2) : totalAfterLoad;
                            const maxExtraLoad = Math.max(beforeLoad, afterLoadPerWeek);
                            const status = maxExtraLoad > 4 ? 'yellow' : 'green';

                            return (
                                <div key={exc.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                        <div style={{ backgroundColor: 'var(--color-background)', color: exc.color, padding: '8px', borderRadius: '50%', marginBottom: '4px' }}>
                                            <Icon size={20} />
                                        </div>
                                        <span className="text-xs fw-bold text-secondary">Vko {exc.week}</span>
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <span className="text-sm fw-semibold mb-1">{exc.title}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div className="text-xs text-secondary">
                                                <strong>Erääntyviä suunnitelmia (vko {exc.week}):</strong> {exc.eraantyvat} kpl
                                            </div>
                                            
                                            {isBalancingEnabled && status === 'green' && (
                                                <div className="panel-ai-tk mt-2" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px' }}>
                                                    <CheckCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span className="text-xs lh-tight">
                                                        <strong>Tasaus onnistuu:</strong> {beforeLoad} kpl ennakkoon (vko {exc.week - 1}) ja {totalAfterLoad} kpl puretaan {spreadWeeks} viikon aikana poikkeuksen jälkeen. Lähiviikkojen tavoitetahti ({exc.tavoitetahti_ympari}) kestää lisäyksen turvallisesti.
                                                    </span>
                                                </div>
                                            )}

                                            {isBalancingEnabled && status === 'yellow' && (
                                                <div className="alert-box alert-box--warning mt-2" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '8px', padding: '8px' }}>
                                                    <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span className="text-xs lh-tight">
                                                        <strong>Huomio ähkysuojasta:</strong> {beforeLoad} kpl siirtyy ennakkoon ja {totalAfterLoad} kpl jaetaan {spreadWeeks} viikolle poikkeuksen jälkeen. Yksittäisen viikon lisäkuorma on enimmillään {maxExtraLoad} asiakasta, mikä ylittää normaalin tavoitetahdin ({exc.tavoitetahti_ympari}). <em>Harkitse purkuajan pidentämistä ylempää, jos mahdollista.</em>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {rawExceptions.length === 0 && (
                            <div className="admin-empty-state p-4 text-sm">
                                Ei tiedossa olevia poikkeuksia (lomia, tuurauksia tai arkipyhiä) seuraavan 3 kuukauden aikana.
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </Card>
    );
};

export default AjanvarausPoikkeukset;