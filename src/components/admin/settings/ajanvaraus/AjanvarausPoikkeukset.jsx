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

// UUSI LISÄYS: Otetaan propsit vastaan yläkomponentilta
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

                // 4. Hae seuranta-data (kapasiteetti ja erääntyvät)
                const currentYear = today.getFullYear();
                const { data: countersData, error: countError } = await supabase.schema('espan')
                    .from('v_tyottomyysturva_seuranta')
                    .select('viikko, vuosi, eraantyvat_suunnitelmat, pbi_tavoitetahti')
                    .eq('asiantuntija_id', currentExpertId)
                    .gte('vuosi', currentYear);

                if (locError) console.error("Virhe locations-haussa:", locError);
                if (countError) console.error("Virhe seuranta-haussa:", countError);

                // 5. Ryhmitellään ja prosessoidaan poikkeukset
                const weekMap = {};
                if (locationsData) {
                    locationsData.forEach(loc => {
                        const locDate = new Date(loc.date);
                        const week = getISOWeek(loc.date);
                        const year = locDate.getFullYear();
                        const key = `${year}-${week}`;

                        if (!weekMap[key]) {
                            weekMap[key] = { week, year, isLoma: false, isTuuraus: false };
                        }

                        if (loc.location_type === 'loma' || (loc.location_name && loc.location_name.includes('Loma'))) {
                            weekMap[key].isLoma = true;
                        }
                        if (loc.location_name && loc.location_name.includes('Ei asiakasaikoja')) {
                            weekMap[key].isTuuraus = true;
                        }
                    });
                }

                const exceptions = [];
                let idCounter = 1;

                Object.values(weekMap).forEach(w => {
                    if (w.isLoma || w.isTuuraus) {
                        const counter = (countersData || []).find(c => c.viikko === w.week && c.vuosi === w.year) || {};
                        const eraantyvat = parseInt(counter.eraantyvat_suunnitelmat || 0, 10);
                        const tavoiteRaw = counter.pbi_tavoitetahti ? parseFloat(counter.pbi_tavoitetahti) : 12;
                        
                        exceptions.push({
                            id: idCounter++,
                            week: w.week,
                            year: w.year,
                            type: w.isLoma ? 'loma' : 'tuuraus',
                            title: w.isLoma ? 'Vuosiloma / Este' : 'Tuurausviikko (Ei omia asiakkaita)',
                            icon: w.isLoma ? Palmtree : Users,
                            color: w.isLoma ? '#10b981' : '#f59e0b',
                            eraantyvat: eraantyvat,
                            tavoitetahti_ympari: Math.round(tavoiteRaw)
                        });
                    }
                });

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
        return <div className="p-4 text-center text-secondary">Skannataan kalenterin poikkeuksia (3 kk)...</div>;
    }

    return (
        <Card icon={Radar} title="Poikkeustutka (Seuraavat 3 kk)" variant="bordered">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* OSA 1: 50/50 Kuormantasauksen ohjaus (käyttää nyt yläkomponentin funktiota) */}
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    
                    {/* Pääkytkin */}
                    <label className="modern-checkbox-label" style={{ marginBottom: 0 }}>
                        <input 
                            type="checkbox" 
                            className="modern-checkbox"
                            checked={isBalancingEnabled}
                            onChange={(e) => onChange('tasaus', e?.target?.checked ?? e)}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <GitMerge className="text-primary" size={16} />
                                <span className="fw-semibold text-primary text-sm">Automaattinen kuormantasaus poikkeusviikoilla</span>
                            </div>
                            <span className="text-xs text-secondary lh-tight mt-1">
                                Kun tutka havaitsee kalenterissasi loman tai tuurausviikon, assistentti purkaa sen aiheuttaman sumpun. Kriittiset asiakkaat (46 §) hoidetaan poikkeuksetta aina ennakkoon. Muiden erääntyvien asiakkaiden massa tasataan valintasi mukaan poikkeusta ympäröiville viikoille.
                            </span>
                        </div>
                    </label>

                    {/* Alavalinta, auki vain jos pääkytkin on päällä */}
                    {isBalancingEnabled && (
                        <div style={{ marginTop: '1.25rem', paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="text-xs fw-semibold text-secondary">Sumpun purkaminen poikkeuksen jälkeen:</label>
                            <select 
                                className="modern-select text-sm" 
                                value={spreadWeeks} 
                                onChange={(e) => onChange('purku_viikot', parseInt(e?.target?.value ?? e))}
                                style={{ maxWidth: '450px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            >
                                <option value={1}>1 viikko ennen ja 1 viikko jälkeen (50 % / 50 %)</option>
                                <option value={2}>1 viikko ennen ja 2 viikkoa jälkeen (50 % / 25 % / 25 %)</option>
                            </select>
                        </div>
                    )}
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

                {/* OSA 2: Tutkan Aikajana dynaamisella laskennalla */}
                <div>
                    <label className="text-sm fw-semibold text-primary mb-3 block">Havaitut poikkeukset ja kapasiteettiennuste</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        {rawExceptions.map((exc) => {
                            const Icon = exc.icon;
                            
                            // Dynaaminen matematiikka valitun purkuajan perusteella
                            const eraantyvat = exc.eraantyvat;
                            const beforeLoad = Math.ceil(eraantyvat / 2); // Puolet aina viikolle ennen
                            const totalAfterLoad = Math.floor(eraantyvat / 2); // Loput purkuun
                            
                            // Paljonko kuormaa per viikko purkuaikana?
                            const afterLoadPerWeek = spreadWeeks === 2 ? Math.ceil(totalAfterLoad / 2) : totalAfterLoad;
                            
                            // Suurin yksittäisen viikon lisäkuorma määrittää liikennevalon värin
                            const maxExtraLoad = Math.max(beforeLoad, afterLoadPerWeek);
                            const status = maxExtraLoad > 4 ? 'yellow' : 'green';

                            return (
                                <div key={exc.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }}>
                                    
                                    {/* Viikko ja Ikonit */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                        <div style={{ backgroundColor: `${exc.color}15`, color: exc.color, padding: '8px', borderRadius: '50%', marginBottom: '4px' }}>
                                            <Icon size={20} />
                                        </div>
                                        <span className="text-xs fw-bold text-secondary">Vko {exc.week}</span>
                                    </div>

                                    {/* Data ja Logiikka */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <span className="fw-semibold text-sm mb-1">{exc.title}</span>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div className="text-xs text-secondary">
                                                <strong>Erääntyviä suunnitelmia (vko {exc.week}):</strong> {exc.eraantyvat} kpl
                                            </div>
                                            
                                            {isBalancingEnabled && status === 'green' && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#059669', backgroundColor: '#ecfdf5', padding: '6px 8px', borderRadius: '4px', marginTop: '4px' }}>
                                                    <CheckCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span className="text-xs lh-tight">
                                                        <strong>Tasaus onnistuu:</strong> {beforeLoad} kpl ennakkoon (vko {exc.week - 1}) ja {totalAfterLoad} kpl puretaan {spreadWeeks} viikon aikana poikkeuksen jälkeen. Lähiviikkojen tavoitetahti ({exc.tavoitetahti_ympari}) kestää lisäyksen turvallisesti.
                                                    </span>
                                                </div>
                                            )}

                                            {isBalancingEnabled && status === 'yellow' && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#d97706', backgroundColor: '#fffbeb', padding: '6px 8px', borderRadius: '4px', marginTop: '4px' }}>
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
                            <div className="text-center p-4 text-sm text-secondary" style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                Ei tiedossa olevia poikkeuksia (lomia tai tuurauksia) seuraavan 3 kuukauden aikana.
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </Card>
    );
};

export default AjanvarausPoikkeukset;