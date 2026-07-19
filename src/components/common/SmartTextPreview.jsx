import React from 'react';
import { FileText, ArrowDownCircle } from 'lucide-react';

const SmartTextPreview = ({ 
    title = "Suunnitelmaluonnos", 
    text, 
    onMoveText, 
    icon: Icon = FileText,
    emptyText = "Valitse toimenpiteitä yläpuolelta muodostaaksesi luonnoksen..."
}) => {
    return (
        <div className="card-inner mb-6">
            {/* Header: Otsikko ja nappi samalla rivillä */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1rem', 
                borderBottom: '1px solid var(--color-border)', 
                paddingBottom: '1rem' 
            }}>
                <h3 className="icon-heading" style={{ marginBottom: 0 }}>
                    <Icon size={22} style={{ color: 'var(--color-primary)' }} />
                    {title}
                </h3>
                
                {text && onMoveText && (
                    <button 
                        className="btn btn--secondary" 
                        onClick={onMoveText} 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        <ArrowDownCircle size={16} />
                        Siirrä muokattavaksi
                    </button>
                )}
            </div>

            {/* Tekstiosa: Käytetään valmista admin-preview-text -luokkaa, joka korjaa rivinvaihdot ja ilman! */}
            <div className="admin-preview-text" style={{ marginTop: 0, minHeight: '120px' }}>
                {text ? text : <em style={{ color: 'var(--color-text-secondary)' }}>{emptyText}</em>}
            </div>
        </div>
    );
};

export default SmartTextPreview;