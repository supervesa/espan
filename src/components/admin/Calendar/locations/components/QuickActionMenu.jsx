import React from 'react';
import { Home, Building, Landmark, Lock, Train, X, Trash2, CalendarClock } from 'lucide-react';
import Button from '../../../../common/Button';

const QuickActionMenu = ({ dateStr, loc, plan, apptCount, data, actions, onClose }) => {
    
    const handleLoc = (type, name) => {
        actions.handleSetLocation(dateStr, type, name);
        onClose();
    };

    const handleJourney = () => {
        actions.handleToggleJourney(dateStr, !!plan);
        onClose();
    };

    // Muotoillaan päivämäärä kivaksi otsikoksi
    const headerDate = new Date(dateStr).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });

    return (
        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            
            {/* OTSAKKEO + ASIAKASLASKURI */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-xs fw-bold text-secondary text-capitalize">{headerDate}</span>
                    <span style={{ fontSize: '0.75rem', color: apptCount > 0 ? '#1e3a8a' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: apptCount > 0 ? '600' : 'normal' }}>
                        <CalendarClock size={12} />
                        {apptCount > 0 ? `${apptCount} asiakasvarausta` : 'Ei varauksia'}
                    </span>
                </div>
                <X size={16} style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }} onClick={onClose} />
            </div>

            {/* SIJAINTIVALINNAT */}
            <Button variant="ghost" size="sm" icon={Home} onClick={() => handleLoc('eta', 'Etätyö')} style={{ justifyContent: 'flex-start', color: loc?.location_type === 'eta' ? '#2563eb' : 'inherit' }}>Etätyö</Button>
            <Button variant="ghost" size="sm" icon={Building} onClick={() => handleLoc('lahityo', data.settings.primary_office_name || 'Toimisto')} style={{ justifyContent: 'flex-start', color: loc?.location_type === 'lahityo' && loc.location_name === data.settings.primary_office_name ? 'var(--color-primary)' : 'inherit' }}>{data.settings.primary_office_name || 'Toimisto'}</Button>
            <Button variant="ghost" size="sm" icon={Building} onClick={() => handleLoc('lahityo', data.settings.thursday_office_name || 'Kokous')} style={{ justifyContent: 'flex-start', color: loc?.location_type === 'lahityo' && loc.location_name === data.settings.thursday_office_name ? 'var(--color-primary)' : 'inherit' }}>{data.settings.thursday_office_name || 'Kokous'}</Button>
            
            {data.ledgerBalance > 0 && loc?.location_type !== 'eta_pankki' && (
                <Button variant="ghost" size="sm" icon={Landmark} onClick={() => handleLoc('eta_pankki', 'Pankki-etäpäivä')} style={{ justifyContent: 'flex-start', color: 'var(--color-success)' }}>Käytä pankkipäivä</Button>
            )}

            {/* SISÄTYÖT (Näytetään vain, jos halutaan sulkea kalenteri) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <button 
                    onClick={() => handleLoc('sisatyot_eta', 'Ei asiakasaikoja (Etä)')}
                    style={{ fontSize: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: loc?.location_type === 'sisatyot_eta' ? '#f1f5f9' : 'transparent', color: '#475569', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    <Lock size={12} style={{ marginBottom: '2px' }}/> Sisätyö (Etä)
                </button>
                <button 
                    onClick={() => handleLoc('sisatyot_lahityo', 'Ei asiakasaikoja (Toimisto)')}
                    style={{ fontSize: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: loc?.location_type === 'sisatyot_lahityo' ? '#f1f5f9' : 'transparent', color: '#475569', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    <Lock size={12} style={{ marginBottom: '2px' }}/> Sisätyö (Lähi)
                </button>
            </div>

            {loc && (
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { actions.handleRemoveLocation(dateStr); onClose(); }} style={{ justifyContent: 'flex-start', color: 'var(--color-danger)', marginTop: '4px' }}>Poista sijainti</Button>
            )}

            <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />

            {/* MATKASUUNNITELMA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="text-xs fw-bold text-secondary">Kaukoliikenne:</span>
                <Button 
                    variant={plan ? "default" : "secondary"} 
                    size="sm" 
                    icon={Train} 
                    onClick={handleJourney} 
                    style={{ 
                        justifyContent: 'center', 
                        backgroundColor: plan ? '#f3e8ff' : 'var(--color-surface)',
                        borderColor: plan ? '#c4b5fd' : 'var(--color-border)',
                        color: plan ? '#7c3aed' : 'var(--color-text-secondary)'
                    }}
                >
                    {plan ? 'Matkasuunnitelma tehty (Poista)' : 'Lisää matkasuunnitelma'}
                </Button>
                {plan && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '2px' }}>
                        Lataa liput Matkat-välilehdellä.
                    </span>
                )}
            </div>
        </div>
    );
};
export default QuickActionMenu;