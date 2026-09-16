import React, { useState, useMemo } from 'react';
import { supabase, macbase } from '../../../utils/supabaseClient'; 
import { Briefcase, GraduationCap, HeartPulse, Rocket, Building, Calendar, Globe, Copy, CheckCircle, ExternalLink } from 'lucide-react';

// Tuodaan omat common-komponentit
import SmartResolutionHub from '../../common/SmartResolutionHub';
import AILoadingSpinner from '../../common/AILoadingSpinner';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import Button from '../../common/Button';

// ==========================================
// NIGHTFRIGHT - SALAUSLOGIIKKA (Web Crypto)
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

// Pvm-muotoilija suomalaiseen formaattiin (pp.kk.vvvv)
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
    const [copiedId, setCopiedId] = useState(null); // Tekstin kopioinnin tilaseuranta

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

    const haePalvelut = async () => {
        setIsSearching(true);
        setSuositellutPalvelut([]); 
        setCopiedId(null);
        const startTime = performance.now();
        
        try {
            const koulutusTeksti = appState?.['custom-koulutus']?.trim() || '';
            const kieliTeksti = appState?.['custom-kielitaso']?.trim() || '';
            const edellytyksetTeksti = (appState?.['custom-lopullinen_33_arvio'] || appState?.['custom-edellytykset'] || '').trim();
            
            let escoTeksti = '';
            if (appState?.valitutAmmattikortit && Array.isArray(appState.valitutAmmattikortit)) {
                escoTeksti = appState.valitutAmmattikortit.map(kortti => kortti.nimi || kortti.title).join(', ');
            } else if (typeof appState?.['custom-tavoite_ammatit'] === 'string') {
                escoTeksti = appState['custom-tavoite_ammatit'].trim();
            }

            const hakupalat = [];
            // Korostetaan vahvasti asiakkaan tavoiteammattia, koska meillä on ne metadatassa tallessa!
            if (escoTeksti) hakupalat.push(`Työllistymistavoite tai tavoiteammatti on: ${escoTeksti}`);
            if (koulutusTeksti) hakupalat.push(`Koulutustausta: ${koulutusTeksti}`);
            if (kieliTeksti) hakupalat.push(`Kielitaito: ${kieliTeksti}`);
            if (edellytyksetTeksti) hakupalat.push(`Huomioitavaa: ${edellytyksetTeksti}`);

            const searchText = hakupalat.length > 0 
                ? hakupalat.join('. ') 
                : "Asiakas etsii työllistymistä edistäviä palveluita, koulutuksia tai valmennusta.";

            const rawPayload = {
                search_text: searchText,
                match_count: 5, // Nostetaan ehdotukset kolmesta viiteen, kun TVM dataa on paljon!
                threshold: 0.5,
                filters: activeSignals
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
                active_signals: activeSignals,
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

    // Kopiointifunktio suunnitelmatekstille
    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 3000); // Palauttaa ikonin 3 sekunnin päästä
    };

    return (
        <div className="smart-suggestion-container">
            <SmartResolutionHub 
                signals={displaySignals}
                strategies={strategies}
            />

            <div className="ai-service-search" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                
                {isSearching ? (
                    <AILoadingSpinner text="Työmarkkinatorin tekoälysovittaja etsii osumia..." />
                ) : (
                    <Button 
                        variant="primary" 
                        onClick={haePalvelut}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Rocket size={16} /> 
                        Etsi sopivia koulutuksia ja palveluita
                    </Button>
                )}

                {suositellutPalvelut.length > 0 && (
                    <div className="service-results" style={{ marginTop: '1.5rem' }}>
                        <h4 className="subsection-title" style={{ marginBottom: '1rem' }}>Suositellut osumat</h4>
                        
                        <div className="flex-col-gap">
                            {suositellutPalvelut.map(palvelu => (
                                <Card key={palvelu.id} className="mb-2" style={{ padding: '1rem' }}>
                                    
                                    {/* Otsikko ja Osumaprosentti */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                                            {palvelu.title}
                                        </strong>
                                        <Badge variant={palvelu.similarity > 0.8 ? "success" : "info"}>
                                            {Math.round(palvelu.similarity * 100)}% osuma
                                        </Badge>
                                    </div>
                                    
                                    {/* Visuaaliset metadatatagit */}
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

                                    {/* Kuvaus */}
                                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                        {palvelu.description}
                                    </p>
                                    
                                    {/* Toimintopainikkeet */}
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
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
                                                Lue lisää Työmarkkinatorilta <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartSuggestionBox;