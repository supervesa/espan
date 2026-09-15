import React, { useState, useMemo } from 'react';
import { supabase, macbase } from '../../../utils/supabaseClient'; 
import { Briefcase, GraduationCap, HeartPulse, Rocket } from 'lucide-react';

// Tuodaan omat common-komponentit
import SmartResolutionHub from '../../common/SmartResolutionHub';
import AILoadingSpinner from '../../common/AILoadingSpinner';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import Button from '../../common/Button';

// ==========================================
// NIGHTFRIGHT - SALAUSLOGIIKKA (Web Crypto)
// ==========================================

// Apufunktio: Base64 -> ArrayBuffer
const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// Apufunktio: ArrayBuffer -> Base64
const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Tuodaan palvelimen julkinen RSA-avain PEM-muodosta selaimeen
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

// Varsinainen Nightfright-paketointi
const encryptNightfright = async (payloadObj, publicKeyPem) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payloadObj));

    // 1. Generoidaan kertakäyttöinen AES-GCM avain ja IV
    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 2. Salataan itse data AES:llä (GCM lisää automaattisesti Auth Tagin loppuun)
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        data
    );

    // 3. Viedään AES-avain raakamuotoon salausta varten
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 4. Salataan AES-avain Mac Minin julkisella RSA-avaimella
    const rsaPubKey = await importPublicKey(publicKeyPem);
    const encryptedAesKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaPubKey,
        exportedAesKey
    );

    // 5. Palautetaan Pythonin odottama paketti
    return {
        nf_key: arrayBufferToBase64(encryptedAesKey),
        nf_iv: arrayBufferToBase64(iv),
        nf_data: arrayBufferToBase64(encryptedData)
    };
};

// ==========================================
// VARSINAINEN KOMPONENTTI
// ==========================================

const SmartSuggestionBox = ({ activeSignals, dbPhrases, onTogglePath, appState }) => {
    
    const [suositellutPalvelut, setSuositellutPalvelut] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // 1. Muotoillaan näytettävät signaalit yhteistä komponenttia varten
    const displaySignals = useMemo(() => 
        Object.entries(activeSignals)
            .filter(([key, value]) => value && !key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i))
            .map(([key]) => ({ label: key.replace(/_/g, ' ') })), 
    [activeSignals]);

    // 2. Lasketaan polut
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

    // 3. Muutetaan datamuoto common-komponentille sopivaksi
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

    // --- HAKUFUNKTIO ---
    const haePalvelut = async () => {
        setIsSearching(true);
        setSuositellutPalvelut([]); 
        const startTime = performance.now();
        
        try {
            // 1. KOOTAAN TEKSTI
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
            if (escoTeksti) hakupalat.push(`Tavoiteammatit ja kiinnostuksen kohteet: ${escoTeksti}`);
            if (koulutusTeksti) hakupalat.push(`Koulutustausta ja osaaminen: ${koulutusTeksti}`);
            if (kieliTeksti) hakupalat.push(`Kielitaito: ${kieliTeksti}`);
            if (edellytyksetTeksti) hakupalat.push(`Työllistymisen edellytykset: ${edellytyksetTeksti}`);

            const searchText = hakupalat.length > 0 
                ? hakupalat.join('. ') 
                : "Asiakas etsii työllistymistä edistäviä palveluita, koulutuksia tai valmennusta.";

            const rawPayload = {
                search_text: searchText,
                match_count: 3,
                threshold: 0.5,
                filters: activeSignals
            };

            // 2. NIGHTFRIGHT-SALAUS 
            const publicKeyPem = import.meta.env.VITE_PUBLIC_RSA_KEY; 
            if (!publicKeyPem) {
                throw new Error("Julkinen RSA-avain puuttuu (VITE_PUBLIC_RSA_KEY)");
            }
            const encryptedPayload = await encryptNightfright(rawPayload, publicKeyPem);

            // 3. LÄHETETÄÄN SALATTU PAKETTI API:LLE
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
            const endTime = performance.now();
            const durationMs = Math.round(endTime - startTime);

            // 4. LOKITUS (Tallennetaan raakateksti Mac Minille tulevaisuuden hienosäätöä varten)
            macbase.from('log_services_ai').insert([{
                search_text: searchText,
                active_signals: activeSignals,
                results: result.data || [],
                duration_ms: durationMs
            }]).then(({ error }) => {
                if (error) console.error("Tekoälyn lokituksen tallennus epäonnistui:", error);
            });

            setSuositellutPalvelut(result.data || []);
            
        } catch (error) {
            console.error("Virhe tekoälyhaussa:", error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="smart-suggestion-container">
            <SmartResolutionHub 
                signals={displaySignals}
                strategies={strategies}
            />

            <div className="ai-service-search" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                
                {isSearching ? (
                    <AILoadingSpinner text="Tekoäly etsii osuvimpia palveluita..." />
                ) : (
                    <Button 
                        variant="primary" 
                        onClick={haePalvelut}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Rocket size={16} /> 
                        Etsi sopivia palveluita tekoälyllä
                    </Button>
                )}

                {suositellutPalvelut.length > 0 && (
                    <div className="service-results" style={{ marginTop: '1.5rem' }}>
                        <h4 className="subsection-title" style={{ marginBottom: '1rem' }}>Suositellut palvelut (Hybridihaku)</h4>
                        
                        <div className="flex-col-gap">
                            {suositellutPalvelut.map(palvelu => (
                                <Card key={palvelu.id} className="mb-2">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                                            {palvelu.title}
                                        </strong>
                                        
                                        <Badge variant="info">
                                            {Math.round(palvelu.similarity * 100)}% osuma
                                        </Badge>
                                    </div>
                                    
                                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                        {palvelu.description}
                                    </p>
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