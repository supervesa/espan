#!/bin/bash

# Luodaan hakemistot, jos niitä ei ole olemassa
mkdir -p src/components
mkdir -p src/data

# Luodaan datatiedosto viestipohjille
cat > src/data/messageTemplates.js << 'EOF'
export const messageTemplates = [
    // --- Kategoria: Ajanvaraukset ja muistutukset ---
    {
        id: 'ajanvaraus-yleinen',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Tapaamisen varaus (Yleinen)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Sinulle on varattu aika tapaamiseen {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.
Paikka: {location}
Jos esitetty aika ei sovi, ilmoitathan siitä mahdollisimman pian.
Huomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Tapaamisen tyyppi', type: 'text', placeholder: 'esim. alkuhaastatteluun' },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' },
            { id: 'location', label: 'Paikka', type: 'text', placeholder: 'Viipurinkatu 2, 00510 Helsinki' }
        ]
    },
    {
        id: 'puhelinaika-yleinen',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Puhelinajan varaus (Yleinen)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Sinulle on varattu puhelinaika {meetingType} varten {date} klo {time}. Asiantuntijana toimii {expertName}.
Asiantuntija soittaa sinulle sovittuna aikana. Olethan tavoitettavissa puhelimitse.
Huomioithan, että asioimatta jättäminen on laiminlyönti, jolla voi olla seuraamuksia työnhaun voimassaoloon.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Puhelun aihe', type: 'text', placeholder: 'esim. alkuhaastattelua' },
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ajan-siirto',
        category: 'Ajanvaraukset ja muistutukset',
        title: 'Ajan siirto',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Aiemmin sovittua aikaa {meetingType} varten on siirretty.
Uusi aika on {date} klo {time}. Asiantuntijana toimii {expertName}.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'meetingType', label: 'Tapaamisen tyyppi', type: 'text', placeholder: 'esim. työnhakukeskustelulle' },
            { id: 'date', label: 'Uusi päivämäärä', type: 'date' },
            { id: 'time', label: 'Uusi kellonaika', type: 'time' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    },

    // --- Kategoria: Yhteydenotot ja tavoittelu ---
    {
        id: 'tavoitteluyritys-syylla',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Tavoitteluyritys (Syyllä)',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Yritin tavoitella sinua puhelimitse. Asia koskee: {reason}.
Soitan sinulle uudelleen myöhemmin tai voit jättää meille yhteydenottopyynnön Työmarkkinatorilla.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'reason', label: 'Yhteydenoton syy', type: 'text', placeholder: 'työnhaun aloittamista...' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    },
    {
        id: 'ilmoitus-soitosta-syylla',
        category: 'Yhteydenotot ja tavoittelu',
        title: 'Ilmoitus tulevasta soitosta',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Tavoittelen sinua puhelimitse {date} klo {time} koskien asiaa: {reason}.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Päivämäärä', type: 'date' },
            { id: 'time', label: 'Kellonaika', type: 'time' },
            { id: 'reason', label: 'Soiton syy', type: 'text', placeholder: 'sairauslomaasi ja työnhakua' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    },

    // --- Kategoria: Muut ilmoitukset ja ohjeet ---
    {
        id: 'vastaus-yhteydenottopyyntoon',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Vastaus yhteydenottopyyntöön (Yleinen)',
        template: `Hei,
Kiitos yhteydenotostasi. {message}
Terveisin, {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'message', label: 'Viesti', type: 'textarea', placeholder: 'Olen vastaanottanut työtodistuksesi...' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    },
    {
        id: 'muistutus-suunnitelman-hyvaksyminen',
        category: 'Muut ilmoitukset ja ohjeet',
        title: 'Muistutus suunnitelman hyväksymisestä',
        template: `Tervehdys Helsingin työllisyyspalveluista!
Et ole vielä hyväksynyt työllistymissuunnitelmaasi. Hoidathan asian Työmarkkinatorin asiointipalvelussa {date} mennessä.
Terveisin {expertName}, Helsingin työllisyyspalvelut`,
        fields: [
            { id: 'date', label: 'Määräaika', type: 'date' },
            { id: 'expertName', label: 'Asiantuntija', type: 'text', placeholder: 'Vesa Nessling' }
        ]
    }
];
EOF

# Luodaan MessageGenerator-komponentti
cat > src/components/MessageGenerator.jsx << 'EOF'
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

    useEffect(() => {
        if (currentTemplate) {
            const initialFormData = {};
            currentTemplate.fields.forEach(field => {
                initialFormData[field.id] = '';
            });
            setFormData(initialFormData);
        } else {
            setFormData({});
        }
    }, [currentTemplate]);
    
    useEffect(() => {
        if (!currentTemplate) {
            setGeneratedMessage('');
            return;
        }

        let message = currentTemplate.template;
        for (const key in formData) {
            const value = formData[key] || '';
            let formattedValue = value;
            if (currentTemplate.fields.find(f => f.id === key)?.type === 'date' && value) {
                const [year, month, day] = value.split('-');
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
                clearedFormData[field.id] = '';
            });
            setFormData(clearedFormData);
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
                        {field.type === 'textarea' ? (
                             <textarea 
                                id={field.id}
                                name={field.id}
                                value={formData[field.id] || ''}
                                onChange={handleInputChange}
                                placeholder={field.placeholder || ''}
                                rows="3"
                            />
                        ) : (
                            <input
                                type={field.type}
                                id={field.id}
                                name={field.id}
                                value={formData[field.id] || ''}
                                onChange={handleInputChange}
                                placeholder={field.placeholder || ''}
                            />
                        )}
                    </div>
                ))}
            </div>
            {currentTemplate && (
                <div className="esikatselu-container">
                    <h3>Esikatselu</h3>
                    <textarea value={generatedMessage} readOnly rows="10"></textarea>
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
EOF

echo "Tiedostot luotu onnistuneesti!"
echo "Lisää seuraavaksi <MessageGenerator /> App.jsx-tiedostoosi."
