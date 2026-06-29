import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useViestiKokoamo(selectedRule, basket, isMandatory, expertLocations = [], interpreterState = {}) {
    const [virallinenTeksti, setVirallinenTeksti] = useState('');
    const [smsTeksti, setSmsTeksti] = useState('');
    const [virallinenTekstiICS, setVirallinenTekstiICS] = useState('');
    const [resolvedAddress, setResolvedAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const activeSlot = basket && basket.length > 0 ? basket[0] : null;

    const { dateStr, timeStr, meetingMode, activeDateStr } = useMemo(() => {
        if (!activeSlot) return { dateStr: '{date}', timeStr: '{time}', meetingMode: 'puhelu', activeDateStr: '' };
        const d = new Date(activeSlot.time);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return {
            dateStr: d.toLocaleDateString('fi-FI'),
            timeStr: d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
            meetingMode: activeSlot.mode || 'puhelu',
            activeDateStr: `${yyyy}-${mm}-${dd}`
        };
    }, [activeSlot]);

    const { currentLocName, currentLocType } = useMemo(() => {
        const row = expertLocations.find(l => l.date === activeDateStr);
        return {
            currentLocName: row?.location_name || '',
            currentLocType: row?.location_type || ''
        };
    }, [activeDateStr, expertLocations]);

    useEffect(() => {
        if (!selectedRule || !activeSlot) {
            setVirallinenTeksti('');
            setVirallinenTekstiICS('');
            setSmsTeksti('');
            setResolvedAddress('');
            return;
        }

        const kasaaViestit = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const templates = selectedRule.metadata?.message_templates || {};
                const puzzleId = templates[meetingMode];

                if (!puzzleId) throw new Error(`Säännön metadatasta puuttuu 'message_templates.${meetingMode}'`);

                const [puzzleRes, blueprintsRes] = await Promise.all([
                    supabase.from('puzzles').select('*').eq('id', puzzleId).single(),
                    supabase.from('puzzle_blueprints').select('piece_id, order_index').eq('puzzle_id', puzzleId).order('order_index', { ascending: true })
                ]);

                if (puzzleRes.error) throw puzzleRes.error;
                if (blueprintsRes.error) throw blueprintsRes.error;

                const puzzle = puzzleRes.data;
                const blueprints = blueprintsRes.data;
                let altBlueprints = null;

                if (puzzle.title.includes('(Aika määritelty)')) {
                    const altTitle = puzzle.title.replace('(Aika määritelty)', '(Yleinen)');
                    const { data: altPuzzle } = await supabase.from('puzzles').select('id').eq('title', altTitle).single();
                    if (altPuzzle) {
                        const { data: altBps } = await supabase.from('puzzle_blueprints').select('piece_id, order_index').eq('puzzle_id', altPuzzle.id).order('order_index', { ascending: true });
                        if (altBps) altBlueprints = altBps;
                    }
                }

                // TULKKAUS-ADDONIN VALINTA DYNAAMISESTI INTERPRETER STATESTA
                let addonsText = '';
                try {
                    const addonsArr = typeof puzzle.addons === 'string' ? JSON.parse(puzzle.addons) : (puzzle.addons || []);
                    if (addonsArr.length > 0) {
                        if (interpreterState.hasTulkkiSignal) {
                            const addon = addonsArr.find(a => a.id === 'tulkki_osallistuu');
                            if (addon) addonsText = addon.text;
                        } else if (interpreterState.needsInterpreter) {
                            const addon = addonsArr.find(a => a.id === 'tulkki_tarve');
                            if (addon) addonsText = addon.text;
                        }
                    }
                } catch (e) {
                    console.warn("Addons-käsittelyvirhe:", e);
                }

                const pieceIds = blueprints.map(bp => bp.piece_id);
                const altPieceIds = altBlueprints ? altBlueprints.map(bp => bp.piece_id) : [];
                const smsPieceId = '26c9b93b-2bf4-42cc-8d16-c173f2abd49d';
                
                const allTargetIds = [...new Set([...pieceIds, ...altPieceIds, smsPieceId])];

                const [piecesRes, varsRes] = await Promise.all([
                    supabase.from('puzzle_pieces').select('*').in('id', allTargetIds),
                    supabase.from('puzzle_pieces').select('title, content').eq('category', 'Vakiomuuttuja')
                ]);

                if (piecesRes.error) throw piecesRes.error;
                if (varsRes.error) throw varsRes.error;

                const piecesMap = piecesRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                const dbVariables = varsRes.data.reduce((acc, curr) => ({ ...acc, [curr.title]: curr.content }), {});

                let locAddress = 'Puhelin';
                if (meetingMode === 'kaynti') {
                    if (currentLocType === 'eta') {
                        locAddress = 'Etäyhteys / Puhelin';
                    } else {
                        const normalize = (str) => (str || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').trim();
                        const normLoc = normalize(currentLocName); 
                        const keys = Object.keys(dbVariables);
                        
                        let matchedKey = keys.find(k => normalize(k) === normLoc);
                        if (!matchedKey && normLoc) {
                            matchedKey = keys.find(k => normalize(k).includes(normLoc) || normLoc.includes(normalize(k)));
                        }
                        
                        if (matchedKey) {
                            locAddress = dbVariables[matchedKey];
                        } else if (currentLocName) {
                            locAddress = currentLocName; 
                        } else {
                            locAddress = 'Asiointipaikka'; 
                        }
                    }
                }
                
                setResolvedAddress(locAddress); 

                const korvaaMuuttujat = (teksti) => {
                    if (!teksti) return '';
                    let korvattu = teksti
                        .replace(/{date}/g, dateStr)
                        .replace(/{time}/g, timeStr)
                        .replace(/{expertName}/g, 'Vesa Nessling')
                        .replace(/{tapaamispaikka}/g, locAddress)
                        .replace(/{reason}/g, 'työnhakukeskustelu')
                        .replace(/{tekstiviesti}/g, `${dateStr} klo ${timeStr}`)
                        .replace(/{addons}/g, addonsText);
                    
                    Object.keys(dbVariables).forEach(key => {
                        const regex = new RegExp(`{${key}}`, 'g');
                        korvattu = korvattu.replace(regex, dbVariables[key]);
                    });

                    korvattu = korvattu.replace(/\n\s*\n\s*\n/g, '\n\n');
                    return korvattu.trim();
                };

                let virallinenKoottu = '';
                blueprints.forEach(bp => {
                    const piece = piecesMap[bp.piece_id];
                    if (piece) {
                        if (!isMandatory && piece.category === 'Lakiteksti') return; 
                        virallinenKoottu += piece.content + '\n\n';
                    }
                });
                
                let virallinenICSKoottu = '';
                if (altBlueprints) {
                    altBlueprints.forEach(bp => {
                        const piece = piecesMap[bp.piece_id];
                        if (piece) {
                            if (!isMandatory && piece.category === 'Lakiteksti') return; 
                            virallinenICSKoottu += piece.content + '\n\n';
                        }
                    });
                } else {
                    virallinenICSKoottu = virallinenKoottu;
                }

                setVirallinenTeksti(korvaaMuuttujat(virallinenKoottu));
                setVirallinenTekstiICS(korvaaMuuttujat(virallinenICSKoottu)); 

                const smsPiece = piecesMap[smsPieceId];
                if (smsPiece) {
                    setSmsTeksti(korvaaMuuttujat(smsPiece.content));
                } else {
                    setSmsTeksti(`Tavoittelen sinua puhelimitse ${dateStr} klo ${timeStr}. Yhteydenoton aiheena on työnhakukeskustelu.`);
                }

            } catch (err) {
                console.error("Viestikokoamo virhe:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        kasaaViestit();
    }, [selectedRule, basket, isMandatory, dateStr, timeStr, meetingMode, activeDateStr, expertLocations, currentLocName, currentLocType, interpreterState]);

    return { virallinenTeksti, virallinenTekstiICS, smsTeksti, isLoading, error, resolvedAddress };
}