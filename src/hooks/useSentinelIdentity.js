import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient'; 
import { createEncryptedSessionKey, encryptPayload, decryptPayload } from '../utils/cryptoUtils';

// Haetaan julkinen lukko Vite-ympäristömuuttujista
const PUBLIC_RSA_KEY = import.meta.env.VITE_PUBLIC_RSA_KEY;

export const useSentinelIdentity = () => {
    const [isReturning, setIsReturning] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // --- TARKISTUS JA LIIKETOIMINTALOGIIKKA (CHECK) ---
    const checkIdentity = useCallback(async (idPart) => {
        if (!idPart) return { found: false };
        if (!PUBLIC_RSA_KEY) {
            console.error("Turvallisuusvirhe: VITE_PUBLIC_RSA_KEY puuttuu!");
            return { found: false };
        }
        
        setIsChecking(true);
        try {
            // 1. Luodaan kertakäyttöavain paluupostia varten
            const { sessionKey, encryptedKeyBase64 } = await createEncryptedSessionKey(PUBLIC_RSA_KEY);

            // 2. Lähetetään kysely palvelimelle
            const { data, error } = await supabase.functions.invoke('sentinel-identity', {
                body: { 
                    action: 'check', 
                    idPart: idPart,
                    returnKey: encryptedKeyBase64 
                }
            });
            
            if (error) throw error;
            
            // 3. Avataan paluuposti ja lasketaan 6 kk matematiikka
            if (data?.isReturningCustomer && data?.encryptedResponse) {
                const vaultData = await decryptPayload(data.encryptedResponse, sessionKey);
                
                let viimeKayntiKk = null;
                let latestTapa = null;
                const signals = [];
                
                const historia = Array.isArray(vaultData.historia) ? vaultData.historia : [];
                const latest = historia[0] || null;

                if (historia.length > 0) {
                    latestTapa = latest.tapa === 'PUH' ? 'PUHELIN' : 'KÄYNTI';
                    
                    // Etsitään uusin käynti 6 kk sääntöä varten
                    const latestKaynti = historia.find(h => h.tapa === 'KÄY');
                    
                    if (latestKaynti && latestKaynti.kk && latestKaynti.v) {
                        viimeKayntiKk = String(latestKaynti.kk).padStart(2, '0');
                        
                        // Parannettu matikka (huomioi myös vuodet)
                        const currentDate = new Date();
                        const currentMonth = currentDate.getMonth() + 1; // 1-12
                        const currentYear = currentDate.getFullYear();
                        
                        const monthsDiff = (currentYear - latestKaynti.v) * 12 + (currentMonth - parseInt(viimeKayntiKk, 10));
                        
                        if (monthsDiff >= 6) {
                            signals.push({ 
                                id: 'kaynti_suositus', 
                                label: `🚨 Yli 6 kk lähikäynnistä! (${viimeKayntiKk}/${latestKaynti.v})` 
                            });
                        }
                    }

                    // Lisätään signaali viimeisimmästä asiointitavasta
                    if (latest) {
                        const isPuh = latest.tapa === 'PUH';
                        const tapaSig = isPuh ? 'puhelin_tapaaminen' : 'kayntitapaaminen';
                        const kkStr = latest.kk ? String(latest.kk).padStart(2, '0') : 'XX';
                        const tapaLabel = isPuh 
                            ? `Viimeksi: Puhelin (${kkStr}/${latest.v})` 
                            : `Viimeksi: Käynti (${kkStr}/${latest.v})`;
                        
                        signals.push({ id: tapaSig, label: tapaLabel });
                    }
                }

                setIsReturning(true);
                return { 
                    found: true, 
                    vaultData: vaultData,
                    // Paketoidaan Imurille valmiiksi pureskellut tiedot
                    processed: {
                        sv: vaultData.sv || null,
                        postinro: vaultData.postinro || null,
                        historia: historia,
                        viimeKayntiKk: viimeKayntiKk,
                        latestTapa: latestTapa,
                        signals: signals
                    }
                };
            }
            
            setIsReturning(false);
            return { found: false };
        } catch (err) {
            console.error("Sentinel Check Error:", err);
            return { found: false };
        } finally {
            setIsChecking(false);
        }
    }, []);

    // --- TALLENNUS (REGISTER) ---
    const registerIdentity = useCallback(async (idPart, payloadObj) => {
        if (!idPart || !payloadObj) return;
        if (!PUBLIC_RSA_KEY) {
            console.error("Turvallisuusvirhe: VITE_PUBLIC_RSA_KEY puuttuu!");
            return;
        }

        try {
            const { sessionKey, encryptedKeyBase64 } = await createEncryptedSessionKey(PUBLIC_RSA_KEY);
            const encryptedPayload = await encryptPayload(payloadObj, sessionKey);

            const { error } = await supabase.functions.invoke('sentinel-identity', {
                body: { 
                    action: 'register', 
                    idPart: idPart, 
                    payload: {
                        encryptedKey: encryptedKeyBase64,
                        iv: encryptedPayload.iv,
                        ciphertext: encryptedPayload.ciphertext
                    }
                }
            });
            
            if (error) throw error;
            console.log("✅ Ovimies: Holvi lukittu vahvalla E2E-hybridisalauksella.");
            
        } catch (err) {
            console.error("Sentinel Register Error:", err);
        }
    }, []);

    return { checkIdentity, registerIdentity, isReturning, isChecking };
};