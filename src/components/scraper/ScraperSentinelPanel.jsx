import React from 'react';
import { Fingerprint, MapPin, Calendar, MessageSquare, User, Database } from 'lucide-react';
import AdminPanel from '../common/AdminPanel';

const ScraperSentinelPanel = ({ variables, isKnownCustomer, sourceFlags = {} }) => {
    if (!variables || Object.keys(variables).length === 0) return null;

    const dataRows = [
        { key: 'syntymavuosi', label: 'Syntymävuosi', icon: User, value: variables.syntymavuosi },
        { key: 'tyonhaku_alkanut', label: 'Työnhaku alkanut', icon: Calendar, value: variables.tyonhaku_alkanut },
        { key: 'kotikunta', label: 'Kotikunta', icon: MapPin, value: variables.kotikunta },
        { key: 'yhteydenottotapa', label: 'Asiointitapa', icon: MessageSquare, value: variables.yhteydenottotapa }
    ].filter(item => item.value);

    if (dataRows.length === 0) return null;

    return (
        <AdminPanel 
            title={isKnownCustomer ? "Tunnettu asiakas (Löytyi arkistosta)" : "Tunnistettu identiteetti (Tekstistä)"} 
            icon={<Fingerprint size={18} className={isKnownCustomer ? "text-success" : "text-primary"} />}
            variant="bordered"
            className="mb-4"
            style={isKnownCustomer ? { borderLeftColor: 'var(--color-success)' } : {}}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
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
                                    title="Tieto haettiin onnistuneesti tietokannasta aiemman käynnin perusteella"
                                    style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Database size={10} /> Arkistosta
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </AdminPanel>
    );
};

export default ScraperSentinelPanel;