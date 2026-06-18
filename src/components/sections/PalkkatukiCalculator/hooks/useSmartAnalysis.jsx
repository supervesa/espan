// --- src/components/sections/PalkkatukiCalculator/hooks/useSmartAnalysis.js ---
import React, { useMemo } from 'react';
import { MapPin, CheckCircle, AlertCircle, Zap, Activity, Calendar, User, FileDigit, Info } from 'lucide-react';

// Apufunktio ääkkösten ja isojen kirjainten siivoamiseen (Ääkköspanssari)
const normalizeKey = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a');
};

export const useSmartAnalysis = (state, ptState, ika, ehto24_28_tayttyy, ehto3kk_tayttyy, hyvaksytytPaivat = 0, tkCalc, handleSupportToggle, onUpdatePalkkatuki) => {
    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];

        // 1. KUNTA JA HELSINKI-LISÄ (Panssaroitu haku)
        const kotikuntaObj = state?.suunnitelman_perustiedot?.kotikunta || state?.kotikunta;
        
        // Etsitään muuttujaa useista mahdollisista muodoista
        const kuntaStr = kotikuntaObj?.muuttujat?.['[KUNTA]'] 
                      || kotikuntaObj?.muuttujat?.KUNTA 
                      || kotikuntaObj?.muuttujat?.kunta 
                      || kotikuntaObj?.value 
                      || '';
                      
        const normKunta = normalizeKey(String(kuntaStr));
        const isHelsinki = normKunta.includes('helsinki');
        const hasKunta = kuntaStr.toString().trim().length > 0;
        
        if (hasKunta) {
            detected.push({ 
                label: `Kunta: ${kuntaStr}`, 
                icon: <MapPin size={14} style={{ color: 'var(--color-primary)' }} />, 
                type: 'variable' 
            });
        } else {
            detected.push({ 
                label: 'Kotikunta puuttuu tiedoista (Helsinki-lisää ei voida arvioida)', 
                icon: <Info size={14} style={{ color: 'var(--color-text-secondary)' }} />, 
                type: 'variable' 
            });
        }

        // 2. SIGNAALIEN ÄÄKKÖSPANSSAROITU LUKU
        let onkoAlentuma = false;
        let eiTutkintoa = false;
        const loydetytSignaalit = [];

        if (state?.activeSignals) {
            for (const key of Object.keys(state.activeSignals)) {
                const normKey = normalizeKey(key);
                
                // Työkyvyn alentuma
                if (normKey.includes('tyokyky') || normKey.includes('alentuma') || normKey.includes('sairaus') || normKey.includes('vamma')) {
                    onkoAlentuma = true;
                    loydetytSignaalit.push(key);
                }
                
                // Koulutuksen/tutkinnon puute
                if (normKey.includes('tutkinto') || normKey.includes('koulutus')) {
                    eiTutkintoa = true;
                }
            }
        }
        
        if (onkoAlentuma) {
            detected.push({ 
                label: `Signaali: ${loydetytSignaalit.join(', ')}`, 
                icon: <Activity size={14} style={{ color: 'var(--color-warning)' }} />, 
                type: 'signal' 
            });
        }

        // 3. MATEMATIIKKA JA LAIN EDELLYTYKSET
        const yli6kkTyottomyys = hyvaksytytPaivat >= 183; // Laki 7 luku 2 § 1 mom 5 kohta
        const peruste50Tuki = (ika && (ika < 25 || ika >= 50)) || yli6kkTyottomyys || eiTutkintoa;

        if (ika !== null) {
            detected.push({ 
                label: `Ikä: ${ika} v`, 
                icon: <User size={14} style={{ color: 'var(--color-text-secondary)' }} />, 
                type: 'math' 
            });
        }
        if (ehto24_28_tayttyy) {
            detected.push({ 
                label: '24/28 kk ehto täyttyy (yli 730 pv)', 
                icon: <Calendar size={14} style={{ color: 'var(--color-success)' }} />, 
                type: 'math' 
            });
        } else if (ehto3kk_tayttyy) {
            detected.push({ 
                label: '3 kk ehto täyttyy (yli 91 pv)', 
                icon: <Calendar size={14} style={{ color: 'var(--color-primary)' }} />, 
                type: 'math' 
            });
        }

        // 4. KÄYNNISSÄ OLEVAT PALVELUT & ESTOT
        const services = state?.sessionServices || [];
        const onkoPalkkatukiValittu = services.some(s => s.entity_key === 'palkkatuki');
        const onkoYhdistys = ptState.tyonantaja_yhdistys;

        if (tkCalc?.isMaxedOut) {
            detected.push({ 
                label: 'Estetty: Työkokeilun 6 kk täynnä', 
                icon: <AlertCircle size={14} style={{ color: 'var(--color-danger)' }} />, 
                type: 'alert' 
            });
        }

        // --- RATKAISUEHDOTUKSET (Suggestions) ---
        
        // A. Peruspalkkatuki (50 %)
        if (peruste50Tuki) {
            const perusteTeksti = yli6kkTyottomyys ? 'Yli 6 kk työttömyys' : (eiTutkintoa ? 'Ei tutkintoa' : `Ikäperuste (${ika}v)`);
            if (onkoPalkkatukiValittu && ptState.puoltoTyyppi === '50_perus') {
                suggestions.push({ 
                    label: '50 % peruspalkkatuki huomioitu', info: 'Ammatillisen osaamisen puute on jo huomioitu päätöksessä.', 
                    status: 'done', icon: <CheckCircle size={18} color="var(--color-success)" /> 
                });
            } else {
                suggestions.push({
                    label: 'Puolla peruspalkkatukea (50 %)', 
                    info: `Laki 7 luku 2 §: Harkinnanvarainen. Täyttää ehdon: ${perusteTeksti}. Vaatii asiantuntijan arvion ammatillisen osaamisen puutteesta.`, 
                    status: 'suggested', icon: <Zap size={18} color="var(--color-primary)" />,
                    action: () => { onUpdatePalkkatuki('puoltoTyyppi', '50_perus'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
                });
            }
        }

        // B. Työkyvyn alentuma (70 %)
        if (onkoAlentuma) {
            if (onkoPalkkatukiValittu && ptState.puoltoTyyppi === '70_tyokyky') {
                suggestions.push({ 
                    label: '70 % tuki huomioitu', info: 'Työkyvyn alentuma on jo huomioitu päätöksessä.', 
                    status: 'done', icon: <CheckCircle size={18} color="var(--color-success)" /> 
                });
            } else {
                suggestions.push({
                    label: 'Puolla 70 % tukea (Työkyvyn alentuma)', 
                    info: 'Laki 7 luku 7 §: Tunnistettu vamman/sairauden signaali. Voidaan myöntää, jos työllistyminen on olennaisesti vaikeutunut.', 
                    status: 'suggested', icon: <Activity size={18} />,
                    action: () => { onUpdatePalkkatuki('puoltoTyyppi', '70_tyokyky'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
                });
            }
        }

        // C. Yhdistystuki (100 %)
        if (onkoYhdistys) {
            if (ehto24_28_tayttyy) {
                suggestions.push({
                    label: 'Puolla 100 % tukea (Yhdistys / 24 kk)', 
                    info: 'Laki 7 luku 8 §: Työnantaja on yhdistys/säätiö ja 24/28 kk työttömyysehto täyttyy kriteeristössä.', 
                    status: 'suggested', icon: <FileDigit size={18} />,
                    action: () => { onUpdatePalkkatuki('puoltoTyyppi', '100_yhdistys'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
                });
            } else {
                suggestions.push({ 
                    label: '100 % yhdistystuki (Estetty)', 
                    info: `Laki 7 luku 8 §: Ei voida myöntää, vaikka työnantaja on yhdistys, koska 24 kk työttömyys (730 pv) ei täyty (Nyt ${hyvaksytytPaivat} pv).`, 
                    status: 'blocked', icon: <AlertCircle size={18} color="var(--color-danger)" /> 
                });
            }
        }

        // D. 55-vuotiaiden tuki (70 %)
        if (ika >= 55) {
            if (ehto24_28_tayttyy) {
                suggestions.push({
                    label: 'Puolla 55-vuotiaiden työllistämistukea', 
                    info: 'Laki 7 a luku 2 §: Ikä ja 24/28 kk työttömyysehto täyttyvät. Ei vaadi ammatillisen osaamisen puutteen arviointia.', 
                    status: 'suggested', icon: <User size={18} />,
                    action: () => { onUpdatePalkkatuki('puoltoTyyppi', '55_tuki'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
                });
            } else {
                suggestions.push({ 
                    label: '55-vuotiaiden tuki (Estetty)', 
                    info: `Laki 7 a luku 2 §: Asiakas on yli 55v, mutta 24 kk työttömyys ei täyty (Nyt ${hyvaksytytPaivat} pv). Vain peruspalkkatuki on mahdollinen.`, 
                    status: 'blocked', icon: <AlertCircle size={18} color="var(--color-danger)" /> 
                });
            }
        }

        // E. Helsinki-lisä (50 %)
        if (isHelsinki) {
            if (ehto3kk_tayttyy) {
                if (ptState.helsinkilisa_puolletaan) {
                    suggestions.push({ 
                        label: 'Helsinki-lisä puoltamassa', info: '3 kk työttömyysehto täyttyy.', 
                        status: 'done', icon: <CheckCircle size={18} color="var(--color-success)" /> 
                    });
                } else {
                    suggestions.push({
                        label: 'Puolla Helsinki-lisää (50 %)', 
                        info: 'Kaupungin ohjeistus: Asiakas on helsinkiläinen ja 3 kk työttömyysehto täyttyy. Ei voi yhdistää valtion tukeen.', 
                        status: 'suggested', icon: <MapPin size={18} />,
                        action: () => { handleSupportToggle('helsinkilisa_puolletaan', 'helsinkilisa_puollettu', true); }
                    });
                }
            } else {
                suggestions.push({ 
                    label: 'Helsinki-lisä (Estetty)', 
                    info: 'Kunta on Helsinki, mutta 3 kk (91 pv) yhdenjaksoinen työttömyysehto ei täyty.', 
                    status: 'blocked', icon: <AlertCircle size={18} color="var(--color-danger)" /> 
                });
            }
        }

        // F. Työkokeilu (Estotiedot)
        if (tkCalc?.isMaxedOut) {
            suggestions.push({ 
                label: 'Työkokeilu (Estetty)', 
                info: 'Laki 55 §: 6 kk enimmäisaika samalla työnantajalla on täyttynyt. Vaatii nollautuakseen lakisääteisen tauon.', 
                status: 'blocked', icon: <AlertCircle size={18} color="var(--color-danger)" /> 
            });
        }

        suggestions.sort((a, b) => {
            const order = { 'suggested': 1, 'done': 2, 'blocked': 3 };
            return order[a.status] - order[b.status];
        });

        return { detected, suggestions };
    }, [ika, ehto24_28_tayttyy, ehto3kk_tayttyy, hyvaksytytPaivat, state, ptState.tyonantaja_yhdistys, ptState.helsinkilisa_puolletaan, ptState.puoltoTyyppi, tkCalc, handleSupportToggle, onUpdatePalkkatuki]);

    return analysis;
};