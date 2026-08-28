import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient'; 
import { createEncryptedSessionKey, encryptPayload, decryptPayload } from '../utils/cryptoUtils';

// Haetaan julkinen lukko Vite-ympäristömuuttujista
const PUBLIC_RSA_KEY = import.meta.env.VITE_PUBLIC_RSA_KEY;

// --- UUSI: Apufunktio, jolla uusi kesto ujutetaan 18-askeleen rengaspuskuriin ---
export const appendDurationToVault = (vaultData, kesto, kestoTyyppi, kestoTapa) => {
    // Jos kellotusta ei tehty, palautetaan reppu sellaisenaan
    if (!kesto || !kestoTyyppi || !kestoTapa) {
        console.log("⚠️ [Ovimies] Keston päivitys ohitettu: kelloa ei käytetty tai tiedot puutteelliset.");
        return vaultData;
    }

    const newVault = { ...vaultData };
    if (!newVault.kestot) newVault.kestot = {};

    // Normalisoidaan avain (esim. "Täydentävä työnhakukeskustelu" + "Puhelu" -> "taydentava_tyonhakukeskustelu_puhelu")
    const normalizeKey = (str) => {
        return str.toLowerCase()
                  .replace(/ä/g, 'a')
                  .replace(/ö/g, 'o')
                  .replace(/[^a-z0-9]/g, '_')
                  .replace(/_+/g, '_')
                  .replace(/^_|_$/g, '');
    };
    
    const key = `${normalizeKey(kestoTyyppi)}_${normalizeKey(kestoTapa)}`;

    // Haetaan vanha lista tai luodaan tyhjä
    const oldArray = newVault.kestot[key] || [];
    
    // Laitetaan uusi aika alkuun, ja leikataan lista armotta 18 pitkäksi!
    const newArray = [kesto, ...oldArray].slice(0, 18);
    
    newVault.kestot[key] = newArray;

    console.log(`🔄 [Ovimies] Päivitetään rengaspuskuri kategorialle: '${key}'`);
    console.log(`   🔸 Vanha lista: [${oldArray.join(', ')}]`);
    console.log(`   🔸 Uusi lisättävä arvo: ${kesto} min`);
    console.log(`   ✅ Leikattu uusi lista (max 18 kpl): [${newArray.join(', ')}]`);

    return newVault;
};

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
            
            // 3. Avataan paluuposti ja puretaan sisältö
            if (data?.isReturningCustomer && data?.encryptedResponse) {
                const vaultData = await decryptPayload(data.encryptedResponse, sessionKey);
                
                let viimeKayntiKk = null;
                let latestTapa = null;
                const signals = [];
                
                const historia = Array.isArray(vaultData.historia) ? vaultData.historia : [];
                const latest = historia[0] || null;

                // 🟢 LISÄTTY: Haetaan myös kestot repusta
                const kestot = vaultData.kestot || {};
                console.log(`🔐 [Ovimies] Purettiin asiakkaan reppu. Löydetyt kesto-historiat:`, kestot);

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
                        signals: signals,
                        kestot: kestot // 🟢 LISÄTTY
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
            // 🟢 LISÄTTY: Vahvistusloki ennen salausta
            console.log(`📦 [Ovimies] Pakataan asiakkaan reppu salausta varten. Mukana kesto-historiat:`, payloadObj.kestot || 'Ei kestoja');

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
            console.log("✅ [Ovimies] Holvi lukittu vahvalla E2E-hybridisalauksella. Data turvassa.");
            
        } catch (err) {
            console.error("Sentinel Register Error:", err);
        }
    }, []);

    return { checkIdentity, registerIdentity, isReturning, isChecking };
};