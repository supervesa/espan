// src/components/AikatauluEhdotus/IntelAssistant/IntelEngine.js

// Apufunktio lokaaliin YYYY-MM-DD -muotoon
const getLocalDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Apufunktio mediaanin laskentaan numerotaulukosta
const getMedian = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

// Normalisoi kategoria (esim. "Täydentävä työnhakukeskustelu" -> "taydentava_tyonhakukeskustelu")
const normalizeKey = (str) => (str || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

export const analyzeSchedule = ({ 
    settings, basket, suggestion, clientType, is46, 
    needsInterpreter, isFamiliar, expertLocations, 
    clientVaultData = {}, universalData = [] 
}) => {
    const logs = [];
    let isCompromise = false;
    
    let expectedDuration = settings.kestot_perus?.[clientType] || 45;
    let kestoSelite = `Peruskesto ${expectedDuration} min`;
    let isDynamicUsed = false;

    // Määritellään suunniteltu tapa (Mode) joko korista tai ehdotuksesta
    const mode = basket.length > 0 ? basket[0].mode : (suggestion?.forcedMode || 'puhelu');

    // --- A. KESTON LASKENTA (Dataperusteinen vs Manuaalinen) ---
    if (settings.automaatio?.ajanhallinta?.salli_dynaamiset_kestot) {
        const categoryKey = `${normalizeKey(clientType)}_${normalizeKey(mode)}`;
        
        // 1. HOLVI 1: Asiakkaan oma historia (Rengaspuskuri)
        const clientMedian = getMedian(clientVaultData?.[categoryKey]);

        if (clientMedian) {
            expectedDuration = clientMedian;
            kestoSelite = `Datan ennuste (Henkilökohtainen)`;
            logs.push({ type: 'success', iconName: 'Zap', msg: `Tekoälyn kestoarvio (${clientMedian} min) pohjautuu suoraan tämän asiakkaan aiempaan asiointihistoriaan.` });
            isDynamicUsed = true;
        } else {
            // 2. HOLVI 2: Universaali historia (Globaali mediaani)
            const uniList = universalData.filter(d => d.kategoria === categoryKey).map(d => d.kesto_min);
            const uniMedian = getMedian(uniList);
            
            if (uniMedian) {
                expectedDuration = uniMedian;
                kestoSelite = `Datan ennuste (Yleinen)`;
                logs.push({ type: 'info', iconName: 'Zap', msg: `Uusi asiakas: Kestoarvio (${uniMedian} min) ohittaa manuaalisen asetuksen, ja se on laskettu asiantuntijan 6 kk yleisestä mediaanista.` });
                isDynamicUsed = true;
            }
        }
    }

    // Jos dynamic ei ollut päällä TAI dataa ei löytynyt, käytetään normaaleja "Manuaali" sääntöjä
    if (!isDynamicUsed) {
        // Ensin katsotaan onko tuttu asiakas (vaikuttaa peruskestoon)
        if (isFamiliar && settings.kesto_tuttu_asiakas > 0) {
            expectedDuration = settings.kesto_tuttu_asiakas;
            kestoSelite = `Kiinteä kesto (Tuttu)`;
            logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Tuttu asiakas tunnistettu: Käytetään nopeutettua aikaa (${settings.kesto_tuttu_asiakas} min).` });
        }

        // Sitten lisätään tulkkilisä perus- tai nopeutetun ajan päälle
        if (needsInterpreter) {
            expectedDuration += settings.tulkki_lisa_minuutit;
            kestoSelite += ` + Tulkki`;
            logs.push({ type: 'info', iconName: 'Info', msg: `Tulkkisuojaus aktiivinen: Aikaa pidennetty (+${settings.tulkki_lisa_minuutit} min).` });
        }
    } else {
        // Jos tulkki on mukana, annetaan sille TULKKILISÄ puskurina jopa dynaamisessa arviossa.
        if (needsInterpreter) {
            expectedDuration += settings.tulkki_lisa_minuutit;
            kestoSelite += ` + Tulkki`;
            logs.push({ type: 'info', iconName: 'Info', msg: `Dataan lisättiin turvallisuussyistä normaali tulkkipuskuri (+${settings.tulkki_lisa_minuutit} min).` });
        }
    }

    // Puskurit asioinnin loppuun
    if (settings.kirjaus_puskuri_minuutit > 0) {
        expectedDuration += settings.kirjaus_puskuri_minuutit;
        kestoSelite += ` (+${settings.kirjaus_puskuri_minuutit}m tauko)`;
    }


    // --- B. KALENTERIN VALINNAN SKANNAUS (Ovimies ja Toleranssit) ---
    if (basket.length > 0) {
        const selectedItem = basket[0];
        const selectedTime = new Date(selectedItem.time);

        // 1. Vesiputous (Liedennys)
        if (selectedItem.isBorrowed) {
            isCompromise = true;
            logs.push({ type: 'warning', iconName: 'AlertTriangle', msg: `Kompromissien vesiputous: ${selectedItem.label || 'Aika lainattu toisesta lokerosta'}.` });
        }
        
        // 2. Lykkäystoleranssi ja "Kuoppa" -skannaus
        if (suggestion?.targetDate) {
            const tDate = new Date(suggestion.targetDate);
            tDate.setHours(0,0,0,0);
            const sDate = new Date(selectedTime);
            sDate.setHours(0,0,0,0);
            
            const diffTime = sDate.getTime() - tDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let hasAbsence = false;
            let absenceType = '';
            
            if (diffDays > 0 && expertLocations.length > 0) {
                for (let i = 0; i <= diffDays; i++) {
                    const checkD = new Date(tDate);
                    checkD.setDate(checkD.getDate() + i);
                    const dStr = getLocalDateString(checkD);
                    
                    const loc = expertLocations.find(l => l.date === dStr && (l.location_type === 'loma' || l.location_type === 'koulutus'));
                    if (loc) {
                        hasAbsence = true;
                        absenceType = loc.location_type === 'loma' ? 'loman' : 'poissaolon';
                        break;
                    }
                }
            }
            
            // TÄSSÄ KORJATTU IF/ELSE-RAKENNE
            if (diffDays > settings.lykkays_toleranssi_pv) {
                isCompromise = true;
                if (hasAbsence) {
                    logs.push({ type: 'warning', iconName: 'Calendar', msg: `Lykkäystoleranssi (${settings.lykkays_toleranssi_pv} pv) ylitetty asiantuntijan ${absenceType} vuoksi (+${diffDays} pv tavoitteesta).` });
                } else {
                    logs.push({ type: 'warning', iconName: 'AlertTriangle', msg: `Lykkäystoleranssi ylitetty kalenteriruuhkan vuoksi (+${diffDays} pv tavoitteesta).` });
                }
            } else if (diffDays > 0) {
                if (hasAbsence) {
                    logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Aika lykätty, mutta osui toleranssiin (+${diffDays} pv). Edeltävä ${absenceType} kierrettiin automaattisesti.` });
                } else {
                    logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Aika löytyi sallitun lykkäystoleranssin sisältä (+${diffDays} pv).` });
                }
            } else if (diffDays < 0) {
                // Kuoppatutka voi nyt trigata tämän!
                logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Aikaistettu (${diffDays} pv). Hakeuduttu aktiivisesti "kuoppaan" tasapainotuksen turvaamiseksi.` });
            } else {
                logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Optimaalinen sijoitus! Aika tismalleen tavoiteviikolla.` });
            }
        }

        // 3. Fokus-päivät
        const jsDay = selectedTime.getDay() || 7; 
        if (settings.pyhat_paivat?.includes(String(jsDay))) {
            if (is46) {
                logs.push({ type: 'warning', iconName: 'ShieldAlert', msg: `Lakisääteinen hätävara: Aika sijoitettu poikkeuksellisesti varatulle Fokus-päivälle!` });
            } else {
                isCompromise = true;
                logs.push({ type: 'danger', iconName: 'AlertTriangle', msg: `KRIITTINEN VIRHE: Valitsit ajan suojatulta Fokus-päivältä, asetus ei salli tätä.` });
            }
        }
    }

    return { logs, expectedDuration, kestoSelite, isCompromise };
};