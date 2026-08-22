// --- src/components/sections/Tyotilanne/PalveluSalkku.jsx ---
import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, Plus, Save, Trash2, Clock, History, CheckCircle, FileText, Hash } from 'lucide-react';
import { ENTITY_DEFINITIONS } from '../../../data/entityDefinitions';

import Card from '../../common/Card';
import SmartInput from '../../common/SmartInput';
import Button from '../../common/Button';
import Badge from '../../common/Badge';
import NeutralAlert from '../../common/NeutralAlert';
import SmartTextPreview from '../../common/SmartTextPreview';
import Accordion from '../../common/Accordion';

const PalveluSalkku = ({ 
    sessionServices = [], 
    onAddService, 
    onRemoveService, 
    generatedText = "", 
    onUpdateText, 
    analyticsData = {} 
}) => {
    // Valitun palvelun tyyppi
    const [activeEntityKey, setActiveEntityKey] = useState('kuntouttava_tyotoiminta');
    // Dynaaminen data-objekti (täyttyy ENTITY_DEFINITIONS fields-määrittelyn mukaan)
    const [formData, setFormData] = useState({});
    const [pasteArea, setPasteArea] = useState('');

    // Nollataan lomake aina kun palvelun tyyppi vaihtuu
    useEffect(() => {
        setFormData({});
        setPasteArea('');
    }, [activeEntityKey]);

    // --- 1. APUFUNKTIOT ---
    const handlePasteChange = (val) => {
        setPasteArea(val);
        const match = val.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (match) {
            setFormData(prev => ({ ...prev, alku: match[1], loppu: match[2] }));
            setPasteArea(""); 
        }
    };

    const handleSave = () => {
        // Alku ja loppu ovat pakolliset tallennuksessa
        if (!formData.alku || !formData.loppu) return;
        
        onAddService({
            id: window.crypto.randomUUID(),
            entity_key: activeEntityKey,
            data: { ...formData }, // Tallennetaan kaikki dynaamiset kentät mitä asiantuntija syötti
            meta: { source: pasteArea ? 'pikasyotto' : 'manual' }
        });

        setFormData({});
    };

    const getStatusInfo = (alku, loppu) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const s = new Date(alku.split('.').reverse().join('-'));
        const e = new Date(loppu.split('.').reverse().join('-'));

        if (e < now) return { label: 'Päättynyt', variant: 'muted', icon: History };
        if (s <= now && e >= now) return { label: 'Käynnissä', variant: 'success', icon: CheckCircle };
        return { label: 'Tuleva', variant: 'primary', icon: Clock };
    };

    // Hae aktiivisen palvelun kenttävaatimukset
    const activeDef = ENTITY_DEFINITIONS[activeEntityKey];
    const availableFields = activeDef?.fields || {};

    return (
        <div className="flex-col-gap">
            
            {/* --- LISÄYSLOMAKE --- */}
            <Card title="Lisää palvelujakso" icon={Plus} variant="default">
                <NeutralAlert className="mb-4 text-sm">
                    Käytä pikasyöttöä päivämäärien liittämiseen tai täytä tiedot käsin. Vain päivämäärät ovat pakollisia.
                </NeutralAlert>

                <div className="grid-cols-2-tight mb-4">
                    {/* PALVELUN VALINTA */}
                    <select 
                        className="modern-select text-sm-dense"
                        value={activeEntityKey}
                        onChange={(e) => setActiveEntityKey(e.target.value)}
                    >
                        {Object.entries(ENTITY_DEFINITIONS)
                            .filter(([_, def]) => def.category === 'palvelu')
                            .map(([key, def]) => (
                                <option key={key} value={key}>{def.label}</option>
                        ))}
                    </select>

                    <SmartInput 
                        placeholder="Liitä pvm-väli tähän (Pikasyöttö)" 
                        value={pasteArea} 
                        onChange={(e) => handlePasteChange(e.target.value)}
                        icon={Briefcase}
                    />
                </div>

                {/* DYNAAMISET SYÖTTÖKENTÄT */}
                <div className="grid-cols-2-tight mb-4">
                    {Object.entries(availableFields).map(([fieldKey, fieldType]) => {
                        // Määritetään ikoni ja placeholder kentän nimen perusteella
                        let icon = FileText;
                        let placeholder = fieldKey;
                        
                        if (fieldType === 'date') { icon = Calendar; placeholder = fieldKey === 'alku' ? 'Alkamispäivä' : 'Päättymispäivä'; }
                        if (fieldType === 'number') { icon = Hash; placeholder = fieldKey === 'paivatViikossa' ? 'Päivää viikossa (vapaaehtoinen)' : 'Tuntia päivässä (vapaaehtoinen)'; }
                        
                        return (
                            <SmartInput 
                                key={fieldKey}
                                type={fieldType === 'date' ? 'text' : fieldType} // Date pidetään tekstinä regex-tuen vuoksi
                                placeholder={placeholder}
                                value={formData[fieldKey] || ''} 
                                onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})}
                                icon={icon}
                            />
                        );
                    })}
                </div>

                <Button onClick={handleSave} className="w-full mt-2" disabled={!formData.alku || !formData.loppu}>
                    <Save size={16} className="mr-2" /> Tallenna jakso salkkuun
                </Button>
            </Card>

            {/* --- LISTAUS TALLENNETUISTA (AIKAJANA / SALKKU) --- */}
            {sessionServices.length > 0 && (
                <Card title="Asiakkaan palvelusalkku" icon={Briefcase} variant="default">
                    <div className="flex-col-gap">
                        {sessionServices.map((srv) => {
                            const def = ENTITY_DEFINITIONS[srv.entity_key];
                            const status = getStatusInfo(srv.data.alku, srv.data.loppu);
                            const StatusIcon = status.icon;

                            return (
                                <div key={srv.id} className="card-inner-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span className="text-md fw-semibold">{def?.label}</span>
                                            <Badge variant={status.variant} icon={StatusIcon}>
                                                {status.label}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-secondary">
                                            {srv.data.alku} – {srv.data.loppu}
                                            {/* Näytetään lisätiedot jos niitä on */}
                                            {srv.data.jarjestaja && ` • ${srv.data.jarjestaja}`}
                                            {srv.data.tyonantaja && ` • ${srv.data.tyonantaja}`}
                                            {srv.data.paivatViikossa && ` • ${srv.data.paivatViikossa} pv/vko`}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => onRemoveService(srv.id)} 
                                        className="btn-icon text-danger"
                                        title="Poista"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* --- TEKSTIN ESIKATSELU JA VIENTI --- */}
            {generatedText && (
                <Accordion title="Lausuntotekstin esikatselu" defaultOpen={true}>
                    <SmartTextPreview text={generatedText} />
                    <Button onClick={() => onUpdateText(generatedText)} className="mt-4">
                        Vie teksti lausuntoon
                    </Button>
                </Accordion>
            )}

            {/* --- ANALYTIIKAN LÄPINÄKYVYYS --- */}
            <div className="p-3 mt-4" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
                <h4 className="text-xs-dense fw-bold text-slate-700 text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                    📊 Sentinel Analytiikka (Live)
                </h4>
                <div className="text-xxs font-mono text-slate-500 lh-tight grid-cols-2-tight">
                    <div>
                        <strong>Päästatus:</strong> {analyticsData.paastatus || '-'}<br/>
                        <strong>Käynnissä:</strong> {analyticsData.aktiiviset_kpl || 0} kpl<br/>
                        <strong>Tulevat:</strong> {analyticsData.tulevat_kpl || 0} kpl
                    </div>
                    <div>
                        <strong>Historia:</strong><br/>
                        - Työkokeilut: {analyticsData.historia_kpl?.tyokokeilu || 0}<br/>
                        - Palkkatuet: {analyticsData.historia_kpl?.palkkatuki || 0}<br/>
                        - Kuntouttava: {analyticsData.historia_kpl?.kuntouttava_tyotoiminta || 0}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default PalveluSalkku;