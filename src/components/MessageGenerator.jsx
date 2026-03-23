import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Bot, Copy, Mail, Trash2 } from 'lucide-react';

function MessageGenerator({ state, templates }) {
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [formData, setFormData] = useState({});
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [editMode, setEditMode] = useState('generated');
    const [customMessage, setCustomMessage] = useState('');
    const [addonData, setAddonData] = useState({});
    const [combinedDateTime, setCombinedDateTime] = useState('');

    const [isRefining, setIsRefining] = useState(false);
    const [aiError, setAiError] = useState('');
    
    const [rawTextInput, setRawTextInput] = useState('');
    const [isGeneratingFromRaw, setIsGeneratingFromRaw] = useState(false);

    const groupedTemplates = useMemo(() => {
        if (!templates || templates.length === 0) return {};
        
        const categoryOrder = ['Viralliset Kutsupohjat', 'Yleiset pohjat', 'Yhteydenotot ja tavoittelu', 'Muut ilmoitukset ja ohjeet'];
        const grouped = templates.reduce((acc, template) => {
            (acc[template.category] = acc[template.category] || []).push(template);
            return acc;
        }, {});
        
        const orderedGroups = {};
        categoryOrder.forEach(category => {
            if (grouped[category]) {
                orderedGroups[category] = grouped[category];
            }
        });
        
        Object.keys(grouped).forEach(category => {
            if (!orderedGroups[category]) {
                orderedGroups[category] = grouped[category];
            }
        });

        return orderedGroups;
    }, [templates]);

    const currentTemplate = useMemo(() => {
        return templates ? templates.find(t => t.id === selectedTemplateId) : null;
    }, [selectedTemplateId, templates]);

    useEffect(() => {
        if (currentTemplate) {
            const initialFormData = {};
            if (currentTemplate.fields && Array.isArray(currentTemplate.fields)) {
                currentTemplate.fields.forEach(field => {
                    initialFormData[field.id] = field.defaultValue || ''; 
                });
            }
            
            if (state && state.perustiedot) {
                if (initialFormData.hasOwnProperty('asiakkaan_nimi') && state.perustiedot.nimi) {
                     initialFormData['asiakkaan_nimi'] = state.perustiedot.nimi;
                }
                 if (initialFormData.hasOwnProperty('expertName') && state.perustiedot.virkailija) {
                     initialFormData['expertName'] = state.perustiedot.virkailija;
                 }
            }
            
            setFormData(initialFormData);
            setAddonData({});
        } else {
            setFormData({});
        }
        
        setRecipientEmail(state?.perustiedot?.sahkoposti || '');
        setCopySuccess('');
        setEditMode('generated'); 
        setCombinedDateTime('');
    }, [currentTemplate, state]);
    
    useEffect(() => {
        if (!combinedDateTime) return;
        const match = combinedDateTime.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2})[:.](\d{2})/);
        if (match) {
            const [, day, month, year, hour, minute] = match;
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            const formattedTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, date: formattedDate, time: formattedTime }));
            setEditMode('generated');
        }
    }, [combinedDateTime]);

    useEffect(() => {
        if (!currentTemplate) {
            setGeneratedMessage('');
            return;
        }
        let message = currentTemplate.template || '';
        const dataToRender = { ...formData };
        if (dataToRender.location === 'Muu osoite') {
            dataToRender.location = dataToRender.location_custom || '';
        }
        for (const key in dataToRender) {
            let value = dataToRender[key] || `({${key}})`;
            if (key === 'date' && dataToRender[key]) {
                const [year, month, day] = dataToRender[key].split('-');
                if (year && month && day) value = `${day}.${month}.${year}`;
            }
            message = message.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        let addonsText = '';
        if (currentTemplate.addons && Array.isArray(currentTemplate.addons)) {
             const activeAddons = currentTemplate.addons
                .filter(addon => addonData[addon.id])
                .map(addon => {
                    if (addon.hasInput && addonData[addon.id]) {
                        return addon.text.replace(`{${addon.inputId}}`, addonData[addon.inputId] || '_________');
                    }
                    return addon.text;
                });
            if (activeAddons.length > 0) addonsText = activeAddons.join('\n') + '\n';
        }
        message = message.replace('{addons}', addonsText);
        setGeneratedMessage(message);
    }, [formData, currentTemplate, addonData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setEditMode('generated'); 
        if (name === 'date' || name === 'time') setCombinedDateTime('');
    };

    const handleAddonChange = (e) => {
        const { name, type, value, checked } = e.target;
        setAddonData(prev => {
            const newState = { ...prev };
            if (type === 'checkbox') {
                newState[name] = checked;
                if (!checked) {
                    const addon = currentTemplate.addons.find(a => a.id === name);
                    if (addon && addon.hasInput) newState[addon.inputId] = '';
                }
            } else {
                newState[name] = value;
            }
            return newState;
        });
        setEditMode('generated');
    };

    const handleCopy = () => {
        const messageToCopy = editMode === 'custom' ? customMessage : generatedMessage;
        if (!messageToCopy) return;
        navigator.clipboard.writeText(messageToCopy).then(() => {
            setCopySuccess('Viesti kopioitu leikepöydälle!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };
    
    const handleClear = () => {
        if (currentTemplate) {
            const clearedFormData = {};
            if (currentTemplate.fields) {
                currentTemplate.fields.forEach(field => {
                    clearedFormData[field.id] = field.defaultValue || '';
                });
            }
            setFormData(clearedFormData);
            setRecipientEmail(state?.perustiedot?.sahkoposti || '');
            setAddonData({});
            setEditMode('generated');
            setCombinedDateTime('');
            setRawTextInput('');
        }
    };

    const handleMailto = () => {
        const messageToSend = editMode === 'custom' ? customMessage : generatedMessage;
        if (!currentTemplate || !messageToSend) return;
        let subject = currentTemplate.subject || 'Viesti Helsingin työllisyyspalveluista';
        const dataToRender = { ...formData };
        if (dataToRender.location === 'Muu osoite') {
            dataToRender.location = dataToRender.location_custom || '';
        }
        for (const key in dataToRender) {
             const value = dataToRender[key] || '';
            let formattedValue = value;
            if (key === 'date' && dataToRender[key]) {
                const [year, month, day] = dataToRender[key].split('-');
                if(year && month && day) formattedValue = `${day}.${month}.${year}`;
            }
            subject = subject.replace(new RegExp(`{${key}}`, 'g'), formattedValue);
        }
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(messageToSend);
        const mailtoLink = `mailto:${recipientEmail}?subject=${encodedSubject}&body=${encodedBody}`;
        window.location.href = mailtoLink;
    };

    const handlePreviewChange = (e) => {
        setEditMode('custom');
        setCustomMessage(e.target.value);
    };

    const handleResetToTemplate = () => {
        setEditMode('generated');
    };

    const handleAiRefine = async () => {
        setIsRefining(true);
        setAiError('');
        setCopySuccess('');
        
        const baseMessage = editMode === 'generated' ? generatedMessage : customMessage;

        try {
            const response = await fetch('/.netlify/functions/generateMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseMessage: baseMessage,
                    customerState: state,
                    templateId: selectedTemplateId
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Tekoälypalvelu epäonnistui');
            }

            setCustomMessage(data.refinedMessage);
            setEditMode('custom');

        } catch (err) {
            setAiError(err.message);
        } finally {
            setIsRefining(false);
        }
    };

    const handleAiGenerateFromRaw = async () => {
        if (!rawTextInput) {
            setAiError('Raakatekstikenttä on tyhjä.');
            return;
        }
        setIsGeneratingFromRaw(true);
        setAiError('');
        setCopySuccess('');

        try {
            const response = await fetch('/.netlify/functions/formatMessageFromRaw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawText: rawTextInput,
                    customerState: state,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Tekoälyn muotoilu epäonnistui');
            }

            setCustomMessage(data.formattedMessage);
            setEditMode('custom');
            setRawTextInput('');

        } catch (err) {
            setAiError(err.message);
        } finally {
            setIsGeneratingFromRaw(false);
        }
    };

    const renderField = (field) => {
        const commonProps = {
            id: field.id,
            name: field.id,
            value: formData[field.id] || '',
            onChange: handleInputChange,
            placeholder: field.placeholder || '',
            className: 'form-input' 
        };
        const getDisplayValue = (opt) => {
            if (typeof opt === 'string' && opt.includes('Helsingin Työllisyyspalvelut,')) {
                const parts = opt.split(',');
                return parts[1] ? parts[1].trim() : opt;
            }
            return opt;
        };
        switch (field.type) {
            case 'textarea': return <textarea {...commonProps} rows="4" />;
            case 'select':
                 const options = field.id === 'location' ? [...field.options, 'Muu osoite'] : field.options;
                return (
                    /* KÄYTETÄÄN UUTTA MODERN-SELECT LUOKKAA! */
                    <select {...commonProps} className="modern-select">
                        <option value="">-- Valitse --</option>
                        {options.map(opt => <option key={opt} value={opt}>{getDisplayValue(opt)}</option>)}
                    </select>
                );
            case 'datalist':
                const listId = `${field.id}-list`;
                return (
                    <>
                        <input {...commonProps} list={listId} />
                        <datalist id={listId}>
                            {field.options.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    </>
                );
            default: return <input type={field.type} {...commonProps} />;
        }
    };

    const hasDateTimeFields = currentTemplate && currentTemplate.fields &&
                              currentTemplate.fields.some(f => f.id === 'date') && 
                              currentTemplate.fields.some(f => f.id === 'time');

    return (
        <div className="main-grid" id="osio-viestit">
            
            <main className="sections-container">
                
                <section className="section-container">
                    <h2 style={{ marginBottom: '2rem' }}>Viestigeneraattori</h2>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Käytä valmista pohjaa</h3>
                    
                    <div className="form-grid">
                        <div className="form-row">
                            <label htmlFor="template-select" style={{ fontWeight: 'bold' }}>Valitse viestipohja</label>
                            {/* KÄYTETÄÄN UUTTA MODERN-SELECT LUOKKAA TÄÄLLÄKIN! */}
                            <select id="template-select" className="modern-select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                                <option value="">-- Valitse pohja --</option>
                                {Object.entries(groupedTemplates).map(([category, templates]) => (
                                    <optgroup label={category} key={category}>
                                        {templates.map(template => (
                                            <option key={template.id} value={template.id}>{template.title}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        
                        {hasDateTimeFields && (
                            <div className="form-row">
                                <label htmlFor="datetime_combined" style={{ fontWeight: 'bold' }}>Pikasyöttö (esim. 12.12.2025, 14.40)</label>
                                <input
                                    type="text"
                                    id="datetime_combined"
                                    className="form-input"
                                    value={combinedDateTime}
                                    onChange={(e) => setCombinedDateTime(e.target.value)}
                                    placeholder="Liitä päivämäärä ja kellonaika tähän"
                                />
                            </div>
                        )}

                        {currentTemplate && currentTemplate.fields && currentTemplate.fields.map(field => (
                            <div className="form-row" key={field.id}>
                                <label htmlFor={field.id} style={{ fontWeight: 'bold' }}>{field.label}</label>
                                {renderField(field)}
                            </div>
                        ))}
                        
                        {formData.location === 'Muu osoite' && (
                            <div className="form-row">
                                <label htmlFor="location_custom" style={{ fontWeight: 'bold' }}>Muu osoite</label>
                                <input
                                    type="text"
                                    id="location_custom"
                                    name="location_custom"
                                    className="form-input"
                                    value={formData.location_custom || ''}
                                    onChange={handleInputChange}
                                    placeholder="Kirjoita koko osoite"
                                />
                            </div>
                        )}
                        
                        {/* KORJATUT UUDET ADDONIT MODERN-CHECKBOXILLA */}
                        {currentTemplate && currentTemplate.addons && currentTemplate.addons.length > 0 && (
                            <div className="form-row addon-section" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                                <label style={{ fontWeight: 'bold', marginBottom: '1rem', display: 'block' }}>Lisätiedot tapaamiseen</label>
                                <div className="addon-container">
                                    {currentTemplate.addons.map(addon => (
                                        <React.Fragment key={addon.id}>
                                            <label className="modern-checkbox-label" htmlFor={addon.id}>
                                                <input
                                                    type="checkbox"
                                                    id={addon.id}
                                                    name={addon.id}
                                                    className="modern-checkbox"
                                                    checked={!!addonData[addon.id]}
                                                    onChange={handleAddonChange}
                                                />
                                                <span>{addon.label}</span>
                                            </label>
                                            
                                            {/* Sisään animoituva alikenttä */}
                                            {addon.hasInput && addonData[addon.id] && (
                                                <div className="addon-child-container">
                                                    <input
                                                        type="text"
                                                        name={addon.inputId}
                                                        value={addonData[addon.inputId] || ''}
                                                        onChange={handleAddonChange}
                                                        className="form-input"
                                                        placeholder="Tarkenna tähän..."
                                                    />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <details className="section-container" style={{ padding: '1.25rem', marginTop: '1rem', cursor: 'pointer' }}>
                    <summary style={{ fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                        <Bot size={18} style={{ marginRight: '8px' }} /> 
                        Kokeelliset tekoälytyökalut
                    </summary>
                    <div className="raakateksti-container" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--color-border)', cursor: 'default' }}>
                        <h4 style={{ marginTop: 0 }}>Luo viesti muistiinpanoista</h4>
                        <div className="form-row">
                            <label htmlFor="raw-text-input">Syötä raakateksti (esim. "soita huomenna 14.30, asia: työkyky")</label>
                            <textarea
                                id="raw-text-input"
                                className="form-input"
                                value={rawTextInput}
                                onChange={(e) => setRawTextInput(e.target.value)}
                                rows="3"
                                placeholder="Liitä tai kirjoita muistiinpanosi tähän..."
                            />
                        </div>
                        <div className="summary-actions" style={{ marginTop: '1rem' }}>
                            <button 
                                onClick={handleAiGenerateFromRaw} 
                                disabled={isGeneratingFromRaw || !state} 
                                className="btn btn--secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Sparkles size={16} />
                                {isGeneratingFromRaw ? 'Muotoillaan...' : 'Muotoile viestiksi (AI)'}
                            </button>
                        </div>
                        {!state && <p className="feedback-text" style={{marginTop: '0.5rem', color: 'var(--color-warning)'}}>Tekoälytoiminnot vaativat, että asiakasdata on ladattu.</p>}
                    </div>
                </details>
            </main>

            <aside className="summary-sticky-container">
                <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-background)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Esikatselu</h2>
                    
                    {(currentTemplate || editMode === 'custom') ? (
                        <>
                            <div className="form-row" style={{ marginBottom: '1rem' }}>
                                <label htmlFor="recipient-email" style={{ fontWeight: 'bold' }}>Asiakkaan sähköposti</label>
                                <input
                                    type="email"
                                    id="recipient-email"
                                    className="form-input"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    placeholder="esimerkki.asiakas@email.com"
                                />
                            </div>
                            
                            {editMode === 'custom' && (
                                <div style={{ backgroundColor: 'var(--color-warning-light)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Olet muokkaustilassa.</span>
                                    <button onClick={handleResetToTemplate} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
                                        Palauta pohjaan
                                    </button>
                                </div>
                            )}

                            <textarea 
                                value={editMode === 'generated' ? generatedMessage : customMessage} 
                                onChange={handlePreviewChange}
                                className="form-input"
                                rows="16"
                                style={{ width: '100%', marginBottom: '1.5rem', fontFamily: 'inherit', resize: 'vertical' }}
                            />

                            <div className="summary-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button className="btn" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Copy size={18} /> Kopioi viesti
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn--secondary" onClick={handleMailto} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <Mail size={16} /> Avaa sähköpostissa
                                    </button>
                                    <button className="btn btn--secondary" onClick={handleClear} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <Trash2 size={16} /> Tyhjennä
                                    </button>
                                </div>
                                
                                <details style={{ marginTop: '0.5rem' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                        Haluatko parannella tekstiä tekoälyllä?
                                    </summary>
                                    <button 
                                        onClick={handleAiRefine} 
                                        disabled={isRefining || !state || (editMode === 'generated' && !currentTemplate)}
                                        className="btn btn--secondary"
                                        style={{ width: '100%', marginTop: '0.5rem', border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                    >
                                        <Sparkles size={16} />
                                        {isRefining ? 'Parannellaan...' : 'Paranna tekstiä (AI)'}
                                    </button>
                                </details>
                            </div>
                            
                            {copySuccess && <p style={{ color: 'var(--color-success)', textAlign: 'center', margin: '1rem 0 0 0', fontWeight: 'bold' }}>{copySuccess}</p>}
                            {aiError && <p style={{ color: 'var(--color-error)', textAlign: 'center', margin: '1rem 0 0 0' }}>{aiError}</p>}
                        </>
                    ) : (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', border: '2px dashed var(--color-border)', borderRadius: '8px' }}>
                            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                                Valitse viestipohja vasemmalta nähdäksesi esikatselun.
                            </p>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

export default MessageGenerator;