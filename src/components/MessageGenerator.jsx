import React, { useState, useEffect, useMemo } from 'react';
import { messageTemplates } from '../data/messageTemplates';

function MessageGenerator() {
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [formData, setFormData] = useState({});
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    const groupedTemplates = useMemo(() => {
        return messageTemplates.reduce((acc, template) => {
            (acc[template.category] = acc[template.category] || []).push(template);
            return acc;
        }, {});
    }, []);

    const currentTemplate = useMemo(() => {
        return messageTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId]);

    // --- TÄMÄ KOHTA ON KORJATTU ---
    useEffect(() => {
        if (currentTemplate) {
            const initialFormData = {};
            currentTemplate.fields.forEach(field => {
                // Nyt käytetään oletusarvoa (defaultValue), jos sellainen on määritelty
                initialFormData[field.id] = field.defaultValue || ''; 
            });
            setFormData(initialFormData);
        } else {
            setFormData({});
        }
        setCopySuccess('');
    }, [currentTemplate]);
    
    useEffect(() => {
        if (!currentTemplate) {
            setGeneratedMessage('');
            return;
        }

        let message = currentTemplate.template;
        for (const key in formData) {
            const value = formData[key] || `({${key}})`; 
            let formattedValue = value;
            if (currentTemplate.fields.find(f => f.id === key)?.type === 'date' && formData[key]) {
                const [year, month, day] = formData[key].split('-');
                formattedValue = `${day}.${month}.${year}`;
            }
            message = message.replace(new RegExp(`{${key}}`, 'g'), formattedValue);
        }
        setGeneratedMessage(message);

    }, [formData, currentTemplate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCopy = () => {
        if (!generatedMessage) return;
        navigator.clipboard.writeText(generatedMessage).then(() => {
            setCopySuccess('Viesti kopioitu leikepöydälle!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Kopiointi epäonnistui.');
        });
    };
    
    const handleClear = () => {
        if (currentTemplate) {
            const clearedFormData = {};
            currentTemplate.fields.forEach(field => {
                clearedFormData[field.id] = field.defaultValue || '';
            });
            setFormData(clearedFormData);
        }
    };

    const renderField = (field) => {
        const commonProps = {
            id: field.id,
            name: field.id,
            value: formData[field.id] || '',
            onChange: handleInputChange,
            placeholder: field.placeholder || '',
        };

        switch (field.type) {
            case 'textarea':
                return <textarea {...commonProps} rows="4" />;
            case 'select':
                return (
                    <select {...commonProps}>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                {currentTemplate && currentTemplate.fields.map(field => (
                    <div className="form-row" key={field.id}>
                        <label htmlFor={field.id}>{field.label}</label>
                        {renderField(field)}
                    </div>
                ))}
            </div>
            {currentTemplate && (
                <div className="esikatselu-container">
                    <h3>Esikatselu</h3>
                    <textarea value={generatedMessage} readOnly rows="12"></textarea>
                    <div className="button-container">
                         <button onClick={handleCopy}>Kopioi viesti</button>
                         <button onClick={handleClear} className="secondary-button">Tyhjennä kentät</button>
                    </div>
                    {copySuccess && <p className="copy-success-message">{copySuccess}</p>}
                </div>
            )}
        </div>
    );
}

export default MessageGenerator;