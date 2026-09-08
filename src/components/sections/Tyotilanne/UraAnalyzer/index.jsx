// --- src/components/sections/Suunnitelma/UraAnalyzer/index.jsx ---
import React, { useState, useEffect } from 'react';
import { Wand2, Check, Loader2, Server, Minimize2, History, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../../../../utils/supabaseClient';
import Modal from '../../../common/Modal'; 
import AlertBox from '../../../common/AlertBox';
import { COMPANY_PATTERN, SCHOOL_PATTERN, HETU_PATTERN, SINGLE_DATE_PATTERN } from '../../../../utils/regex/core';
import { extractGMServices } from '../../../../utils/regex/gmServiceExtractor'; 

import Step1Input from './Step1Input';
import Step2Results from './Step2Results';

// ==========================================
// SALAUSFUNKTIOT JA HASH (Web Crypto API)
// ==========================================
const getHashSHA256 = async (str) => {
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
};

const encryptNightfright = async (text, publicKeyPem) => {
    const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertextBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, encodedText);

    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = publicKeyPem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    const binaryDerString = window.atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) binaryDer[i] = binaryDerString.charCodeAt(i);

    const rsaPubKey = await window.crypto.subtle.importKey("spki", binaryDer.buffer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaPubKey, exportedAesKey);

    const toBase64 = (buffer) => window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { type: "nightfright", nf_key: toBase64(encryptedAesKeyBuffer), nf_iv: toBase64(iv), nf_data: toBase64(ciphertextBuffer) };
};
// ==========================================

const UraAnalyzer = ({ isOpen, onClose, actions, state, dynamicKeys }) => {
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Tausta-ajon tila
    const [isMinimized, setIsMinimized] = useState(false);
    const [cachedResult, setCachedResult] = useState(null);

    const [aiResult, setAiResult] = useState({});
    const [finescoSector, setFinescoSector] = useState('');
    const [escoProfession, setEscoProfession] = useState('');
    const [activeTriggers, setActiveTriggers] = useState([]);
    const [tilaTyoton, setTilaTyoton] = useState(false);
    const [aktiivisetPalvelut, setAktiivisetPalvelut] = useState([]); 

    const resetState = () => {
        setStep(1); setRawData(''); setAiResult({});
        setFinescoSector(''); setEscoProfession(''); setTilaTyoton(false);
        setAktiivisetPalvelut([]); setActiveTriggers([]); setError(null);
        setLoadingMessage(''); setIsMinimized(false); setCachedResult(null);
    };

    const getProtectedDates = (text) => {
        const { foundServices } = extractGMServices(text);
        const dates = [];
        foundServices.forEach(s => {
            if (['tyokokeilu', 'palkkatuki', 'tyovoimakoulutus', 'kuntouttava_tyotoiminta'].includes(s.entity_key)) {
                if (s.data.alku) dates.push(s.data.alku);
                if (s.data.loppu) dates.push(s.data.loppu);
            }
        });
        return [...new Set(dates)]; 
    };

    const protectedDates = getProtectedDates(rawData);

    const handleAutoAnonymize = () => {
        if (!rawData) return;
        let cleaned = rawData;
        protectedDates.forEach((date, i) => {
            const regex = new RegExp(`\\b${date.replace(/\./g, '\\.')}\\b`, 'g');
            cleaned = cleaned.replace(regex, `__PROTECTED_DATE_${i}__`);
        });
        cleaned = cleaned.replace(COMPANY_PATTERN, '[ORGANISAATIO]');
        cleaned = cleaned.replace(SCHOOL_PATTERN, '[OPPILAITOS]');
        cleaned = cleaned.replace(HETU_PATTERN, '[HETU]');
        cleaned = cleaned.replace(SINGLE_DATE_PATTERN, (match, d, m, y) => `[PVM: ${m.padStart(2, '0')}/${y}]`);
        protectedDates.forEach((date, i) => {
            cleaned = cleaned.replace(new RegExp(`__PROTECTED_DATE_${i}__`, 'g'), date);
        });
        setRawData(cleaned);
    };

    let textForRiskCheck = rawData;
    protectedDates.forEach((date) => {
        const regex = new RegExp(`\\b${date.replace(/\./g, '\\.')}\\b`, 'g');
        textForRiskCheck = textForRiskCheck.replace(regex, ''); 
    });

    const hasRisks = Boolean(
        textForRiskCheck.match(COMPANY_PATTERN) || 
        textForRiskCheck.match(SCHOOL_PATTERN) || 
        textForRiskCheck.match(HETU_PATTERN) || 
        textForRiskCheck.match(SINGLE_DATE_PATTERN)
    );

    // ==========================================
    // MAGIC CACHE (Välimuistin tarkistus)
    // ==========================================
    useEffect(() => {
        if (rawData.length > 50 && !hasRisks) {
            getHashSHA256(rawData).then(async (hash) => {
                const { data } = await supabase.schema('espan').from('waiting_room')
                    .select('last_result').eq('last_content_hash', hash).eq('status', 'done').order('created_at', { ascending: false }).maybeSingle();
                
                if (data) setCachedResult(data.last_result);
                else setCachedResult(null);
            });
        } else {
            setCachedResult(null);
        }
    }, [rawData, hasRisks]);

    // ==========================================
    // MAC MINI ANALYYSI (Uusi työ)
    // ==========================================
    const handleAnalyzeLocal = async () => {
        if (!rawData.trim()) return setError("Syötä URA-historia ensin.");
        setError(null); 
        setIsAnalyzing(true);
        
        // HUOMIO: Palvelut (aktiiviset_palvelut) poistettu AI:n taakasta!
        const systemPrompt = `Olet datanpurkaja. Tehtäväsi on lukea asiakkaan epärakenteinen työ- ja koulutushistoria ja muuttaa se TÄSMÄLLEEN pyydettyyn JSON-muotoon.

SÄÄNNÖT:
1. PÄIVÄMÄÄRÄT: Muuta työpaikkojen ja koulutusten päivämäärät EHDOTTOMASTI muotoon KK/VVVV (esim. 05/2023). Poista päivät.
2. TIETOSUOJA: Anonymisoi data! Muuta yritysten ja koulujen nimet muotoon [Yritys] tai [Oppilaitos].
3. PALAUTUS: Palauta PELKKÄ JSON-objekti. Älä selitä mitään. Älä käytä markdown-blokkeja.

JSON-RAKENNE JOTA NOUDATAT:
{
  "tyopaikat": [ {"tehtava": "Ammattinimike", "aika": "KK/VVVV - KK/VVVV"} ],
  "koulutukset": [ {"tutkinto": "Tutkinto", "aika": "KK/VVVV - KK/VVVV"} ],
  "esco_pääammatti": "Yksi selkeä sana",
  "onko_tyoton_nyt": true,
  "ammatilliset_huomiot": ["Poimi tähän 1-3 vapaamuotoista ammatillista huomiota"]
}`;

        try {
            const rsaPubKey = import.meta.env.VITE_PUBLIC_RSA_KEY; 
            let finalSourceConfig;
            let finalPrompt = systemPrompt;

            if (rsaPubKey) {
                setLoadingMessage('Salataan dataa paikallisesti (E2EE)...');
                finalSourceConfig = await encryptNightfright(rawData, rsaPubKey);
            } else {
                setLoadingMessage('Huom: Salausavainta ei löytynyt, lähetetään teksti salaamattomana...');
                finalSourceConfig = { type: "direct_prompt" };
                finalPrompt = `${systemPrompt}\n\nASIAKKAAN TYÖHISTORIA:\n${rawData}`;
            }

            setLoadingMessage('Lähetetään turvallisesti Mac Minille (Qwen Coder 14B)...');

            const { data: newTask, error: insertError } = await supabase
                .schema('espan')
                .from('waiting_room')
                .insert([{
                    model: 'qwen2.5-coder:14b', // VAIHDETTU TAKAISIN ÄLYKKÄÄMPÄÄN MALLIIN
                    system_prompt: finalPrompt,
                    source_config: finalSourceConfig,
                    output_config: { type: "ui_component", component: "UraAnalyzer" },
                    status: 'waiting',
                    schedule_slot: 'immediate'
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            const taskId = newTask.id;

            const channel = supabase
                .channel(`task-${taskId}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'espan', table: 'waiting_room', filter: `id=eq.${taskId}` },
                (payload) => {
                    const status = payload.new.status;
                    if (status === 'processing') setLoadingMessage('Mac Mini purkaa lukitusta ja erottelee dataa...');
                    
                    if (status === 'done') {
                        supabase.removeChannel(channel);
                        handleLocalResult(payload.new.last_result);
                    }
                    if (status === 'error') {
                        supabase.removeChannel(channel);
                        setError(`Paikallinen analyysi epäonnistui: ${payload.new.error_log}`);
                        setIsAnalyzing(false);
                        setIsMinimized(false); 
                    }
                }).subscribe();

        } catch (err) {
            setError(`Virhe lähetysvaiheessa: ${err.message}`);
            setIsAnalyzing(false);
        }
    };

    // =================================================================
    // TUHOUTUMATON JSON-PARSERI JA REGEX-YHDISTÄJÄ
    // =================================================================
    const handleLocalResult = (rawResult) => {
        try {
            console.log("📥 AI palautti raakatekstin:", rawResult);

            const jsonStartIndex = rawResult.indexOf('{');
            const jsonEndIndex = rawResult.lastIndexOf('}');

            if (jsonStartIndex === -1 || jsonEndIndex === -1) {
                throw new Error("Vastauksesta ei löytynyt JSON-rakennetta.");
            }

            let cleanJsonString = rawResult.substring(jsonStartIndex, jsonEndIndex + 1);

            let safeString = cleanJsonString;
            safeString = safeString.replace(COMPANY_PATTERN, '[ORGANISAATIO]');
            safeString = safeString.replace(SCHOOL_PATTERN, '[OPPILAITOS]');
            safeString = safeString.replace(HETU_PATTERN, '[HETU]');

            const parsedData = JSON.parse(safeString);
            
            // 1. Koulutusten ja työpaikkojen mappaus (Tulee AI:lta)
            const mappedKoulutukset = (parsedData.koulutukset || []).map(k => ({ tutkinto: k.tutkinto, vuosi: k.aika }));
            const tyohistoriaList = (parsedData.tyopaikat || []).map(t => `• ${t.aika}: ${t.tehtava}`).join('\n');

            // 2. TÄRKEIN KORJAUS: Haetaan palvelut millintarkasti omasta Regex-funktiostasi!
            const regexServices = extractGMServices(rawData).foundServices || [];

            setAiResult({ tyohistoria: tyohistoriaList || 'Ei selkeitä työpaikkamerkintöjä.', suoritetut_koulutukset: mappedKoulutukset });
            setFinescoSector(''); 
            setEscoProfession(parsedData.esco_pääammatti || '');
            setTilaTyoton(parsedData.onko_tyoton_nyt === true);
            setAktiivisetPalvelut(regexServices); // Tässä käytetään vihdoin luotettavaa Regex-lähdettä
            setActiveTriggers(parsedData.ammatilliset_huomiot || []); 
            
            setStep(2);
            setIsAnalyzing(false);
            setError(null);
            
        } catch (e) {
            console.error("❌ Parsintavirhe:", e.message);
            console.error("❌ Tekoälyn antama viallinen sisältö:", rawResult);
            setError("Tekoälyn vastaus ei ollut oikeassa muodossa (Katso konsoli F12). Yritä uudelleen.");
            setIsAnalyzing(false);
            setIsMinimized(false);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    const handleAccept = async () => {
        setIsSaving(true);
        try {
            const DIVIDER = "Työhistoria:";
            let existingText = state['custom-tyotilanne'] || '';
            if (existingText.includes(DIVIDER)) existingText = existingText.split(DIVIDER)[0].trim();

            let finalNotes = existingText ? `${existingText}\n\n${DIVIDER}\n${aiResult.tyohistoria || ''}` : `${DIVIDER}\n${aiResult.tyohistoria || ''}`;
            finalNotes = finalNotes.replace(/\n{3,}/g, '\n\n').trim();

            actions.onUpdateCustomText('tyotilanne', finalNotes);

            if (dynamicKeys && dynamicKeys.tyoton && tilaTyoton) {
                const currentSectionState = state['tyotilanne'] || {};
                if (!currentSectionState[dynamicKeys.tyoton]) {
                    actions.onSelect('tyotilanne', dynamicKeys.tyoton, true); 
                }
            }

            if (aktiivisetPalvelut && aktiivisetPalvelut.length > 0) {
                const newServices = aktiivisetPalvelut.map(srv => ({
                    id: window.crypto.randomUUID(), 
                    entity_key: srv.entity_key,
                    data: { alku: srv.data?.alku || '', loppu: srv.data?.loppu || '', tarkenne: srv.data?.tarkenne || '' }, // Käytetään regex-objektin muotoa
                    meta: { source: 'ai_analyzer_local', timestamp: new Date().toISOString() }
                }));
                const currentServices = Array.isArray(state.sessionServices) ? state.sessionServices : [];
                actions.onUpdateVariable('global', 'sessionServices', [...currentServices, ...newServices]);
            }

            if (aiResult.suoritetut_koulutukset && aiResult.suoritetut_koulutukset.length > 0) {
                const newEducations = aiResult.suoritetut_koulutukset.map(edu => ({
                    id: window.crypto.randomUUID(), 
                    data: { tutkinto: edu.tutkinto, vuosi: edu.vuosi || '' }, 
                    meta: { source: 'ai_analyzer_local', timestamp: new Date().toISOString() }
                }));
                const currentEdus = Array.isArray(state.sessionEducations) ? state.sessionEducations : [];
                actions.onUpdateVariable('global', 'sessionEducations', [...currentEdus, ...newEducations]);
            }

            if (escoProfession) actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', escoProfession);
            
            resetState();
            onClose(); 
        } catch (err) { 
            setError("Virhe siirrossa."); 
        } finally { 
            setIsSaving(false); 
        }
    };

    if (isMinimized) {
        return (
            <div 
                style={{
                    position: 'fixed', top: '80px', left: '20px', zIndex: 9999,
                    backgroundColor: '#fff', padding: '1rem', borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                    animation: 'slideInLeft 0.3s ease-out'
                }}
                onClick={() => setIsMinimized(false)}
            >
                {isAnalyzing ? (
                    <Loader2 className="animate-spin text-primary" size={24} />
                ) : (
                    <div style={{ backgroundColor: '#d1fae5', padding: '8px', borderRadius: '50%' }}>
                        <Check className="text-success" size={24} />
                    </div>
                )}
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', fontWeight: 'bold' }}>
                        {isAnalyzing ? 'URA-purku käynnissä...' : 'URA-analyysi valmis!'}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        {isAnalyzing ? 'Tekoäly purkaa dataa taustalla.' : 'Klikkaa avataksesi tulokset.'}
                    </p>
                </div>
            </div>
        );
    }

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleCancel} 
            title="Työ- ja palveluhistorian Purku (Salattu Lokaali & Gemini)" 
            icon={Server} 
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {step === 2 ? (
                            <button className="btn btn--secondary" onClick={() => setStep(1)} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ArrowLeft size={16} /> Takaisin raakadataan
                            </button>
                        ) : (
                            <button className="btn btn--secondary" onClick={handleCancel} disabled={isAnalyzing || isSaving}>
                                Sulje
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {step === 1 ? ( 
                            <>
                                {rawData && (
                                    <button className="btn btn--secondary" onClick={resetState} disabled={isAnalyzing} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Trash2 size={16} /> Tyhjennä
                                    </button>
                                )}

                                {isAnalyzing && (
                                    <button className="btn btn--secondary" onClick={() => setIsMinimized(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Minimize2 size={16} /> Piilota taustalle
                                    </button>
                                )}

                                {cachedResult ? (
                                    <button className="btn btn--primary" onClick={() => handleLocalResult(cachedResult)} disabled={isAnalyzing || hasRisks} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-primary)' }}> 
                                        <History size={16} /> Palauta aiempi tulos
                                    </button>
                                ) : (
                                    <button className="btn" onClick={handleAnalyzeLocal} disabled={isAnalyzing || !rawData.trim() || hasRisks} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}> 
                                        {isAnalyzing ? <><Loader2 size={16} className="animate-spin" /> {loadingMessage}</> : <><Server size={16} /> 1. Salattu käsittely (Mac Mini)</>} 
                                    </button> 
                                )}
                            </>
                        ) : ( 
                            <button className="btn btn--success" onClick={handleAccept} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}> 
                                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Siirretään...</> : <><Check size={16} /> Hyväksy datasiirto</>} 
                            </button> 
                        )}
                    </div>
                </div>
            }
        >
            {error && <AlertBox type="danger">{error}</AlertBox>}
            {step === 1 && <Step1Input rawData={rawData} setRawData={setRawData} hasRisks={hasRisks} onAutoAnonymize={handleAutoAnonymize} isAnalyzing={isAnalyzing} protectedDates={protectedDates} />}
            {step === 2 && <Step2Results aiResult={aiResult} setAiResult={setAiResult} finescoSector={finescoSector} setFinescoSector={setFinescoSector} escoProfession={escoProfession} setEscoProfession={setEscoProfession} tilaTyoton={tilaTyoton} aktiivisetPalvelut={aktiivisetPalvelut} activeTriggers={activeTriggers} setActiveTriggers={setActiveTriggers} />}
        </Modal>
    );
};

export default UraAnalyzer;