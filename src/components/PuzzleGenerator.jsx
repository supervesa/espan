import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { PenTool, Blocks, Combine, Zap } from 'lucide-react';
import PuzzleComposer from './PuzzleComposer';
import PieceEditor from './PieceEditor';
import PuzzleBuilder from './PuzzleBuilder';

function PuzzleGenerator({ state }) {
    const [activeMode, setActiveMode] = useState('composer');
    const [puzzles, setPuzzles] = useState([]);
    const [allPieces, setAllPieces] = useState([]);
    const [blueprints, setBlueprints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [omniboxPrompt, setOmniboxPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedGreeting, setSelectedGreeting] = useState('');
    const [selectedLegal, setSelectedLegal] = useState('');
    const [selectedSignature, setSelectedSignature] = useState('');
    
    const [forcedPuzzleId, setForcedPuzzleId] = useState(null);
    const [suggestedPieces, setSuggestedPieces] = useState([]);

    // KORJAUS: Lisätty isInitialLoad parametri. Oletuksena false (taustapäivitys).
    const fetchData = async (isInitialLoad = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            const [puzRes, piecesRes, bpRes] = await Promise.all([
                supabase.from('puzzles').select('*').order('title'),
                supabase.from('puzzle_pieces').select('*').order('title'),
                supabase.from('puzzle_blueprints').select('*').order('order_index')
            ]);
            if (puzRes.data) setPuzzles(puzRes.data);
            if (piecesRes.data) {
                setAllPieces(piecesRes.data);
                const greetings = piecesRes.data.filter(p => p.category === 'Tervehdys');
                const signatures = piecesRes.data.filter(p => p.category === 'Allekirjoitus');
                if (greetings.length > 0) setSelectedGreeting(greetings[0].id);
                if (signatures.length > 0) setSelectedSignature(signatures[0].id);
            }
            if (bpRes.data) setBlueprints(bpRes.data);
        } catch (error) { console.error(error); }
        if (isInitialLoad) setIsLoading(false);
    };

    // Alkulataus asettaa isInitialLoad = true, jotta näytetään latausruutu
    useEffect(() => { fetchData(true); }, []);

    const greetings = useMemo(() => allPieces.filter(p => p.category === 'Tervehdys'), [allPieces]);
    const legals = useMemo(() => allPieces.filter(p => p.category === 'Lakiteksti'), [allPieces]);
    const signatures = useMemo(() => allPieces.filter(p => p.category === 'Allekirjoitus'), [allPieces]);

    const handleGenerateMessage = async () => {
        if (!omniboxPrompt) return;
        setIsGenerating(true);
        
        try {
            const availablePiecesForAi = allPieces
                .filter(p => !['Tervehdys', 'Allekirjoitus'].includes(p.category))
                .map(p => ({ id: p.id, title: p.title, category: p.category }));

            const response = await fetch('/.netlify/functions/generatePuzzleMessage', {
                method: 'POST',
                body: JSON.stringify({ prompt: omniboxPrompt, availablePieces: availablePiecesForAi })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            const { ydinviesti, ehdotetut_palikat } = data;

            const aiPuzzleId = 'draft-puzzle-' + Date.now();
            const aiPieceId = 'draft-piece-' + Date.now();

            const aiPiece = {
                id: aiPieceId, category: 'Ydinviesti', title: 'Luonnosteltu ydinviesti',
                content: ydinviesti, is_locked: false, ai_editable: true
            };

            const aiPuzzle = {
                id: aiPuzzleId, title: 'Viestin pikaluonnos', category: 'Luonnokset',
                subject: 'Yhteydenotto Helsingin työllisyyspalveluista', fields: [], addons: []
            };

            const newBlueprints = [];
            let order = 1;
            if (selectedGreeting) newBlueprints.push({ puzzle_id: aiPuzzleId, piece_id: selectedGreeting, order_index: order++ });
            newBlueprints.push({ puzzle_id: aiPuzzleId, piece_id: aiPieceId, order_index: order++ });
            if (selectedLegal) newBlueprints.push({ puzzle_id: aiPuzzleId, piece_id: selectedLegal, order_index: order++ });
            if (selectedSignature) newBlueprints.push({ puzzle_id: aiPuzzleId, piece_id: selectedSignature, order_index: order++ });

            setAllPieces(prev => [...prev, aiPiece]);
            setPuzzles(prev => [...prev, aiPuzzle]);
            setBlueprints(prev => [...prev, ...newBlueprints]);
            
            setSuggestedPieces(ehdotetut_palikat || []);
            setOmniboxPrompt('');
            setActiveMode('composer');
            setForcedPuzzleId(aiPuzzleId);

        } catch (error) { alert("Generointi epäonnistui: " + error.message); }
        setIsGenerating(false);
    };

    if (isLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Ladataan työtilaa...</div>;

    return (
        <div id="osio-puzzle" style={{ width: '100%' }}>
            
            {/* SANKARIALUE - Salainen ase (Pikaluonnos) */}
            <div className="section-container" style={{ marginBottom: '2rem', background: 'var(--color-surface)', border: '2px solid var(--color-primary)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                    <Zap color="var(--color-primary)" size={24} /> Viestin pikaluonnos
                </h2>
                <div style={{ marginBottom: '1rem' }}>
                    <textarea 
                        className="form-input" rows="3" 
                        placeholder="Kirjoita lyhyesti asiasi ranskansalaisilla viivoilla (esim. 'Asiakas perui ajan, laita uusi haastatteluaika ja pyydä lääkärintodistus'). Järjestelmä muotoilee tekstin."
                        value={omniboxPrompt} onChange={(e) => setOmniboxPrompt(e.target.value)}
                        style={{ fontSize: '1.05rem', padding: '1rem', resize: 'vertical', border: '1px solid var(--color-border)', backgroundColor: '#fff' }}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-background-alt)', padding: '1rem', borderRadius: '8px' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>👋 Tervehdys</label>
                        <select className="modern-select" value={selectedGreeting} onChange={(e) => setSelectedGreeting(e.target.value)}>
                            <option value="">-- Ei tervehdystä --</option>
                            {greetings.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>⚖️ Lakiteksti / Ohje</label>
                        <select className="modern-select" value={selectedLegal} onChange={(e) => setSelectedLegal(e.target.value)}>
                            <option value="">-- Ei lakitekstiä --</option>
                            {legals.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>✍️ Allekirjoitus</label>
                        <select className="modern-select" value={selectedSignature} onChange={(e) => setSelectedSignature(e.target.value)}>
                            <option value="">-- Ei allekirjoitusta --</option>
                            {signatures.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleGenerateMessage} disabled={isGenerating || !omniboxPrompt} className="btn" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={20} /> {isGenerating ? 'Muotoillaan viestiä...' : 'Muotoile viestiksi'}
                </button>
            </div>

            {/* Navigaatio */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', backgroundColor: 'var(--color-surface)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', width: 'fit-content', margin: '0 auto 2rem auto' }}>
                <button onClick={() => setActiveMode('composer')} className={`btn ${activeMode !== 'composer' ? 'btn--secondary' : ''}`} style={{ border: 'none', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><PenTool size={18} /> Generaattori</button>
                <button onClick={() => setActiveMode('pieces')} className={`btn ${activeMode !== 'pieces' ? 'btn--secondary' : ''}`} style={{ border: 'none', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Blocks size={18} /> Palikkasorvaamo</button>
                <button onClick={() => setActiveMode('builder')} className={`btn ${activeMode !== 'builder' ? 'btn--secondary' : ''}`} style={{ border: 'none', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Combine size={18} /> Kokoamo</button>
            </div>

            {activeMode === 'composer' && <PuzzleComposer state={state} puzzles={puzzles} allPieces={allPieces} blueprints={blueprints} forcedPuzzleId={forcedPuzzleId} initialSuggestedPieces={suggestedPieces} />}
            {activeMode === 'pieces' && <PieceEditor allPieces={allPieces} refreshData={fetchData} />}
            {activeMode === 'builder' && <PuzzleBuilder puzzles={puzzles} allPieces={allPieces} blueprints={blueprints} refreshData={fetchData} />}
            
        </div>
    );
}

export default PuzzleGenerator;