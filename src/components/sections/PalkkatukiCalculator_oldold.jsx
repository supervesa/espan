// --- src/components/sections/PalkkatukiCalculator.jsx ---

import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient'; 
import { 
    BrainCircuit, Calculator, Calendar, Zap, Building, 
    CheckCircle, AlertCircle, Info, Coins, FileText, Clock, RotateCcw, MinusCircle, MapPin, Briefcase, Copy, AlertTriangle
} from 'lucide-react';
import Modal from '../Modal';
import { OHJEET, PALKKATUKI_LISAHUOMIOT, STATE_MUUTTUJAT } from '../../data/constants';

const PalkkatukiCalculator = ({ state, actions }) => {
    const { onUpdatePalkkatuki, onUpdateCustomText } = actions;
    const [showModal, setShowModal] = useState(false);
    
    const [estoFraasi, setEstoFraasi] = useState('');
    const ptState = state.palkkatuki || {};

    useEffect(() => {
        const fetchFraasi = async () => {
            try {
                const { data, error } = await supabase
                    .from('phrases')
                    .select('base_text')
                    .eq('phrase_key', 'tyokokeilu_maksimi_taynna')
                    .single();
                    
                if (data && !error) {
                    setEstoFraasi(data.base_text);
                }
            } catch (err) {
                console.error("Virhe fraasin haussa:", err);
            }
        };
        fetchFraasi();
    }, []);

    const handleSupportToggle = (avain, signaaliNimi, isChecked) => {
        onUpdatePalkkatuki(avain, isChecked);
        
        if (isChecked && actions.onAddSignal) {
            actions.onAddSignal(signaaliNimi);
        } else if (!isChecked && actions.onRemoveSignal) {
            actions.onRemoveSignal(signaaliNimi);
        }
    };

    // Paranneltu päivämäärän lukija (Ymmärtää Suomi-muodon ja Radiosta tulevan ISO-muodon)
    const parseAnyDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (val.includes('-')) {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        const parts = val.split('.');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    };

    // =========================================================================
    // 1. PALKKATUKI MATEMATIIKKA
    // =========================================================================
    
    const { ika, alkuperainenAlkuPvm, perusKestoPv, perusKestoTxt, hyvaksytytPaivat, ehto24_28_tayttyy, ehto3kk_tayttyy } = useMemo(() => {
        let laskettuIka = null;
        let originalDiffDays = 0;
        let originalKestoTxt = 'Ei tiedossa';

        const syntymaVuosi = state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.[STATE_MUUTTUJAT.SYNTYMAVUOSI]
                          || state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]']; 

        if (syntymaVuosi) {
            const vuosiNum = parseInt(String(syntymaVuosi).replace(/\D/g, ''), 10);
            if (!isNaN(vuosiNum)) {
                laskettuIka = new Date().getFullYear() - vuosiNum;
            }
        }

        const alkupvmStr = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.[STATE_MUUTTUJAT.TYONHAKU_ALKUPVM];
        const startDate = parseAnyDate(alkupvmStr);
        const now = new Date();
        
        if (startDate) {
            const diffTime = Math.max(0, now - startDate);
            originalDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const vuodet = Math.floor(originalDiffDays / 365);
            const kuukaudet = Math.floor((originalDiffDays % 365) / 30);
            if (vuodet > 0) originalKestoTxt = `${vuodet} v ${kuukaudet} kk (${originalDiffDays} pv)`;
            else originalKestoTxt = `${kuukaudet} kk (${originalDiffDays} pv)`;
        }

        const nollausPvm = parseAnyDate(ptState.nollausPvm);
        const activeStart = nollausPvm || startDate;
        
        let acceptedDays = 0;
        if (activeStart) {
            const diffTimeActive = Math.max(0, now - activeStart);
            const daysFromActiveStart = Math.ceil(diffTimeActive / (1000 * 60 * 60 * 24));
            const daysIn28MonthWindow = Math.min(daysFromActiveStart, 852);
            const vahennykset = parseInt(ptState.vahennysPv, 10) || 0;
            acceptedDays = Math.max(0, daysIn28MonthWindow - vahennykset);
        }

        return { ika: laskettuIka, alkuperainenAlkuPvm: alkupvmStr, perusKestoPv: originalDiffDays, perusKestoTxt: originalKestoTxt, hyvaksytytPaivat: acceptedDays, ehto24_28_tayttyy: acceptedDays >= 730, ehto3kk_tayttyy: acceptedDays >= 91 };
    }, [state.suunnitelman_perustiedot, ptState.nollausPvm, ptState.vahennysPv]);

    useEffect(() => {
        if (ptState.ehto24_28_tayttyy !== ehto24_28_tayttyy) {
            onUpdatePalkkatuki('ehto24_28_tayttyy', ehto24_28_tayttyy);
        }
    }, [ehto24_28_tayttyy, ptState.ehto24_28_tayttyy, onUpdatePalkkatuki]);


    // === RADION KUUNTELIJA (Vastaanottaa työkokeilun, muttei sotke laatikkoa) ===
    useEffect(() => {
        const handleRadio = (event) => {
            const payload = event.detail;
            if (payload && payload.tyyppi === "tyokokeilu" && payload.alku && payload.loppu) {
                onUpdatePalkkatuki('suunniteltu_tk_alku', payload.alku);
                onUpdatePalkkatuki('suunniteltu_tk_loppu', payload.loppu);
            } else {
                onUpdatePalkkatuki('suunniteltu_tk_alku', null);
                onUpdatePalkkatuki('suunniteltu_tk_loppu', null);
            }
        };

        window.addEventListener('palvelu_ajankohta_paivitetty', handleRadio);
        return () => window.removeEventListener('palvelu_ajankohta_paivitetty', handleRadio);
    }, [onUpdatePalkkatuki]);


    // =========================================================================
    // 3. TYÖKOKEILUN 6 KK LASKURI (Historia + Suunniteltu)
    // =========================================================================
    
    const tkText = ptState.tyokokeilu_historia || '';
    const isUnder25 = ika !== null && ika < 25;

    const tkCalc = useMemo(() => {
        const regex = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
        let match;
        const periods = [];
        let totalDays = 0;
        let latestEndDate = null;

        // 1. Lasketaan historia-laatikon päivät
        while ((match = regex.exec(tkText)) !== null) {
            const start = parseAnyDate(match[1]);
            const end = parseAnyDate(match[2]);
            if (start && end && end >= start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
                totalDays += diffDays;
                
                if (!latestEndDate || end > latestEndDate) {
                    latestEndDate = end;
                }
                periods.push({ startStr: match[1], endStr: match[2], days: diffDays });
            }
        }

        // 2. Lisätään suunniteltu jakso (JOS täppä on päällä)
        const usePlanned = ptState.huomioi_suunniteltu_tk !== false; // Oletuksena True
        if (usePlanned && ptState.suunniteltu_tk_alku && ptState.suunniteltu_tk_loppu) {
            const pStart = parseAnyDate(ptState.suunniteltu_tk_alku);
            const pEnd = parseAnyDate(ptState.suunniteltu_tk_loppu);

            if (pStart && pEnd && pEnd >= pStart) {
                const diffDays = Math.ceil(Math.abs(pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
                totalDays += diffDays;
                
                if (!latestEndDate || pEnd > latestEndDate) {
                    latestEndDate = pEnd;
                }
            }
        }

        // 3. Tarkistetaan nollaussääntö (karenssi)
        const now = new Date();
        let gapDays = 0;
        let isReset = false;

        if (latestEndDate) {
            const gapTime = Math.max(0, now - latestEndDate);
            gapDays = Math.ceil(gapTime / (1000 * 60 * 60 * 24));
            const requiredGap = isUnder25 ? 90 : 365;
            if (gapDays >= requiredGap) {
                isReset = true;
                totalDays = 0; 
            }
        }

        const maxDays = 180;
        const remainingDays = Math.max(0, maxDays - totalDays);
        const remainingMonths = Math.floor(remainingDays / 30); 
        
        return {
            periods,
            isReset,
            remainingMonths,
            isMaxedOut: remainingMonths <= 0 && !isReset
        };
    }, [tkText, isUnder25, ptState.suunniteltu_tk_alku, ptState.suunniteltu_tk_loppu, ptState.huomioi_suunniteltu_tk]);

    useEffect(() => {
        if (ptState.tyokokeilu_kesto_kk !== tkCalc.remainingMonths) {
            onUpdatePalkkatuki('tyokokeilu_kesto_kk', tkCalc.remainingMonths);
        }
    }, [tkCalc.remainingMonths, ptState.tyokokeilu_kesto_kk, onUpdatePalkkatuki]);

    useEffect(() => {
        if (!tkCalc.isMaxedOut && ptState.kirjaa_tyokokeilu_esto) {
            onUpdatePalkkatuki('kirjaa_tyokokeilu_esto', false);
        }
    }, [tkCalc.isMaxedOut, ptState.kirjaa_tyokokeilu_esto, onUpdatePalkkatuki]);

    // =========================================================================
    // 4. ÄLYKÄS ANALYYSI
    // =========================================================================
    
    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];
        const fullStateStr = JSON.stringify(state || {}).toLowerCase();
        
        const onkoAlentuma = fullStateStr.includes('alentuma') || fullStateStr.includes('haaste') || fullStateStr.includes('työkyky_alentunut') || fullStateStr.includes('tyokyky_alentunut') || fullStateStr.includes('sairausloma');

        if (ika && ika >= 55) detected.push(`Ikä 55+ vuotta (${ika} v)`);
        else if (ika && ika < 25) detected.push(`Alle 25-vuotias (${ika} v)`);
        if (ehto24_28_tayttyy) detected.push('24/28 kk ehto (730 pv) täyttyy');
        else if (ehto3kk_tayttyy) detected.push('3 kk työttömyysehto täyttyy (Helsinki-lisä)');
        if (onkoAlentuma) detected.push('Työkyvyn alentuma havaittu');

        const onkoYhdistys = ptState.tyonantaja_yhdistys;

        if (onkoAlentuma) {
            suggestions.push({
                label: 'Puolla 70 % tukea (Työkyvyn alentuma)', info: 'Vamman tai sairauden perusteella.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '70_tyokyky'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        if (ehto3kk_tayttyy && ptState.kotikunta_helsinki) {
            suggestions.push({
                label: 'Puolla Helsinki-lisää (50 %)', info: 'Helsinkiläinen, väh. 3 kk työttömyys.', icon: <MapPin size={18} />,
                action: () => { handleSupportToggle('helsinkilisa_puolletaan', 'helsinkilisa_puollettu', true); }
            });
        }
        if (ehto24_28_tayttyy && onkoYhdistys) {
            suggestions.push({
                label: 'Puolla 100 % tukea (Yhdistys / 24 kk)', info: '24/28 kk ehto täyttyy.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '100_yhdistys'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        if (ika >= 55 && ehto24_28_tayttyy) {
            suggestions.push({
                label: 'Puolla 55-vuotiaiden työllistämistukea', info: '70% tuki ikäperusteella.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '55_tuki'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        return { detected, suggestions };
    }, [ika, ehto24_28_tayttyy, ehto3kk_tayttyy, state, ptState.tyonantaja_yhdistys, ptState.kotikunta_helsinki]);

    // =========================================================================
    // 5. TEKSTINGENEROINTI
    // =========================================================================
    
    const lisahuomiotStr = JSON.stringify(ptState.lisahuomiot || {});

    useEffect(() => {
        let uusiKappale = '';
        let lauseet = [];

        if (ptState.kirjaa_tyokokeilu_esto && estoFraasi && tkCalc.isMaxedOut) {
            const karenssiTxt = isUnder25 ? "3 kuukautta" : "12 kuukautta";
            lauseet.push(estoFraasi.replace('[KARENSSI_KK]', karenssiTxt));
        }

        if (ptState.palkkatuki_puolletaan || ptState.helsinkilisa_puolletaan || ptState.tyokokeilu_puolletaan) {
            if (ptState.helsinkilisa_puolletaan && ptState.palkkatuki_puolletaan) {
                let ptPeruste = "ammatillisen osaamisen puutteiden perusteella (50 %)";
                if (ptState.puoltoTyyppi === '100_yhdistys') ptPeruste = "yhdistykselle 24 kk työttömyyden perusteella (100 %)";
                if (ptState.puoltoTyyppi === '70_tyokyky') ptPeruste = "työkyvyn alentuman perusteella (70 %)";
                if (ptState.puoltoTyyppi === '55_tuki') ptPeruste = "55-vuotiaiden työllistämistukena";
                lauseet.push(`Asiakkaalle voidaan puoltaa valtion palkkatukea ${ptPeruste} tai vaihtoehtoisesti Helsinki-lisää (50 % palkkauskustannuksista, enintään 1500 €/kk).`);
                lauseet.push(`Huomioitavaa on, että tuet ovat toisensa poissulkevia, ja työnantaja voi saada vain toista näistä tuista kerrallaan. Helsinki-lisän myöntäminen edellyttää valtion palkkatuesta luopumista kyseisessä työsuhteessa.`);
            } else if (ptState.helsinkilisa_puolletaan) {
                const kesto = ptState.onko_oppisopimus ? "koko oppisopimuksen ajalle" : "enintään 12 kuukauden ajalle";
                lauseet.push(`Asiakkaalle voidaan myöntää Helsinki-lisä (50 % palkkauskustannuksista, enintään 1500 €/kk). Tukea myönnetään ${kesto}.`);
            } else if (ptState.palkkatuki_puolletaan) {
                let peruste = "ammatillisen osaamisen puutteiden perusteella (50 %)";
                if (ptState.puoltoTyyppi === '100_yhdistys') peruste = "yhdistykselle 24 kk työttömyyden perusteella (100 %)";
                if (ptState.puoltoTyyppi === '70_tyokyky') peruste = "työkyvyn alentuman perusteella (70 %)";
                if (ptState.puoltoTyyppi === '55_tuki') peruste = "55-vuotiaiden työllistämistukena";
                lauseet.push(`Asiakkaalle voidaan puoltaa palkkatukea ${peruste}.`);
            }
            if (ptState.tyokokeilu_puolletaan && !tkCalc.isMaxedOut) {
                const liite = lauseet.length > 0 ? "Lisäksi puolletaan " : "Asiakkaalle puolletaan ";
                const kestoTieto = tkCalc.remainingMonths > 0 ? ` enintään ${tkCalc.remainingMonths} kuukaudeksi` : '';
                lauseet.push(`${liite}työkokeilua${kestoTieto}.`);
            }
        }

        const currentHuomiot = ptState.lisahuomiot || {};
        const valitutHuomiot = Object.values(PALKKATUKI_LISAHUOMIOT).filter(h => currentHuomiot[h.id] === true).map(h => h.teksti);
        if (valitutHuomiot.length > 0) {
            const prefix = lauseet.length > 0 ? '\n\n' : '';
            lauseet.push(`${prefix}${valitutHuomiot.join(' ')}`);
        }

        uusiKappale = lauseet.join(' ').trim();
        if (ptState.puoltoKappale !== uusiKappale) {
            onUpdatePalkkatuki('puoltoKappale', uusiKappale);
        }
    }, [ptState.palkkatuki_puolletaan, ptState.helsinkilisa_puolletaan, ptState.tyokokeilu_puolletaan, ptState.puoltoTyyppi, ptState.onko_oppisopimus, ptState.kirjaa_tyokokeilu_esto, estoFraasi, isUnder25, tkCalc.isMaxedOut, tkCalc.remainingMonths, ptState.puoltoKappale, lisahuomiotStr, onUpdatePalkkatuki]);

    const handleLisahuomioToggle = (id) => {
        const current = ptState.lisahuomiot || {};
        onUpdatePalkkatuki('lisahuomiot', { ...current, [id]: !current[id] });
    };

    return (
        <>
            <section className="section-container">
                <div className="section-header">
                    <h2 className="section-title thv-section-title">
                        <Coins size={22} color="var(--color-primary)" /> Palkkatuki ja muut tuet
                    </h2>
                    <button onClick={() => setShowModal(true)} className="btn btn--secondary">Näytä ohjeet</button>
                </div>

                {/* 1. PALKKATUKI LASKURI */}
                <div className="info-box" style={{ marginBottom: '1.5rem', backgroundColor: '#f8f9fa', borderLeftColor: '#6c757d', padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                        <Calculator size={20} /> Palkkatuen 24 / 28 kk Säännön Laskuri
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.2rem' }}>Laskettu ikä</span>
                            <strong style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>{ika !== null ? `${ika} vuotta` : 'Ei tiedossa'}</strong>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.2rem' }}>
                                Työnhaku alkanut ({alkuperainenAlkuPvm || '-'})
                            </span>
                            <strong style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>{perusKestoTxt}</strong>
                        </div>
                    </div>

                    <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    <RotateCcw size={16} color="var(--color-primary)" /> Estävä katko (Yli 4 kk)
                                </label>
                                <input type="text" placeholder="pp.kk.vvvv" className="form-input" value={ptState.nollausPvm || ''} onChange={(e) => onUpdatePalkkatuki('nollausPvm', e.target.value)} />
                            </div>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    <MinusCircle size={16} color="var(--color-warning)" /> Sallitut katkot (viim. 28 kk)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input type="number" placeholder="0" className="form-input" value={ptState.vahennysPv || ''} onChange={(e) => onUpdatePalkkatuki('vahennysPv', e.target.value)} style={{ width: '100px' }} />
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>päivää</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Hyväksytty aika tarkastelujaksolla:</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>Hyväksytty aika: {hyvaksytytPaivat} pv</strong>
                            </div>
                            <div>
                                {ehto24_28_tayttyy ? <span className="tag tag--success">24 kk ehto täyttyy</span> : (ehto3kk_tayttyy ? <span className="tag tag--warning">3 kk ehto täyttyy</span> : null)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. TYÖKOKEILUN 6 KK LASKURI */}
                <div className="info-box" style={{ marginBottom: '1.5rem', backgroundColor: '#e9ecef', borderLeftColor: '#495057', padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                        <Briefcase size={20} /> Työkokeilun 6 kk Säännön Laskuri (Laki 55 §)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)', flexGrow: 1 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                    <Copy size={16} color="var(--color-primary)" /> Liitä aiemmat työkokeilut
                                </label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                                    Järjestelmä etsii tekstistä historiajaksojen päivämääräparit.
                                </p>
                                <textarea 
                                    className="form-input" 
                                    rows="4" 
                                    placeholder="Liitä aiempi historia tähän..."
                                    value={tkText}
                                    onChange={(e) => onUpdatePalkkatuki('tyokokeilu_historia', e.target.value)}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                            </div>

                            {/* UUSI: Älykäs täppä työtilanteesta tulleelle työkokeilulle */}
                            {ptState.suunniteltu_tk_alku && ptState.suunniteltu_tk_loppu && (
                                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-primary)', borderRadius: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-primary)', cursor: 'pointer', margin: 0 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={ptState.huomioi_suunniteltu_tk !== false} 
                                            onChange={(e) => onUpdatePalkkatuki('huomioi_suunniteltu_tk', e.target.checked)} 
                                            style={{ cursor: 'pointer', marginTop: '2px' }}
                                        />
                                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong>Huomioi laskurissa uusi suunniteltu kokeilu:</strong>
                                            <span style={{ color: 'var(--color-primary)' }}>
                                                {parseAnyDate(ptState.suunniteltu_tk_alku)?.toLocaleDateString('fi-FI')} - {parseAnyDate(ptState.suunniteltu_tk_loppu)?.toLocaleDateString('fi-FI')}
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Nollaussääntö ({isUnder25 ? 'Alle 25v' : 'Yli 25v'})</span>
                                    <strong style={{ fontSize: '1.1rem', color: tkCalc.isReset ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                                        {tkCalc.isReset ? 'Nollautunut!' : `Vaatii ${isUnder25 ? '3 kk' : '12 kk'} tauon`}
                                    </strong>
                                </div>
                                <div style={{ flex: 1, backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Jäljellä (pyöristettynä)</span>
                                    <strong style={{ fontSize: '1.5rem', color: tkCalc.isMaxedOut ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                                        {tkCalc.remainingMonths} kk
                                    </strong>
                                </div>
                            </div>
                            
                            {tkCalc.isMaxedOut && (
                                <div className="tag tag--warning" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <span style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                                            <strong>Työkokeilun enimmäiskesto (6 kk) on täyttynyt.</strong><br/>
                                            Uuden työkokeilun myöntäminen edellyttää, että asiakas on ollut vähintään {isUnder25 ? '3 kuukautta' : '12 kuukautta'} yhdenjaksoisesti työttömänä.
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => onUpdatePalkkatuki('kirjaa_tyokokeilu_esto', !ptState.kirjaa_tyokokeilu_esto)}
                                        className="btn btn--secondary"
                                        style={{ 
                                            alignSelf: 'stretch', 
                                            fontSize: '0.85rem', 
                                            padding: '0.4rem', 
                                            display: 'flex', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            gap: '0.5rem',
                                            borderColor: ptState.kirjaa_tyokokeilu_esto ? 'var(--color-danger)' : 'var(--color-border)',
                                            color: ptState.kirjaa_tyokokeilu_esto ? 'var(--color-danger)' : 'var(--color-text-primary)'
                                        }}
                                    >
                                        <FileText size={16} /> 
                                        {ptState.kirjaa_tyokokeilu_esto ? 'Poista lainsäädäntöteksti asiakirjasta' : 'Kirjaa perustelu tulosteeseen'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. RATKAISUKESKUS */}
                <div className="thv-resolution-hub">
                    <div className="thv-resolution-header">
                        <BrainCircuit size={22} /> Järjestelmän analyysi
                    </div>
                    
                    <div className="thv-resolution-grid">
                        <div className="thv-resolution-column">
                            <h4 className="thv-column-title">Havaitut kriteerit:</h4>
                            <ul className="thv-resolution-signals">
                                {analysis.detected.map((cond, i) => <li key={i}>{cond}</li>)}
                                {analysis.detected.length === 0 && <li style={{ color: 'var(--color-text-secondary)', listStyle: 'none' }}>Ei erityisiä ehtoja havaittu.</li>}
                            </ul>
                        </div>
                        <div className="thv-resolution-column">
                            <h4 className="thv-column-title">Järjestelmän ehdotukset:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {analysis.suggestions.map((sugg, i) => (
                                    <div key={i}>
                                        <button type="button" onClick={sugg.action} className="thv-action-button">
                                            {sugg.icon || <Zap size={18} />} {sugg.label}
                                        </button>
                                        <p className="thv-resolution-info" style={{ marginTop: '0.4rem' }}>
                                            {sugg.info}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. ASIANTUNTIJAN VALINNAT */}
                <div className="questions-container" style={{ marginTop: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <Building size={20} /> Tarkentavat tiedot
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <label className="custom-checkbox-row">
                            <input type="checkbox" checked={!!ptState.kotikunta_helsinki} onChange={(e) => onUpdatePalkkatuki('kotikunta_helsinki', e.target.checked)} />
                            Kotikunta: Helsinki (Helsinki-lisän peruste)
                        </label>
                        <label className="custom-checkbox-row">
                            <input type="checkbox" checked={!!ptState.tyonantaja_yhdistys} onChange={(e) => onUpdatePalkkatuki('tyonantaja_yhdistys', e.target.checked)} />
                            Työnantaja on yhdistys/säätiö
                        </label>
                    </div>

                    <h4 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Puollot</h4>
                    {ptState.palkkatuki_puolletaan && ptState.helsinkilisa_puolletaan && (
                        <div className="tag tag--warning" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <AlertCircle size={16} /> <strong>Huom:</strong> Valittu molemmat tuet – tulostetaan vaihtoehtoisina.
                        </div>
                    )}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                checked={!!ptState.palkkatuki_puolletaan} 
                                onChange={(e) => handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', e.target.checked)} 
                            />
                            Puolletaan valtion palkkatukea
                        </label>
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                checked={!!ptState.helsinkilisa_puolletaan} 
                                onChange={(e) => handleSupportToggle('helsinkilisa_puolletaan', 'helsinkilisa_puollettu', e.target.checked)} 
                            />
                            Puolletaan Helsinki-lisää (Väh. 3 kk työttömyys)
                        </label>
                        
                        <label className="custom-checkbox-row" style={{ opacity: tkCalc.isMaxedOut ? 0.5 : 1 }}>
                            <input 
                                type="checkbox" 
                                checked={!!ptState.tyokokeilu_puolletaan} 
                                disabled={tkCalc.isMaxedOut}
                                onChange={(e) => handleSupportToggle('tyokokeilu_puolletaan', 'tyokokeilu_puollettu', e.target.checked)} 
                            />
                            Puolletaan työkokeilua {tkCalc.remainingMonths > 0 && !tkCalc.isMaxedOut ? `(Max ${tkCalc.remainingMonths} kk)` : ''}
                        </label>
                        
                        <label className="custom-checkbox-row" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                            <input type="checkbox" checked={!!ptState.onko_oppisopimus} onChange={(e) => onUpdatePalkkatuki('onko_oppisopimus', e.target.checked)} />
                            Kyseessä on oppisopimus (Vaikuttaa Helsinki-lisän kestoon)
                        </label>
                    </div>

                    <h4 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginTop: '1.5rem' }}>Lisäehdot ja huomiot</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                        {Object.values(PALKKATUKI_LISAHUOMIOT).map(huomio => (
                            <label key={huomio.id} className="custom-checkbox-row">
                                <input type="checkbox" checked={!!ptState.lisahuomiot?.[huomio.id]} onChange={() => handleLisahuomioToggle(huomio.id)} />
                                {huomio.label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* 5. ESIKATSELU */}
                <div className="thv-locked-text-container" style={{ marginTop: '2.5rem' }}>
                    <div className="thv-locked-text-header">
                        <FileText size={16} /> Esikatselu asiakirjaan
                    </div>
                    <div className="thv-locked-text-body" style={{ backgroundColor: '#fff', padding: '1.5rem', border: '1px solid #dee2e6', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                        {ptState.puoltoKappale || <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>Tee valintoja yläpuolelta nähdäksesi tekstin...</span>}
                    </div>
                    <div className="custom-text-container" style={{ borderTop: 'none', paddingTop: '1rem', marginTop: '1rem' }}>
                        <textarea className="form-input" rows="3" placeholder="Vapaa sana..." value={state['custom-palkkatuki'] || ''} onChange={(e) => onUpdateCustomText('palkkatuki', e.target.value)} />
                    </div>
                </div>
            </section>

            <Modal show={showModal} onClose={() => setShowModal(false)} title="Helsinki-lisän ja palkkatuen ehdot">
                <div className="modal-content-inner">
                    <h5 style={{ color: 'var(--color-primary)', fontSize: '1.1rem' }}>Helsinki-lisä (Uudistunut)</h5>
                    <p>Helsinkiläiselle työttömälle, joka on ollut työtön vähintään 3 kuukautta.</p>
                    <ul style={{ paddingLeft: '1.5rem' }}>
                        <li>50 % palkkauskustannuksista, max. 1500 €/kk.</li>
                        <li>Kesto max 12 kk (oppisopimuksessa koko kesto).</li>
                        <li>Rajoitus: Ei voi yhdistää valtion palkkatukeen samanaikaisesti.</li>
                    </ul>
                    <hr />
                    {OHJEET.KAPPALEET.map((kappale, index) => (
                        <div key={index} style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: 'var(--color-primary)' }}>{kappale.otsikko}</h5>
                            {kappale.teksti && <p>{kappale.teksti}</p>}
                            {kappale.lista && (
                                <ul style={{ paddingLeft: '1.5rem' }}>
                                    {kappale.lista.map((item, i) => (
                                        <li key={i} dangerouslySetInnerHTML={{ __html: item }}></li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </Modal>
        </>
    );
};

export default PalkkatukiCalculator;