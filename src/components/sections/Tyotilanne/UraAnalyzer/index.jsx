// --- src/components/sections/Tyotilanne/UraAnalyzer/index.jsx ---
import React, { useState, useEffect } from 'react';
import { Wand2, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../../../utils/supabaseClient';
import Modal from '../../../common/Modal'; 
import AlertBox from '../../../common/AlertBox';

// UUSI IMPORT POLKU!
import { COMPANY_PATTERN, SCHOOL_PATTERN, HETU_PATTERN, SINGLE_DATE_PATTERN } from '../../../../utils/regex';

import Step1Input from './Step1Input';
import Step2Results from './Step2Results';

const UraAnalyzer = ({ isOpen, onClose, actions, state, dynamicKeys }) => {
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const [aiResult, setAiResult] = useState({});
    const [finescoSector, setFinescoSector] = useState('');
    const [escoProfession, setEscoProfession] = useState('');
    const [activeTriggers, setActiveTriggers] = useState([]);
    
    // Lomakeautomaatiot
    const [tilaTyokokeilu, setTilaTyokokeilu] = useState(false);
    const [tilaPalkkatuki, setTilaPalkkatuki] = useState(false);
    const [tilaTyoton, setTilaTyoton] = useState(false);

    const [knownTriggers, setKnownTriggers] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchDictionary();
            setStep(1); setRawData(''); setAiResult({});
            setFinescoSector(''); setEscoProfession('');
            setTilaTyokokeilu(false); setTilaPalkkatuki(false); setTilaTyoton(false);
            setActiveTriggers([]); setError(null);
        }
    }, [isOpen]);

    const fetchDictionary = async () => {
        try {
            const { data } = await supabase.from('view_master_dictionary').select('keyword');
            if (data) setKnownTriggers(data.map(d => d.keyword));
        } catch (err) {
            console.error(err);
        }
    };

    // SIIRRETTY ANONYMISOINTILOGIIKKA TÄNNE:
    const handleAutoAnonymize = () => {
        if (!rawData) return;
        let cleaned = rawData;
        cleaned = cleaned.replace(COMPANY_PATTERN, '[ORGANISAATIO]');
        cleaned = cleaned.replace(SCHOOL_PATTERN, '[OPPILAITOS]');
        cleaned = cleaned.replace(HETU_PATTERN, '[HETU]');
        cleaned = cleaned.replace(SINGLE_DATE_PATTERN, (match, d, m, y) => `[PVM: ${m.padStart(2, '0')}/${y}]`);
        setRawData(cleaned);
    };

    const hasRisks = Boolean(rawData.match(COMPANY_PATTERN) || rawData.match(SCHOOL_PATTERN) || rawData.match(HETU_PATTERN) || rawData.match(SINGLE_DATE_PATTERN));

    const handleAnalyze = async () => {
        if (!rawData.trim()) return setError("Syötä URA-historia ensin.");
        setError(null); setIsAnalyzing(true);

        const todayDate = new Date().toISOString().split('T')[0]; 

        try {
            const response = await fetch('/.netlify/functions/analyze_ura', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: rawData, knownTriggers, currentDate: todayDate })
            });

            if (!response.ok) throw new Error("Aivoissa ruuhkaa. Yritä hetken kuluttua uudelleen.");

            const aiData = await response.json();
            setAiResult(aiData);
            setFinescoSector(aiData.finesco_ammattiala || ''); 
            setEscoProfession(aiData.esco_ammatti || '');
            
            setTilaTyokokeilu(aiData.tila_tyokokeilu === true);
            setTilaPalkkatuki(aiData.tila_palkkatuki === true);
            setTilaTyoton(aiData.tila_tyoton === true);

            setActiveTriggers(aiData.loydetyt_triggerit || []);
            setStep(2); 
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAccept = async () => {
        setIsSaving(true);
        try {
            const DIVIDER = "URA- JA PALVELUHISTORIA:";
            let existingText = state['custom-tyotilanne'] || '';
            
            if (existingText.includes(DIVIDER)) {
                existingText = existingText.split(DIVIDER)[0].trim();
            }

            let aiKoonti = aiResult.tyohistoria || '';
            
            if (finescoSector || escoProfession) {
                let escoSentence = finescoSector && escoProfession 
                    ? `Asiakkaan tavoitteena on työllistyä alalle: ${finescoSector.toLowerCase()}. Tarkempana tavoiteammattina on ${escoProfession.toLowerCase()}.`
                    : `Asiakkaan tavoiteammattina on ${(escoProfession || finescoSector).toLowerCase()}.`;

                if (aiResult.vaihtoehtoiset_ammatit?.length > 0) {
                    escoSentence += ` Kiinnostusta myös seuraaviin: ${aiResult.vaihtoehtoiset_ammatit.join(' ja ').toLowerCase()}.`;
                }
                aiKoonti += `\n\n${escoSentence}`;
            }

            let finalNotes = existingText ? `${existingText}\n\n${DIVIDER}\n${aiKoonti}` : `${DIVIDER}\n${aiKoonti}`;
            finalNotes = finalNotes.replace(/\n{3,}/g, '\n\n').trim();

            actions.onUpdateCustomText('tyotilanne', finalNotes);
            
            if (aiResult.koulutushistoria) actions.onUpdateCustomText('ai_koulutushistoria', aiResult.koulutushistoria);
            if (aiResult.koulutusehdotukset?.length > 0) actions.onUpdateCustomText('ai_koulutus_ideat', JSON.stringify(aiResult.koulutusehdotukset));
            
            if (aiResult.tyokokeilut_pvm) {
                typeof actions.onUpdatePalkkatuki === 'function' ? actions.onUpdatePalkkatuki('tyokokeilu_historia', aiResult.tyokokeilut_pvm) : actions.onUpdateVariable('palkkatuki', 'tyokokeilu_historia', aiResult.tyokokeilut_pvm);
            }

            if (dynamicKeys) {
                if (tilaTyokokeilu && dynamicKeys.tyokokeilu) actions.onSelect(dynamicKeys.tyokokeilu, true);
                if (tilaPalkkatuki && dynamicKeys.palkkatuki) actions.onSelect(dynamicKeys.palkkatuki, true);
                if (tilaTyoton) actions.onSelect('tyoton_tyonhakija', true); 
            }

            if (aiResult.nykyinen_palvelu_alku && aiResult.nykyinen_palvelu_loppu) {
                actions.onUpdateVariable('tyotilanne', 'palvelu_alku', aiResult.nykyinen_palvelu_alku);
                actions.onUpdateVariable('tyotilanne', 'palvelu_loppu', aiResult.nykyinen_palvelu_loppu);
                if (typeof actions.onUpdateAsiakas === 'function') {
                    actions.onUpdateAsiakas('palvelu_alku', aiResult.nykyinen_palvelu_alku);
                    actions.onUpdateAsiakas('palvelu_loppu', aiResult.nykyinen_palvelu_loppu);
                }
            }

            activeTriggers.forEach(trigger => { actions.onAddSignal(trigger); actions.onUpdateVariable('tyotilanne', trigger, true); });
            if (finescoSector) actions.onAddSignal(`AI_FINESCO_${finescoSector}`);
            if (escoProfession) actions.onAddSignal(`AI_ESCO_${escoProfession}`);

            if (finescoSector) actions.onUpdateAsiakas('tavoiteammatti_finesco_ala', finescoSector);

            if (escoProfession) {
                let uri = ''; let title = escoProfession; 
                try {
                    const escoRes = await fetch(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(escoProfession)}&language=fi&type=occupation`);
                    if (escoRes.ok) {
                        const escoJson = await escoRes.json();
                        if (escoJson._embedded?.results?.length > 0) uri = escoJson._embedded.results[0].uri;
                    }
                } catch (e) {}
                actions.onUpdateAsiakas('tavoiteammatti_esco_uri', uri);
                actions.onUpdateAsiakas('tavoiteammatti_esco_nimi', title);
            }

            if (aiResult.nykyinen_opiskelija) {
                actions.onUpdateTyottomyysturva('updateKysymys', { id: 'opiskelija', value: true });
                actions.onUpdateTyottomyysturva('ai_tunnistus_opiskelija', true);
            }
            if (aiResult.nykyinen_yrittaja) {
                actions.onUpdateTyottomyysturva('updateKysymys', { id: 'yritystoiminta', value: true });
                actions.onUpdateTyottomyysturva('ai_tunnistus_yritystoiminta', true);
            }

            onClose(); 
        } catch (err) {
            setError("Virhe siirrossa."); console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Työ- ja palveluhistorian AI-analyysi" 
            icon={Wand2}
            footer={
                <>
                    <button className="btn btn--secondary" onClick={onClose} disabled={isAnalyzing || isSaving}>
                        Peruuta
                    </button>
                    {step === 1 ? (
                        <button className="btn" onClick={handleAnalyze} disabled={isAnalyzing || !rawData.trim() || hasRisks} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isAnalyzing ? (
                                <><Loader2 size={16} className="animate-spin" /> Analysoidaan...</>
                            ) : (
                                <><Wand2 size={16} /> Pura ja jäsennä</>
                            )}
                        </button>
                    ) : (
                        <button className="btn btn--success" onClick={handleAccept} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin" /> Siirretään...</>
                            ) : (
                                <><Check size={16} /> Hyväksy ja siirrä</>
                            )}
                        </button>
                    )}
                </>
            }
        >
            {error && <AlertBox type="danger">{error}</AlertBox>}

            {step === 1 && (
                <Step1Input 
                    rawData={rawData} 
                    setRawData={setRawData} 
                    hasRisks={hasRisks} 
                    onAutoAnonymize={handleAutoAnonymize} 
                    isAnalyzing={isAnalyzing} 
                />
            )}

            {step === 2 && (
                <Step2Results 
                    aiResult={aiResult}
                    finescoSector={finescoSector} setFinescoSector={setFinescoSector}
                    escoProfession={escoProfession} setEscoProfession={setEscoProfession}
                    tilaTyoton={tilaTyoton} tilaTyokokeilu={tilaTyokokeilu} tilaPalkkatuki={tilaPalkkatuki}
                    activeTriggers={activeTriggers} setActiveTriggers={setActiveTriggers}
                />
            )}
        </Modal>
    );
};

export default UraAnalyzer;