import React, { useState } from 'react';
import { importPlanData, importMessageTemplates, importKnowledgeBase } from './adminSupabaseService';

const ImportPanel = () => {
    const [importType, setImportType] = useState('planData');
    const [jsonInput, setJsonInput] = useState('');
    const [logs, setLogs] = useState([]);
    const [isImporting, setIsImporting] = useState(false);

    const handleLog = (msg) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const handleImport = async () => {
        if (!jsonInput.trim()) {
            handleLog("Virhe: Tekstikenttä on tyhjä.");
            return;
        }

        setIsImporting(true);
        setLogs([]); // Tyhjennetään vanhat lokit
        handleLog(`Käynnistetään tuonti tyypille: ${importType}`);

        if (importType === 'planData') {
            await importPlanData(jsonInput, handleLog);
        } else {
            handleLog("Tätä tuontityyppiä ei ole vielä ohjelmoitu.");
        }

        setIsImporting(false);
        setJsonInput('');

        if (importType === 'planData') {
            await importPlanData(jsonInput, handleLog);
        } else if (importType === 'messageTemplates') {
            await importMessageTemplates(jsonInput, handleLog);
        } else {
            handleLog("Tätä tuontityyppiä ei ole vielä ohjelmoitu.");
        }
        
        if (importType === 'planData') {
            await importPlanData(jsonInput, handleLog);
        } else if (importType === 'messageTemplates') {
            await importMessageTemplates(jsonInput, handleLog);
        } else if (importType === 'knowledgeBase') {
            await importKnowledgeBase(jsonInput, handleLog);
        } else {
            handleLog("Tätä tuontityyppiä ei ole vielä ohjelmoitu.");
        }
    };
    

    return (
        <section className="section-container">
            <h2 className="section-title">Massatuonti (JSON)</h2>
            <p style={{ marginBottom: '1rem' }}>
                Kopioi vanhan JavaScript-tiedoston (esim. planData.js) sisältämä data puhtaana JSON-objektina ja liitä se alle.
            </p>

            <div style={{ marginBottom: '1rem' }}>
                <select 
                    value={importType} 
                    onChange={(e) => setImportType(e.target.value)}
                    style={{ maxWidth: '300px' }}
                >
                    <option value="planData">PlanData (Osiot ja Fraasit)</option>
                    <option value="messageTemplates">Viestipohjat (messageTemplates.js)</option>
                    <option value="knowledgeBase">Tietopankki (guide.js & infoSnippets.js)</option>
                </select>
            </div>

            <div className="paste-area-container">
                <textarea
                    className="paste-area-textarea"
                    rows="12"
                    placeholder='{"aihealueet": [ { "otsikko": "...", "fraasit": [...] } ]}'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    disabled={isImporting}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
            </div>
            
            <button 
                onClick={handleImport} 
                className="btn" 
                disabled={isImporting || !jsonInput.trim()}
            >
                {isImporting ? 'Tuodaan tietokantaan...' : 'Suorita tuonti Supabaseen'}
            </button>

            {logs.length > 0 && (
                <div className="info-box" style={{ marginTop: '2rem', maxHeight: '300px', overflowY: 'auto' }}>
                    <h4 style={{ marginTop: 0 }}>Tuonnin loki</h4>
                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                        {logs.map((log, index) => (
                            <li key={index} style={{ marginBottom: '4px', color: log.includes('Virhe') ? 'var(--color-danger)' : 'inherit' }}>
                                {log}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default ImportPanel;