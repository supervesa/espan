import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Card from '../../common/Card';
import MetricBox from '../../common/MetricBox';
import Badge from '../../common/Badge';
import { 
    Brain, 
    TrendingUp, 
    TrendingDown, 
    Target, 
    Zap, 
    Clock, 
    AlertCircle,
    ChevronRight,
    Sparkles
} from 'lucide-react';

const AiStrategicForecast = ({ asiantuntijaId }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!asiantuntijaId) return;

        const fetchLatestAnalysis = async () => {
            setLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .schema('espan')
                    .from('ai_analytics')
                    .select('*')
                    .eq('asiantuntija_id', asiantuntijaId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fetchError) throw fetchError;
                setAnalysis(data);
            } catch (err) {
                console.error('Virhe AI-analyysin haussa:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLatestAnalysis();
    }, [asiantuntijaId]);

    // Parsitaan teksti ja JSON-data toisistaan
    const processedData = useMemo(() => {
        if (!analysis || !analysis.analyysi) return null;

        const parts = analysis.analyysi.split('[FORECAST_DATA]');
        const verbalPart = parts[0].trim();
        let jsonData = analysis.metadata || {};

        // Jos AI lisäsi JSONin tekstin loppuun, yritetään parsia se jos metadata on tyhjä
        if (parts[1] && Object.keys(jsonData).length === 0) {
            try {
                jsonData = JSON.parse(parts[1].trim());
            } catch (e) {
                console.error("JSON parsimisvirhe:", e);
            }
        }

        return {
            text: verbalPart,
            forecast: jsonData
        };
    }, [analysis]);

    if (loading) return <div className="p-8 text-center text-slate-500"><Brain className="animate-pulse mx-auto mb-2" /> Lasketaan strategista ennustetta...</div>;
    if (!analysis || !processedData) return null;

    const { forecast } = processedData;

    return (
        <Card 
            title="AI-Strateginen Ennuste & Kapasiteetti" 
            icon={Brain} 
            variant="default"
            customStyle={{ borderLeft: '4px solid var(--color-ai)' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. NUMEERISET ENNUSTEET (PROJEKTIOT) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    
                    <MetricBox title="Ennuste 4vk" icon={Clock} variant="default">
                        <div className="text-2xl fw-bold font-mono">
                            {forecast.forecast_4w}%
                        </div>
                        <Badge variant={forecast.forecast_4w >= 65 ? 'success' : 'warning'} customStyle={{ marginTop: '4px' }}>
                            {forecast.forecast_4w >= 65 ? 'Tavoitteessa' : 'Vajeuhka'}
                        </Badge>
                    </MetricBox>

                    <MetricBox title="Ennuste 8vk" icon={TrendingUp} variant="default">
                        <div className="text-2xl fw-bold font-mono">
                            {forecast.forecast_8w}%
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            {forecast.forecast_8w > forecast.forecast_4w ? (
                                <TrendingUp size={16} className="text-success" />
                            ) : (
                                <TrendingDown size={16} className="text-danger" />
                            )}
                            <span className="text-xs text-slate-500">Trendi 8 viikon jaksolla</span>
                        </div>
                    </MetricBox>

                    <MetricBox title="Kapasiteetin käyttö" icon={Zap} variant="default">
                        <div className="text-2xl fw-bold font-mono">
                            {forecast.capacity_usage_percent}%
                        </div>
                        <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px', marginTop: '8px' }}>
                            <div style={{ 
                                width: `${forecast.capacity_usage_percent}%`, 
                                backgroundColor: forecast.capacity_usage_percent > 85 ? '#ef4444' : '#3b82f6',
                                height: '100%', 
                                borderRadius: '4px' 
                            }} />
                        </div>
                    </MetricBox>

                    <MetricBox title="Suositeltu kiri" icon={Target} variant="primary">
                        <div className="text-2xl fw-bold font-mono">
                            +{forecast.recommended_weekly_increase}
                        </div>
                        <div className="text-xs opacity-80">Lisäsuunnitelmaa / vk</div>
                    </MetricBox>
                </div>

                {/* 2. SANALLINEN ANALYYSI */}
                <div style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '1.5rem', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0',
                    lineHeight: '1.6'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <Sparkles size={20} className="text-ai" />
                        <h4 className="text-base fw-bold text-slate-800" style={{ margin: 0 }}>Asiantuntija-arvio & Strategia</h4>
                    </div>
                    
                    <div className="ai-analysis-content text-slate-700 text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {processedData.text}
                    </div>
                </div>

                {/* 3. ALAVALIKKO / STATUS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} />
                        Analyysi perustuu viimeisimpään kalenteri- ja seurantadataan.
                    </div>
                    <div>
                        Malli: {analysis.malli_versio || 'Qwen 2.5:14b'} • Päivitetty {new Date(analysis.created_at).toLocaleString('fi-FI')}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default AiStrategicForecast;