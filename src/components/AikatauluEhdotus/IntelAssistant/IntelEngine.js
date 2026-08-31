// src/components/AikatauluEhdotus/IntelAssistant/IntelEngine.js

const getLocalDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getMedian = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const normalizeKey = (str) => (str || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

// 🟢 UUSI APUFUNKTIO: Aggregoi asiakkaan data kanavan (esim. 'puhelu') perusteella
const getAggregatedClientData = (vaultData, mode) => {
    const modeSuffix = `_${normalizeKey(mode)}`;
    let aggregated = [];
    if (vaultData && typeof vaultData === 'object') {
        Object.entries(vaultData).forEach(([key, arr]) => {
            if (key.endsWith(modeSuffix) && Array.isArray(arr)) {
                aggregated = aggregated.concat(arr);
            }
        });
    }
    return aggregated;
};

// 🟢 UUSI APUFUNKTIO: Aggregoi universaalidata kanavan perusteella
const getAggregatedUniversalData = (universalData, mode) => {
    const modeSuffix = `_${normalizeKey(mode)}`;
    return (universalData || [])
        .filter(d => d.kategoria && d.kategoria.endsWith(modeSuffix))
        .map(d => d.kesto_min);
};

export const calculateExpectedDuration = ({ 
    settings, clientType, mode = 'puhelu', needsInterpreter = false, 
    isFamiliar = false, clientVaultData = {}, universalData = [] 
}) => {
    let expectedDuration = Number(settings?.kestot_perus?.[clientType] || 45);
    let kestoSelite = `Peruskesto ${expectedDuration} min`;
    let isDynamicUsed = false;
    let autoLog = null; 

    // LUKITAAN AKTIVOINTI EHDOTTOMASTI 60 MINUUTTIIN
    if (clientType === 'aktivointi') {
        expectedDuration = 60;
        kestoSelite = `Lakisääteinen kesto (60 min)`;
        autoLog = { type: 'warning', iconName: 'Lock', msg: `Keston ohitus: Aktivointijakson tapaaminen on lukittu tiukasti 60 minuuttiin. Dynaamisia kestoja tai lyhennyksiä ei sovelleta.` };
        isDynamicUsed = true; 
    } 
    // NORMAALI DYNAAMINEN LASKENTA (AGGREGOITUNA KANAVAN MUKAAN)
    else if (settings?.automaatio?.ajanhallinta?.salli_dynaamiset_kestot) {
        
        // 🟢 Haetaan yhdistetyt listat kanavan perusteella (Tyyppi jätetään huomiotta!)
        const clientAggregated = getAggregatedClientData(clientVaultData, mode);
        const clientMedian = getMedian(clientAggregated);

        if (clientMedian) {
            expectedDuration = Number(clientMedian);
            kestoSelite = `Datan ennuste (Henkilökohtainen)`;
            autoLog = { type: 'success', iconName: 'Zap', msg: `Tekoälyn kestoarvio (${clientMedian} min) pohjautuu asiakkaan kaikkiin aiempiin asiointeihin kanavassa: ${mode.toUpperCase()}.` };
            isDynamicUsed = true;
        } else {
            const uniList = getAggregatedUniversalData(universalData, mode);
            const uniMedian = getMedian(uniList);
            
            if (uniMedian) {
                expectedDuration = Number(uniMedian);
                kestoSelite = `Datan ennuste (Yleinen)`;
                autoLog = { type: 'info', iconName: 'Zap', msg: `Uusi asiakas: Kestoarvio (${uniMedian} min) laskettu asiantuntijan 6 kk yleisestä mediaanista kanavassa: ${mode.toUpperCase()}.` };
                isDynamicUsed = true;
            }
        }
    }

    if (!isDynamicUsed) {
        if (isFamiliar && settings?.kesto_tuttu_asiakas > 0) {
            expectedDuration = Number(settings.kesto_tuttu_asiakas);
            kestoSelite = `Kiinteä kesto (Tuttu)`;
            autoLog = { type: 'success', iconName: 'CheckCircle2', msg: `Tuttu asiakas tunnistettu: Käytetään nopeutettua aikaa (${settings.kesto_tuttu_asiakas} min).` };
        }
    } 

    if (needsInterpreter) {
        expectedDuration += Number(settings?.tulkki_lisa_minuutit || 15);
        kestoSelite += ` + Tulkki`;
    }

    if (settings?.kirjaus_puskuri_minuutit > 0) {
        expectedDuration += Number(settings.kirjaus_puskuri_minuutit);
        kestoSelite += ` (+${settings.kirjaus_puskuri_minuutit}m tauko)`;
    }

    return { expectedDuration, kestoSelite, isDynamicUsed, autoLog };
};

export const analyzeSchedule = ({ 
    settings, basket, suggestion, clientType, is46, 
    needsInterpreter, isFamiliar, expertLocations, 
    clientVaultData = {}, universalData = [] 
}) => {
    const logs = [];
    let isCompromise = false;
    
    const mode = basket.length > 0 ? basket[0].mode : (suggestion?.forcedMode || 'puhelu');

    const durationData = calculateExpectedDuration({
        settings, clientType, mode, needsInterpreter, isFamiliar, clientVaultData, universalData
    });

    if (durationData.autoLog) logs.push(durationData.autoLog);
    if (needsInterpreter) {
        logs.push({ type: 'info', iconName: 'Info', msg: `Tulkkisuojaus aktiivinen: Aikaa pidennetty (+${settings.tulkki_lisa_minuutit || 15} min).` });
    }

    if (basket.length > 0) {
        const selectedItem = basket[0];
        const selectedTime = new Date(selectedItem.time);

        if (mode === 'kaynti') {
            const idealLoc = suggestion?.toimipiste ? suggestion.toimipiste.split(' ')[0] : 'Tuntematon';
            const actualLoc = selectedItem.locationName || 'Malminkatu';

            if (idealLoc !== actualLoc) {
                isCompromise = true;
                logs.push({ 
                    type: 'warning', 
                    iconName: 'MapPin', 
                    msg: `Lokaatiokompromissi: Asiakkaan postinumeron mukaisesta toimipisteestä (${idealLoc}) ei löytynyt vapaata aikaa asiantuntijalta tälle ajanjaksolle. Tapaaminen ohjattiin pakotetusti vapaaseen työpisteeseen: ${actualLoc}.` 
                });
            } else {
                logs.push({ 
                    type: 'success', 
                    iconName: 'MapPin', 
                    msg: `Ihannesijainti: Aika kohdistettiin täydellisesti asiakkaan postinumeron mukaiseen toimipisteeseen (${actualLoc}).` 
                });
            }
        }

        if (selectedItem.isBorrowed) {
            isCompromise = true;
            logs.push({ type: 'warning', iconName: 'AlertTriangle', msg: `Kompromissien vesiputous: ${selectedItem.label || 'Aika lainattu toisesta lokerosta'}.` });
        }
        
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
            
            if (diffDays > (settings?.lykkays_toleranssi_pv || 14)) {
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
                logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Aikaistettu (${diffDays} pv). Hakeuduttu aktiivisesti "kuoppaan" tasapainotuksen turvaamiseksi.` });
            } else {
                logs.push({ type: 'success', iconName: 'CheckCircle2', msg: `Optimaalinen sijoitus! Aika tismalleen tavoiteviikolla.` });
            }
        }

        const jsDay = selectedTime.getDay() || 7; 
        if (settings?.pyhat_paivat?.includes(String(jsDay))) {
            if (is46) {
                logs.push({ type: 'warning', iconName: 'ShieldAlert', msg: `Lakisääteinen hätävara: Aika sijoitettu poikkeuksellisesti varatulle Fokus-päivälle!` });
            } else {
                isCompromise = true;
                logs.push({ type: 'danger', iconName: 'AlertTriangle', msg: `KRIITTINEN VIRHE: Valitsit ajan suojatulta Fokus-päivältä, asetus ei salli tätä.` });
            }
        }
    }

    return { 
        logs, 
        expectedDuration: durationData.expectedDuration, 
        kestoSelite: durationData.kestoSelite, 
        isCompromise 
    };
};