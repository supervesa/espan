import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, X } from 'lucide-react';

function PuzzleBuilder({ puzzles, allPieces, blueprints, refreshData }) {
    const [selectedPuzzle, setSelectedPuzzle] = useState('');
    const [builderActivePieces, setBuilderActivePieces] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Uuden palapelin luonnin tilat
    const [isNewPuzzleModalOpen, setIsNewPuzzleModalOpen] = useState(false);
    const [newPuzzleData, setNewPuzzleData] = useState({ title: '', category: 'Yleiset pohjat', subject: '' });

    useEffect(() => {
        if (selectedPuzzle) {
            const puzzleBps = blueprints.filter(bp => bp.puzzle_id === selectedPuzzle).sort((a, b) => a.order_index - b.order_index);
            const loaded = puzzleBps.map(bp => allPieces.find(p => p.id === bp.piece_id)).filter(Boolean);
            setBuilderActivePieces(loaded.map(p => ({ ...p, uniqueId: Math.random().toString() })));
        } else {
            setBuilderActivePieces([]);
        }
    }, [selectedPuzzle, blueprints, allPieces]);

    const groupedAllPieces = useMemo(() => {
        return allPieces.reduce((acc, piece) => {
            const cat = piece.category || 'Määrittelemätön';
            (acc[cat] = acc[cat] || []).push(piece);
            return acc;
        }, {});
    }, [allPieces]);

    const addPiece = (piece) => setBuilderActivePieces(prev => [...prev, { ...piece, uniqueId: Math.random().toString() }]);
    const removePiece = (uniqueId) => setBuilderActivePieces(prev => prev.filter(p => p.uniqueId !== uniqueId));
    
    const movePiece = (index, dir) => {
        setBuilderActivePieces(prev => {
            const np = [...prev];
            if (dir === 'up' && index > 0) [np[index - 1], np[index]] = [np[index], np[index - 1]];
            else if (dir === 'down' && index < np.length - 1) [np[index + 1], np[index]] = [np[index], np[index + 1]];
            return np;
        });
    };

    const handleSaveBlueprints = async () => {
        if (!selectedPuzzle) return;
        setIsSaving(true);
        try {
            await supabase.from('puzzle_blueprints').delete().eq('puzzle_id', selectedPuzzle);
            if (builderActivePieces.length > 0) {
                const inserts = builderActivePieces.map((piece, index) => ({
                    puzzle_id: selectedPuzzle, piece_id: piece.id, order_index: index + 1
                }));
                await supabase.from('puzzle_blueprints').insert(inserts);
            }
            alert('Palapelin rakenne tallennettu!');
            await refreshData();
        } catch (error) { alert("Tallennus epäonnistui."); }
        setIsSaving(false);
    };

    const handleCreateNewPuzzle = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const newPuzzleId = crypto.randomUUID(); 
            
            const { error } = await supabase.from('puzzles').insert([{
                id: newPuzzleId,
                title: newPuzzleData.title,
                category: newPuzzleData.category,
                subject: newPuzzleData.subject,
                fields: [],
                addons: [] 
            }]);

            if (error) throw error;

            await refreshData();
            setSelectedPuzzle(newPuzzleId);
            setIsNewPuzzleModalOpen(false);
            setNewPuzzleData({ title: '', category: 'Yleiset pohjat', subject: '' });
            
        } catch (error) {
            console.error("Virhe luonnissa:", error);
            alert("Uuden palapelin luonti epäonnistui: " + error.message);
        }
        setIsSaving(false);
    };

    return (
        // UUSI LEVEYSASERETTELU: Käytetään normaalia gridiä koko leveydellä
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', width: '100%' }}>
            
            {/* VASEN SARAKE: Palikkavalikoima */}
            <aside style={{ maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--color-surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0 }}>🧱 Valikoima</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Klikkaa palikkaa lisätäksesi sen pöydälle.</p>
                {Object.entries(groupedAllPieces).sort().map(([category, categoryPieces]) => (
                    <div key={category} style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>{category}</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {categoryPieces.map(piece => (
                                <button 
                                    key={piece.id} 
                                    onClick={() => addPiece(piece)} 
                                    disabled={!selectedPuzzle} 
                                    style={{ 
                                        textAlign: 'left', 
                                        padding: '0.75rem', 
                                        backgroundColor: '#fff', 
                                        border: '1px solid var(--color-border)', 
                                        borderRadius: '6px', 
                                        cursor: selectedPuzzle ? 'pointer' : 'not-allowed', 
                                        opacity: selectedPuzzle ? 1 : 0.5, 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{piece.title}</span>
                                    <Plus size={14} color="var(--color-primary)" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </aside>

            {/* OIKEA SARAKE: Rakennuspöytä */}
            <main style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <h2 style={{ margin: 0 }}>🧩 Rakennuspöytä</h2>
                    <button onClick={handleSaveBlueprints} disabled={!selectedPuzzle || isSaving} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={16} /> {isSaving ? 'Tallennetaan...' : 'Tallenna rakenne'}
                    </button>
                </div>

                <div className="form-row" style={{ marginBottom: '2rem' }}>
                    <label style={{ fontWeight: 'bold' }}>Mitä palapeliä rakennetaan?</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <select className="modern-select" value={selectedPuzzle} onChange={(e) => setSelectedPuzzle(e.target.value)} style={{ flex: 1 }}>
                            <option value="">-- Valitse kohteena oleva palapeli --</option>
                            {puzzles.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <button onClick={() => setIsNewPuzzleModalOpen(true)} className="btn btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                            <Plus size={16} /> Uusi palapeli
                        </button>
                    </div>
                </div>

                {selectedPuzzle ? (
                    <div style={{ backgroundColor: 'var(--color-background-alt)', padding: '1.5rem', borderRadius: '8px', flex: 1, minHeight: '400px' }}>
                        {builderActivePieces.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: '4rem' }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Pöytä on tyhjä.</p>
                                <p style={{ fontSize: '0.9rem' }}>Valitse ja klikkaa vasemmalta palikoita lisätäksesi niitä tähän palapeliin.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {builderActivePieces.map((piece, index) => (
                                    <div key={piece.uniqueId} style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-border)', padding: '0.75rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                        <div style={{ fontWeight: 'bold', width: '30px', color: 'var(--color-text-muted)', textAlign: 'right' }}>{index + 1}.</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{piece.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>{piece.category}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button onClick={() => movePiece(index, 'up')} disabled={index === 0} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}><ArrowUp size={16} color="var(--color-text-secondary)" /></button>
                                            <button onClick={() => movePiece(index, 'down')} disabled={index === builderActivePieces.length - 1} style={{ background: 'none', border: 'none', cursor: index === builderActivePieces.length - 1 ? 'not-allowed' : 'pointer', opacity: index === builderActivePieces.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} color="var(--color-text-secondary)" /></button>
                                            <button onClick={() => removePiece(piece.uniqueId)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}><Trash2 size={16} color="var(--color-danger)" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ flex: 1, border: '2px dashed var(--color-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', minHeight: '400px' }}>
                        Valitse ensin muokattava palapeli tai luo uusi.
                    </div>
                )}
            </main>

            {/* MODAALI UUDEN PALAPELIN LUONTIIN */}
            {isNewPuzzleModalOpen && (
                <div className="admin-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="admin-modal-content" style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Luo uusi palapeli (Viestipohja)</h3>
                            <button onClick={() => setIsNewPuzzleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleCreateNewPuzzle}>
                            <div className="form-row">
                                <label style={{ fontWeight: 'bold' }}>Palapelin nimi</label>
                                <input required value={newPuzzleData.title} onChange={(e) => setNewPuzzleData({...newPuzzleData, title: e.target.value})} className="form-input" placeholder="esim. Uusi tapahtumakutsu" />
                            </div>
                            <div className="form-row">
                                <label style={{ fontWeight: 'bold' }}>Kategoria</label>
                                <input required list="puzzle-categories" value={newPuzzleData.category} onChange={(e) => setNewPuzzleData({...newPuzzleData, category: e.target.value})} className="form-input" />
                                <datalist id="puzzle-categories">
                                    <option value="Viralliset Kutsupohjat" />
                                    <option value="Yleiset pohjat" />
                                    <option value="Yhteydenotot ja tavoittelu" />
                                    <option value="Muut ilmoitukset ja ohjeet" />
                                </datalist>
                            </div>
                            <div className="form-row">
                                <label style={{ fontWeight: 'bold' }}>Sähköpostin otsikko (Subject)</label>
                                <input required value={newPuzzleData.subject} onChange={(e) => setNewPuzzleData({...newPuzzleData, subject: e.target.value})} className="form-input" placeholder="esim. Kutsu Helsingin työllisyyspalveluihin" />
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setIsNewPuzzleModalOpen(false)} className="btn btn--secondary">Peruuta</button>
                                <button type="submit" disabled={isSaving} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={16}/> {isSaving ? 'Luodaan...' : 'Luo tyhjä palapeli'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default PuzzleBuilder;