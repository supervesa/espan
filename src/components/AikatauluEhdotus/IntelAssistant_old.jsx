// src/components/AikatauluEhdotus/IntelAssistant.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Sparkles, Info, Calendar, MapPin, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Zap, Bot } from 'lucide-react';

// Apufunktio lokaaliin YYYY-MM-DD -muotoon (välttää aikavyöhykeheitot lokaatioiden haussa)
const getLocalDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const IntelAssistant = ({ 
    suggestion, 
    onApply,
    basket = [], 
    clientType = 'normi', 
    is46 = false, 
    needsInterpreter = false, 
    isFamiliar = false,
    expertLocations = [] // Uusi prop, jolla tarkistetaan osumat tavoitteen ja toteutuneen välillä
}) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const currentExpertId = user?.id || '85a812b3-5956-42ad-8e49-e1e673ba5f7d';
                
                const { data, error } = await supabase.schema('espan')
                    .from('settings_ajanvaraus')
                    .select('*')
                    .eq('asiantuntija_id', currentExpertId)
                    .maybeSingle();

                if (data && !error) {
                    setSettings(data);
                }
            } catch (e) {
                console.error("IntelAssistant: Virhe asetusten haussa", e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const analysis = useMemo(() => {
        if (!settings) return null;
        
        const logs = [];
        let isCompromise = false;
        
        // --- A. Kestot ja Puskurit ---
        let expectedDuration = settings.kestot_perus?.[clientType] || 45;
        let kestoSelite = `Peruskesto ${expectedDuration} min`;
        
        if (needsInterpreter) {
            expectedDuration += settings.tulkki_lisa_minuutit;
            kestoSelite += ` + Tulkki ${settings.tulkki_lisa_minuutit} min`;
            logs.push({ type: 'info', icon: <Info size={14}/>, msg: `Tulkkisuojaus aktiivinen: Aikaa pidennetty (+${settings.tulkki_lisa_minuutit} min).` });
        } else if (isFamiliar && settings.kesto_tuttu_asiakas > 0) {
            expectedDuration -= settings.kesto_tuttu_asiakas;
            kestoSelite += ` - Tuttu ${settings.kesto_tuttu_asiakas} min`;
            logs.push({ type: 'success', icon: <CheckCircle2 size={14}/>, msg: `Tuttu asiakas tunnistettu: Aikaa lyhennetty (-${settings.kesto_tuttu_asiakas} min).` });
        }

        if (settings.kirjaus_puskuri_minuutit > 0) {
            expectedDuration += settings.kirjaus_puskuri_minuutit;
            kestoSelite += ` + Puskuri ${settings.kirjaus_puskuri_minuutit} min`;
        }

        // --- B. Kalenterivalinnan tarkistus ---
        if (basket.length > 0) {
            const selectedItem = basket[0];
            const selectedTime = new Date(selectedItem.time);

            // 1. Tarkistetaan onko aika lainattu (Liedennys / Vesiputous)
            if (selectedItem.isBorrowed) {
                isCompromise = true;
                logs.push({ 
                    type: 'warning', 
                    icon: <AlertTriangle size={14}/>, 
                    msg: `Kompromissien vesiputous (Liedennys): ${selectedItem.label || 'Aika lainattu toisesta lokerosta'}.` 
                });
            }
            
            // 2. Lykkäystoleranssi & Poissaolojen tunnistus
            if (suggestion?.targetDate) {
                const tDate = new Date(suggestion.targetDate);
                tDate.setHours(0,0,0,0);
                const sDate = new Date(selectedTime);
                sDate.setHours(0,0,0,0);
                
                const diffTime = sDate.getTime() - tDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let hasAbsence = false;
                let absenceType = '';
                
                // Skannataan tavoitepäivän ja valitun päivän välissä olevat lokaatiot
                if (diffDays > 0 && expertLocations.length > 0) {
                    for (let i = 0; i <= diffDays; i++) {
                        const checkD = new Date(tDate);
                        checkD.setDate(checkD.getDate() + i);
                        const dStr = getLocalDateString(checkD);
                        
                        const loc = expertLocations.find(l => l.date === dStr && (l.location_type === 'loma' || l.location_type === 'koulutus'));
                        if (loc) {
                            hasAbsence = true;
                            absenceType = loc.location_type === 'loma' ? 'loman' : 'poissaolon';
                            break;
                        }
                    }
                }
                
                if (diffDays > settings.lykkays_toleranssi_pv) {
                    isCompromise = true;
                    if (hasAbsence) {
                        logs.push({ type: 'warning', icon: <Calendar size={14}/>, msg: `Lykkäystoleranssi (${settings.lykkays_toleranssi_pv} pv) ylitetty asiantuntijan ${absenceType} vuoksi (+${diffDays} pv tavoitteesta).` });
                    } else {
                        logs.push({ type: 'warning', icon: <AlertTriangle size={14}/>, msg: `Lykkäystoleranssi (${settings.lykkays_toleranssi_pv} pv) ylitetty ruuhkan vuoksi (+${diffDays} pv tavoitteesta).` });
                    }
                } else if (diffDays > 0) {
                    if (hasAbsence) {
                        logs.push({ type: 'success', icon: <CheckCircle2 size={14}/>, msg: `Aika löytyi toleranssin sisältä (+${diffDays} pv). ${absenceType.charAt(0).toUpperCase() + absenceType.slice(1)} kierretty onnistuneesti.` });
                    } else {
                        logs.push({ type: 'success', icon: <CheckCircle2 size={14}/>, msg: `Aika löytyi sallitun lykkäystoleranssin sisältä (+${diffDays} pv).` });
                    }
                } else {
                    logs.push({ type: 'success', icon: <CheckCircle2 size={14}/>, msg: `Optimaalinen sijoitus! Aika tismalleen tavoitepäivänä.` });
                }
            }

            // 3. Fokus-päivät (pyhat_paivat)
            const jsDay = selectedTime.getDay() || 7; 
            if (settings.pyhat_paivat?.includes(String(jsDay))) {
                if (is46) {
                    logs.push({ type: 'warning', icon: <ShieldAlert size={14}/>, msg: `46 § Vihoviimeinen hätävara: Aika sijoitettu poikkeuksellisesti suojatulle Fokus-päivälle!` });
                } else {
                    isCompromise = true;
                    logs.push({ type: 'danger', icon: <AlertTriangle size={14} color="#dc2626"/>, msg: `HUOMIO: Valitsit ajan suojatulta Fokus-päivältä vastoin Ajanvaraus-sääntöjä.` });
                }
            }
        }

        return { logs, expectedDuration, kestoSelite, isCompromise };
    }, [settings, basket, suggestion?.targetDate, clientType, is46, needsInterpreter, isFamiliar, expertLocations]);

    if (!suggestion) return null;

    if (loading) {
        return (
            <div style={{ padding: '1rem', border: '1px dashed var(--color-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={20} className="text-ai" style={{ animation: 'pulse 1.5s infinite' }} />
                <span className="text-xs text-secondary">Synkronoidaan Ajanvaraus-sääntöjä tietokannasta...</span>
            </div>
        );
    }

    const hasBasket = basket.length > 0;
    const isCompromise = hasBasket && analysis?.isCompromise;

    const getIcon = () => {
        if (hasBasket) return <Zap size={18} className={isCompromise ? 'text-warning' : 'text-ai'} />;
        switch (suggestion.priority) {
            case 1: return <Info size={16} />;
            case 2: return <Sparkles size={16} />;
            default: return <Calendar size={16} />;
        }
    };

    const formattedDate = suggestion.targetDate instanceof Date 
        ? suggestion.targetDate.toLocaleDateString('fi-FI')
        : (suggestion.targetDate ? new Date(suggestion.targetDate).toLocaleDateString('fi-FI') : null);

    return (
        <div className="smart-analysis-box" style={{ 
            margin: '0 0 1.5rem 0', 
            borderLeft: isCompromise ? '4px solid #f59e0b' : '4px solid var(--color-ai)',
            backgroundColor: isCompromise ? '#fffbeb' : 'var(--color-bg-ai)',
            padding: '12px'
        }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ 
                        color: isCompromise ? '#b45309' : 'var(--color-ai)', 
                        fontWeight: 'bold', 
                        fontSize: '0.85rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        marginBottom: '4px'
                    }}>
                        {getIcon()} 
                        {hasBasket ? 'Intel Assistant - Sääntöanalyysi' : 'Älykäs ehdotus'}
                    </div>
                    
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: '4px 0', color: '#0f172a' }}>
                        {suggestion.rule?.title}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                        <strong>Peruste:</strong> {suggestion.reason}
                    </p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                        {formattedDate && (
                            <span style={{ fontSize: '0.7rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> Kohdeviikko: {formattedDate}
                            </span>
                        )}
                        {suggestion.toimipiste && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} /> {suggestion.toimipiste}
                            </span>
                        )}
                        {suggestion.forcedMode && (
                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>
                                Pakotettu: {suggestion.forcedMode === 'kaynti' ? 'Käynti' : 'Puhelu'}
                            </span>
                        )}
                    </div>
                </div>

                {!hasBasket && onApply && (
                    <button 
                        className="btn" 
                        onClick={() => onApply(
                            suggestion.rule.id, 
                            suggestion.suggestedCount, 
                            suggestion.suggestedPeriod, 
                            suggestion.forcedMode,
                            suggestion.targetDate 
                        )}
                    >
                        Käytä
                    </button>
                )}
            </div>

            {hasBasket && analysis && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>
                            {analysis.kestoSelite}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', position: 'relative', top: '1px' }} />
                            Yhteensä: {analysis.expectedDuration} min
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '10px' }}>
                        {analysis.logs.map((log, i) => (
                            <div key={i} style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '6px',
                                fontSize: '0.75rem',
                                color: log.type === 'danger' ? '#dc2626' : (log.type === 'warning' ? '#d97706' : '#334155'),
                                fontWeight: log.type === 'danger' || log.type === 'warning' ? 'bold' : 'normal'
                            }}>
                                <div style={{ marginTop: '2px', opacity: 0.8 }}>{log.icon}</div>
                                <span style={{ lineHeight: 1.4 }}>{log.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntelAssistant;