import React, { useState, useMemo } from 'react';
import { supabase, macbase } from '../../../utils/supabaseClient'; 
import { 
    Briefcase, GraduationCap, HeartPulse, Rocket, Building, 
    Calendar, Globe, Copy, CheckCircle, ExternalLink, FileText, 
    Settings2, Target, BookOpen, MessageCircle, AlertCircle, PenTool 
} from 'lucide-react';

// Tuodaan omat common-komponentit
import SmartResolutionHub from '../../common/SmartResolutionHub';
import AILoadingSpinner from '../../common/AILoadingSpinner';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import Button from '../../common/Button';

// TUODAAN UUSI MODAALI (Varmista että polku on oikein!)
import Modal from '../../common/Modal'; 

// ==========================================
// NIGHTFRIGHT - SALAUSLOGIIKKA
// ==========================================

const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const importPublicKey = async (pem) => {
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/[\r\n\s]/g, "");
    const binaryDer = base64ToArrayBuffer(pemContents);

    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
};

const encryptNightfright = async (payloadObj, publicKeyPem) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payloadObj));
    const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, data);
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const rsaPubKey = await importPublicKey(publicKeyPem);
    const encryptedAesKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaPubKey, exportedAesKey);

    return {
        nf_key: arrayBufferToBase64(encryptedAesKey),
        nf_iv: arrayBufferToBase64(iv),
        nf_data: arrayBufferToBase64(encryptedData)
    };
};

const muotoilePvm = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

// ==========================================
// VARSINAINEN KOMPONENTTI
// ==========================================

const SmartSuggestionBox = ({ activeSignals, dbPhrases, onTogglePath, appState }) => {
    
    const [suositellutPalvelut, setSuositellutPalvelut] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [copiedId, setCopiedId] = useState(null); 
    
    // Tarkennetun haun modaalin tilat
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchSettings, setSearchSettings] = useState({
        tavoite: { text: '', active: false },
        koulutus: { text: '', active: false },
        kieli: { text: '', active: false },
        edellytykset: { text: '', active: false },
        lisatiedot: { text: '', active: true } // Vapaa kenttä, oletuksena aina auki
    });

    const displaySignals = useMemo(() => 
        Object.entries(activeSignals)
            .filter(([key, value]) => value && !key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i))
            .map(([key]) => ({ label: key.replace(/_/g, ' ') })), 
    [activeSignals]);

    const strategyPaths = useMemo(() => {
        const paths = {
            'A': { title: 'Työ edellä', icon: <Briefcase size={16} />, phrases: [] },
            'B': { title: 'Koulutus edellä', icon: <GraduationCap size={16} />, phrases: [] },
            'C': { title: 'Työkyky ja tuki', icon: <HeartPulse size={16} />, phrases: [] },
            'Y': { title: 'Yrittäjyys', icon: <Rocket size={16} />, phrases: [] }
        };

        dbPhrases.forEach(phrase => {
            if (phrase.triggerit && phrase.triggerit.length > 0) {
                phrase.triggerit.forEach(t => {
                    if (activeSignals[t.signal_key]) {
                        const path = paths[t.strategy_path];
                        if (path && !path.phrases.find(p => p.id === phrase.id)) {
                            path.phrases.push(phrase);
                        }
                    }
                });
            }
        });
        return paths;
    }, [dbPhrases, activeSignals]);

    const strategies = Object.entries(strategyPaths)
        .filter(([_, pathData]) => pathData.phrases.length > 0)
        .map(([key, pathData]) => ({
            id: key,
            title: pathData.title,
            icon: pathData.icon,
            items: pathData.phrases.map(p => ({ id: p.id, label: p.lyhenne })),
            actionLabel: `Valitse polku ${key}`,
            onAction: () => onTogglePath(pathData.phrases)
        }));

    // ==========================================
    // TEKSTIPESURI
    // ==========================================
    const pesuriRegexit = [
        /asiakas ei ole (tässä vaiheessa )?kiinnostunut yritystoiminnan aloittamisesta\.?/ig,
        /ei kiinnostusta yrittäjyyteen\.?/ig,
        /keskusteltiin yrittäjyydestä\.?/ig 
    ];

    const peseTeksti = (teksti) => {
        let puhdas = teksti || '';
        pesuriRegexit.forEach(regex => {
            puhdas = puhdas.replace(regex, '');
        });
        return puhdas.trim();
    };

    // ==========================================
    // MODAALIN AVAUS JA TIETOJEN ALUSTUS
    // ==========================================
    const handleOpenAdvancedSearch = () => {
        let escoTeksti = '';
        if (appState?.valitutAmmattikortit && Array.isArray(appState.valitutAmmattikortit)) {
            escoTeksti = appState.valitutAmmattikortit.map(kortti => kortti.nimi || kortti.title).join(', ');
        } else if (typeof appState?.['custom-tavoite_ammatit'] === 'string') {
            escoTeksti = appState['custom-tavoite_ammatit'].trim();
        }

        const koulutus = peseTeksti(appState?.['custom-koulutus']?.trim());
        const kieli = appState?.['custom-kielitaso']?.trim() || '';
        const edellytykset = peseTeksti((appState?.['custom-lopullinen_33_arvio'] || appState?.['custom-edellytykset'] || '').trim());

        // Alustetaan muuttujat suoraan näkyville modaaliin
        setSearchSettings({
            tavoite: { text: escoTeksti, active: !!escoTeksti },
            koulutus: { text: koulutus, active: !!koulutus },
            kieli: { text: kieli, active: !!kieli },
            edellytykset: { text: edellytykset, active: !!edellytykset },
            lisatiedot: { text: '', active: true }
        });
        setIsModalOpen(true);
    };

    // ==========================================
    // HAKULOGIIKKA (Käsittelee perushaun ja tarkennetun haun)
    // ==========================================
    const haePalvelut = async (isAdvanced = false) => {
        setIsSearching(true);
        setSuositellutPalvelut([]); 
        setCopiedId(null);
        const startTime = performance.now();
        
        try {
            // 1. SIIVOTAAN SIGNAALIT KANNAN BONUKSIA VARTEN
            const siivotutSignaalit = {};
            Object.entries(activeSignals).forEach(([key, value]) => {
                if (!value) return; 
                if (key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) return; 
                if (key.startsWith('postinro_') || key.startsWith('kunta_')) return; 
                if (key.startsWith('nayta_')) return; 
                
                siivotutSignaalit[key] = value;
            });

            // 2. RAKENNETAAN TEKSTIHAKU
            const hakupalat = [];

            if (isAdvanced) {
                // Tarkennettu haku: Luetaan tekstit ja valinnat suoraan modaalin tilasta
                if (searchSettings.tavoite.active && searchSettings.tavoite.text) hakupalat.push(`Työllistymistavoite tai ammatti on: ${searchSettings.tavoite.text}`);
                if (searchSettings.koulutus.active && searchSettings.koulutus.text) hakupalat.push(`Koulutustausta: ${searchSettings.koulutus.text}`);
                if (searchSettings.kieli.active && searchSettings.kieli.text) hakupalat.push(`Kielitaito: ${searchSettings.kieli.text}`);
                if (searchSettings.edellytykset.active && searchSettings.edellytykset.text) hakupalat.push(`Huomioitavaa: ${searchSettings.edellytykset.text}`);
                if (searchSettings.lisatiedot.active && searchSettings.lisatiedot.text) hakupalat.push(`Erityistoive: ${searchSettings.lisatiedot.text}`);
            } else {
                // Pikahaku: Luetaan tekstit appStatesta, pestään ja yhdistetään
                let escoTeksti = '';
                if (appState?.valitutAmmattikortit && Array.isArray(appState.valitutAmmattikortit)) {
                    escoTeksti = appState.valitutAmmattikortit.map(kortti => kortti.nimi || kortti.title).join(', ');
                } else if (typeof appState?.['custom-tavoite_ammatit'] === 'string') {
                    escoTeksti = appState['custom-tavoite_ammatit'].trim();
                }
                const koulutusTeksti = peseTeksti(appState?.['custom-koulutus']?.trim());
                const kieliTeksti = appState?.['custom-kielitaso']?.trim() || '';
                const edellytyksetTeksti = peseTeksti((appState?.['custom-lopullinen_33_arvio'] || appState?.['custom-edellytykset'] || '').trim());

                if (escoTeksti) hakupalat.push(`Työllistymistavoite tai tavoiteammatti on: ${escoTeksti}`);
                if (koulutusTeksti) hakupalat.push(`Koulutustausta: ${koulutusTeksti}`);
                if (kieliTeksti) hakupalat.push(`Kielitaito: ${kieliTeksti}`);
                if (edellytyksetTeksti) hakupalat.push(`Huomioitavaa: ${edellytyksetTeksti}`);
            }

            const searchText = hakupalat.length > 0 
                ? hakupalat.join('. ') 
                : "Asiakas etsii työllistymistä edistäviä palveluita, koulutuksia tai valmennusta.";

            const rawPayload = {
                search_text: searchText,
                match_count: 5, 
                threshold: 0.5,
                filters: siivotutSignaalit
            };

            const publicKeyPem = import.meta.env.VITE_PUBLIC_RSA_KEY; 
            if (!publicKeyPem) throw new Error("Julkinen RSA-avain puuttuu (VITE_PUBLIC_RSA_KEY)");
            const encryptedPayload = await encryptNightfright(rawPayload, publicKeyPem);

            const response = await fetch('https://nsg.asuscomm.com/python/search', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_PYTHON_API_KEY
                },
                body: JSON.stringify(encryptedPayload)
            });

            if (!response.ok) throw new Error(`Verkkovirhe: ${response.status}`);
            
            const result = await response.json();
            const durationMs = Math.round(performance.now() - startTime);

            macbase.from('log_services_ai').insert([{
                search_text: searchText, 
                active_signals: siivotutSignaalit,
                results: result.data || [],
                duration_ms: durationMs
            }]).then(({ error }) => {
                if (error) console.error("Lokin tallennus epäonnistui:", error);
            });

            setSuositellutPalvelut(result.data || []);
            
        } catch (error) {
            console.error("Virhe tekoälyhaussa:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 3000); 
    };

    // Apukomponentti modaalin kenttien renderöintiin
    const renderSettingsField = (key, title, Icon) => {
        const field = searchSettings[key];
        return (
            <div style={{ backgroundColor: field.active ? '#f8fafc' : '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid', borderColor: field.active ? '#cbd5e1' : '#e2e8f0', transition: 'all 0.2s' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, cursor: 'pointer', color: field.active ? 'var(--color-text-primary)' : '#94a3b8' }}>
                    <input 
                        type="checkbox" 
                        checked={field.active} 
                        onChange={() => setSearchSettings(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }))} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <Icon size={18} /> {title}
                </label>
                {field.active && (
                    <textarea
                        value={field.text}
                        onChange={(e) => setSearchSettings(prev => ({ ...prev, [key]: { ...prev[key], text: e.target.value } }))}
                        placeholder={key === 'lisatiedot' ? "Esim. 'Etsi erityisesti logistiikka-alan lyhytkoulutuksia' tai 'Painota asiakaspalvelua'." : ""}
                        style={{ 
                            width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', 
                            minHeight: key === 'lisatiedot' ? '80px' : '60px', fontFamily: 'inherit', marginTop: '0.75rem',
                            resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5'
                        }}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="smart-suggestion-container">
            <SmartResolutionHub 
                signals={displaySignals}
                strategies={strategies}
            />

            <div className="ai-service-search" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                
                {isSearching ? (
                    <AILoadingSpinner text="Tekoäly etsii osumia palveluista ja koulutuksista..." />
                ) : (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button 
                            variant="primary" 
                            onClick={() => haePalvelut(false)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Rocket size={16} /> 
                            Etsi sopivia koulutuksia ja palveluita
                        </Button>

                        <Button 
                            variant="outline" 
                            onClick={handleOpenAdvancedSearch}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc' }}
                        >
                            <Settings2 size={16} /> 
                            Tarkennettu haku
                        </Button>
                    </div>
                )}

                {suositellutPalvelut.length > 0 && (
                    <div className="service-results" style={{ marginTop: '1.5rem' }}>
                        <h4 className="subsection-title" style={{ marginBottom: '1rem' }}>Suositellut osumat</h4>
                        
                        <div className="flex-col-gap">
                            {suositellutPalvelut.map(palvelu => {
                                const isPM = palvelu.source_table === 'palvelumanuaali';

                                return (
                                    <Card key={palvelu.id} className="mb-2" style={{ padding: '1rem' }}>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <Badge variant={isPM ? "primary" : "warning"} style={{ alignSelf: 'flex-start', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                                    {isPM ? 'Palvelumanuaali' : 'TV-Koulutus'}
                                                </Badge>
                                                <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                                                    {palvelu.title}
                                                </strong>
                                            </div>
                                            <Badge variant={palvelu.similarity > 0.8 ? "success" : "info"}>
                                                {Math.round(palvelu.similarity * 100)}% osuma
                                            </Badge>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                            {palvelu.provider && (
                                                <Badge variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <Building size={12}/> {palvelu.provider}
                                                </Badge>
                                            )}
                                            {palvelu.language_req && (
                                                <Badge variant="warning" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <Globe size={12}/> Väh. {palvelu.language_req}
                                                </Badge>
                                            )}
                                            {palvelu.enrollment_deadline && (
                                                <Badge variant="danger" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <Calendar size={12}/> Haku päättyy: {muotoilePvm(palvelu.enrollment_deadline)}
                                                </Badge>
                                            )}
                                            {palvelu.ura_number && (
                                                <Badge variant="outline">URA: {palvelu.ura_number}</Badge>
                                            )}
                                        </div>

                                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                            {palvelu.description}
                                        </p>
                                        
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
                                            {palvelu.plan_text && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => copyToClipboard(palvelu.plan_text, palvelu.id)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderColor: copiedId === palvelu.id ? 'green' : '' }}
                                                >
                                                    {copiedId === palvelu.id ? <CheckCircle size={14} color="green" /> : <Copy size={14} />} 
                                                    {copiedId === palvelu.id ? 'Kopioitu!' : 'Kopioi suunnitelmaan'}
                                                </Button>
                                            )}
                                            
                                            {palvelu.url && (
                                                <a href={palvelu.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                                                    {isPM ? 'Siirry palvelun sivuille' : 'Lue lisää Työmarkkinatorilta'} <ExternalLink size={14} />
                                                </a>
                                            )}

                                            {palvelu.brochure_url && (
                                                <a href={palvelu.brochure_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--color-success)', textDecoration: 'none', fontWeight: 500 }}>
                                                    Avaa esite <FileText size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* TARKENNETUN HAUN MODAALI */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Tarkennettu tekoälyhaku"
                icon={Settings2}
                maxWidth="800px"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Peruuta
                        </Button>
                        <Button variant="primary" onClick={() => { setIsModalOpen(false); haePalvelut(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Rocket size={16} /> Suorita haku
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                        Valitse, mitä tietoja haluat lähettää tekoälyn pureskeltavaksi. Voit muokata kenttien sisältöä vapaasti; tekemäsi muutokset vaikuttavat vain tähän yksittäiseen hakuun.
                    </p>

                    {renderSettingsField('tavoite', 'Työllistymistavoite ja ala', Target)}
                    {renderSettingsField('koulutus', 'Koulutustausta', BookOpen)}
                    {renderSettingsField('kieli', 'Kielitaito', MessageCircle)}
                    {renderSettingsField('edellytykset', 'Asiantuntijan arvio (33 §)', AlertCircle)}
                    
                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem' }}>
                        {renderSettingsField('lisatiedot', 'Omat lisätiedot haulle', PenTool)}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SmartSuggestionBox;