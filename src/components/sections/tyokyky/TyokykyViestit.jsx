// --- src/components/sections/tyokyky/TyokykyViestit.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { Stethoscope, CalendarDays, FileDown, Copy, Check, CheckCircle, Info } from 'lucide-react';
import Button from '../../common/Button';
import Checkbox from '../../common/Checkbox';
import AlertBox from '../../common/AlertBox';
import Modal from '../../common/Modal';
import Accordion from '../../common/Accordion';

const TyokykyViestit = ({ state, actions, toimenpiteet = [] }) => {
    const [activeTab, setActiveTab] = useState('lahete');
    const [isLoading, setIsLoading] = useState(true);
    
    // Tietokannasta haettavat datat
    const [laheteTavoitteet, setLaheteTavoitteet] = useState([]);
    const [laheteKysymykset, setLaheteKysymykset] = useState([]);
    const [puzzleTexts, setPuzzleTexts] = useState({ terveystarkastus: '', dokumentit: '' });

    // Käyttäjän valinnat (Lähete)
    const [valitutTavoitteet, setValitutTavoitteet] = useState(['tavoite_blausunto']);
    const [valitutKysymykset, setValitutKysymykset] = useState(['kysymys_terveydentila', 'kysymys_rajoitteet', 'kysymys_kuntoutus']);
    
    // Käyttäjän syötteet (Dokumenttipyyntö)
    const [dokumentitSyote, setDokumentitSyote] = useState('');

    // Modaalin ja kopioinnin tilat
    const [modalData, setModalData] = useState({ isOpen: false, signal: '', toimenpideNimi: '' });
    const [copiedStates, setCopiedStates] = useState({ lahete: false, terveystarkastus: false, dokumentti: false, preview: false });

    // Asiakkaan tiedot lomakkeelta
    const oirekuvaus = state['custom-tyokyky_alentuma_kuvaus'] || '[Asiakkaan kuvaus puuttuu. Kirjaa tiedot lomakkeelle ylemmäs kohtaan "Kuvaus työkyvyn alentumasta".]';
    const omaArvioNumero = state['custom-tyokyky_oma_arvio'];
    const omaArvio = omaArvioNumero ? `\n\nAsiakas arvioi oman työkykynsä asteikolla 1-10 tasolle ${omaArvioNumero}.` : '';

    // ==========================================
    // ÄLYKÄS DATAN HAKU TOIMENPITEISTÄ (DOKUMENTIT)
    // ==========================================
    useEffect(() => {
        try {
            const valitutExtrat = JSON.parse(state['custom-tyokyky_valitut_extrat'] || "[]");
            const docKeywords = ['todistuksen', 'todistus', 'lausunto', 'lausunnon', 'asiakirja', 'epikriisi'];
            
            const docToimenpiteet = toimenpiteet
                .filter(t => valitutExtrat.includes(t.avainsana))
                .filter(t => {
                    const txt = (t.lyhyt || t.teksti || '').toLowerCase();
                    return docKeywords.some(kw => txt.includes(kw));
                })
                .map(t => {
                    let nimi = (t.lyhyt || t.teksti).toLowerCase();
                    nimi = nimi.replace(/^(toimittaa|toimita|hakee|pyytää)\s+/g, '');
                    nimi = nimi.replace(/todistuksen$/, 'todistus');
                    nimi = nimi.replace(/lausunnon$/, 'lausunto');
                    nimi = nimi.replace(/epikriisin$/, 'epikriisi');
                    return nimi.charAt(0).toUpperCase() + nimi.slice(1);
                });

            const docStateKey = Object.keys(state).find(key => key.startsWith('custom-tyokyky_var_toimenpide_asiakirjojen_toimitus_'));
            
            let kaikkiDokumentit = [...docToimenpiteet];
            if (docStateKey && state[docStateKey] && !kaikkiDokumentit.includes(state[docStateKey])) {
                kaikkiDokumentit.push(state[docStateKey]);
            }

            if (kaikkiDokumentit.length > 0) {
                const formattedDocs = kaikkiDokumentit.length > 1 
                    ? kaikkiDokumentit.slice(0, -1).join(', ') + ' ja ' + kaikkiDokumentit.slice(-1)
                    : kaikkiDokumentit[0];
                setDokumentitSyote(formattedDocs);
            }
        } catch (e) {
            console.error("Virhe dokumenttien synkronoinnissa:", e);
        }
    }, [state['custom-tyokyky_valitut_extrat'], toimenpiteet, state]);

    // 1. HAETAAN DATA (Phrases ja Puzzles)
    useEffect(() => {
        const fetchViestiData = async () => {
            setIsLoading(true);
            try {
                const { data: phrasesData } = await supabase
                    .from('phrases')
                    .select('phrase_key, short_title, base_text, grouping_key')
                    .in('grouping_key', ['lahete_tavoite', 'lahete_kysymys'])
                    .order('priority_score', { ascending: true });

                if (phrasesData) {
                    setLaheteTavoitteet(phrasesData.filter(p => p.grouping_key === 'lahete_tavoite'));
                    setLaheteKysymykset(phrasesData.filter(p => p.grouping_key === 'lahete_kysymys'));
                }

                const puzzleIds = ['b231179e-8f4b-4325-8372-ceac3332e4e1', 'c94c94dd-a4fe-40a2-9e2d-678e3f2039a4'];
                const { data: bps } = await supabase
                    .from('puzzle_blueprints')
                    .select('puzzle_id, piece_id, order_index')
                    .in('puzzle_id', puzzleIds)
                    .order('order_index', { ascending: true });

                if (bps && bps.length > 0) {
                    const pieceIds = bps.map(bp => bp.piece_id);
                    const { data: pieces } = await supabase.from('puzzle_pieces').select('id, content').in('id', pieceIds);
                    const piecesMap = pieces.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.content }), {});
                    
                    let tkText = '';
                    bps.filter(bp => bp.puzzle_id === 'b231179e-8f4b-4325-8372-ceac3332e4e1').forEach(bp => {
                        if (piecesMap[bp.piece_id]) tkText += piecesMap[bp.piece_id] + '\n\n';
                    });

                    let dokText = '';
                    bps.filter(bp => bp.puzzle_id === 'c94c94dd-a4fe-40a2-9e2d-678e3f2039a4').forEach(bp => {
                        if (piecesMap[bp.piece_id]) dokText += piecesMap[bp.piece_id] + '\n\n';
                    });

                    setPuzzleTexts({ terveystarkastus: tkText.trim(), dokumentit: dokText.trim() });
                }
            } catch (err) {
                console.error("Virhe viestidatan latauksessa:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchViestiData();
    }, []);

    // 2. TEKSTIN GENEROINTI (Ottaa parametrina tyypin, jotta pikakopiointi toimii)
    const generateTextFor = (type) => {
        const expertName = 'Asiantuntija'; 
        
        if (type === 'terveystarkastus') {
            return puzzleTexts.terveystarkastus.replace(/{expertName}/g, expertName);
        }
        
        if (type === 'dokumentti') {
            return puzzleTexts.dokumentit
                .replace(/{dokumentit}/g, dokumentitSyote || '[Määrittele pyydettävät asiakirjat]')
                .replace(/{expertName}/g, expertName);
        }
        
        if (type === 'lahete') {
            let text = 'Asiakas on työttömänä työnhakijana työllisyyspalveluissa. Asiakkaan tilanteen edistämiseksi ja sopivien työllistymis- tai kuntoutusvaihtoehtojen suunnittelemiseksi tarvitsemme ajantasaisen arvion hänen työkyvystään.\n\n';
            text += `Asiakkaan oman kertoman mukaan: ${oirekuvaus}${omaArvio}\n\n`;
            text += 'TAVOITE\n';
            valitutTavoitteet.forEach(tavKey => {
                const phrase = laheteTavoitteet.find(t => t.phrase_key === tavKey);
                if (phrase) text += `${phrase.base_text}\n\n`;
            });

            if (valitutKysymykset.length > 0) {
                text += 'Toivomme lausunnossa otettavan kantaa erityisesti seuraaviin asioihin:\n\n';
                valitutKysymykset.forEach(kysKey => {
                    const phrase = laheteKysymykset.find(k => k.phrase_key === kysKey);
                    if (phrase) text += `${phrase.base_text}\n\n`;
                });
            }

            text += 'Tämä arvio on välttämätön asiakkaan palveluprosessin ja oikea-aikaisten tukitoimien jatkosuunnittelun tueksi.';
            return text;
        }
        return '';
    };

    // 3. ÄLYKÄS KOPIOINTI JA MODAALI
    const handleSmartCopy = (type, triggerKey) => {
        const textToCopy = generateTextFor(type);
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Visuaalinen check-merkki napille
            setCopiedStates(prev => ({ ...prev, [triggerKey]: true }));
            setTimeout(() => setCopiedStates(prev => ({ ...prev, [triggerKey]: false })), 2000);

            // Avataan modaali
            if (type === 'lahete') {
                setModalData({ isOpen: true, signal: 'toimenpide_laakarin_lahete', toimenpideNimi: 'Lääkärin työkykyarvioon hakeutuminen ja B-lausunnon toimittaminen' });
            } else if (type === 'terveystarkastus') {
                setModalData({ isOpen: true, signal: 'toimenpide_terveystarkastus', toimenpideNimi: 'Työttömien terveystarkastukseen osallistuminen' });
            } else if (type === 'dokumentti') {
                setModalData({ isOpen: true, signal: 'toimenpide_asiakirjojen_toimitus', toimenpideNimi: 'Asiakirjojen toimittaminen' });
            }
        });
    };

    const handleAcceptModal = () => {
        if (actions.onAddSignal && modalData.signal) {
            actions.onAddSignal(modalData.signal);
            try {
                let extrat = JSON.parse(state['custom-tyokyky_valitut_extrat'] || "[]");
                if (!extrat.includes(modalData.signal)) {
                    extrat.push(modalData.signal);
                    actions.onUpdateCustomText('tyokyky_valitut_extrat', JSON.stringify(extrat));
                }
            } catch(e) {}
        }
        setModalData({ isOpen: false, signal: '', toimenpideNimi: '' });
    };

    const toggleList = (list, setList, key) => {
        if (list.includes(key)) setList(list.filter(i => i !== key));
        else setList([...list, key]);
    };

    if (isLoading) return null;

    // Piirretään pikanappi
    const renderPikaNappi = (title, type, iconKey) => {
        const isCopied = copiedStates[iconKey];
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                <span className="text-sm fw-semibold text-primary">{title}</span>
                <button 
                    type="button"
                    onClick={() => handleSmartCopy(type, iconKey)}
                    className="btn-copy-circle"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: isCopied ? 'var(--color-success)' : 'rgba(255, 107, 0, 0.1)',
                        color: isCopied ? '#fff' : 'var(--color-primary)',
                        border: 'none', cursor: 'pointer',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isCopied ? 'rotate(360deg) scale(1.1)' : 'rotate(0deg) scale(1)'
                    }}
                    title="Kopioi leikepöydälle"
                >
                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
            </div>
        );
    };

    return (
        <div className="card-inner" style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--color-primary-light)' }}>
            
            <h3 className="text-lg fw-semibold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Stethoscope size={20} /> Työkyvyn viestikeskus
            </h3>
            
            <p className="text-sm text-secondary" style={{ marginBottom: '1.5rem' }}>
                Generoi viestit ja aseta toimenpiteet suunnitelmaan yhdellä klikkauksella.
            </p>

            {/* PIKAKAISTA - Usein toistuvat toiminnot yhdellä napilla */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                {renderPikaNappi('Lääkärinlähete (Oletus)', 'lahete', 'lahete')}
                {renderPikaNappi('Terveystarkastus', 'terveystarkastus', 'terveystarkastus')}
                {renderPikaNappi('Dokumenttipyyntö', 'dokumentti', 'dokumentti')}
            </div>

            {/* HIENOSÄÄTÖ - Piilotettu haitariin (Progressive disclosure) */}
            <Accordion title="Hienosäädä viestien sisältöä" defaultOpen={false}>
                
                {/* VÄLILEHDET */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <Button variant={activeTab === 'lahete' ? 'primary' : 'secondary'} onClick={() => setActiveTab('lahete')} icon={Stethoscope} size="sm">
                        Lääkärinlähete
                    </Button>
                    <Button variant={activeTab === 'terveystarkastus' ? 'primary' : 'secondary'} onClick={() => setActiveTab('terveystarkastus')} icon={CalendarDays} size="sm">
                        Terveystarkastus
                    </Button>
                    <Button variant={activeTab === 'dokumentti' ? 'primary' : 'secondary'} onClick={() => setActiveTab('dokumentti')} icon={FileDown} size="sm">
                        Dokumenttipyyntö
                    </Button>
                </div>

                {/* SISÄLTÖ: LÄHETE */}
                {activeTab === 'lahete' && (
                    <div className="grid-cols-2" style={{ gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
                        <div>
                            <span className="text-md fw-semibold block" style={{ marginBottom: '0.75rem' }}>Lähetteen tavoite</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {laheteTavoitteet.map(tav => (
                                    <Checkbox key={tav.phrase_key} label={tav.short_title} checked={valitutTavoitteet.includes(tav.phrase_key)} onChange={() => toggleList(valitutTavoitteet, setValitutTavoitteet, tav.phrase_key)} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-md fw-semibold block" style={{ marginBottom: '0.75rem' }}>Kantaaottopyynnöt lääkärille</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {laheteKysymykset.map(kys => (
                                    <Checkbox key={kys.phrase_key} label={kys.short_title} checked={valitutKysymykset.includes(kys.phrase_key)} onChange={() => toggleList(valitutKysymykset, setValitutKysymykset, kys.phrase_key)} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* SISÄLTÖ: DOKUMENTIT */}
                {activeTab === 'dokumentti' && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="text-md fw-semibold block" style={{ marginBottom: '0.5rem' }}>Mitä asiakirjoja pyydetään?</label>
                        <input 
                            type="text" className="form-input" value={dokumentitSyote} 
                            onChange={(e) => setDokumentitSyote(e.target.value)} 
                            placeholder="Esim. B-lausunto, C-lausunto tai epikriisi..."
                            style={{ width: '100%', maxWidth: '600px' }}
                        />
                        <small className="block text-muted" style={{ marginTop: '0.5rem' }}>
                            Vinkki: Jos kirjasit asiakirjat "Toimenpiteet"-osiossa, ne näkyvät automaattisesti tässä.
                        </small>
                    </div>
                )}

                {/* ESIKATSELU */}
                <AlertBox type="info" customStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <h4 className="text-sm fw-semibold text-secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Info size={16} /> Viestin esikatselu:
                        </h4>
                        
                        <Button 
                            variant="primary" size="sm" icon={copiedStates.preview ? Check : Copy} 
                            onClick={() => handleSmartCopy(activeTab, 'preview')}
                            style={{ backgroundColor: copiedStates.preview ? 'var(--color-success)' : '' }}
                        >
                            {copiedStates.preview ? 'Kopioitu!' : 'Kopioi leikepöydälle'}
                        </Button>
                    </div>
                    <div className="text-sm text-slate-700 lh-tight" style={{ whiteSpace: 'pre-wrap', padding: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)' }}>
                        {generateTextFor(activeTab)}
                    </div>
                </AlertBox>
            </Accordion>

            {/* ÄLYKÄS POP-UP MODAALI */}
            <Modal 
                isOpen={modalData.isOpen} 
                onClose={() => setModalData({ isOpen: false, signal: '', toimenpideNimi: '' })}
                title="Täydennetäänkö suunnitelmaa?"
                icon={CheckCircle}
                maxWidth="550px"
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p className="text-base" style={{ marginBottom: '1.5rem' }}>
                        Kopioit viestin onnistuneesti. Haluatko, että järjestelmä lisää automaattisesti asiakkaan Suunnitelma-osioon toimenpiteen: 
                        <strong className="text-lg fw-bold text-primary block" style={{ marginTop: '0.75rem' }}>
                            "{modalData.toimenpideNimi}"
                        </strong>
                    </p>
                    <AlertBox type="info" customStyle={{ marginBottom: '1.5rem' }}>
                        Tämä valinta pitää järjestelmän ajan tasalla ja mahdollistaa esimerkiksi työnhakuvelvollisuuden (THV) automaattisen huomioimisen jatkossa.
                    </AlertBox>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={() => setModalData({ isOpen: false, signal: '', toimenpideNimi: '' })}>
                            Ei, pelkkä kopiointi riittää
                        </Button>
                        <Button variant="primary" onClick={handleAcceptModal}>
                            Kyllä, lisää toimenpide
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default TyokykyViestit;