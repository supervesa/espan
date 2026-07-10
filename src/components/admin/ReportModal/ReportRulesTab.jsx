// --- src/components/admin/ReportModal/ReportRulesTab.jsx ---
import React from 'react';
import { Sliders, AlertTriangle, BrainCircuit } from 'lucide-react';
import AdminAlert from '../../common/AdminAlert';

const ReportRulesTab = ({ rulesData }) => {
    const { rules, exceptions, locations } = rulesData;

    // 1. Sääntöjen yksinkertainen KPI
    const activeRulesCount = rules.filter(r => r.is_active).length;
    const bookedAppointments = exceptions.filter(e => !e.is_blocked).length;

    // 2. Kognitiivinen kuorma (Oletus: Mikkeli = Kaukoliikenne, muut = Paikallinen tai Kevennetty)
    // Voit tulevaisuudessa laajentaa tätä hakemalla datan suoraan `expert_ticket_receipts` keywords-taulukosta
    const raskaatSiirtymat = locations.filter(l => l.location_name && (l.location_name.includes('Mikkeli') || l.location_name.includes('Helsinki'))).length;
    const kevyetSiirtymat = locations.length - raskaatSiirtymat;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <AdminAlert type="info">
                <strong>Rakenteilla:</strong> Tämä välilehti analysoi tulevaisuudessa asiantuntijan kalenterirungon ja todellisen toteuman välistä kitkaa (esim. lähityöksi määritelty asiakasaika, joka on jouduttu sopeuttamaan etäyhteydelle sijainnin vuoksi).
            </AdminAlert>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                {/* Olemassa olevat KPI:t */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                        <Sliders size={32} color="var(--color-primary)" style={{ margin: '0 auto 1rem auto' }} />
                        <div className="stat-value-xl">{activeRulesCount}</div>
                        <div className="stat-label mt-2">Aktiivista runkosääntöä järjestelmässä</div>
                    </div>

                    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                        <AlertTriangle size={32} color="var(--color-warning)" style={{ margin: '0 auto 1rem auto' }} />
                        <div className="stat-value-xl">{bookedAppointments}</div>
                        <div className="stat-label mt-2">Varattua poikkeusta / tapaamista</div>
                    </div>
                </div>

                {/* UUSI: Kognitiivinen kuorma */}
                <div className="smart-analysis-box" style={{ margin: 0 }}>
                    <div className="smart-analysis-header" style={{ marginBottom: '1.5rem' }}>
                        <BrainCircuit size={20}/> Kognitiivinen logistiikkakuorma
                    </div>
                    
                    <div className="smart-analysis-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #cce0ff' }}>
                            <div className="smart-analysis-title" style={{ margin: 0 }}>Raskaat siirtymät (Kaukoliikenne)</div>
                            <div className="stat-value">{raskaatSiirtymat} kpl</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #cce0ff' }}>
                            <div className="smart-analysis-title" style={{ margin: 0 }}>Kevyet siirtymät (Paikallinen)</div>
                            <div className="stat-value">{kevyetSiirtymat} kpl</div>
                        </div>
                    </div>
                    
                    <div className="text-xs text-secondary font-italic mt-4" style={{ lineHeight: 1.5 }}>
                        Tieto pohjautuu paikkakuntadataan. Tulevaisuudessa tämä data kytketään suoraan kalenterirunkoihin, jolloin näemme automaattisesti, mitkä säännöt aiheuttavat eniten raskasta sahaamista kaupunkien välillä.
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReportRulesTab;