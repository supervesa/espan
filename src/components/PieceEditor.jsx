import React, { useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Plus, Edit3, Trash2, Lock, Unlock, Save, X } from 'lucide-react';

function PieceEditor({ allPieces, refreshData }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPiece, setEditingPiece] = useState(null);

    // UUDET TILAT TALLENNUKSEN ILMOITUKSEEN JA SULKEMISEEN
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Etsitään kaikki Vakiomuuttujat nappeja varten
    const vakiomuuttujat = useMemo(() => {
        return allPieces.filter(p => p.category === 'Vakiomuuttuja').sort((a, b) => a.title.localeCompare(b.title));
    }, [allPieces]);

    const groupedAllPieces = useMemo(() => {
        return allPieces.reduce((acc, piece) => {
            const cat = piece.category || 'Määrittelemätön';
            (acc[cat] = acc[cat] || []).push(piece);
            return acc;
        }, {});
    }, [allPieces]);

    const openPieceModal = (piece = null) => {
        setEditingPiece(piece ? { ...piece } : { id: null, title: '', category: '', content: '', is_locked: false, ai_editable: true });
        setHasChanges(false);
        setSaveSuccess(false);
        setIsModalOpen(true);
    };

    const handlePieceSave = async (e) => {
        e.preventDefault();
        try {
            if (editingPiece.id) {
                await supabase.from('puzzle_pieces')
                    .update({ title: editingPiece.title, category: editingPiece.category, content: editingPiece.content, is_locked: editingPiece.is_locked, ai_editable: editingPiece.ai_editable })
                    .eq('id', editingPiece.id);
            } else {
                const { id, ...newPieceData } = editingPiece;
                // Haetaan palautusarvo (.select()), jotta saamme uuden ID:n talteen heti luonnin jälkeen
                const { data, error } = await supabase.from('puzzle_pieces')
                    .insert([newPieceData])
                    .select();
                    
                if (error) throw error;
                
                // Päivitetään tilaan uusi ID, jotta seuraava tallennus päivittää tätä samaa riviä, eikä luo uutta kopiota
                if (data && data.length > 0) {
                    setEditingPiece(prev => ({ ...prev, id: data[0].id }));
                }
            }
            
            // Merkitään muutokset tehdyiksi ja näytetään onnistumisilmoitus
            setHasChanges(true);
            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 3000);

        } catch (error) { 
            alert("Virhe: " + error.message); 
        } 
    };

    // Uusi funktio sulkemisen hallintaan
    const handleCloseModal = async () => {
        if (hasChanges) {
            // Jos asioita tallennettiin, päivitetään lista ennen sulkemista
            await refreshData();
        }
        setIsModalOpen(false);
        setHasChanges(false);
    };

    const handlePieceDelete = async (id, title) => {
        if (!window.confirm(`Poistetaanko palikka "${title}"?`)) return;
        await supabase.from('puzzle_pieces').delete().eq('id', id);
        await refreshData();
    };

    const insertVariable = (varTitle) => {
        const textarea = document.getElementById('piece-content');
        const textToInsert = `{${varTitle}}`;
        
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newContent = editingPiece.content.substring(0, start) + textToInsert + editingPiece.content.substring(end);
            setEditingPiece(prev => ({ ...prev, content: newContent }));
            
            // Palautetaan kursori heti lisätyn tekstin perään
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
            }, 0);
        } else {
            setEditingPiece(prev => ({ ...prev, content: prev.content + textToInsert }));
        }
    };

    return (
        <div className="section-container" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0 }}>🧱 Palikkasorvaamo</h2>
                <button onClick={() => openPieceModal()} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} /> Uusi palikka
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {Object.entries(groupedAllPieces).sort().map(([category, categoryPieces]) => (
                    <div key={category} style={{ backgroundColor: 'var(--color-surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-primary)', borderBottom: '2px solid var(--color-background)', paddingBottom: '0.5rem' }}>{category}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {categoryPieces.map(piece => (
                                <div key={piece.id} style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1rem', backgroundColor: piece.is_locked ? 'var(--color-background-alt)' : '#fff', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0, paddingRight: '2.5rem' }}>{piece.title}</h4>
                                        <div style={{ display: 'flex', gap: '0.5rem', position: 'absolute', top: '1rem', right: '1rem' }}>
                                            <button onClick={() => openPieceModal(piece)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><Edit3 size={16} /></button>
                                            <button onClick={() => handlePieceDelete(piece.id, piece.title)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: '4px', backgroundColor: piece.is_locked ? 'rgba(227, 74, 74, 0.1)' : 'rgba(30, 154, 90, 0.1)', color: piece.is_locked ? 'var(--color-danger)' : 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                            {piece.is_locked ? <Lock size={12}/> : <Unlock size={12}/>} {piece.is_locked ? 'Lukittu' : 'Muokattava'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', WebkitLineClamp: 3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>{piece.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && editingPiece && (
                <div className="admin-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="admin-modal-content" style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>{editingPiece.id ? 'Muokkaa palikkaa' : 'Uusi palikka'}</h3>
                            <button type="button" onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
                        </div>
                        <form onSubmit={handlePieceSave}>
                            <div className="form-row">
                                <label>Kategoria</label>
                                <input required placeholder="Valitse listasta tai kirjoita oma" value={editingPiece.category} onChange={(e) => setEditingPiece({...editingPiece, category: e.target.value})} className="form-input" list="cat-list"/>
                                <datalist id="cat-list">
                                    <option value="Tervehdys"/>
                                    <option value="Ydinviesti"/>
                                    <option value="Lakiteksti"/>
                                    <option value="Ohje"/>
                                    <option value="Allekirjoitus"/>
                                    <option value="Vakiomuuttuja"/>
                                    <option value="Valintalista"/>
                                </datalist>
                            </div>

                            {editingPiece.category === 'Vakiomuuttuja' && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', backgroundColor: 'rgba(255,107,0,0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                                    💡 <b>Vakiomuuttuja:</b> Kirjoita Koodisana-kenttään täsmälleen sama koodisana jota haluat käyttää (esim. <i>vaasankatu</i>). Sisältö-kenttään tulee korvaava teksti (esim. <i>Vaasankatu 2, 00510 Helsinki</i>).
                                </div>
                            )}

                            {editingPiece.category === 'Valintalista' && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', backgroundColor: 'rgba(255,107,0,0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                                    💡 <b>Valintalista (Pudotusvalikko):</b> Koodisana on listan nimi (esim. <i>tapaamispaikka</i>). Kirjoita Sisältö-kenttään vaihtoehdot allekkain. Voit käyttää alla olevia pikanappeja lisätäksesi olemassa olevia vakiomuuttujia listaan!
                                </div>
                            )}

                            <div className="form-row">
                                <label>{['Vakiomuuttuja', 'Valintalista'].includes(editingPiece.category) ? 'Koodisana (ilman sulkeita, esim. tapaamispaikka)' : 'Otsikko'}</label>
                                <input required value={editingPiece.title} onChange={(e) => setEditingPiece({...editingPiece, title: e.target.value})} className="form-input" />
                            </div>
                            
                            <div className="form-row">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                    <label style={{ margin: 0 }}>Sisältö {editingPiece.category === 'Valintalista' && '(Yksi vaihtoehto per rivi)'}</label>
                                </div>
                                
                                {/* PIKAVALINTAPANEELI MUUTTUJILLE */}
                                {vakiomuuttujat.length > 0 && !['Vakiomuuttuja'].includes(editingPiece.category) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', alignSelf: 'center', marginRight: '0.2rem' }}>Lisää muuttuja:</span>
                                        {vakiomuuttujat.map(v => (
                                            <button 
                                                type="button" 
                                                key={v.id} 
                                                onClick={() => insertVariable(v.title)} 
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }}
                                                title={`Korvautuu tekstillä: ${v.content}`}
                                            >
                                                {`{${v.title}}`}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <textarea id="piece-content" required value={editingPiece.content} onChange={(e) => setEditingPiece({...editingPiece, content: e.target.value})} className="form-input" rows="5" style={{ whiteSpace: 'pre-wrap' }} />
                            </div>

                            <div className="form-row" style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                                <label className="modern-checkbox-label">
                                    <input type="checkbox" className="modern-checkbox" checked={editingPiece.is_locked} onChange={(e) => setEditingPiece({...editingPiece, is_locked: e.target.checked})}/> 
                                    Lukitse teksti (suositeltu muuttujille ja ohjeille)
                                </label>
                            </div>
                            
                            {/* Alapalkki: Ilmoitus vasemmalla (jos tilaa), napit oikealla */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                                {saveSuccess && (
                                    <span style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '0.9rem' }}>
                                        ✓ Tallennus onnistui
                                    </span>
                                )}
                                <button type="button" className="btn btn--secondary" onClick={handleCloseModal}>Sulje</button>
                                <button type="submit" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={16}/> Tallenna
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PieceEditor;