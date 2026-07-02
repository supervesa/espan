import React from 'react';
import { ShieldCheck, AlertTriangle, TrendingDown, Clock, Zap, Tag } from 'lucide-react';

const AIInsightsPanel = ({ metadata }) => {
    if (!metadata) return null;

    const { confidenceScore, leadTimeHours, smartTags, anomalyInfo, priceTrend } = metadata;
    
    // Määritetään luottamustason värit
    const isHighConfidence = confidenceScore >= 90;
    const isMediumConfidence = confidenceScore >= 70 && confidenceScore < 90;
    
    const confidenceColor = isHighConfidence ? 'var(--color-success)' : (isMediumConfidence ? '#eab308' : 'var(--color-danger)');
    const ConfidenceIcon = isHighConfidence ? ShieldCheck : AlertTriangle;

    return (
        <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)', borderRadius: '8px', padding: '1.25rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#4f46e5' }}>
                <Zap size={18} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>Tekoälyn analyysi</h4>
            </div>

            {anomalyInfo && (
                <div style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '0.75rem', marginBottom: '1rem', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <AlertTriangle size={16} color="#d97706" style={{ marginTop: '2px' }} />
                        <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#92400e', display: 'block' }}>Poikkeamahälytys</span>
                            <span style={{ fontSize: '0.8rem', color: '#b45309' }}>{anomalyInfo}</span>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Datan luotettavuus:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: confidenceColor, fontWeight: '700' }}>
                        <ConfidenceIcon size={14} />
                        {confidenceScore}%
                    </div>
                </div>

                {priceTrend && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Hintatrendi (3kk):</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: priceTrend < 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '700' }}>
                            <TrendingDown size={14} style={{ transform: priceTrend > 0 ? 'rotate(180deg)' : 'none' }} />
                            {priceTrend > 0 ? '+' : ''}{priceTrend}%
                        </div>
                    </div>
                )}

                {leadTimeHours && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Ostoennakko:</span>
                        <span style={{ fontWeight: '600', color: leadTimeHours < 48 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {Math.floor(leadTimeHours / 24)} vrk {leadTimeHours % 24} h
                        </span>
                    </div>
                )}
            </div>

            {smartTags && smartTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                    {smartTags.map((tag, idx) => (
                        <span key={idx} style={{ backgroundColor: '#fff', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Tag size={10} /> {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIInsightsPanel;