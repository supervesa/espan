import React, { useState, useEffect, useMemo } from 'react';
import { messageTemplates } from '../data/messageTemplates';


// 1. Ota 'state' vastaan propsina
function MessageGenerator({ state }) {
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [formData, setFormData] = useState({});
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [editMode, setEditMode] = useState('generated');
    const [customMessage, setCustomMessage] = useState('');
    const [addonData, setAddonData] = useState({});
    const [combinedDateTime, setCombinedDateTime] = useState('');

    // --- LISÄYS: Tilat tekoälytoiminnoille ---
    const [isRefining, setIsRefining] = useState(false); // Vanha "Paranna"-nappi
    const [aiError, setAiError] = useState('');
    
    // --- LISÄYS: Uudet tilat raakatekstille ---
    const [rawTextInput, setRawTextInput] = useState('');
    const [isGeneratingFromRaw, setIsGeneratingFromRaw] = useState(false); // Uusi "Muotoile"-nappi

    // groupedTemplates pysyy ennallaan
    const groupedTemplates = useMemo(() => {
        const categoryOrder = ['Viralliset Kutsupohjat', 'Yleiset pohjat', 'Yhteydenotot ja tavoittelu', 'Muut ilmoitukset ja ohjeet'];
        const grouped = messageTemplates.reduce((acc, template) => {
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
    }, []);

    // currentTemplate pysyy ennallaan
    const currentTemplate = useMemo(() => {
        return messageTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId]);

    // --- MUOKATTU useEffect: Esitäyttää sähköpostin ---
    useEffect(() => {
        if (currentTemplate) {
            const initialFormData = {};
            currentTemplate.fields.forEach(field => {
                initialFormData[field.id] = field.defaultValue || ''; 
            });
            
            // Yritetään esitäyttää joitain kenttiä, jos state on olemassa
            if (state && state.perustiedot) {
                if (initialFormData.hasOwnProperty('asiakkaan_nimi') && state.perustiedot.nimi) {
                     initialFormData['asiakkaan_nimi'] = state.perustiedot.nimi;
                }
                // Voit lisätä tähän muita esitäyttöjä, esim. virkailijan nimi
                 if (initialFormData.hasOwnProperty('expertName') && state.perustiedot.virkailija) {
                     initialFormData['expertName'] = state.perustiedot.virkailija;
                 }
            }
            
            setFormData(initialFormData);
            setAddonData({});
        } else {
            setFormData({});
        }
        
        // Esitäytä sähköposti state-objektista, jos löytyy
        setRecipientEmail(state?.perustiedot?.sahkoposti || '');
        
        setCopySuccess('');
        setEditMode('generated'); 
        setCombinedDateTime('');
    }, [currentTemplate, state]); // Lisätty 'state' tänne
    
    // combinedDateTime useEffect pysyy ennallaan
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

    // generatedMessage useEffect pysyy ennallaan
    useEffect(() => {
        if (!currentTemplate) {
            setGeneratedMessage('');
            return;
        }
        let message = currentTemplate.template;
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
        if (currentTemplate.addons) {
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

    // handleInputChange pysyy ennallaan
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setEditMode('generated'); 
        if (name === 'date' || name === 'time') setCombinedDateTime('');
    };

    // handleAddonChange pysyy ennallaan
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

    // handleCopy pysyy ennallaan
    const handleCopy = () => {
        const messageToCopy = editMode === 'custom' ? customMessage : generatedMessage;
        if (!messageToCopy) return;
        navigator.clipboard.writeText(messageToCopy).then(() => {
            setCopySuccess('Viesti kopioitu leikepöydälle!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };
    
    // handleClear pysyy ennallaan
    const handleClear = () => {
        if (currentTemplate) {
            const clearedFormData = {};
            currentTemplate.fields.forEach(field => {
                clearedFormData[field.id] = field.defaultValue || '';
            });
            setFormData(clearedFormData);
            setRecipientEmail(state?.perustiedot?.sahkoposti || ''); // Palauta asiakkaan sähköposti
            setAddonData({});
            setEditMode('generated');
            setCombinedDateTime('');
            setRawTextInput(''); // Tyhjennä myös raakateksti
        }
    };

    // handleMailto pysyy ennallaan
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

    // handlePreviewChange pysyy ennallaan
    const handlePreviewChange = (e) => {
        setEditMode('custom');
        setCustomMessage(e.target.value);
    };

    // handleResetToTemplate pysyy ennallaan
    const handleResetToTemplate = () => {
        setEditMode('generated');
    };

    // --- LISÄYS: Tekoälytoiminto 1 (Paranna olemassa olevaa) ---
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

    // --- LISÄYS: Tekoälytoiminto 2 (Luo raakatekstistä) ---
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
            setRawTextInput(''); // Tyhjennä kenttä onnistumisen jälkeen

        } catch (err) {
            setAiError(err.message);
        } finally {
            setIsGeneratingFromRaw(false);
        }
    };

    // renderField pysyy ennallaan
    const renderField = (field) => {
        const commonProps = {
            id: field.id,
            name: field.id,
            value: formData[field.id] || '',
            onChange: handleInputChange,
            placeholder: field.placeholder || '',
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
                    <select {...commonProps}>
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

    // hasDateTimeFields pysyy ennallaan
    const hasDateTimeFields = currentTemplate && 
                              currentTemplate.fields.some(f => f.id === 'date') && 
                              currentTemplate.fields.some(f => f.id === 'time');

    // --- TÄMÄ ON PÄIVITETTY RENDERÖINTI ---
    return (
        <div className="section-container">
            <h2>Viestigeneraattori</h2>

            {/* --- UUSI LOHKO: RAAKATEKSTI --- */}
            <div className="raakateksti-container" style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #ccc' }}>
                <h3 style={{ marginTop: 0 }}>Luo viesti muistiinpanoista</h3>
                <div className="form-row">
                    <label htmlFor="raw-text-input">Syötä raakateksti (esim. "soita huomenna 14.30, asia: työkyky")</label>
                    <textarea
                        id="raw-text-input"
                        value={rawTextInput}
                        onChange={(e) => setRawTextInput(e.target.value)}
                        rows="3"
                        placeholder="Liitä tai kirjoita muistiinpanosi tähän..."
                    />
                </div>
                <div className="button-container" style={{ justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                    <button 
                        onClick={handleAiGenerateFromRaw} 
                        disabled={isGeneratingFromRaw || !state} // Estä, jos asiakasdataa ei ole
                        className="primary-button"
                    >
                        {isGeneratingFromRaw ? 'Muotoillaan...' : 'Muotoile viestiksi (AI)'}
                    </button>
                </div>
                 {!state && <p className="error-message" style={{marginTop: '0.5rem'}}>Tekoälytoiminnot vaativat, että asiakasdata on ladattu "Suunnitelman rakennus" -välilehdellä.</p>}
            </div>
            {/* --- UUSI LOHKO PÄÄTTYY --- */}

            <h3 style={{ marginTop: 0 }}>...tai käytä viestipohjaa</h3>
            <div className="form-grid">
                <div className="form-row">
                    <label htmlFor="template-select">Valitse viestipohja</label>
                    <select id="template-select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
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
                        <label htmlFor="datetime_combined">Pikasyöttö (esim. 12.12.2025, 14.40)</label>
                        <input
                            type="text"
                            id="datetime_combined"
                            value={combinedDateTime}
                            onChange={(e) => setCombinedDateTime(e.target.value)}
                            placeholder="Liitä päivämäärä ja kellonaika tähän"
                        />
                    </div>
                )}

                {currentTemplate && currentTemplate.fields.map(field => (
                    <div className="form-row" key={field.id}>
                        <label htmlFor={field.id}>{field.label}</label>
                        {renderField(field)}
                    </div>
                ))}
                
                {formData.location === 'Muu osoite' && (
                    <div className="form-row">
                        <label htmlFor="location_custom">Muu osoite</label>
                        <input
                            type="text"
                            id="location_custom"
                            name="location_custom"
                            value={formData.location_custom || ''}
                            onChange={handleInputChange}
                            placeholder="Kirjoita koko osoite"
                        />
                    </div>
                )}
                
                {currentTemplate && currentTemplate.addons && (
                    <div className="form-row addon-section">
                        <label>Lisätiedot tapaamiseen</label>
                        <div className="addon-container">
                            {currentTemplate.addons.map(addon => (
                                <div key={addon.id} className="addon-item">
                                    <input
                                        type="checkbox"
                                        id={addon.id}
                                        name={addon.id}
                                        checked={!!addonData[addon.id]}
                                        onChange={handleAddonChange}
                                    />
                                    <label htmlFor={addon.id}>{addon.label}</label>
                                    {addon.hasInput && addonData[addon.id] && (
                                        <input
                                            type="text"
                                            name={addon.inputId}
                                            value={addonData[addon.inputId] || ''}
                                            onChange={handleAddonChange}
                                            className="addon-input"
                                            placeholder="Kirjoita tähän"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Esikatselulohko (sisältää nyt AI-napin) */}
            {(currentTemplate || editMode === 'custom') && ( // Näytä tämä, jos pohja on valittu TAI jos AI on luonut sinne tekstiä
                <div className="esikatselu-container">
                    <h3>Esikatselu</h3>
                    <div className="form-row">
                        <label htmlFor="recipient-email">Asiakkaan sähköposti (mailto-toimintoa varten)</label>
                        <input
                            type="email"
                            id="recipient-email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="esimerkki.asiakas@email.com"
                        />
                    </div>
                    
                    {editMode === 'custom' && (
                        <p className="edit-mode-notice">
                            Olet muokkaustilassa. 
                            <button onClick={handleResetToTemplate} className="link-button">
                                Palauta pohjaan
                            </button>
                        </p>
                    )}

                    <textarea 
                        value={editMode === 'generated' ? generatedMessage : customMessage} 
                        onChange={handlePreviewChange}
                        rows="12"
                    />

                    {/* --- TÄMÄ ON PÄIVITETTY NAPPIKONTTI --- */}
                    <div className="button-container">
                         <button onClick={handleCopy}>Kopioi viesti</button>
                         <button 
                            onClick={handleAiRefine} 
                            disabled={isRefining || !state || editMode === 'generated' && !currentTemplate}
                            className="primary-button"
                         >
                            {isRefining ? 'Parannellaan...' : 'Paranna (AI)'}
                         </button>
                         <button onClick={handleMailto} className="secondary-button">Avaa sähköpostissa</button>
                         <button onClick={handleClear} className="secondary-button">Tyhjennä</button>
                    </div>
                    {copySuccess && <p className="copy-success-message">{copySuccess}</p>}
                    {aiError && <p className="error-message">{aiError}</p>}
                </div>
            )}
        </div>
    );
}

export default MessageGenerator;