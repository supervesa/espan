// --- APUFUNKTIOT (Base64 <-> Puskuri) ---
export const arrayBufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
export const base64ToArrayBuffer = (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

// Muuttaa ympäristömuuttujasta luetun PEM-avaimen selaimen ymmärtämäksi RSA-lukoksi
const importPublicKey = async (pem) => {
    const pemContents = pem
        .replace(/-----BEGIN PUBLIC KEY-----/g, "")
        .replace(/-----END PUBLIC KEY-----/g, "")
        .replace(/\s/g, "");
    
    const binaryDer = base64ToArrayBuffer(pemContents);

    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
};

// 1. LUO KERTAKÄYTTÖISEN SALAUSAVAIMEN (Session Key)
// Tämä luo uuden AES-avaimen ja lukitsee sen palvelimen RSA-lukolla
export const createEncryptedSessionKey = async (rsaPublicKeyPem) => {
    // Luodaan täysin uusi 256-bittinen AES-avain
    const sessionKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    // Lukitaan tämä uusi AES-avain palvelimen julkisella RSA-avaimella
    const publicKey = await importPublicKey(rsaPublicKeyPem);
    const rawSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);
    const encryptedSessionKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawSessionKey
    );

    return {
        sessionKey, // Tämä jää selaimen muistiin!
        encryptedKeyBase64: arrayBufferToBase64(encryptedSessionKeyBuffer) // Tämä lähetetään palvelimelle
    };
};

// 2. SALAA DATAN (Payload)
export const encryptPayload = async (dataObj, sessionKey) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(dataObj));
    
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        sessionKey,
        encodedData
    );

    return {
        iv: arrayBufferToBase64(iv.buffer),
        ciphertext: arrayBufferToBase64(ciphertextBuffer)
    };
};

// 3. PURKAA PALUUPOSTIN
export const decryptPayload = async (encryptedResponse, sessionKey) => {
    const iv = base64ToArrayBuffer(encryptedResponse.iv);
    const ciphertext = base64ToArrayBuffer(encryptedResponse.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        sessionKey,
        ciphertext
    );

    const decodedString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decodedString);
};