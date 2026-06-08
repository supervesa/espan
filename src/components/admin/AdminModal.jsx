import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { fetchPhraseRules, addPhraseRule, deletePhraseRule, deleteAdminItem } from './adminSupabaseService';

const AdminModal = ({ item, sections, onClose, onSaveComplete }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    
    // TALLENNUKSEN ILMOITUS JA SULKEMINEN
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Fraasin tilat
    const [shortTitle, setShortTitle] = useState('');
    const [phraseKey, setPhraseKey] = useState('');
    const [baseText, setBaseText] = useState('');
    const [priority, setPriority] = useState(0);
    const [detectedVars, setDetectedVars] = useState([]);

    // --- UUSI: REGEX SÄÄNTÖMOOTTORIN TILAT ---
    const [triggerWordsInput, setTriggerWordsInput] = useState('');
    const [generatedRegex, setGeneratedRegex] = useState('');

    // Viestin tilat
    const [msgTitle, setMsgTitle] = useState('');
    const [msgSubject, setMsgSubject] = useState('');

    // --- BUSINESS RULES TILAT ---
    const [rules, setRules] = useState([]);
    const [isAddingRule, setIsAddingRule] = useState(false);
    
    const [ruleType, setRuleType] = useState('recommendation'); 
    const [ruleSection, setRuleSection] = useState('');
    const [ruleOperator, setRuleOperator] = useState('contains'); 
    const [rulePhrase, setRulePhrase] = useState('');

    // 1. Alustetaan tiedot kun modaali aukeaa
    useEffect(() => {
        if (item.type === 'phrase') {
            setShortTitle(item.data.short_title || '');
            setPhraseKey(item.data.phrase_key || '');
            setBaseText(item.data.base_text || '');
            setPriority(item.data.priority_score || 0);
            
            // --- REGEX ALUSTUS ---
            if (item.data.extraction_pattern) {
                // Puretaan kanta-Regex (sana1|sana2) pilkulla erotetuksi listaksi
                let cleaned = item.data.extraction_pattern.replace(/^\(/, '').replace(/\)$/, '');
                setTriggerWordsInput(cleaned.split('|').join(', '));
            } else {
                // Automaattinen ehdotus, jos kanta on tyhjä
                const suggestion = item.data.short_title 
                    ? item.data.short_title.toLowerCase() 
                    : item.data.phrase_key.replace(/[-_]/g, ' ');
                setTriggerWordsInput(suggestion);
            }

            fetchPhraseRules(item.data.id).then(setRules);
        } else if (item.type === 'message') {
            setMsgTitle(item.data.title || '');
            setMsgSubject(item.data.subject || '');
            setBaseText(item.data.template_body || ''); 
        } else if (item.type === 'knowledge') {
            setShortTitle(item.data.title || '');
            setBaseText(item.data.content_text || '');
        }
    }, [item]);

    // 2. Reaaliaikainen Regexin generointi käyttäjän kirjoittaessa
    useEffect(() => {
        if (item.type !== 'phrase') return;

        if (!triggerWordsInput.trim()) {
            setGeneratedRegex('');
            return;
        }
        
        // Pilkotaan, siivotaan ja muunnetaan takaisin Regex-ryhmäksi (sana1|sana2)
        const wordsArray = triggerWordsInput
            .split(',')
            .map(word => word.trim())
            .filter(word => word.length > 0);
            
        if (wordsArray.length > 0) {
            setGeneratedRegex(`(${wordsArray.join('|')})`);
        } else {
            setGeneratedRegex('');
        }
    }, [triggerWordsInput, item.type]);

    // 3. Etsitään muuttujia tekstistä
    useEffect(() => {
        if (item.type === 'phrase') {
            const matches = baseText.match(/\[([A-Z_ÄÖÅ0-9]+)\]/g) || [];
            setDetectedVars([...new Set(matches)]);
        } else if (item.type === 'message') {
            const matches = baseText.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
            setDetectedVars([...new Set(matches)]);
        }
    }, [baseText, item.type]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (item.type === 'phrase') {
                await supabase.from('phrases').update({
                    short_title: shortTitle, 
                    phrase_key: phraseKey,
                    base_text: baseText, 
                    priority_score: priority,
                    extraction_pattern: generatedRegex || null // TALLENNETAAN REGEX KANTAAN
                }).eq('id', item.data.id);
            } 
            else if (item.type === 'message') {
                await supabase.from('message_templates').update({
                    title: msgTitle, 
                    subject: msgSubject, 
                    template_body: baseText
                }).eq('id', item.data.id);
            }
            else if (item.type === 'knowledge') {
                await supabase.from('knowledge_base').update({
                    title: shortTitle, 
                    content_text: baseText
                }).eq('id', item.data.id);
            }
            
            setHasChanges(true);
            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 3000);

        } catch (error) {
            console.error("Tallennus epäonnistui:", error);
            alert("Tallennus epäonnistui!");
        }
        setIsSaving(false);
    };

    const handleClose = () => {
        if (hasChanges) {
            onSaveComplete();
        } else {
            onClose();
        }
    };

    const handleDeleteClick = async () => {
        setIsSaving(true);
        let tableName = '';
        
        if (item.type === 'phrase') tableName = 'phrases';
        else if (item.type === 'message') tableName = 'message_templates';
        else if (item.type === 'knowledge') tableName = 'knowledge_base';

        const success = await deleteAdminItem(tableName, item.data.id);
        setIsSaving(false);

        if (success) {
            onSaveComplete(); 
        } else {
            alert("Poisto epäonnistui!");
            setConfirmDelete(false);
        }
    };

    const handleAddRule = async () => {
        if (!ruleSection) return;
        if (ruleOperator !== 'exists' && !rulePhrase) return;

        const newRule = {
            target_type: 'phrase',
            target_id: item.data.id,
            rule_type: ruleType,
            condition_json: {
                section: ruleSection,
                operator: ruleOperator,
                value: ruleOperator === 'exists' ? null : rulePhrase
            }
        };

        const savedRule = await addPhraseRule(newRule);
        if (savedRule) {
            setRules([...rules, savedRule]);
            setIsAddingRule(false);
            
            setRuleSection('');
            setRulePhrase('');
            setRuleType('recommendation');
            setRuleOperator('contains');
        }
    };

    const handleDeleteRule = async (ruleId) => {
        const success = await deletePhraseRule(ruleId);
        if (success) {
            setRules(rules.filter(r => r.id !== ruleId));
        }
    };

    const availablePhrasesForRule = sections?.find(s => s.section_key === ruleSection)?.phrases || [];

    return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                
                <div className="admin-modal-header">
                    <div>
                        <h2 style={{ margin: '0 0 0.25rem 0' }}>Muokkaa: {item.type.toUpperCase()}</h2>
                        <span className="tag tag--warning">ID: {item.data.id.substring(0,8)}...</span>
                    </div>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>✕</button>
                </div>

                <div className="admin-modal-body">
                    
                    {/* VASEN SARAKE: Pääsisältö */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h4 style={{ margin: 0, borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>1. Sisältö</h4>
                        
                        {item.type === 'phrase' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Lyhyt otsikko (nappi):</label>
                                    <input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={shortTitle} onChange={e => setShortTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Avainsana (tunniste, esim. 'tyoton'):</label>
                                    <input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={phraseKey} onChange={e => setPhraseKey(e.target.value)} />
                                </div>

                                {/* UUSI OSIO: SÄÄNTÖMOOTTORIN LAUKAISUSANAT */}
                                <div style={{ backgroundColor: '#f0f4f8', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cce3f6', marginTop: '0.25rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', color: '#004a8f' }}>Pika-pura laukaisusanat (erota pilkulla):</label>
                                    <p style={{ fontSize: '0.8rem', margin: '0 0 0.5rem 0', color: '#555' }}>
                                        Mitkä sanat asiantuntijan vapaassa tekstissä laukaisevat tämän valinnan?
                                    </p>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #a2c6eb' }} 
                                        value={triggerWordsInput} 
                                        onChange={e => setTriggerWordsInput(e.target.value)} 
                                        placeholder="esim. työkokeilu, kokeilu, te-kokeilu"
                                    />
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                                        <strong>Tietokantaan menevä sääntö: </strong> 
                                        <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                            {generatedRegex || 'Ei sääntöä'}
                                        </code>
                                    </div>
                                </div>
                            </>
                        )}

                        {item.type === 'message' && (
                            <>
                                <div><label style={{ display: 'block', marginBottom: '0.25rem' }}>Pohjan nimi:</label><input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={msgTitle} onChange={e => setMsgTitle(e.target.value)} /></div>
                                <div><label style={{ display: 'block', marginBottom: '0.25rem' }}>Sähköpostin otsikko:</label><input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={msgSubject} onChange={e => setMsgSubject(e.target.value)} /></div>
                            </>
                        )}

                        {item.type === 'knowledge' && (
                            <div><label style={{ display: 'block', marginBottom: '0.25rem' }}>Ohjeen/Linkin otsikko:</label><input type="text" className="input-field" style={{ width: '100%', padding: '0.5rem' }} value={shortTitle} onChange={e => setShortTitle(e.target.value)} /></div>
                        )}

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Varsinainen teksti:</label>
                            <textarea 
                                style={{ width: '100%', padding: '0.75rem', fontFamily: 'var(--font-sans)', flex: 1, minHeight: '150px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                value={baseText} onChange={e => setBaseText(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* OIKEA SARAKE: Asetukset & Logiikka */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h4 style={{ margin: 0, borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>2. Älykkyys & Säännöt</h4>
                        
                        {(item.type === 'phrase' || item.type === 'message') && (
                            <div className="info-box" style={{ backgroundColor: 'var(--color-background)', border: '1px dashed var(--color-border)' }}>
                                <strong>Havaitut muuttujat:</strong>
                                {detectedVars.length > 0 ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                        {detectedVars.map(v => <span key={v} className="chip chip--warning">{v}</span>)}
                                    </div>
                                ) : <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0 0', color: 'var(--color-text-secondary)' }}>Ei muuttujia havaittu.</p>}
                            </div>
                        )}

                        {item.type === 'phrase' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Prioriteetti (0-100):</label>
                                    <input type="number" className="input-field" style={{ width: '100px', padding: '0.5rem' }} value={priority} onChange={e => setPriority(parseInt(e.target.value)||0)} />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>Pienempi numero voittaa (1 = vahvin, 100 = heikoin).</p>
                                </div>
                                
                                <div className="info-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-background)', gap: '1rem' }}>
                                    <strong style={{ margin: 0 }}>Liitetyt säännöt (Business Rules)</strong>
                                    
                                    {rules.length > 0 ? (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {rules.map(rule => (
                                                <li key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                                    <span style={{ fontSize: '0.85rem' }}>
                                                        <strong style={{ color: rule.rule_type === 'recommendation' ? '#d97706' : '#be123c' }}>
                                                            [{rule.rule_type === 'recommendation' ? 'SUOSITUS' : 'PIILOTUS'}]
                                                        </strong>{' '}
                                                        JOS <strong>{rule.condition_json.section}</strong>{' '}
                                                        {rule.condition_json.operator === 'contains' && 'sisältää arvon'}
                                                        {rule.condition_json.operator === 'equals' && 'on täsmälleen'}
                                                        {rule.condition_json.operator === 'exists' && 'on täytetty (olemassa)'}
                                                        {rule.condition_json.operator !== 'exists' && <strong> '{rule.condition_json.value}'</strong>}
                                                    </span>
                                                    <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>Ei sääntöjä. Fraasi näytetään aina normaalisti.</p>
                                    )}

                                    {isAddingRule ? (
                                        <div style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-primary)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            
                                            <div>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>1. Mitä sääntö tekee?</label>
                                                <select className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
                                                    <option value="recommendation">Suosittele tätä fraasia automaattisesti</option>
                                                    <option value="visibility">Piilota tämä fraasi, jos ehto ei täyty</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>2. Minkä osion perusteella?</label>
                                                <select className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={ruleSection} onChange={(e) => { setRuleSection(e.target.value); setRulePhrase(''); }}>
                                                    <option value="">-- Valitse kohdeosio --</option>
                                                    {sections?.map(s => <option key={s.id} value={s.section_key}>{s.title}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>3. Mikä on vertailutapa?</label>
                                                <select className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={ruleOperator} onChange={(e) => setRuleOperator(e.target.value)}>
                                                    <option value="contains">Sisältää valinnan</option>
                                                    <option value="equals">On täsmälleen</option>
                                                    <option value="exists">Kenttä on täytetty / olemassa</option>
                                                </select>
                                            </div>

                                            {ruleOperator !== 'exists' && (
                                                <div>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>4. Mikä arvo pitää löytyä?</label>
                                                    <select className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={rulePhrase} onChange={(e) => setRulePhrase(e.target.value)} disabled={!ruleSection}>
                                                        <option value="">-- Valitse etsittävä arvo --</option>
                                                        {availablePhrasesForRule.map(p => <option key={p.id} value={p.phrase_key}>{p.short_title}</option>)}
                                                    </select>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <button className="btn btn--secondary" onClick={() => setIsAddingRule(false)}>Peruuta</button>
                                                <button className="btn" onClick={handleAddRule} disabled={!ruleSection || (ruleOperator !== 'exists' && !rulePhrase)}>
                                                    Tallenna sääntö
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="btn btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setIsAddingRule(true)}>
                                            + Rakenna uusi sääntö
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                        
                        {item.type !== 'phrase' && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                Sääntömoottori koskee vain lomakkeen fraaseja. Tälle kohteelle ei ole erillisiä sääntöasetuksia.
                            </p>
                        )}
                    </div>
                </div>

                <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    
                    <div>
                        {!confirmDelete ? (
                            <button 
                                className="btn btn--secondary" 
                                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} 
                                onClick={() => setConfirmDelete(true)}
                                disabled={isSaving}
                            >
                                Poista kohde
                            </button>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>Oletko varma?</span>
                                <button 
                                    className="btn" 
                                    style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} 
                                    onClick={handleDeleteClick}
                                    disabled={isSaving}
                                >
                                    Kyllä, poista lopullisesti
                                </button>
                                <button 
                                    className="btn btn--secondary" 
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={isSaving}
                                >
                                    Peruuta poisto
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {saveSuccess && (
                            <span style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '0.9rem' }}>
                                ✓ Tallennus onnistui
                            </span>
                        )}
                        <button className="btn btn--secondary" onClick={handleClose} disabled={isSaving}>Sulje</button>
                        <button className="btn" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Tallennetaan...' : 'Tallenna tekstimuutokset'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminModal;