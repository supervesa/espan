// --- src/components/admin/PlanCalculator/PlanCalculator.jsx ---
import React, { useState } from 'react';
import { usePlanCalculator } from './usePlanCalculator';
import { useTargetCalculator } from './useTargetCalculator'; 
import ProjectionChart from './ProjectionChart';
import Card from '../../common/Card';
import MetricBox from '../../common/MetricBox';
import SmartInput from '../../common/SmartInput';
import Button from '../../common/Button';
import DataTable from '../../common/DataTable';
import Badge from '../../common/Badge';
import { Activity, Users, Target, Save, TrendingUp, TrendingDown, Clock, CheckCircle, MapPin } from 'lucide-react';

const PlanCalculator = ({ asiantuntijaId }) => {
    // Lisätty currentWeekTotal hookin vastaanottoon
    const { snapshots, loading, unreportedPlans, ageDistribution, areaDistribution, currentWeekTotal, saveSnapshot } = usePlanCalculator(asiantuntijaId);
    
    const latestSnapshot = snapshots[0] || null;
    const laskuri = useTargetCalculator(latestSnapshot, unreportedPlans);

    const [formData, setFormData] = useState({
        asiakkaat_yht: '',
        voimassa_prosentti: '',
        tavoite_prosentti: '80.0',
        huomioita: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const success = await saveSnapshot({
            asiakkaat_yht: parseInt(formData.asiakkaat_yht, 10),
            voimassa_prosentti: parseFloat(formData.voimassa_prosentti),
            tavoite_prosentti: parseFloat(formData.tavoite_prosentti),
            huomioita: formData.huomioita
        });
        
        if (success) {
            setFormData(prev => ({ ...prev, asiakkaat_yht: '', voimassa_prosentti: '', huomioita: '' }));
        }
        setIsSaving(false);
    };

    const tableColumns = [
        { 
            key: 'created_at', 
            label: 'Kirjattu', 
            render: (row) => <span className="text-sm-dense text-slate-700">{new Date(row.created_at).toLocaleDateString('fi-FI')}</span> 
        },
        { 
            key: 'voimassa_prosentti', 
            label: 'Voimassa', 
            render: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="fw-bold">{row.voimassa_prosentti} %</span>
                    {row.voimassa_prosentti >= row.tavoite_prosentti ? (
                        <Badge variant="success" icon={TrendingUp}>OK</Badge>
                    ) : (
                        <Badge variant="warning" icon={TrendingDown}>Alle</Badge>
                    )}
                </div>
            )
        },
        { 
            key: 'asiakkaat_yht', 
            label: 'Salkku', 
            render: (row) => <span className="font-mono">{row.asiakkaat_yht} hlö</span> 
        },
        { 
            key: 'espan_omat_tehdyt', 
            label: 'Espanin Delta', 
            render: (row) => (
                <span className="text-xs text-muted" title="Järjestelmässä tehdyt suunnitelmat edellisen raportin jälkeen">
                    +{row.espan_omat_tehdyt} kpl
                </span>
            )
        },
        { 
            key: 'huomioita', 
            label: 'Huomioita', 
            render: (row) => <span className="text-xs text-truncate text-slate-500" style={{ maxWidth: '150px' }}>{row.huomioita}</span> 
        }
    ];

    if (loading) return <div className="p-4 text-center text-slate-500">Ladataan Power BI -dataa...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
            
            {/* YLÄRIVI: 4 Ydinmittaria + Täysleveä Tahti-laatikko */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                
                {/* Mittari 1: Kohderyhmät */}
                <MetricBox title="Kohderyhmät (Tehdyt)" icon={Users} variant="default">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {ageDistribution?.length > 0 ? ageDistribution.map((item, index) => {
                            const maxCount = ageDistribution[0].count;
                            const widthPercent = (item.count / maxCount) * 100;
                            return (
                                <div key={item.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                        <span className={index === 0 ? "fw-bold text-slate-700" : "text-slate-500"}>{item.name}</span>
                                        <span className="text-slate-600 font-mono">{item.count} kpl</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                        <div style={{ 
                                            width: `${widthPercent}%`, 
                                            backgroundColor: index === 0 ? '#3b82f6' : '#94a3b8',
                                            height: '100%', 
                                            borderRadius: '4px',
                                            transition: 'width 0.5s ease-in-out'
                                        }} />
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-xs text-slate-500 mt-2">Ei vielä kirjattuna.</div>
                        )}
                    </div>
                </MetricBox>

                {/* UUSI MITTARI 2: Alueet */}
                <MetricBox title="Alueet (Tehdyt)" icon={MapPin} variant="default">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {areaDistribution?.length > 0 ? areaDistribution.map((item, index) => {
                            const maxCount = areaDistribution[0].count;
                            const widthPercent = (item.count / maxCount) * 100;
                            return (
                                <div key={item.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                        <span className={index === 0 ? "fw-bold text-slate-700" : "text-slate-500"}>{item.name}</span>
                                        <span className="text-slate-600 font-mono">{item.count} kpl</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                        <div style={{ 
                                            width: `${widthPercent}%`, 
                                            backgroundColor: index === 0 ? '#10b981' : '#94a3b8', // Smaragdinvihreä väriteema tähän
                                            height: '100%', 
                                            borderRadius: '4px',
                                            transition: 'width 0.5s ease-in-out'
                                        }} />
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-xs text-slate-500 mt-2">Ei vielä kirjattuna.</div>
                        )}
                    </div>
                </MetricBox>

                {/* Mittari 3: Voimassaolo */}
                <MetricBox 
                    title="Voimassaolo %" 
                    icon={Activity} 
                    variant={latestSnapshot?.voimassa_prosentti >= latestSnapshot?.tavoite_prosentti ? 'default' : 'warning'}
                >
                    <div className="text-2xl fw-bold">{latestSnapshot?.voimassa_prosentti || '0'} %</div>
                    <div className="text-sm text-slate-500 mt-1">Tavoite {latestSnapshot?.tavoite_prosentti || '80'} %</div>
                </MetricBox>

                {/* Mittari 4: Espanin Tutka */}
                <MetricBox title="Espanin tutka (Odottaa)" icon={Clock}>
                    <div className="text-2xl fw-bold font-mono text-primary">+{unreportedPlans}</div>
                    <div className="text-sm text-slate-500 mt-1">Uusia tehty (ei vielä Power BI:ssä)</div>
                    
                    {/* TÄNNE LISÄTTY VIIKON SALDO */}
                    <div className="text-sm fw-semibold text-slate-700 mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                        Koko viikon saldo: <span className="font-mono text-success text-base">{currentWeekTotal} kpl</span>
                    </div>
                </MetricBox>

                {/* TÄYSLEVEÄ: Tahti & Tavoite */}
                {laskuri && (
                    <div style={{ gridColumn: '1 / -1' }}> 
                        <MetricBox 
                            title="Tahti & Tavoite" 
                            icon={Target} 
                            variant={laskuri.tavoite.vajeKpl === 0 ? 'success' : 'default'}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '12px' }}>
                                
                                {/* Näyttö 1: Todellisuus */}
                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div className="text-base fw-bold text-slate-700" style={{ marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
                                        Koko salkun tila
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span className="text-sm text-slate-600">Salkun koko:</span>
                                        <span className="text-base fw-bold font-mono">{laskuri.todellisuus.salkku}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                                        <span className="text-sm text-slate-600">Vanhentuneet yht:</span>
                                        <span className="text-base fw-bold text-danger font-mono">{laskuri.todellisuus.vanhentuneetKpl} kpl</span>
                                    </div>
                                    <div className="text-sm text-slate-500" style={{ fontStyle: 'italic', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                        Perusvanheneminen vaatii <strong className="text-slate-700">{laskuri.todellisuus.perusVanheneminen} kpl/vk</strong> salkun paikallaan pitämiseksi.
                                    </div>
                                </div>

                                {/* Näyttö 2: Operatiivinen Tavoite */}
                                <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                    <div className="text-base fw-bold text-primary" style={{ marginBottom: '12px', borderBottom: '1px solid #bfdbfe', paddingBottom: '6px' }}>
                                        Operatiivinen Kiri (Tavoite {latestSnapshot?.tavoite_prosentti}%)
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span className="text-sm text-slate-600">Puhdas vaje:</span>
                                        <span className="text-base fw-bold text-primary font-mono">{laskuri.tavoite.vajeKpl} kpl</span>
                                    </div>
                                    
                                    {laskuri.tavoite.vajeKpl > 0 ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                                <span className="text-sm text-slate-600">Kiri {laskuri.tavoite.kurotusViikot} viikolle:</span>
                                                <span className="text-base fw-bold text-primary font-mono">+{laskuri.tavoite.kirinViikkotahti} kpl/vk</span>
                                            </div>
                                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #bfdbfe', textAlign: 'center' }}>
                                                <div className="text-sm fw-bold text-slate-600 mb-2">Suositeltu viikkokapasiteetti</div>
                                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                                    <span className="text-2xl fw-bold text-primary font-mono">{laskuri.tavoite.kokonaisViikkotahti}</span>
                                                    <span className="text-base text-primary fw-semibold">kpl / vk</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-base fw-bold text-success mt-4 text-center">
                                            Tavoite saavutettu!<br/>
                                            <span className="text-sm fw-normal text-slate-600">Pelkkä perusylläpito ({laskuri.todellisuus.perusVanheneminen} kpl/vk) riittää.</span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </MetricBox>
                    </div>
                )}
            </div>

            {/* SYÖTTÖLOMAKE */}
            <Card title="Uusi Power BI -raportti" icon={Target} variant="default">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 120px' }}>
                        <SmartInput label="Asiakasmäärä (Salkku)" type="number" mono value={formData.asiakkaat_yht} onChange={(e) => setFormData({...formData, asiakkaat_yht: e.target.value})} placeholder="Esim. 150" />
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <SmartInput label="Voimassa %" type="number" mono value={formData.voimassa_prosentti} onChange={(e) => setFormData({...formData, voimassa_prosentti: e.target.value})} placeholder="Esim. 75.5" />
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <SmartInput label="Tavoite %" type="number" mono value={formData.tavoite_prosentti} onChange={(e) => setFormData({...formData, tavoite_prosentti: e.target.value})} />
                    </div>
                    <div style={{ flex: '2 1 200px' }}>
                        <SmartInput label="Huomioita (Vapaaehtoinen)" value={formData.huomioita} onChange={(e) => setFormData({...formData, huomioita: e.target.value})} placeholder="Lomaviikko tms..." />
                    </div>
                    <div style={{ paddingBottom: '2px' }}>
                        <Button onClick={handleSave} disabled={isSaving || !formData.asiakkaat_yht || !formData.voimassa_prosentti} icon={Save} variant="primary">
                            {isSaving ? 'Tallennetaan...' : 'Tallenna'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* HISTORIA */}
            <Card title="Raporttihistoria & Espanin Delta" icon={CheckCircle}>
                <DataTable columns={tableColumns} data={snapshots} emptyMessage="Ei tallennettuja Power BI -raportteja." />
            </Card>

            {/* --- UUSI LISÄYS: TYÖTTÖMYYSTURVAN 16 VIIKON HORISONTTI --- */}
            <ProjectionChart asiantuntijaId={asiantuntijaId} />

        </div>
    );
};

export default PlanCalculator;