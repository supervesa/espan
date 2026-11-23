import React, { useMemo, useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import {
    BookOpen,
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Info,
    FileText,
    ClipboardCheck,
    Wallet
} from 'lucide-react';
import { ENTITY_DEFINITIONS } from '../../data/entityDefinitions';
import OmoSuunnitelma from './omo_suunnitelma';
import Button from '../common/Button';
import Badge from '../common/Badge';

// --- PÄIVÄMÄÄRÄ- JA KALENTERIKUUKAUSIAPURIT ---

const parseFiDate = (str) => {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();

    const fiMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (fiMatch) {
        const d = parseInt(fiMatch[1], 10);
        const m = parseInt(fiMatch[2], 10) - 1;
        const y = parseInt(fiMatch[3], 10);
        const date = new Date(y, m, d, 12, 0, 0);
        if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
            return date;
        }
        return null;
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        const d = parseInt(isoMatch[3], 10);
        return new Date(y, m, d, 12, 0, 0);
    }

    return null;
};

const formatFiDate = (date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
};

const addDays = (date, days) => {
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
};

// Laskee päättymispäivän kokonaisina kalenterikuukausina (esim. 1.8.2026 + 24 kk -> 31.7.2028)
const addCalendarMonthsInclusive = (startDate, months) => {
    if (!startDate || !months || months <= 0) return null;
    const wholeMonths = Math.floor(months);
    const extraDays = Math.round((months - wholeMonths) * 30);

    const targetYear = startDate.getFullYear();
    const targetMonth = startDate.getMonth() + wholeMonths;
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const clampedDay = Math.min(startDate.getDate(), daysInTargetMonth);

    return new Date(targetYear, targetMonth, clampedDay - 1 + extraDays, 12, 0, 0);
};

const calculateCalendarMonths = (startStr, endStr) => {
    const start = parseFiDate(startStr);
    const end = parseFiDate(endStr);
    if (!start || !end || end < start) return 0;

    const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 12, 0, 0);
    const months =
        (endInclusive.getFullYear() - start.getFullYear()) * 12 +
        (endInclusive.getMonth() - start.getMonth()) +
        (endInclusive.getDate() - start.getDate()) / 30;

    return Math.max(0, Number(months.toFixed(1)));
};

const TuettuOpiskelu = ({ state, actions }) => {
    const { onUpdateCustomText, onUpdateVariable, onUpdateAsiakas, onAddSignal, onRemoveSignal } = actions;

    const [isOmoModalOpen, setIsOmoModalOpen] = useState(false);

    // --- LOKITUS: Seurataan taulukon tilaa ---
    useEffect(() => {
        if (state.sessionServices) {
            const studyRows = state.sessionServices.filter((s) => s.category === 'opiskelu');
            if (studyRows.length > 0) {
                console.log('GM DEBUG: Opinnot taulukossa:', studyRows);
            }
        }
    }, [state.sessionServices]);

    // --- ASIAKKAAN PERUSTIEDOT ---
    const asiakasAlle25 = useMemo(() => {
        const sv =
            state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] ||
            state.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!sv) return false;
        return new Date().getFullYear() - parseInt(String(sv).replace(/\D/g, ''), 10) < 25;
    }, [state.suunnitelman_perustiedot]);

    const asiakasAidinkieli =
        state.asiakas?.aidinkieli ||
        state.suunnitelman_perustiedot?.aidinkieli?.muuttujat?.['[ÄIDINKIELI]'] ||
        '';

    // --- 1. DATAN LUKEMINEN TAULUKOSTA (Golden Master) ---
    const activeStudy = useMemo(
        () => (state.sessionServices || []).find((s) => s.category === 'opiskelu') || null,
        [state.sessionServices]
    );

    const studyData = activeStudy?.data || {};

    // Peruskentät
    const aktiivinen = !!activeStudy;
    const tyyppi = activeStudy ? activeStudy.entity_key.replace('opiskelu_', '') : '';
    const opinnonNimi = studyData.nimi || '';
    const alkuPvm = studyData.alku || '';
    const loppuPvm = studyData.loppu || '';
    const perusopetus = studyData.perusopetus === true;

    // 73 § edellytykset (omaehtoinen)
    const edellytysKoulutustarve = studyData.edellytys_koulutustarve !== false;
    const edellytysTyollistyminen = studyData.edellytys_tyollistyminen !== false;
    const edellytysPaatoiminen = studyData.edellytys_paatoiminen !== false;

    // 74 § aiemmin keskeytyneet opinnot
    const aiemminKeskeytyneet = studyData.aiemmin_keskeytyneet === true;
    const keskeytysPvm = studyData.keskeytys_pvm || '';
    const keskeytysPoikkeus = studyData.keskeytys_poikkeus === true;

    // 75 § suunnitelma & painava syy
    const edellytysSuunnitelma = studyData.edellytys_suunnitelma === true;
    const painavaSyy = studyData.painava_syy || '';

    // 76 § aiemmin käytetyt tukikuukaudet
    const aiemminKaytetytKk = Number(studyData.aiemmin_kaytetyt_kk || 0);

    // 77 § seuranta & koulutuspalvelun tuottajan selvitys
    const edellytysSeuranta = studyData.edellytys_seuranta === true;
    const tuottajanSelvitys = studyData.tuottajan_selvitys || 'ei_pyydetty';

    // Suunnitelmageneraattorin tila
    const suunnitelmaTeksti = studyData.suunnitelma_teksti || '';

    // --- 2. TALLENNUSLOGIIKKA (Päivittää taulukkoa) ---
    const handleUpdate = (key, value) => {
        console.log(`GM ACTION: Päivitetään opinto - Kenttä: ${key}, Arvo:`, value);

        const currentServices = Array.isArray(state.sessionServices) ? [...state.sessionServices] : [];
        const studyIndex = currentServices.findIndex((s) => s.category === 'opiskelu');

        let updatedServices = [...currentServices];

        if (key === 'aktiivinen') {
            if (value === true) {
                const newId = window.crypto.randomUUID();
                updatedServices.push({
                    id: newId,
                    entity_key: asiakasAlle25 ? 'opiskelu_sivutoiminen' : 'opiskelu_omaehtoinen',
                    category: 'opiskelu',
                    data: {
                        alku: '',
                        loppu: '',
                        tukiaika_loppu: '',
                        tukiaika_loppu_manuaali: false,
                        nimi: '',
                        perusopetus: false,
                        koulutusaste: 'ammatillinen',
                        edellytys_koulutustarve: true,
                        edellytys_tyollistyminen: true,
                        edellytys_paatoiminen: true,
                        edellytys_suunnitelma: true,
                        edellytys_seuranta: false,
                        aiemmin_kaytetyt_kk: 0,
                        tuottajan_selvitys: 'ei_pyydetty'
                    },
                    meta: { source: 'manual', created_at: new Date().toISOString() }
                });
                console.log('GM EVENT: Uusi opintorivi luotu ID:llä', newId);
            } else {
                updatedServices = updatedServices.filter((s) => s.category !== 'opiskelu');
                console.log('GM EVENT: Opintorivi poistettu taulukosta');
            }
        } else if (activeStudy) {
            const updatedStudy = { ...activeStudy };
            if (key === 'tyyppi') {
                updatedStudy.entity_key = `opiskelu_${value}`;
            } else {
                const nextData = { ...updatedStudy.data, [key]: value };
                if (key === 'perusopetus') {
                    nextData.koulutusaste = value
                        ? 'perusopetus'
                        : nextData.koulutusaste === 'perusopetus'
                        ? 'ammatillinen'
                        : nextData.koulutusaste || 'ammatillinen';
                }
                // Jos perusopetus, alkupvm tai käytetyt kk muuttuvat, nollataan manuaalinen tukiaikaraja ellei käyttäjä erikseen muokkaa modaalissa
                if (['alku', 'loppu', 'perusopetus', 'aiemmin_kaytetyt_kk'].includes(key)) {
                    nextData.tukiaika_loppu_manuaali = false;
                }
                updatedStudy.data = nextData;
            }

            if (studyIndex > -1) {
                updatedServices[studyIndex] = updatedStudy;
            }
        }

        onUpdateVariable('global', 'sessionServices', updatedServices);
    };

    const handleSaveOmoPlan = (planText, updatedFields) => {
        const currentServices = Array.isArray(state.sessionServices) ? [...state.sessionServices] : [];
        const studyIndex = currentServices.findIndex((s) => s.category === 'opiskelu');

        if (studyIndex > -1) {
            const updatedServices = [...currentServices];
            updatedServices[studyIndex] = {
                ...updatedServices[studyIndex],
                data: {
                    ...updatedServices[studyIndex].data,
                    ...updatedFields,
                    suunnitelma_teksti: planText
                }
            };
            onUpdateVariable('global', 'sessionServices', updatedServices);
        }

        if (typeof onUpdateCustomText === 'function') {
            onUpdateCustomText('tuettu_opiskelu_omaehtoinen', planText);
        }
    };

    // --- LOGIIKKA JA SIGNAALIT ---

    useEffect(() => {
        const registerMySignals = async () => {
            const mySignals = [
                {
                    signal_key: 'tuettu_opiskelu_omaehtoinen',
                    label: 'Tuettu opiskelu: Omaehtoinen',
                    category: 'Koulutus ja osaaminen',
                    description: 'Asiakas osallistuu työttömyysetuudella tuettuun omaehtoiseen opiskeluun.'
                },
                {
                    signal_key: 'tuettu_opiskelu_kotoutuja',
                    label: 'Tuettu opiskelu: Kotoutuja',
                    category: 'Koulutus ja osaaminen',
                    description: 'Kotoutuja-asiakkaan omaehtoinen opiskelu.'
                },
                {
                    signal_key: 'tuettu_opiskelu_lyhytkestoinen',
                    label: 'Tuettu opiskelu: Lyhytkestoinen',
                    category: 'Koulutus ja osaaminen',
                    description: 'Lyhytkestoiset opinnot (max 6kk).'
                },
                {
                    signal_key: 'tuettu_opiskelu_sivutoiminen',
                    label: 'Tuettu opiskelu: Sivutoiminen',
                    category: 'Koulutus ja osaaminen',
                    description: 'Sivutoiminen opiskelu. Ei estä kokoaikatyön vastaanottamista.'
                }
            ];
            try {
                await supabase.from('system_signals').upsert(mySignals, { onConflict: 'signal_key' });
            } catch (e) {}
        };
        registerMySignals();
    }, []);

    useEffect(() => {
        const allTypes = ['omaehtoinen', 'lyhytkestoinen', 'kotoutuja', 'sivutoiminen'];
        allTypes.forEach((t) => {
            if (typeof onRemoveSignal === 'function') onRemoveSignal(`tuettu_opiskelu_${t}`);
        });

        if (aktiivinen && tyyppi) {
            if (typeof onAddSignal === 'function') onAddSignal(`tuettu_opiskelu_${tyyppi}`);
            if (typeof onUpdateAsiakas === 'function') onUpdateAsiakas('paa_asiallinen_toiminta', 'Opiskelija');
        }
    }, [aktiivinen, tyyppi, onAddSignal, onRemoveSignal, onUpdateAsiakas]);

    // --- OPINTOJEN KESTON JA TUKIAJAN ERITTELY ---

    const maxKkPerus = perusopetus ? 48 : 24;
    const jaljellaMaxKk = Math.max(0, maxKkPerus - aiemminKaytetytKk);

    const opintojenKestoKk = useMemo(() => calculateCalendarMonths(alkuPvm, loppuPvm), [alkuPvm, loppuPvm]);

    const tukiaikaLaskelma = useMemo(() => {
        const startDate = parseFiDate(alkuPvm);
        const endDate = parseFiDate(loppuPvm);

        if (!startDate || !endDate || endDate < startDate) {
            return {
                tukiaikaLoppu: '',
                tukiaikaKestoKk: 0,
                opinnotJatkuvatTukiajanJalkeen: false,
                muunRahoituksenAlku: '',
                muunRahoituksenKestoKk: 0,
                enimmaisaikaKatkaisee: false
            };
        }

        if (tyyppi !== 'omaehtoinen') {
            return {
                tukiaikaLoppu: loppuPvm,
                tukiaikaKestoKk: opintojenKestoKk,
                opinnotJatkuvatTukiajanJalkeen: false,
                muunRahoituksenAlku: '',
                muunRahoituksenKestoKk: 0,
                enimmaisaikaKatkaisee: false
            };
        }

        const maxEndDate = jaljellaMaxKk > 0 ? addCalendarMonthsInclusive(startDate, jaljellaMaxKk) : null;
        const enimmaisaikaKatkaisee = Boolean(maxEndDate && endDate > maxEndDate);
        const autoTukiaikaLoppu = enimmaisaikaKatkaisee ? formatFiDate(maxEndDate) : loppuPvm;

        const effectiveTukiaikaLoppu =
            studyData.tukiaika_loppu_manuaali && studyData.tukiaika_loppu
                ? studyData.tukiaika_loppu
                : autoTukiaikaLoppu;

        const effectiveEndDate = parseFiDate(effectiveTukiaikaLoppu);
        const tukiaikaKestoKk = calculateCalendarMonths(alkuPvm, effectiveTukiaikaLoppu);
        const opinnotJatkuvatTukiajanJalkeen = Boolean(effectiveEndDate && endDate > effectiveEndDate);
        const muunRahoituksenAlku = opinnotJatkuvatTukiajanJalkeen
            ? formatFiDate(addDays(effectiveEndDate, 1))
            : '';
        const muunRahoituksenKestoKk = opinnotJatkuvatTukiajanJalkeen
            ? calculateCalendarMonths(muunRahoituksenAlku, loppuPvm)
            : 0;

        return {
            tukiaikaLoppu: effectiveTukiaikaLoppu,
            tukiaikaKestoKk,
            opinnotJatkuvatTukiajanJalkeen,
            muunRahoituksenAlku,
            muunRahoituksenKestoKk,
            enimmaisaikaKatkaisee
        };
    }, [
        alkuPvm,
        loppuPvm,
        tyyppi,
        opintojenKestoKk,
        jaljellaMaxKk,
        studyData.tukiaika_loppu_manuaali,
        studyData.tukiaika_loppu
    ]);

    // 75 § tarkistus: onko aloituspäivä jo menneisyydessä
    const aloitusMenneisyydessa = useMemo(() => {
        const start = parseFiDate(alkuPvm);
        if (!start) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return start < today;
    }, [alkuPvm]);

    // 74 § tarkistus: onko keskeytymisestä alle 1 vuosi
    const keskeytysAlleVuosi = useMemo(() => {
        if (!aiemminKeskeytyneet || keskeytysPoikkeus) return false;
        const keskeytys = parseFiDate(keskeytysPvm);
        if (!keskeytys) return false;
        const vertailuPvm = parseFiDate(alkuPvm) || new Date();
        const vuosiKeskeytyksesta = new Date(
            keskeytys.getFullYear() + 1,
            keskeytys.getMonth(),
            keskeytys.getDate(),
            12,
            0,
            0
        );
        return vertailuPvm < vuosiKeskeytyksesta;
    }, [aiemminKeskeytyneet, keskeytysPoikkeus, keskeytysPvm, alkuPvm]);

    // Estävät varoitukset (ylipitkät omaehtoiset opinnot eivät ole este, vaan katkaistaan tukiajasta)
    const warnings = [];
    if (alkuPvm && loppuPvm && opintojenKestoKk === 0) {
        warnings.push('Tarkista päivämäärät (muoto pp.kk.vvvv, päättymispäivän tulee olla aloituspäivän jälkeen).');
    }
    if (tyyppi === 'lyhytkestoinen' && opintojenKestoKk > 6) {
        warnings.push('Lyhytkestoinen opiskelu saa kestää enintään 6 kuukautta!');
    }
    if (tyyppi === 'omaehtoinen') {
        if (jaljellaMaxKk <= 0) {
            warnings.push(`Omaehtoisen opiskelun enimmäistukiaika (${maxKkPerus} kk) on jo kokonaan käytetty (76 §).`);
        } else if (tukiaikaLaskelma.tukiaikaKestoKk > jaljellaMaxKk) {
            warnings.push(
                `Asetettu tukiaika (${tukiaikaLaskelma.tukiaikaKestoKk} kk) ylittää jäljellä olevan enimmäistukiajan (${jaljellaMaxKk} kk).`
            );
        }
        if (!edellytysKoulutustarve || !edellytysTyollistyminen) {
            warnings.push(
                '73 § estävä edellytys: Koulutustarve ja työllistymismahdollisuuksien olennainen paraneminen on todettava.'
            );
        }
        if (!edellytysPaatoiminen) {
            warnings.push('73 §: Jos opinnot eivät ole päätoimisia, valitse opiskelumuodoksi Sivutoiminen opiskelu.');
        }
        if (keskeytysAlleVuosi) {
            warnings.push('74 § este: Aiempien opintojen keskeytymisestä on alle 1 vuosi (ilman poikkeusperustetta).');
        }
        if (aloitusMenneisyydessa && !painavaSyy.trim()) {
            warnings.push('75 §: Opinnot ovat alkaneet ennen suunnitelmassa sopimista — kirjaa painava syy.');
        }
    }

    const tyyppiMeta = {
        omaehtoinen: { title: 'Omaehtoinen', desc: 'Vaatii 25 v iän (73–78 §).' },
        lyhytkestoinen: { title: 'Lyhytkestoinen', desc: 'Vaatii 25 v iän, max 6 kk.' },
        kotoutuja: { title: 'Kotoutuja', desc: 'Kotoutumislaki, ei 25 v ikärajaa.' },
        sivutoiminen: { title: 'Sivutoiminen', desc: 'Ei ikärajaa, ei estä kokoaikatyötä.' }
    };

    return (
        <div className="panel-gray mb-6 tuettu-opiskelu-panel">
            <h3 className="icon-heading">
                <BookOpen size={20} color="var(--color-primary)" />
                Työttömyysetuudella tuettu opiskelu
            </h3>

            <div className="card-inner-sm mb-6">
                <label className="custom-checkbox-row">
                    <input
                        type="checkbox"
                        checked={aktiivinen}
                        onChange={(e) => handleUpdate('aktiivinen', e.target.checked)}
                    />
                    <span className="font-semibold">
                        Asiakkaan kanssa suunnitellaan opintojen tukemista työttömyysetuudella
                    </span>
                </label>
            </div>

            {aktiivinen && (
                <div className="tuettu-content-wrapper">
                    {asiakasAlle25 && (
                        <div className="alert-box alert-box--danger mb-6">
                            <div className="alert-box-content">
                                <AlertTriangle size={18} className="alert-box-icon" />
                                <div className="alert-box-text">
                                    <strong>Lain estävä edellytys (73 §):</strong> Asiakas on alle 25-vuotias. Omaehtoista tai lyhytkestoista opiskelua ei voida tukea (kotoutujan ja sivutoimiset opinnot ovat mahdollisia).
                                </div>
                            </div>
                        </div>
                    )}

                    <h4 className="icon-label">1. Valitse opiskelun muoto</h4>
                    <div className="service-card-grid mb-6">
                        {['omaehtoinen', 'lyhytkestoinen', 'kotoutuja', 'sivutoiminen'].map((t) => {
                            const disabled = (t === 'omaehtoinen' || t === 'lyhytkestoinen') && asiakasAlle25;
                            return (
                                <div
                                    key={t}
                                    className={`service-card ${tyyppi === t ? 'service-card--selected' : ''} ${
                                        disabled ? 'service-card--disabled' : ''
                                    }`}
                                    onClick={() => !disabled && handleUpdate('tyyppi', t)}
                                >
                                    <h5 className="service-card-title">{tyyppiMeta[t].title}</h5>
                                    <p className="service-card-desc">{tyyppiMeta[t].desc}</p>
                                </div>
                            );
                        })}
                    </div>

                    {tyyppi && (
                        <>
                            <h4 className="icon-label">2. Koulutuksen tiedot ja opintojen kesto</h4>
                            <div className="card-inner mb-6">
                                <div className="flex-col-gap">
                                    <div>
                                        <label className="stat-label">Oppilaitos ja tutkinnon nimi</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Esim. Metropolia AMK, Tradenomi (AMK)"
                                            value={opinnonNimi}
                                            onChange={(e) => handleUpdate('nimi', e.target.value)}
                                        />
                                    </div>

                                    <div className="grid-cols-2-tight">
                                        <div>
                                            <label className="stat-label">Opinnot alkavat (pp.kk.vvvv)</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="1.8.2026"
                                                value={alkuPvm}
                                                onChange={(e) => handleUpdate('alku', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="stat-label">
                                                {tyyppi === 'omaehtoinen'
                                                    ? 'Opintojen suunniteltu päättymispäivä (pp.kk.vvvv)'
                                                    : 'Opinnot päättyvät (pp.kk.vvvv)'}
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="30.7.2030"
                                                value={loppuPvm}
                                                onChange={(e) => handleUpdate('loppu', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {tyyppi === 'omaehtoinen' && (
                                        <div
                                            className="grid-cols-2-tight"
                                            style={{ alignItems: 'center', marginTop: '0.25rem' }}
                                        >
                                            <label className="custom-checkbox-row">
                                                <input
                                                    type="checkbox"
                                                    checked={perusopetus}
                                                    onChange={(e) => handleUpdate('perusopetus', e.target.checked)}
                                                />
                                                <span>Perusopetuksen suorittaminen (enimmäistukiaika 48 kk)</span>
                                            </label>

                                            <div>
                                                <label className="stat-label">
                                                    Samaan opintokokonaisuuteen aiemmin käytetty tuki (kk, 76 §)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={maxKkPerus}
                                                    className="form-input"
                                                    value={aiemminKaytetytKk}
                                                    onChange={(e) =>
                                                        handleUpdate('aiemmin_kaytetyt_kk', Number(e.target.value) || 0)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {alkuPvm && loppuPvm && (
                                <div className="smart-analysis-box mb-6">
                                    <div className="smart-analysis-header">
                                        <CalendarClock size={20} /> Opintojen kesto ja tukiajan laskenta
                                    </div>
                                    <div className="smart-analysis-grid">
                                        <div className="smart-analysis-column">
                                            <p className="smart-analysis-title">
                                                {tyyppi === 'omaehtoinen' ? 'TUETTU AIKA / OPINNOT' : 'KESTO'}
                                            </p>
                                            {tyyppi === 'omaehtoinen' ? (
                                                <>
                                                    <strong className="stat-value-xl">
                                                        {tukiaikaLaskelma.tukiaikaKestoKk} kk
                                                    </strong>
                                                    <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                                        Tukiaika: {alkuPvm}–{tukiaikaLaskelma.tukiaikaLoppu || '-'} (max {jaljellaMaxKk} kk)
                                                    </span>
                                                    {tukiaikaLaskelma.opinnotJatkuvatTukiajanJalkeen && (
                                                        <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                                            Opintojen kokonaiskesto: {opintojenKestoKk} kk ({alkuPvm}–{loppuPvm})
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <strong className="stat-value-xl">{opintojenKestoKk} kk</strong>
                                            )}
                                        </div>

                                        <div className="smart-analysis-column" style={{ gap: '0.45rem' }}>
                                            {warnings.length > 0 ? (
                                                warnings.map((w, idx) => (
                                                    <span key={idx} className="status-text--danger">
                                                        <AlertTriangle size={16} /> {w}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="status-text--success">
                                                    <CheckCircle2 size={16} /> Lain puitteissa.
                                                </span>
                                            )}

                                            {tyyppi === 'omaehtoinen' && tukiaikaLaskelma.opinnotJatkuvatTukiajanJalkeen && (
                                                <div
                                                    style={{
                                                        marginTop: '0.35rem',
                                                        padding: '0.6rem 0.75rem',
                                                        borderRadius: '6px',
                                                        background: 'var(--color-bg-subtle, #f1f5f9)',
                                                        fontSize: '0.88rem',
                                                        display: 'flex',
                                                        gap: '0.5rem',
                                                        alignItems: 'flex-start'
                                                    }}
                                                >
                                                    <Wallet size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <div>
                                                        <strong>Enimmäistukiaika ({jaljellaMaxKk} kk) täyttyy {tukiaikaLaskelma.tukiaikaLoppu}:</strong>{' '}
                                                        Tuki lakkaa tähän päivään, eikä oikeutta työttömyysturvaan ole ennen opintojen päättymistä. Asiakkaan tulee hankkia muu rahoitus ajalle{' '}
                                                        <strong>
                                                            {tukiaikaLaskelma.muunRahoituksenAlku}–{loppuPvm}
                                                        </strong>{' '}
                                                        ({tukiaikaLaskelma.muunRahoituksenKestoKk} kk).
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. EDELLYTYKSET */}
                            <h4 className="icon-label">
                                3. Edellytykset {tyyppi === 'omaehtoinen' ? '(73 §–77 §)' : '(75 §, 77 §)'}
                            </h4>
                            <div className="card-inner flex-col-gap mb-6">
                                {tyyppi === 'omaehtoinen' && (
                                    <>
                                        <label className="custom-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={edellytysKoulutustarve}
                                                onChange={(e) =>
                                                    handleUpdate('edellytys_koulutustarve', e.target.checked)
                                                }
                                            />
                                            <span>Asiakkaalla on todettu koulutustarve (73 §).</span>
                                        </label>

                                        <label className="custom-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={edellytysTyollistyminen}
                                                onChange={(e) =>
                                                    handleUpdate('edellytys_tyollistyminen', e.target.checked)
                                                }
                                            />
                                            <span>Opinnot parantavat olennaisesti työllistymismahdollisuuksia (73 §).</span>
                                        </label>

                                        <label className="custom-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={edellytysPaatoiminen}
                                                onChange={(e) =>
                                                    handleUpdate('edellytys_paatoiminen', e.target.checked)
                                                }
                                            />
                                            <span>Opinnot ovat päätoimisia (73 §).</span>
                                        </label>

                                        {!edellytysPaatoiminen && (
                                            <div className="alert-box alert-box--warning">
                                                <div className="alert-box-content">
                                                    <Info size={16} className="alert-box-icon" />
                                                    <div className="alert-box-text">
                                                        Sivutoimisia opintoja ei tueta omaehtoisen opiskelun säännöksillä.{' '}
                                                        <button
                                                            type="button"
                                                            style={{
                                                                textDecoration: 'underline',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontWeight: 600,
                                                                padding: 0
                                                            }}
                                                            onClick={() => handleUpdate('tyyppi', 'sivutoiminen')}
                                                        >
                                                            Vaihda sivutoimiseksi opiskeluksi
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 74 § Keskeytyneet opinnot */}
                                        <label className="custom-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={aiemminKeskeytyneet}
                                                onChange={(e) =>
                                                    handleUpdate('aiemmin_keskeytyneet', e.target.checked)
                                                }
                                            />
                                            <span>Kyseessä on aiemmin keskeytyneiden opintojen jatkaminen (74 §).</span>
                                        </label>

                                        {aiemminKeskeytyneet && (
                                            <div
                                                style={{
                                                    padding: '0.75rem',
                                                    borderRadius: '8px',
                                                    background: 'var(--color-bg-subtle, #f8fafc)',
                                                    border: '1px solid var(--color-border, #e2e8f0)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.6rem'
                                                }}
                                            >
                                                <div style={{ maxWidth: '260px' }}>
                                                    <label className="stat-label">
                                                        Edellisen keskeytymisen päivämäärä (pp.kk.vvvv)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="15.5.2025"
                                                        value={keskeytysPvm}
                                                        onChange={(e) => handleUpdate('keskeytys_pvm', e.target.value)}
                                                    />
                                                </div>
                                                <label className="custom-checkbox-row">
                                                    <input
                                                        type="checkbox"
                                                        checked={keskeytysPoikkeus}
                                                        onChange={(e) =>
                                                            handleUpdate('keskeytys_poikkeus', e.target.checked)
                                                        }
                                                    />
                                                    <span>
                                                        Poikkeusperuste täyttyy (opinnot aloitettu työsuhteen tai työvoimakoulutuksen aikana)
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* 75 § Suunnitelma */}
                                <label className="custom-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={edellytysSuunnitelma}
                                        onChange={(e) => handleUpdate('edellytys_suunnitelma', e.target.checked)}
                                    />
                                    <span>Sovittu suunnitelmassa ennen aloitusta (75 §).</span>
                                </label>

                                {tyyppi === 'omaehtoinen' && (aloitusMenneisyydessa || !edellytysSuunnitelma) && (
                                    <div>
                                        <label className="stat-label">
                                            Painava syy sopia suunnitelmassa opintojen alkamisen jälkeen (75 §)
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Kirjaa painava syy (esim. viranomaisesta johtuva viive, nopea opiskelupaikan varmistuminen)"
                                            value={painavaSyy}
                                            onChange={(e) => handleUpdate('painava_syy', e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* 77 § Seuranta & selvitys */}
                                <label className="custom-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={edellytysSeuranta}
                                        onChange={(e) => handleUpdate('edellytys_seuranta', e.target.checked)}
                                    />
                                    <span>Seurannasta ja etenemisestä on sovittu (77 §).</span>
                                </label>

                                {tyyppi === 'omaehtoinen' && (
                                    <div style={{ maxWidth: '380px' }}>
                                        <label className="stat-label">
                                            Koulutuspalvelun tuottajan selvitys (77 §)
                                        </label>
                                        <select
                                            className="form-input"
                                            value={tuottajanSelvitys}
                                            onChange={(e) => handleUpdate('tuottajan_selvitys', e.target.value)}
                                        >
                                            <option value="ei_pyydetty">Ei vielä pyydetty</option>
                                            <option value="pyydetty">Pyydetty oppilaitokselta</option>
                                            <option value="saatu">Saatu ja tarkistettu</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* 4. OMAEHTOSEN SUUNNITELMAGENERAATTORI (MODAALI) */}
                            {tyyppi === 'omaehtoinen' && (
                                <>
                                    <h4 className="icon-label">4. Työllistymissuunnitelman laatiminen</h4>
                                    <div
                                        className="card-inner"
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <ClipboardCheck size={18} color="var(--color-primary)" />
                                                <strong>Omaehtoisen opiskelun suunnitelmageneraattori</strong>
                                                {suunnitelmaTeksti ? (
                                                    <Badge variant="success">Luotu</Badge>
                                                ) : (
                                                    <Badge variant="default">Luonnostelematta</Badge>
                                                )}
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                                                {suunnitelmaTeksti
                                                    ? 'Suunnitelmateksti on tallennettu tukiajan päivämäärineen ja seurantapäivineen. Voit avata sen muokattavaksi.'
                                                    : 'Luo määrämuotoinen suunnitelma automaattisella 24/48 kk tukiajan laskennalla, rahoituskirjauksella ja seurantatehtävillä.'}
                                            </p>
                                        </div>

                                        <Button variant="primary" onClick={() => setIsOmoModalOpen(true)}>
                                            <FileText size={16} />
                                            {suunnitelmaTeksti ? 'Muokkaa suunnitelmaa' : 'Avaa suunnitelmageneraattori'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Omaehtoisen opiskelun suunnitelmageneraattori modaalissa */}
            <OmoSuunnitelma
                isOpen={isOmoModalOpen}
                onClose={() => setIsOmoModalOpen(false)}
                studyData={studyData}
                onSave={handleSaveOmoPlan}
                asiakasAidinkieli={asiakasAidinkieli}
            />
        </div>
    );
};

export default TuettuOpiskelu;