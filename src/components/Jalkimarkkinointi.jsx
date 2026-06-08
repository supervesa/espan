// --- src/components/Jalkimarkkinointi.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Sparkles, Mail, CheckCircle, Copy, ExternalLink, ListChecks } from 'lucide-react';

const Jalkimarkkinointi = ({ state }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    // Lentoonlähtötarkastuksen datat
    const [planItems, setPlanItems] = useState([]); 
    const [snippets, setSnippets] = useState([]);
    const [selectedSnippetIds, setSelectedSnippetIds] = useState([]);
    
    // Tekoälyn palauttamat sähköpostit
    const [emailHtml, setEmailHtml] = useState('');
    const [emailText, setEmailText] = useState('');
    
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    // 1. PANSSAROITU DATAN LUKU
    const masterAsiakas = state?.asiakas || {};
    
    const customerEmail = masterAsiakas.sahkoposti || state?.perustiedot?.sahkoposti || state?.sahkoposti || state?.asiakkaan_sahkoposti || 'Ei sähköpostia kirjattu';
    const customerName = masterAsiakas.etunimi || state?.perustiedot?.etunimi || state?.etunimi || state?.nimi || state?.asiakkaan_nimi || 'Asiakas';
    
    const lkmArvo = masterAsiakas.lkm_arvo || state?.tyonhakuvelvollisuus?.muuttujat?.LKM || state?.tyonhakuvelvollisuus?.lkm_arvo || 0;
    
    // Haetaan Suunnitelma-komponentin tallentama lopullinen teksti tekoälylle
    const finalPlanText = masterAsiakas.lopullinen_suunnitelma_teksti || '';

    // 2. HAETAAN LINKIT
    useEffect(() => {
        const fetchSnippets = async () => {
            try {
                const { data, error } = await supabase.from('info_snippets').select('*').order('label');
                if (error) throw error;
                if (data) setSnippets(data);
            } catch (err) {
                console.error("Virhe linkkien haussa:", err);
            }
        };
        fetchSnippets();
    }, []);

// 3. SUUNNITELMAN KÄÄNNÖS
    useEffect(() => {
        const fetchPlanDetails = async () => {
            const rawPlan = masterAsiakas.valitut_palvelut_id || state?.suunnitelma || [];
            const validPlanArray = Array.isArray(rawPlan) ? rawPlan : Object.keys(rawPlan).filter(k => rawPlan[k]);

            if (validPlanArray.length === 0) {
                setPlanItems([]);
                return;
            }

            try {
                // SUODATUS: Erotellaan puhtaat UUID:t (palvelut) ja tekstiavaimet (fraasit) toisistaan
                // UUID formaatti on tyypillisesti: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                
                const uuidKeys = validPlanArray.filter(key => uuidRegex.test(key));
                const textKeys = validPlanArray.filter(key => !uuidRegex.test(key));

                // Ajetaan haut erikseen vain, jos listoilla on tavaraa
                const promises = [];
                
                if (textKeys.length > 0) {
                    promises.push(supabase.from('phrases').select('phrase_key, short_title').in('phrase_key', textKeys));
                } else {
                    promises.push(Promise.resolve({ data: [] })); // Tyhjä lupaus, jotta taulukot pysyvät järjestyksessä
                }

                if (uuidKeys.length > 0) {
                    promises.push(supabase.from('services').select('id, title').in('id', uuidKeys));
                } else {
                    promises.push(Promise.resolve({ data: [] })); 
                }

                const [phrasesRes, servicesRes] = await Promise.all(promises);

                const items = [];
                if (phrasesRes.data) phrasesRes.data.forEach(p => items.push(`Toimenpide: ${p.short_title}`));
                if (servicesRes.data) servicesRes.data.forEach(s => items.push(`Palveluohjaus: ${s.title}`));
                
                setPlanItems(items);
            } catch (err) {
                console.error("Virhe suunnitelman kääntämisessä:", err);
            }
        };
        fetchPlanDetails();
    }, [JSON.stringify(masterAsiakas.valitut_palvelut_id), JSON.stringify(state?.suunnitelma)]);

    // 4. ÄLYKÄS RUKSAILU (Super-imuri, jossa on roskasuodatin!)
    useEffect(() => {
        if (snippets.length === 0) return;

        const userSignals = state?.signals || {};
        const rawPlan = masterAsiakas.valitut_palvelut_id || state?.suunnitelma || [];
        const validPlanArray = Array.isArray(rawPlan) ? rawPlan : Object.keys(rawPlan).filter(k => rawPlan[k]);
        
        const normalize = (str) => {
            if (!str) return '';
            return str.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a').trim();
        };

        // Otetaan talteen aktiiviset signaalit omana listanaan täsmäosumia varten
        const activeSignalKeys = Object.keys(userSignals)
            .filter(key => 
                userSignals[key] === true || 
                userSignals[key] === "true" || 
                (typeof userSignals[key] === 'object' && !userSignals[key].isMuted)
            )
            .map(normalize);

        const allContext = [
            ...activeSignalKeys,
            ...validPlanArray,
            ...planItems, 
            masterAsiakas.tavoiteammatti_esco_nimi || '',
            finalPlanText // TÄRKEÄÄ: Lisätään koko lopullinen teksti mukaan turvaverkoksi
        ].map(normalize).join(' ');

        const contextString = allContext.replace(/helsinki-lisa/g, 'helsinkilisa').replace(/helsinki-lisä/g, 'helsinkilisa');
        
        // Ohitetaan super-yleiset triggerit, jotta koko ruutu ei mene ruksille
   // UUSI LAYER: Ohitetaan super-yleiset triggerit, jotta koko ruutu ei mene ruksille!
const ignoredTriggers = ['tyoton', 'tyottomyys_pitkittynyt', 'lomautettu', 'irtisanottu', 'alle_6kk_tyossa', 'yrittajyys_kiinnostus'];

        const preSelected = [];
        snippets.forEach(snippet => {
            if (snippet.triggers) {
                const triggersArray = snippet.triggers.split(',').map(t => normalize(t));
                
                const isMatch = triggersArray.some(trigger => {
                    const cleanTrigger = trigger.replace('_puollettu', '').replace('_valittu', '');
                    
                    // 1. Estetään liian yleiset sanat
                    if (ignoredTriggers.includes(cleanTrigger)) return false; 
                    
                    // 2. Estetään liian lyhyet haamusomat
                    if (cleanTrigger.length < 3) return false; 

                    // 3. TASO 1 (Täsmäosuma): Löytyykö trigger suoraan asiakkaan signaaleista? (esim. yrittajyys_kiinnostus)
                    if (activeSignalKeys.includes(cleanTrigger)) return true;

                    // 4. TASO 2 (Turvaverkko): Löytyykö trigger laajemmasta tekstianalyysistä?
                    return contextString.includes(cleanTrigger);
                });

                if (isMatch) preSelected.push(snippet.id);
            }
        });
        
        setSelectedSnippetIds(preSelected);
    }, [snippets, JSON.stringify(state?.signals), JSON.stringify(masterAsiakas), JSON.stringify(state?.suunnitelma), planItems, finalPlanText]);

    const toggleSnippet = (id) => {
        setSelectedSnippetIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleGenerateFollowup = async () => {
        setIsLoading(true);
        setError('');
        setCopySuccess('');
        setEmailHtml('');
        setEmailText('');

        try {
            const selectedSnippetsData = snippets.filter(s => selectedSnippetIds.includes(s.id));

            const response = await fetch('/.netlify/functions/generateFollowup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    customerName,
                    planItems, 
                    obligationsCount: lkmArvo,
                    selectedSnippets: selectedSnippetsData,
                    finalPlanText: finalPlanText 
                }),
            });

            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                if (response.status === 500 || response.status === 503) {
                    throw new Error("Aivoissa on ruuhkaa! Liikaa pörriäisiä kimpussani, yritä hetken kuluttua uudestaan. 🐝");
                }
                throw new Error(responseData.error || "Pyyntö epäonnistui (Virhekoodi: " + response.status + ")");
            }

            const data = await response.json();
            setEmailHtml(data.followupEmailHtml);
            setEmailText(data.followupEmailText);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyRichText = async () => {
        if (!emailHtml) return;
        try {
            const blobHtml = new Blob([emailHtml], { type: "text/html" });
            const blobText = new Blob([emailText], { type: "text/plain" });
            const clipboardItem = new window.ClipboardItem({ "text/html": blobHtml, "text/plain": blobText });
            await navigator.clipboard.write([clipboardItem]);
            setCopySuccess('Sähköposti kopioitu muotoiluineen! Voit nyt liittää sen suoraan Outlookiin/Gmailiin. ✅');
            setTimeout(() => setCopySuccess(''), 5000);
        } catch (err) {
            navigator.clipboard.writeText(emailText).then(() => {
                setCopySuccess('Sähköposti kopioitu raakatekstinä. ✅');
                setTimeout(() => setCopySuccess(''), 3000);
            });
        }
    };

    const handleMailto = () => {
        if (!emailText) return;
        const subject = encodeURIComponent("Yhteenveto tapaamisestamme (Helsingin työllisyyspalvelut)");
        const body = encodeURIComponent(emailText);
        window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
    };

    return (
        <section className="section-container">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail color="var(--color-primary)" /> Tapaamisen yhteenveto (Sähköposti)
            </h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>
                Tekoäly rakentaa asiakkaalle ystävällisen yhteenvedon. Alla näet "Lentoonlähtötarkastuksen" eli ainekset, joista viesti leivotaan.
            </p>

            <div className="smart-analysis-box" style={{ marginTop: '1.5rem', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <div className="smart-analysis-header" style={{ color: 'var(--color-text-primary)' }}>
                    <ListChecks size={20} color="var(--color-primary)" /> Sähköpostin ainekset
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                        <strong style={{ width: '120px' }}>Asiakas:</strong>
                        <span>{customerName} ({customerEmail})</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                        <strong style={{ width: '120px' }}>Toimenpiteet:</strong>
                        <div style={{ flex: 1 }}>
                            {planItems.length > 0 ? (
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text-primary)' }}>
                                    {planItems.map((item, i) => <li key={i}>{item}</li>)}
                                </ul>
                            ) : (
                                <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Ei valittuja toimenpiteitä suunnitelmassa.</span>
                            )}
                        </div>
                    </div>

                    {finalPlanText && (
                        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                            <strong style={{ width: '120px' }}>Suunnitelma:</strong>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                ✓ Asiakirjan lopullinen teksti liitetty mukaan tekoälyn pohjadataksi.
                            </span>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                        <strong style={{ width: '120px' }}>Velvollisuus:</strong>
                        <span>{lkmArvo > 0 ? `${lkmArvo} työpaikkaa kuukaudessa` : 'Ei määrättyä työnhakuvelvollisuutta'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <strong style={{ width: '120px' }}>Liitteet ja Linkit:</strong>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                Tekoäly on esivalinnut asiakkaan tilanteeseen sopivat linkit.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                                {snippets.map(snippet => {
                                    const isSelected = selectedSnippetIds.includes(snippet.id);
                                    return (
                                        <label key={snippet.id} className="custom-checkbox-row" style={{ backgroundColor: isSelected ? '#fffaf5' : '#fff', border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleSnippet(snippet.id)} />
                                            <span style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ fontSize: '0.9rem' }}>{snippet.label}</strong>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                                                    {snippet.url ? new URL(snippet.url).hostname : 'Sisäinen tietoisku'}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                <button onClick={handleGenerateFollowup} disabled={isLoading} className="btn-ai" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                    <Sparkles size={20} />
                    {isLoading ? 'Rakennetaan sähköpostia... 🌼' : 'Luo sähköpostiyhteenveto (AI) 🐝'}
                </button>
            </div>

            {error && (
                <div className="guidance-box a-tmt-guidance">
                    <div className="warning"><strong>Virhe:</strong> {error}</div>
                </div>
            )}
            
            {emailHtml && (
                <div className="ai-workspace">
                    <div className="ai-workspace-header">
                        <CheckCircle size={20} color="var(--color-success)" /> Valmis sähköposti
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        Tarkista teksti. Kun painat Kopioi, kaikki lihavoinnit ja linkit siirtyvät ehjänä sähköpostiisi!
                    </p>
                    
                    <div className="email-rich-preview" dangerouslySetInnerHTML={{ __html: emailHtml }} />

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                         <button onClick={handleCopyRichText} className="btn" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Copy size={18} /> Kopioi sähköposti (Rich Text)
                         </button>
                         <button onClick={handleMailto} className="btn btn--secondary" disabled={customerEmail === 'Ei sähköpostia kirjattu'} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <ExternalLink size={18} /> Avaa sähköpostiohjelmassa
                         </button>
                         {copySuccess && <span className="feedback-text">{copySuccess}</span>}
                    </div>
                </div>
            )}
        </section>
    );
};

export default Jalkimarkkinointi;