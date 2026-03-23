// --- src/components/PuzzleComposer.jsx ---

import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Mail, Edit3, Lock, Trash2, ArrowUp, ArrowDown, Plus, ListPlus, Edit } from 'lucide-react';

function PuzzleComposer({ state, puzzles, allPieces, blueprints, forcedPuzzleId, initialSuggestedPieces = [] }) {
    const [selectedPuzzleId, setSelectedPuzzleId] = useState('');
    const [formData, setFormData] = useState({});
    const [addonData, setAddonData] = useState({});
    const [combinedDateTime, setCombinedDateTime] = useState('');
    const [activePieces, setActivePieces] = useState([]);
    const [copySuccess, setCopySuccess] = useState('');
    const [suggestedPieces, setSuggestedPieces] = useState([]);
    const [selectedPieceToAdd, setSelectedPieceToAdd] = useState('');

    // Vapaa muokkaus
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualText, setManualText] = useState('');

    const globalVariables = useMemo(() => {
        const vars = {};
        allPieces.filter(p => p.category === 'Vakiomuuttuja').forEach(p => {
            vars[p.title.trim()] = p.content;
        });
        return vars;
    }, [allPieces]);

    const dropdownLists = useMemo(() => {
        const lists = {};
        allPieces.filter(p => p.category === 'Valintalista').forEach(p => {
            const options = p.content.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                
                let resolvedLine = trimmed;
                Object.keys(globalVariables).forEach(key => {
                    resolvedLine = resolvedLine.replace(new RegExp(`\\{${key}\\}`, 'g'), globalVariables[key]);
                });
                return resolvedLine;
            }).filter(Boolean);
            
            lists[p.title.trim()] = options;
        });
        return lists;
    }, [allPieces, globalVariables]);

    const insertablePieces = useMemo(() => {
        const groups = {};
        allPieces.forEach(p => {
            if (p.category === 'Vakiomuuttuja' || p.category === 'Valintalista') return;
            (groups[p.category] = groups[p.category] || []).push(p);
        });
        return groups;
    }, [allPieces]);

    const replaceGlobalVarsInText = (text) => {
        if (!text) return '';
        let newText = text;
        Object.keys(globalVariables).forEach(key => {
            newText = newText.replace(new RegExp(`\\{${key}\\}`, 'g'), globalVariables[key]);
        });
        return newText;
    };

    const currentPuzzle = useMemo(() => puzzles.find(p => p.id === selectedPuzzleId) || null, [selectedPuzzleId, puzzles]);

    const groupedPuzzles = useMemo(() => {
        return puzzles.reduce((acc, puzzle) => {
            (acc[puzzle.category] = acc[puzzle.category] || []).push(puzzle);
            return acc;
        }, {});
    }, [puzzles]);

    // Nollataan vapaa muokkaus ja pikasyöttö, jos käyttäjä vaihtaa kokonaan toiseen pohjaan
    useEffect(() => {
        setIsManualMode(false);
        setManualText('');
        setCombinedDateTime('');
    }, [selectedPuzzleId]);

    useEffect(() => {
        if (forcedPuzzleId) {
            setSelectedPuzzleId(forcedPuzzleId);
            const validSuggestions = initialSuggestedPieces
                .map(id => allPieces.find(p => p.id === id))
                .filter(Boolean);
            setSuggestedPieces(validSuggestions);
        }
    }, [forcedPuzzleId, initialSuggestedPieces, allPieces]);

    useEffect(() => {
        if (currentPuzzle) {
            const initialFormData = {};
            let parsedFields = [];
            try { parsedFields = typeof currentPuzzle.fields === 'string' ? JSON.parse(currentPuzzle.fields) : currentPuzzle.fields; } catch(e){}
            
            parsedFields?.forEach(field => { initialFormData[field.id] = field.defaultValue || ''; });
            setFormData(initialFormData);
            setAddonData({});

            const puzzleBlueprints = blueprints.filter(bp => bp.puzzle_id === currentPuzzle.id).sort((a, b) => a.order_index - b.order_index);
            const loadedPieces = puzzleBlueprints.map(bp => {
                const originalPiece = allPieces.find(p => p.id === bp.piece_id);
                return { uniqueId: Math.random().toString(36).substr(2, 9), ...originalPiece, currentContent: originalPiece?.content || '' };
            }).filter(p => p.id);
            setActivePieces(loadedPieces);
            
            if (currentPuzzle.id !== forcedPuzzleId) setSuggestedPieces([]);
        } else {
            setActivePieces([]);
        }
    }, [currentPuzzle, blueprints, allPieces, forcedPuzzleId]);

    const scannedFields = useMemo(() => {
        const fields = [];
        const regex = /\{([a-zA-Z0-9_]+)\}/g;
        const seen = new Set();
        
        activePieces.forEach(piece => {
            let match;
            while ((match = regex.exec(piece.currentContent)) !== null) {
                const tag = match[1];
                
                if (tag === 'addons' || globalVariables.hasOwnProperty(tag) || tag === 'expertName') continue;
                
                if (!seen.has(tag)) {
                    seen.add(tag);
                    
                    if (dropdownLists.hasOwnProperty(tag)) {
                        fields.push({ id: tag, label: tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type: 'select', options: dropdownLists[tag] });
                        continue;
                    }

                    let type = 'text';
                    const lowerTag = tag.toLowerCase();
                    if (lowerTag.includes('date') || lowerTag.includes('pvm')) type = 'date';
                    if (lowerTag.includes('time') || lowerTag.includes('klo') || lowerTag.includes('aika')) type = 'time';
                    
                    fields.push({ id: tag, label: tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type: type });
                }
            }
        });
        return fields;
    }, [activePieces, globalVariables, dropdownLists]);

    let finalFields = [];
    if (currentPuzzle) {
        let parsedFields = [];
        try { parsedFields = typeof currentPuzzle.fields === 'string' ? JSON.parse(currentPuzzle.fields) : currentPuzzle.fields; } catch(e){}
        finalFields = [...parsedFields];
        
        scannedFields.forEach(sf => {
            if (!finalFields.find(f => f.id === sf.id)) finalFields.push(sf);
        });

        finalFields = finalFields.filter(field => !globalVariables.hasOwnProperty(field.id) && field.id !== 'expertName');
    }

    // Päivämäärän pikasyöttö (Regex)
    useEffect(() => {
        if (!combinedDateTime) return;
        const match = combinedDateTime.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2})[:.](\d{2})/);
        if (match) {
            const [, day, month, year, hour, minute] = match;
            setFormData(prev => ({ ...prev, date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` }));
            setIsManualMode(false); // Nollataan vapaa muokkaus, koska kenttiä päivitettiin
        }
    }, [combinedDateTime]);

    const generatedMessage = useMemo(() => {
        if (!currentPuzzle || activePieces.length === 0) return '';
        let rawText = activePieces.map(p => p.currentContent).join('\n\n');
        
        let parsedAddons = [];
        try { parsedAddons = typeof currentPuzzle.addons === 'string' ? JSON.parse(currentPuzzle.addons) : currentPuzzle.addons; } catch(e){}
        let addonsText = '';
        if (parsedAddons && Array.isArray(parsedAddons)) {
             const activeAddons = parsedAddons.filter(addon => addonData[addon.id]).map(addon => {
                    if (addon.hasInput && addonData[addon.id]) return addon.text.replace(`{${addon.inputId}}`, addonData[addon.inputId] || '_________');
                    return addon.text;
                });
            if (activeAddons.length > 0) addonsText = activeAddons.join('\n') + '\n';
        }
        rawText = rawText.replace('{addons}', addonsText);

        let globalExpert = globalVariables['expertName'] || state?.perustiedot?.virkailija || formData.expertName;
        if (!globalExpert || globalExpert.trim() === '') globalExpert = '[Asiantuntijan nimi]';
        rawText = rawText.replace(/{expertName}/g, globalExpert);

        const dataToRender = { ...formData };
        
        const regex = /\{([a-zA-Z0-9_]+)\}/g;
        let match;
        const tagsToReplace = [];
        while ((match = regex.exec(rawText)) !== null) {
            tagsToReplace.push(match[1]);
        }

        tagsToReplace.forEach(tag => {
            if (globalVariables.hasOwnProperty(tag)) {
                rawText = rawText.replace(new RegExp(`\\{${tag}\\}`, 'g'), globalVariables[tag]);
                return;
            }

            let value = dataToRender[tag] || `(${tag})`;
            if ((tag.toLowerCase().includes('date') || tag.toLowerCase().includes('pvm')) && dataToRender[tag]) {
                const parts = dataToRender[tag].split('-');
                if (parts.length === 3) value = `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
            rawText = rawText.replace(new RegExp(`\\{${tag}\\}`, 'g'), value);
        });

        return rawText;
    }, [activePieces, formData, addonData, currentPuzzle, globalVariables, state]);

    const finalMessageToUse = isManualMode ? manualText : generatedMessage;

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setIsManualMode(false);
        // Nollataan pikasyöttö-kenttä, jos päiviä/kelloja muutetaan manuaalisesti
        if (e.target.name === 'date' || e.target.name === 'time') setCombinedDateTime('');
    };

    const handleAddonChange = (e) => {
        const { name, type, value, checked } = e.target;
        setAddonData(prev => {
            const newState = { ...prev };
            if (type === 'checkbox') {
                newState[name] = checked;
                if (!checked) {
                    let pAddons = [];
                    try { pAddons = JSON.parse(currentPuzzle.addons); } catch(err){}
                    const addon = pAddons?.find(a => a.id === name);
                    if (addon && addon.hasInput) newState[addon.inputId] = '';
                }
            } else newState[name] = value;
            return newState;
        });
        setIsManualMode(false);
    };

    const addPreMadePiece = (pieceId) => {
        if (!pieceId) return;
        const piece = allPieces.find(p => p.id === pieceId);
        if (!piece) return;

        const newPiece = { uniqueId: Math.random().toString(36).substr(2, 9), ...piece, currentContent: piece.content };
        
        setActivePieces(prev => {
            const newArray = [...prev];
            const sigIndex = newArray.findIndex(p => p.category === 'Allekirjoitus');
            const insertIndex = sigIndex !== -1 ? sigIndex : newArray.length;
            newArray.splice(insertIndex, 0, newPiece);
            return newArray;
        });
        
        setSelectedPieceToAdd(''); 
        setIsManualMode(false); 
    };

    const addCustomPiece = () => {
        setActivePieces(prev => [...prev, { uniqueId: Math.random().toString(36).substr(2, 9), category: 'Vapaa teksti', title: 'Oma lisäys', content: '', currentContent: '', is_locked: false, ai_editable: true }]);
        setIsManualMode(false);
    };

    const movePiece = (index, dir) => {
        setActivePieces(prev => {
            const np = [...prev];
            if (dir === 'up' && index > 0) [np[index - 1], np[index]] = [np[index], np[index - 1]];
            else if (dir === 'down' && index < np.length - 1) [np[index + 1], np[index]] = [np[index], np[index + 1]];
            return np;
        });
        setIsManualMode(false);
    };

    const removePiece = (uniqueId) => {
        setActivePieces(prev => prev.filter(p => p.uniqueId !== uniqueId));
        setIsManualMode(false);
    };

    let parsedAddons = [];
    if (currentPuzzle) {
        try { parsedAddons = typeof currentPuzzle.addons === 'string' ? JSON.parse(currentPuzzle.addons) : currentPuzzle.addons; } catch(e){}
    }

    const hasDateTimeFields = finalFields.some(f => f.id === 'date' || f.id === 'time');

    return (
        <div className="main-grid">
            <main className="sections-container">
                <section className="section-container">
                    <h2 style={{ marginBottom: '1.5rem' }}>Rakenna ja täydennä viesti</h2>
                    <div className="form-row">
                        <label style={{ fontWeight: 'bold' }}>Valitse Palapeli (Valmispohja)</label>
                        <select className="modern-select" value={selectedPuzzleId} onChange={(e) => setSelectedPuzzleId(e.target.value)}>
                            <option value="">-- Valitse --</option>
                            {Object.entries(groupedPuzzles).map(([category, puzzleList]) => (
                                <optgroup label={category} key={category}>
                                    {puzzleList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Pikasyöttö näytetään vain, jos palikoissa on date tai time */}
                    {currentPuzzle && hasDateTimeFields && (
                        <div className="form-row" style={{ marginTop: '1.5rem' }}>
                            <label htmlFor="datetime_combined" style={{ fontWeight: 'bold' }}>Pikasyöttö (esim. 12.12.2025, 14.40)</label>
                            <input
                                type="text"
                                id="datetime_combined"
                                className="form-input"
                                value={combinedDateTime}
                                onChange={(e) => setCombinedDateTime(e.target.value)}
                                placeholder="Liitä päivämäärä ja kellonaika tähän..."
                            />
                        </div>
                    )}
                    
                    {currentPuzzle && finalFields.length > 0 && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                            <div className="form-grid">
                                {finalFields.map(field => (
                                    <div className="form-row" key={field.id}>
                                        <label style={{ fontWeight: 'bold' }}>{field.label}</label>
                                        {field.type === 'select' ? (
                                            <select id={field.id} name={field.id} value={formData[field.id] || ''} onChange={handleInputChange} className="modern-select">
                                                <option value="">-- Valitse --</option>
                                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input type={field.type} id={field.id} name={field.id} value={formData[field.id] || ''} onChange={handleInputChange} className="form-input" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentPuzzle && parsedAddons?.length > 0 && (
                        <div className="form-row addon-section" style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                            <label style={{ fontWeight: 'bold', marginBottom: '1rem', display: 'block' }}>Lisätiedot (Ydinviestin sisään)</label>
                            <div className="addon-container">
                                {parsedAddons.map(addon => (
                                    <React.Fragment key={addon.id}>
                                        <label className="modern-checkbox-label" htmlFor={addon.id}>
                                            <input type="checkbox" id={addon.id} name={addon.id} className="modern-checkbox" checked={!!addonData[addon.id]} onChange={handleAddonChange} />
                                            <span>{addon.label}</span>
                                        </label>
                                        {addon.hasInput && addonData[addon.id] && (
                                            <div className="addon-child-container">
                                                <input type="text" name={addon.inputId} value={addonData[addon.inputId] || ''} onChange={handleAddonChange} className="form-input" placeholder="Tarkenna tähän..." />
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {currentPuzzle && (
                    <section className="section-container" style={{ backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <span>Viestin rakenne</span>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <select className="modern-select" style={{ padding: '0.3rem 2rem 0.3rem 0.75rem', fontSize: '0.85rem', width: 'auto', minWidth: '220px' }} value={selectedPieceToAdd} onChange={(e) => addPreMadePiece(e.target.value)}>
                                    <option value="">+ Lisää valmis palikka...</option>
                                    {Object.entries(insertablePieces).sort().map(([category, pieces]) => (
                                        <optgroup label={category} key={category}>
                                            {pieces.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                                <button onClick={addCustomPiece} className="btn btn--secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    <Plus size={14} /> Oma lisäys
                                </button>
                            </div>
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {activePieces.map((piece, index) => (
                                <div key={piece.uniqueId} style={{ backgroundColor: piece.is_locked ? 'var(--color-background-alt)' : 'var(--color-surface)', border: `1px solid ${piece.is_locked ? 'var(--color-border)' : 'var(--color-primary)'}`, borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: piece.is_locked ? 'rgba(0,0,0,0.03)' : 'rgba(255,107,0,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: piece.is_locked ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                                            {piece.is_locked ? <Lock size={16} /> : <Edit3 size={16} />} {piece.title}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button onClick={() => movePiece(index, 'up')} disabled={index === 0} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}><ArrowUp size={16} color="var(--color-text-secondary)" /></button>
                                            <button onClick={() => movePiece(index, 'down')} disabled={index === activePieces.length - 1} style={{ background: 'none', border: 'none', cursor: index === activePieces.length - 1 ? 'not-allowed' : 'pointer', opacity: index === activePieces.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} color="var(--color-text-secondary)" /></button>
                                            {!piece.is_locked && <button onClick={() => removePiece(piece.uniqueId)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}><Trash2 size={16} color="var(--color-danger)" /></button>}
                                        </div>
                                    </div>
                                    <div style={{ padding: '0.75rem' }}>
                                        {piece.is_locked ? (
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                                {replaceGlobalVarsInText(piece.currentContent)}
                                            </p>
                                        ) : (
                                            <textarea className="form-input" value={piece.currentContent} onChange={(e) => { setActivePieces(prev => prev.map(p => p.uniqueId === piece.uniqueId ? { ...p, currentContent: e.target.value } : p)); setIsManualMode(false); }} rows={Math.max(2, piece.currentContent.split('\n').length)} style={{ border: 'none', padding: '0.5rem', backgroundColor: '#fdfdfd', resize: 'vertical' }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            <aside className="summary-sticky-container">
                <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>Esikatselu</h2>
                        {currentPuzzle && (
                            !isManualMode ? (
                                <button onClick={() => { setManualText(generatedMessage); setIsManualMode(true); }} className="btn btn--secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Edit size={14} /> Vapaa muokkaus
                                </button>
                            ) : (
                                <button onClick={() => setIsManualMode(false)} className="btn btn--secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Trash2 size={14} /> Peruuta muokkaukset
                                </button>
                            )
                        )}
                    </div>

                    {currentPuzzle ? (
                        <>
                            {isManualMode && (
                                <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                    ⚠️ Vapaa muokkaustila päällä. Palikoiden tekemät muutokset eivät enää päivity tähän tekstiin automaattisesti.
                                </div>
                            )}
                            
                            {isManualMode ? (
                                <textarea 
                                    className="form-input" 
                                    value={manualText} 
                                    onChange={(e) => setManualText(e.target.value)} 
                                    rows="18" 
                                    style={{ width: '100%', marginBottom: '1.5rem', fontFamily: 'inherit', resize: 'vertical', backgroundColor: '#fff', border: '2px solid var(--color-primary)' }} 
                                />
                            ) : (
                                <textarea 
                                    readOnly 
                                    className="form-input" 
                                    value={generatedMessage} 
                                    rows="18" 
                                    style={{ width: '100%', marginBottom: '1.5rem', fontFamily: 'inherit', resize: 'vertical', backgroundColor: 'var(--color-background-alt)' }} 
                                />
                            )}

                            <div className="summary-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => { navigator.clipboard.writeText(finalMessageToUse); setCopySuccess('Kopioitu!'); setTimeout(() => setCopySuccess(''), 2000); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Copy size={18} /> Kopioi
                                </button>
                                <button className="btn btn--secondary" onClick={() => window.location.href = `mailto:?subject=${encodeURIComponent(currentPuzzle.subject)}&body=${encodeURIComponent(finalMessageToUse)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Mail size={16} /> Avaa sähköposti
                                </button>
                            </div>
                            {copySuccess && <p style={{ color: 'var(--color-success)', textAlign: 'center', marginTop: '1rem', fontWeight: 'bold' }}>{copySuccess}</p>}
                        </>
                    ) : <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Valitse palapeli tai tee pikaluonnos</p>}
                </div>
            </aside>
        </div>
    );
}

export default PuzzleComposer;