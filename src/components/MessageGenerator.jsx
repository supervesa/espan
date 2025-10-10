import React, { useState, useEffect, useMemo } from 'react';
import { messageTemplates } from '../data/messageTemplates';

function MessageGenerator() {
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [formData, setFormData] = useState({});
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [editMode, setEditMode] = useState('generated');
    const [customMessage, setCustomMessage] = useState('');
    const [addonData, setAddonData] = useState({});

    // Tila pikasyöttökentälle
    const [combinedDateTime, setCombinedDateTime] = useState('');

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

    const currentTemplate = useMemo(() => {
        return messageTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId]);

    useEffect(() => {
        if (currentTemplate) {
            const initialFormData = {};
            currentTemplate.fields.forEach(field => {
                initialFormData[field.id] = field.defaultValue || ''; 
            });
            setFormData(initialFormData);
            
            setAddonData({});
        } else {
            setFormData({});
        }
        setRecipientEmail('');
        setCopySuccess('');
        setEditMode('generated'); 
        setCombinedDateTime(''); // Nollataan myös pikasyöttö
    }, [currentTemplate]);
    
    // Logiikka, joka parsii pikasyöttökentän ja päivittää formDataa
    useEffect(() => {
        if (!combinedDateTime) return;

        // Yritetään poimia pvm (DD.MM.YYYY) ja aika (HH:MM tai HH.MM)
        const match = combinedDateTime.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2})[:.](\d{2})/);

        if (match) {
            const [, day, month, year, hour, minute] = match;
            
            // Muunnetaan HTML-inputeille sopivaan muotoon (YYYY-MM-DD ja HH:MM)
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            const formattedTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                time: formattedTime
            }));
            setEditMode('generated');
        }
    }, [combinedDateTime]);


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
            // Muotoillaan päivämäärä suomalaiseen muotoon vain viestiä varten
            if (key === 'date' && dataToRender[key]) {
                const [year, month, day] = dataToRender[key].split('-');
                if (year && month && day) {
                    value = `${day}.${month}.${year}`;
                }
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
            
            if (activeAddons.length > 0) {
                addonsText = activeAddons.join('\n') + '\n';
            }
        }
        message = message.replace('{addons}', addonsText);

        setGeneratedMessage(message);

    }, [formData, currentTemplate, addonData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setEditMode('generated'); 

        if (name === 'date' || name === 'time') {
            setCombinedDateTime('');
        }
    };

    const handleAddonChange = (e) => {
        const { name, type, value, checked } = e.target;
        
        setAddonData(prev => {
            const newState = { ...prev };
            if (type === 'checkbox') {
                newState[name] = checked;
                if (!checked) {
                    const addon = currentTemplate.addons.find(a => a.id === name);
                    if (addon && addon.hasInput) {
                        newState[addon.inputId] = '';
                    }
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
            currentTemplate.fields.forEach(field => {
                clearedFormData[field.id] = field.defaultValue || '';
            });
            setFormData(clearedFormData);
            setRecipientEmail('');
            setAddonData({});
            setEditMode('generated');
            setCombinedDateTime('');
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
                if(year && month && day) {
                    formattedValue = `${day}.${month}.${year}`;
                }
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
            case 'textarea':
                return <textarea {...commonProps} rows="4" />;
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
            default:
                return <input type={field.type} {...commonProps} />;
        }
    };

    const hasDateTimeFields = currentTemplate && 
                              currentTemplate.fields.some(f => f.id === 'date') && 
                              currentTemplate.fields.some(f => f.id === 'time');

    return (
        <div className="section-container">
            <h2>Viestigeneraattori</h2>
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
            {currentTemplate && (
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
                            Olet muokkaustilassa. Muutokset eivät päivity syöttökenttiin. 
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

                    <div className="button-container">
                         <button onClick={handleCopy}>Kopioi viesti</button>
                         <button onClick={handleMailto} className="secondary-button">Avaa sähköpostissa</button>
                         <button onClick={handleClear} className="secondary-button">Tyhjennä kentät</button>
                    </div>
                    {copySuccess && <p className="copy-success-message">{copySuccess}</p>}
                </div>
            )}
        </div>
    );
}

export default MessageGenerator;