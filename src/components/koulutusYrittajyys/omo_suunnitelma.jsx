import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText,
    CalendarClock,
    CheckCircle2,
    AlertTriangle,
    RotateCcw,
    Copy,
    Check,
    Calculator,
    BookOpen,
    ClipboardCheck,
    Globe,
    Save,
    Wallet
} from 'lucide-react';

import Modal from '../common/Modal';
import Card from '../common/Card';
import AlertBox from '../common/AlertBox';
import NeutralAlert from '../common/NeutralAlert';
import Checkbox from '../common/Checkbox';
import Badge from '../common/Badge';
import MetricBox from '../common/MetricBox';
import SummaryRow from '../common/SummaryRow';
import Accordion from '../common/Accordion';
import Button from '../common/Button';

// --- PÄIVÄMÄÄRÄ- JA LASKENTA-APURIT ---

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

// Generoi seurantapäivämäärät yksinomaan tukiajalle (ei tukiajan jälkeisille opiskeluvuosille)
const generateSeurantaDates = (startStr, supportEndStr, intervalMonths) => {
    const start = parseFiDate(startStr);
    const end = parseFiDate(supportEndStr);
    const step = Number(intervalMonths);
    if (!start || !end || end <= start || !step) return [];

    const dates = [];
    let count = 1;

    while (count < 40) {
        const next = addCalendarMonthsInclusive(start, step * count);
        if (!next || next >= end) break;

        const daysToEnd = (end - next) / (1000 * 60 * 60 * 24);
        if (daysToEnd >= 20) {
            dates.push(formatFiDate(next));
        }
        count += 1;
    }

    const formattedEnd = formatFiDate(end);
    if (formattedEnd && dates[dates.length - 1] !== formattedEnd) {
        dates.push(formattedEnd);
    }

    return dates;
};

const formatOrgIllatiivi = (orgName) => {
    const trimmed = (orgName || '').trim();
    if (!trimmed) return 'Työllisyyspalveluihin';
    if (trimmed.toLowerCase().endsWith('palvelut')) {
        return `${trimmed.slice(0, -1)}ihin`;
    }
    return trimmed;
};

// --- VAKIOVAIHTOEHDOT ---

const TILANNE_OPTIONS = [
    { value: 'uusi', label: 'Uudet opinnot' },
    { value: 'keskeytyneen_jatko', label: 'Aiemmin keskeytyneiden opintojen jatkaminen' },
    { value: 'jatkotuki', label: 'Jatkotuki / päivitys tilapäisen keskeytyksen jälkeen' }
];

const KOULUTUSASTE_OPTIONS = [
    { value: 'korkeakoulu', label: 'Korkeakoulututkinto (AMK / yliopisto)', yksikko: 'op', maxKk: 24 },
    { value: 'ammatillinen', label: 'Ammatillinen tutkinto / tutkinnon osa', yksikko: 'osp', maxKk: 24 },
    { value: 'lukio', label: 'Lukio-opinnot', yksikko: 'op', maxKk: 24 },
    { value: 'perusopetus', label: 'Perusopetuksen oppimäärä (max 48 kk)', yksikko: 'op', maxKk: 48 },
    { value: 'muu', label: 'Muu ammatillista osaamista edistävä koulutus', yksikko: 'op', maxKk: 24 }
];

const TH_VELVOLLISUUS_PRESETS = [
    {
        value: 'ei_aseteta',
        label: 'Ei määrällistä työnhakuvelvollisuutta (päätoimiset opinnot)',
        text: 'Asiakkaalle ei aseteta määrällistä työnhakuvelvollisuutta tuetun omaehtoisen opiskelun ajalle.'
    },
    {
        value: 'normaali_4',
        label: 'Täysi työnhakuvelvollisuus (4 haettavaa työmahdollisuutta / kk)',
        text: 'Asiakkaalla on työnhakuvelvollisuus: asiakas hakee vähintään neljää (4) työmahdollisuutta tarkastelujakson (1 kk) aikana ja ilmoittaa haetut työpaikat Oma asiointi -palvelussa.'
    },
    {
        value: 'alennettu',
        label: 'Alennettu työnhakuvelvollisuus (esim. 1–3 paikkaa / tarkastelujakso)',
        text: 'Asiakkaalla on alennettu työnhakuvelvollisuus: asiakas hakee [X] työmahdollisuutta [1/3] kuukauden tarkastelujakson aikana ja ilmoittaa hakemuksista Oma asiointi -palvelussa.'
    },
    {
        value: 'vapaa',
        label: 'Muu / oma kirjaus',
        text: ''
    }
];

const OmoSuunnitelma = ({
    isOpen,
    onClose,
    studyData = {},
    onSave,
    asiakasAidinkieli = '',
    defaultOrganisaatio = 'Helsingin työllisyyspalvelut'
}) => {
    // --- LOMAKKEEN TILA ---
    const [tilanne, setTilanne] = useState('uusi');
    const [koulutusaste, setKoulutusaste] = useState('ammatillinen');
    const [opinnonNimi, setOpinnonNimi] = useState('');

    // Opintojen kesto vs. tukiaika
    const [alkuPvm, setAlkuPvm] = useState('');
    const [opintojenLoppuPvm, setOpintojenLoppuPvm] = useState('');
    const [tukiaikaLoppuManuaali, setTukiaikaLoppuManuaali] = useState(false);
    const [tukiaikaLoppuInput, setTukiaikaLoppuInput] = useState('');

    // Jatkotuki / aiemmat opinnot
    const [suoritetutMaara, setSuoritetutMaara] = useState('');
    const [jaljellaMaara, setJaljellaMaara] = useState('');
    const [aiemminKaytetytKk, setAiemminKaytetytKk] = useState('0');

    // Perusteet, seuranta ja työnhakuvelvollisuus
    const [tuenPeruste, setTuenPeruste] = useState('');
    const [seurantavaliKk, setSeurantavaliKk] = useState('3');
    const [ilmoitustapa, setIlmoitustapa] = useState(
        'Oma asiointi -palvelun kautta (opintosuoritusote / oppilaitoksen todistus)'
    );
    const [thPreset, setThPreset] = useState('ei_aseteta');
    const [thTeksti, setThTeksti] = useState(TH_VELVOLLISUUS_PRESETS[0].text);
    const [organisaatio, setOrganisaatio] = useState(defaultOrganisaatio);
    const [valtuutusAllekirjoitus, setValtuutusAllekirjoitus] = useState(true);
    const [muuAidinkieliManuaali, setMuuAidinkieliManuaali] = useState(false);

    // Esikatselu ja käsinmuokkaus
    const [customText, setCustomText] = useState('');
    const [isManuallyEdited, setIsManuallyEdited] = useState(false);
    const [copied, setCopied] = useState(false);

    // Synkronoidaan alkutiedot, kun modaali avataan
    useEffect(() => {
        if (!isOpen) return;

        setOpinnonNimi(studyData.nimi || '');
        setAlkuPvm(studyData.alku || '');
        setOpintojenLoppuPvm(studyData.loppu || studyData.opintojen_loppu || '');
        setTukiaikaLoppuManuaali(Boolean(studyData.tukiaika_loppu_manuaali));
        setTukiaikaLoppuInput(studyData.tukiaika_loppu || '');
        setKoulutusaste(studyData.koulutusaste || (studyData.perusopetus ? 'perusopetus' : 'ammatillinen'));
        setTilanne(studyData.tilanne || 'uusi');
        setSuoritetutMaara(studyData.suoritetut_maara || '');
        setJaljellaMaara(studyData.jaljella_maara || '');
        setAiemminKaytetytKk(String(studyData.aiemmin_kaytetyt_kk ?? '0'));
        setTuenPeruste(studyData.tuen_peruste || '');
        setSeurantavaliKk(String(studyData.seurantavali_kk || '3'));
        setIlmoitustapa(
            studyData.ilmoitustapa ||
            'Oma asiointi -palvelun kautta (opintosuoritusote / oppilaitoksen todistus)'
        );
        setThPreset(studyData.th_preset || 'ei_aseteta');
        setThTeksti(studyData.th_teksti || TH_VELVOLLISUUS_PRESETS[0].text);
        setOrganisaatio(studyData.organisaatio || defaultOrganisaatio);
        setValtuutusAllekirjoitus(studyData.valtuutus_allekirjoitus !== false);

        if (studyData.suunnitelma_teksti) {
            setCustomText(studyData.suunnitelma_teksti);
            setIsManuallyEdited(true);
        } else {
            setIsManuallyEdited(false);
        }
    }, [isOpen, studyData, defaultOrganisaatio]);

    // --- LASKETUT ARVOT: OPINTOJEN KESTO VS. TUKIAIKA ---

    const asteInfo = useMemo(
        () => KOULUTUSASTE_OPTIONS.find((o) => o.value === koulutusaste) || KOULUTUSASTE_OPTIONS[1],
        [koulutusaste]
    );

    const kaytetytKkNum = Math.max(0, parseFloat(aiemminKaytetytKk) || 0);
    const jaljellaMaxTukiaikaKk = Math.max(0, asteInfo.maxKk - kaytetytKkNum);

    // Jatkotuen enimmäisaika opintopisteiden mukaan (esim. 50 op -> max 10 kk)
    const laskettuOpMaxKk = useMemo(() => {
        if (tilanne === 'uusi') return null;
        const op = parseFloat(String(jaljellaMaara).replace(',', '.'));
        if (!op || op <= 0) return null;
        if (asteInfo.yksikko === 'op') {
            return Math.ceil(op / 5);
        }
        return null;
    }, [tilanne, jaljellaMaara, asteInfo.yksikko]);

    // Tehollinen enimmäiskesto (huomioi sekä 24/48 kk katon että jatkotuen op-rajan)
    const tehollinenKattoKk = useMemo(() => {
        if (laskettuOpMaxKk) {
            return Math.min(jaljellaMaxTukiaikaKk, laskettuOpMaxKk);
        }
        return jaljellaMaxTukiaikaKk;
    }, [jaljellaMaxTukiaikaKk, laskettuOpMaxKk]);

    // Automaattisesti lasketut päivämäärät
    const aikavaliLaskelma = useMemo(() => {
        const startDate = parseFiDate(alkuPvm);
        const opintojenLoppuDate = parseFiDate(opintojenLoppuPvm);
        const opintojenKestoKk = calculateCalendarMonths(alkuPvm, opintojenLoppuPvm);

        const maxLakisaateinenEndDate =
            startDate && jaljellaMaxTukiaikaKk > 0
                ? addCalendarMonthsInclusive(startDate, jaljellaMaxTukiaikaKk)
                : null;

        const tehollinenCapDate =
            startDate && tehollinenKattoKk > 0
                ? addCalendarMonthsInclusive(startDate, tehollinenKattoKk)
                : null;

        let autoTukiaikaLoppu = '';
        if (startDate && opintojenLoppuDate && opintojenLoppuDate >= startDate) {
            if (tehollinenCapDate && opintojenLoppuDate > tehollinenCapDate) {
                autoTukiaikaLoppu = formatFiDate(tehollinenCapDate);
            } else {
                autoTukiaikaLoppu = opintojenLoppuPvm.trim();
            }
        } else if (startDate && tehollinenCapDate && !opintojenLoppuPvm.trim()) {
            autoTukiaikaLoppu = formatFiDate(tehollinenCapDate);
        }

        const effectiveTukiaikaLoppu = tukiaikaLoppuManuaali ? tukiaikaLoppuInput.trim() : autoTukiaikaLoppu;
        const effectiveTukiEndDate = parseFiDate(effectiveTukiaikaLoppu);
        const tukiaikaKestoKk = calculateCalendarMonths(alkuPvm, effectiveTukiaikaLoppu);

        const opinnotJatkuvatTukiajanJalkeen = Boolean(
            opintojenLoppuDate && effectiveTukiEndDate && opintojenLoppuDate > effectiveTukiEndDate
        );

        const muunRahoituksenAlku = opinnotJatkuvatTukiajanJalkeen
            ? formatFiDate(addDays(effectiveTukiEndDate, 1))
            : '';

        const muunRahoituksenKestoKk = opinnotJatkuvatTukiajanJalkeen
            ? calculateCalendarMonths(muunRahoituksenAlku, opintojenLoppuPvm)
            : 0;

        // Täyttyykö lain mukainen 24/48 kk enimmäisaika (jolloin pidennys ei ole mahdollinen)
        const enimmaisaikaTayttyy = Boolean(
            jaljellaMaxTukiaikaKk > 0 &&
                ((maxLakisaateinenEndDate &&
                    effectiveTukiEndDate &&
                    effectiveTukiEndDate >= maxLakisaateinenEndDate) ||
                    tukiaikaKestoKk >= jaljellaMaxTukiaikaKk)
        );

        return {
            opintojenKestoKk,
            autoTukiaikaLoppu,
            effectiveTukiaikaLoppu,
            tukiaikaKestoKk,
            opinnotJatkuvatTukiajanJalkeen,
            muunRahoituksenAlku,
            muunRahoituksenKestoKk,
            enimmaisaikaTayttyy,
            maxLakisaateinenEndDate,
            effectiveTukiEndDate,
            opintojenLoppuDate
        };
    }, [
        alkuPvm,
        opintojenLoppuPvm,
        jaljellaMaxTukiaikaKk,
        tehollinenKattoKk,
        tukiaikaLoppuManuaali,
        tukiaikaLoppuInput
    ]);

    const seurantaPvmLista = useMemo(
        () => generateSeurantaDates(alkuPvm, aikavaliLaskelma.effectiveTukiaikaLoppu, seurantavaliKk),
        [alkuPvm, aikavaliLaskelma.effectiveTukiaikaLoppu, seurantavaliKk]
    );

    const kielihuomautus = useMemo(() => {
        if (muuAidinkieliManuaali) return true;
        if (!asiakasAidinkieli) return false;
        const norm = asiakasAidinkieli.trim().toLowerCase();
        return !['suomi', 'fi', 'ruotsi', 'sv', 'finnish', 'swedish'].includes(norm);
    }, [asiakasAidinkieli, muuAidinkieliManuaali]);

    const varoitukset = useMemo(() => {
        const list = [];
        if (jaljellaMaxTukiaikaKk <= 0) {
            list.push(`Omaehtoisen opiskelun enimmäistukiaika (${asteInfo.maxKk} kk) on jo kokonaan käytetty.`);
        }
        if (aikavaliLaskelma.tukiaikaKestoKk > jaljellaMaxTukiaikaKk) {
            list.push(
                `Asetettu tukiaika (${aikavaliLaskelma.tukiaikaKestoKk} kk) ylittää jäljellä olevan enimmäistukiajan (${jaljellaMaxTukiaikaKk} kk). Tukiaika voi päättyä viimeistään ${formatFiDate(
                    aikavaliLaskelma.maxLakisaateinenEndDate
                )}.`
            );
        }
        if (laskettuOpMaxKk && aikavaliLaskelma.tukiaikaKestoKk > laskettuOpMaxKk) {
            list.push(
                `Jäljellä olevien opintojen (${jaljellaMaara} op) perusteella tukiaika voi olla enintään ${laskettuOpMaxKk} kk (asetettu: ${aikavaliLaskelma.tukiaikaKestoKk} kk).`
            );
        }
        if (
            aikavaliLaskelma.opintojenLoppuDate &&
            aikavaliLaskelma.effectiveTukiEndDate &&
            aikavaliLaskelma.effectiveTukiEndDate > aikavaliLaskelma.opintojenLoppuDate
        ) {
            list.push('Tukiajan päättymispäivä ei voi olla opintojen suunnitellun päättymispäivän jälkeen.');
        }
        if (alkuPvm && opintojenLoppuPvm && aikavaliLaskelma.opintojenKestoKk === 0) {
            list.push('Tarkista opintojen päivämäärät (muoto pp.kk.vvvv, päättymispäivän tulee olla alkamispäivän jälkeen).');
        }
        return list;
    }, [
        jaljellaMaxTukiaikaKk,
        asteInfo.maxKk,
        aikavaliLaskelma,
        laskettuOpMaxKk,
        jaljellaMaara,
        alkuPvm,
        opintojenLoppuPvm
    ]);

    // --- AUTOMAATTINEN TEKSTIGENERAATTORI ---

    const generatedDraft = useMemo(() => {
        const nimi = opinnonNimi.trim() || '[Oppilaitos ja tutkinnon nimi]';
        const alku = alkuPvm.trim() || 'XX.X.20XX';
        const tukiLoppu = aikavaliLaskelma.effectiveTukiaikaLoppu || 'XX.X.20XX';
        const opintojenLoppu = opintojenLoppuPvm.trim() || tukiLoppu;
        const orgTaivutettu = formatOrgIllatiivi(organisaatio);

        const aloitusVerbi =
            tilanne === 'uusi'
                ? 'aloittaa päätoimiset omaehtoiset opinnot'
                : tilanne === 'keskeytyneen_jatko'
                ? 'jatkaa aiemmin keskeytyneitä päätoimisia omaehtoisia opintoja'
                : 'jatkaa työttömyysetuudella tuettuja päätoimisia omaehtoisia opintoja';

        const kappaleet = [];

        // 1. Opiskelutiedot ja tuen peruste
        let k1 = `Asiakas ${aloitusVerbi}: ${nimi}.`;
        if (tuenPeruste.trim()) {
            k1 += ` Tuen perusteena on asiakkaan todettu koulutustarve: ${tuenPeruste.trim()}`;
        } else {
            k1 += ` Tuen perusteena on asiakkaan todettu koulutustarve ja opintojen arvioidaan parantavan olennaisesti asiakkaan ammattitaitoa sekä työllistymismahdollisuuksia.`;
        }
        kappaleet.push(k1);

        // 2. Tukiaika, opintojen kokonaiskesto ja jatkotuen laajuus
        const kestoSelite = aikavaliLaskelma.enimmaisaikaTayttyy
            ? `enimmäistukiaika ${aikavaliLaskelma.tukiaikaKestoKk} kk`
            : `${aikavaliLaskelma.tukiaikaKestoKk} kk`;

        let k2 = `Omaehtoista opiskelua tuetaan työttömyysetuudella ajalla ${alku}–${tukiLoppu}${
            aikavaliLaskelma.tukiaikaKestoKk > 0 ? ` (${kestoSelite})` : ''
        }.`;

        if (aikavaliLaskelma.opinnotJatkuvatTukiajanJalkeen) {
            k2 += ` Opintojen suunniteltu kokonaiskesto on ${alku}–${opintojenLoppu}${
                aikavaliLaskelma.opintojenKestoKk > 0 ? ` (${aikavaliLaskelma.opintojenKestoKk} kk)` : ''
            }.`;
        }

        if (tilanne !== 'uusi') {
            const suoritetutStr = suoritetutMaara
                ? `${suoritetutMaara} ${asteInfo.yksikko}`
                : `[suoritetut ${asteInfo.yksikko}]`;
            const jaljellaStr = jaljellaMaara
                ? `${jaljellaMaara} ${asteInfo.yksikko}`
                : `[jäljellä olevat ${asteInfo.yksikko}]`;
            k2 += ` Opinnoista on tähän mennessä suoritettu ${suoritetutStr} ja jäljellä on ${jaljellaStr}. Tukiaika on määritelty jäljellä olevien opintojen mukaisesti.`;
        }
        kappaleet.push(k2);

        // 3. Edellytetty eteneminen ja seuranta (vain tukiajalle)
        const eteneminenKriteeri =
            koulutusaste === 'korkeakoulu'
                ? 'korkeakouluopinnoissa keskimäärin vähintään 5 opintopistettä tukikuukautta kohden'
                : 'henkilökohtaisen opiskelusuunnitelman (HOKS / opintosuunnitelma) mukaisesti';

        let k3 = `Etuuden maksamisen edellytyksenä on, että opinnot etenevät riittävästi (${eteneminenKriteeri}). Asiakas toimittaa selvityksen opintojen etenemisestä (${ilmoitustapa}) ${seurantavaliKk} kuukauden välein.`;
        if (seurantaPvmLista.length > 0) {
            k3 += ` Sovitut seurantapäivämäärät tukiajalla: ${seurantaPvmLista.join(', ')}.`;
        }
        k3 += ` Opintojen laiminlyönti tai opintojen etenemisestä ilmoittamisen laiminlyönti voivat johtaa tuen lakkauttamiseen ja aiheettomasti maksetun työttömyysetuuden takaisinperimiseen.`;
        kappaleet.push(k3);

        // 4. Tukiajan päättyminen, muu rahoitus ja opintojen toteaminen päättyneiksi
        let k4 = '';
        if (aikavaliLaskelma.enimmaisaikaTayttyy && aikavaliLaskelma.opinnotJatkuvatTukiajanJalkeen) {
            k4 = `Omaehtoisen opiskelun ${asteInfo.maxKk} kuukauden enimmäistukiaika täyttyy ${tukiLoppu}, jolloin työttömyysetuudella tuettu aika päättyy eikä tukiaikaa voida pidentää. Asiakkaan tulee selvittää ja hankkia muu rahoitus jäljellä olevalle opiskeluajalle (${aikavaliLaskelma.muunRahoituksenAlku}–${opintojenLoppu}). Oikeutta työttömyysturvaan ei ole ${tukiLoppu} jälkeen ennen kuin opinnot todetaan päättyneiksi. Opinnot todetaan päättyneeksi, kun hakija toimittaa tutkintotodistuksen tai todistuksen opinnoista eroamisesta.`;
        } else if (aikavaliLaskelma.enimmaisaikaTayttyy) {
            k4 = `Mikäli asiakas ei saa suoritetuksi tutkintoa tukiajalla, hän selvittää opintojen muita rahoituskeinoja. Omaehtoisen opiskelun ${asteInfo.maxKk} kuukauden enimmäistukiaika täyttyy ${tukiLoppu}, eikä tukiaikaa voida pidentää tämän jälkeen. Oikeutta työttömyysturvaan ei ole ${tukiLoppu} jälkeen ennen kuin opinnot todetaan päättyneiksi. Opinnot todetaan päättyneeksi, kun hakija toimittaa tutkintotodistuksen tai todistuksen opinnoista eroamisesta.`;
        } else if (aikavaliLaskelma.opinnotJatkuvatTukiajanJalkeen) {
            k4 = `Mikäli asiakas ei saa suoritetuksi tutkintoa tukiajalla, hän selvittää opintojen muita rahoituskeinoja jäljellä olevalle opiskeluajalle (${aikavaliLaskelma.muunRahoituksenAlku}–${opintojenLoppu}). Oikeutta työttömyysturvaan ei ole ${tukiLoppu} jälkeen ennen kuin opinnot todetaan päättyneiksi. Opinnot todetaan päättyneeksi, kun hakija toimittaa tutkintotodistuksen tai todistuksen opinnoista eroamisesta. HUOM. Mikäli valmistuminen siirtyy suunniteltua myöhemmäksi asiakkaasta riippumattomista syistä, tukiajan pidennys on harkittavissa enimmäisajan (${asteInfo.maxKk} kk) puitteissa. Tällöin tulee ottaa hyvissä ajoin yhteyttä ${orgTaivutettu}.`;
        } else {
            k4 = `Mikäli asiakas ei saa suoritetuksi tutkintoa tukiajalla, hän selvittää opintojen muita rahoituskeinoja. Oikeutta työttömyysturvaan ei ole ${tukiLoppu} jälkeen ennen kuin opinnot todetaan päättyneiksi. Opinnot todetaan päättyneeksi, kun hakija toimittaa tutkintotodistuksen tai todistuksen opinnoista eroamisesta. HUOM. Mikäli valmistuminen siirtyy suunniteltua myöhemmäksi asiakkaasta riippumattomista syistä, tukiajan pidennys on harkittavissa. Tällöin tulee ottaa hyvissä ajoin yhteyttä ${orgTaivutettu}.`;
        }
        kappaleet.push(k4);

        // 5. Tilapäinen keskeytys
        kappaleet.push(
            `Jos asiakas haluaa keskeyttää opintonsa tilapäisesti, hänen on otettava ajoissa yhteyttä ${orgTaivutettu} ja sovittava asiasta virkailijan kanssa. Tilapäiselle keskeytykselle on oltava perusteltu syy (työllistyminen, perhevapaa, sairausloma). Tilapäisen keskeytyksen aikana ei ole mahdollista saada työttömyysetuutta.`
        );

        // 6. Työnhakuvelvollisuus
        if (thTeksti.trim()) {
            kappaleet.push(thTeksti.trim());
        }

        // 7. Ilmoitusvelvollisuus ja allekirjoitus
        let k7 = `Asiakas ilmoittaa omaehtoisiin opintoihin tai työnhakuun liittyvistä muutoksista ${orgTaivutettu} (työllistyminen, yritystoiminta, sairausloma, yhteystiedot).`;
        if (valtuutusAllekirjoitus) {
            k7 += ' Työllistymissuunnitelma on allekirjoitettu asiakkaan antamalla valtuutuksella.';
        }
        kappaleet.push(k7);

        return kappaleet.join('\n\n');
    }, [
        opinnonNimi,
        alkuPvm,
        opintojenLoppuPvm,
        aikavaliLaskelma,
        organisaatio,
        tilanne,
        tuenPeruste,
        suoritetutMaara,
        jaljellaMaara,
        asteInfo.yksikko,
        asteInfo.maxKk,
        koulutusaste,
        ilmoitustapa,
        seurantavaliKk,
        seurantaPvmLista,
        thTeksti,
        valtuutusAllekirjoitus
    ]);

    useEffect(() => {
        if (!isManuallyEdited) {
            setCustomText(generatedDraft);
        }
    }, [generatedDraft, isManuallyEdited]);

    // --- TOIMINNOT ---

    const handleApplyOpEndDate = () => {
        const start = parseFiDate(alkuPvm);
        if (!start || !laskettuOpMaxKk) return;
        const maxAllowed = Math.min(laskettuOpMaxKk, jaljellaMaxTukiaikaKk);
        const computedEnd = addCalendarMonthsInclusive(start, maxAllowed);
        if (computedEnd) {
            setTukiaikaLoppuManuaali(true);
            setTukiaikaLoppuInput(formatFiDate(computedEnd));
        }
    };

    const handleResetAutoTukiaika = () => {
        setTukiaikaLoppuManuaali(false);
        setTukiaikaLoppuInput(aikavaliLaskelma.autoTukiaikaLoppu);
    };

    const handleThPresetChange = (presetKey) => {
        setThPreset(presetKey);
        const found = TH_VELVOLLISUUS_PRESETS.find((p) => p.value === presetKey);
        if (found && presetKey !== 'vapaa') {
            setThTeksti(found.text);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(customText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Kopiointi epäonnistui:', e);
        }
    };

    const handleSave = () => {
        const updatedFields = {
            nimi: opinnonNimi,
            alku: alkuPvm,
            loppu: opintojenLoppuPvm,
            tukiaika_loppu: aikavaliLaskelma.effectiveTukiaikaLoppu,
            tukiaika_loppu_manuaali: tukiaikaLoppuManuaali,
            perusopetus: koulutusaste === 'perusopetus',
            koulutusaste,
            tilanne,
            suoritetut_maara: tilanne !== 'uusi' ? suoritetutMaara : '',
            jaljella_maara: tilanne !== 'uusi' ? jaljellaMaara : '',
            aiemmin_kaytetyt_kk: kaytetytKkNum,
            tuen_peruste: tuenPeruste,
            seurantavali_kk: Number(seurantavaliKk),
            seuranta_pvm_lista: seurantaPvmLista,
            ilmoitustapa,
            th_preset: thPreset,
            th_teksti: thTeksti,
            organisaatio,
            valtuutus_allekirjoitus: valtuutusAllekirjoitus,
            edellytys_suunnitelma: true,
            edellytys_seuranta: seurantaPvmLista.length > 0,
            suunnitelma_teksti: customText
        };

        if (typeof onSave === 'function') {
            onSave(customText, updatedFields);
        }
        onClose();
    };

    const parseCheck = (valOrEvent) =>
        typeof valOrEvent === 'boolean' ? valOrEvent : Boolean(valOrEvent?.target?.checked);

    const modalFooter = (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.75rem' }}>
            <Button variant="secondary" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopioitu leikepöydälle' : 'Kopioi teksti'}
            </Button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="secondary" onClick={onClose}>
                    Peruuta
                </Button>
                <Button variant="primary" onClick={handleSave}>
                    <Save size={16} />
                    Tallenna suunnitelmaan
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Omaehtoisen opiskelun työllistymissuunnitelma"
            icon={FileText}
            footer={modalFooter}
            maxWidth="1040px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {kielihuomautus && (
                    <AlertBox type="info">
                        <strong>Huomioi kielitaito:</strong> Suunnitelma laaditaan ensisijaisesti tapaamisessa asiakkaille, joiden äidinkieli on muu kuin suomi tai ruotsi.
                    </AlertBox>
                )}

                {varoitukset.map((w, i) => (
                    <AlertBox key={i} type="warning">
                        <strong>Tarkista tukiaika:</strong> {w}
                    </AlertBox>
                ))}

                {/* 1. PERUSTIEDOT JA TILANNE */}
                <Card title="1. Opintojen tilanne ja koulutustiedot" icon={BookOpen}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label className="stat-label">Suunnitelman tilanne</label>
                                <select
                                    className="form-input"
                                    value={tilanne}
                                    onChange={(e) => setTilanne(e.target.value)}
                                >
                                    {TILANNE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="stat-label">Koulutusaste ja etenemiskriteeri</label>
                                <select
                                    className="form-input"
                                    value={koulutusaste}
                                    onChange={(e) => setKoulutusaste(e.target.value)}
                                >
                                    {KOULUTUSASTE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="stat-label">Oppilaitos ja tutkinnon / koulutuksen nimi</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Esim. Metropolia AMK, Tradenomi (AMK)"
                                value={opinnonNimi}
                                onChange={(e) => setOpinnonNimi(e.target.value)}
                            />
                        </div>

                        {tilanne !== 'uusi' && (
                            <div
                                style={{
                                    padding: '0.85rem',
                                    borderRadius: '8px',
                                    background: 'var(--color-bg-subtle, #f8fafc)',
                                    border: '1px solid var(--color-border, #e2e8f0)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label className="stat-label">Suoritetut ({asteInfo.yksikko})</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="esim. 160"
                                            value={suoritetutMaara}
                                            onChange={(e) => setSuoritetutMaara(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="stat-label">Jäljellä ({asteInfo.yksikko})</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="esim. 50"
                                            value={jaljellaMaara}
                                            onChange={(e) => setJaljellaMaara(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="stat-label">Aiemmin käytetty tuki (kk)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            max={asteInfo.maxKk}
                                            value={aiemminKaytetytKk}
                                            onChange={(e) => setAiemminKaytetytKk(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {laskettuOpMaxKk && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <span style={{ fontSize: '0.9rem' }}>
                                            <Calculator
                                                size={15}
                                                style={{ verticalAlign: 'middle', marginRight: '6px' }}
                                            />
                                            Jäljellä <strong>{jaljellaMaara} op</strong> → laskennallinen enimmäistukiaika:{' '}
                                            <strong>max {laskettuOpMaxKk} kk</strong> (5 op / kk).
                                        </span>
                                        {parseFiDate(alkuPvm) && (
                                            <Button variant="secondary" onClick={handleApplyOpEndDate}>
                                                Aseta tukiajan päättymispäivä ({Math.min(laskettuOpMaxKk, jaljellaMaxTukiaikaKk)} kk)
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* 2. OPINTOJEN KESTO, TUKIAIKA JA SEURANTA */}
                <Card title="2. Opintojen kesto, tukiaika (max 24/48 kk) ja seurantapäivät" icon={CalendarClock}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label className="stat-label">Opinnot / tuki alkaa (pp.kk.vvvv)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="1.8.2026"
                                    value={alkuPvm}
                                    onChange={(e) => setAlkuPvm(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="stat-label">Opintojen suunniteltu päättyminen</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="30.7.2030"
                                    value={opintojenLoppuPvm}
                                    onChange={(e) => setOpintojenLoppuPvm(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="stat-label">Seurantaväli tukiajalla</label>
                                <select
                                    className="form-input"
                                    value={seurantavaliKk}
                                    onChange={(e) => setSeurantavaliKk(e.target.value)}
                                >
                                    <option value="3">3 kuukauden välein</option>
                                    <option value="4">4 kuukauden välein</option>
                                    <option value="6">6 kuukauden välein</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                            <div>
                                <label className="stat-label">
                                    Tukiaika päättyy {tukiaikaLoppuManuaali ? '(muokattu käsin)' : '(laskettu automaattisesti)'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="31.7.2028"
                                    value={aikavaliLaskelma.effectiveTukiaikaLoppu}
                                    onChange={(e) => {
                                        setTukiaikaLoppuManuaali(true);
                                        setTukiaikaLoppuInput(e.target.value);
                                    }}
                                />
                            </div>

                            {tukiaikaLoppuManuaali && (
                                <div>
                                    <Button variant="secondary" onClick={handleResetAutoTukiaika}>
                                        <RotateCcw size={14} />
                                        Palauta automaattinen tukiaika ({aikavaliLaskelma.autoTukiaikaLoppu || '-'})
                                    </Button>
                                </div>
                            )}
                        </div>

                        {aikavaliLaskelma.opinnotJatkuvatTukiajanJalkeen && (
                            <AlertBox type="info">
                                <strong>Muu rahoitus tukiajan jälkeen:</strong> Työttömyysetuudella tuettu aika päättyy{' '}
                                <strong>{aikavaliLaskelma.effectiveTukiaikaLoppu}</strong> ({aikavaliLaskelma.tukiaikaKestoKk} kk).
                                Jäljellä olevalle opiskeluajalle{' '}
                                <strong>
                                    {aikavaliLaskelma.muunRahoituksenAlku}–{opintojenLoppuPvm}
                                </strong>{' '}
                                ({aikavaliLaskelma.muunRahoituksenKestoKk} kk) asiakkaan tulee hankkia muu rahoitus.
                            </AlertBox>
                        )}

                        <MetricBox
                            title="Tukiajan ja seurannan yhteenveto"
                            icon={CalendarClock}
                            variant={varoitukset.length > 0 ? 'warning' : 'default'}
                        >
                            <SummaryRow
                                icon={varoitukset.length > 0 ? AlertTriangle : CheckCircle2}
                                label="Työttömyysetuudella tuettu aika"
                                value={
                                    alkuPvm && aikavaliLaskelma.effectiveTukiaikaLoppu
                                        ? `${alkuPvm}–${aikavaliLaskelma.effectiveTukiaikaLoppu} (${aikavaliLaskelma.tukiaikaKestoKk} kk / max ${jaljellaMaxTukiaikaKk} kk)`
                                        : 'Syötä päivämäärät'
                                }
                                borderTop={false}
                            />
                            {aikavaliLaskelma.opinnotJatkuvatTukiajanJalkeen && (
                                <SummaryRow
                                    icon={Wallet}
                                    label="Muun rahoituksen jakso (tuen jälkeen)"
                                    value={`${aikavaliLaskelma.muunRahoituksenAlku}–${opintojenLoppuPvm} (${aikavaliLaskelma.muunRahoituksenKestoKk} kk)`}
                                />
                            )}
                            <SummaryRow
                                icon={CalendarClock}
                                label="Tukioikeuden takaraja tekstiin (ei oikeutta jälkeen)"
                                value={aikavaliLaskelma.effectiveTukiaikaLoppu || 'Syötä päivämäärät'}
                            />
                            {seurantaPvmLista.length > 0 && (
                                <div style={{ marginTop: '0.6rem' }}>
                                    <div className="stat-label" style={{ marginBottom: '0.35rem' }}>
                                        Automaattisesti lasketut seurantapäivämäärät tukiajalle ({seurantaPvmLista.length} kpl):
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {seurantaPvmLista.map((pvm) => (
                                            <Badge key={pvm} variant="default">
                                                {pvm}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </MetricBox>
                    </div>
                </Card>

                {/* 3. PERUSTEET JA TYÖNHAKUVELVOLLISUUS */}
                <Card title="3. Tuen peruste, työnhakuvelvollisuus ja asetukset" icon={ClipboardCheck}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                            <label className="stat-label">Tuen peruste (koulutustarve ja työllistymisvaikutus)</label>
                            <textarea
                                className="form-input"
                                rows={2}
                                placeholder="Esim. Asiakkaalta puuttuu alan tutkinto ja tutkinnon suorittaminen parantaa olennaisesti työllistymismahdollisuuksia."
                                value={tuenPeruste}
                                onChange={(e) => setTuenPeruste(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label className="stat-label">Etenemisen ilmoitustapa</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={ilmoitustapa}
                                    onChange={(e) => setIlmoitustapa(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="stat-label">Työnhakuvelvollisuuden pohjakirjaus</label>
                                <select
                                    className="form-input"
                                    value={thPreset}
                                    onChange={(e) => handleThPresetChange(e.target.value)}
                                >
                                    {TH_VELVOLLISUUS_PRESETS.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="stat-label">Työnhakuvelvollisuuden teksti suunnitelmaan</label>
                            <textarea
                                className="form-input"
                                rows={2}
                                value={thTeksti}
                                onChange={(e) => setThTeksti(e.target.value)}
                            />
                        </div>

                        <Accordion title="Lisäasetukset (organisaatio, valtuutus, äidinkieli)">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                <div>
                                    <label className="stat-label">Työllisyysalue / organisaation nimi tekstissä</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={organisaatio}
                                        onChange={(e) => setOrganisaatio(e.target.value)}
                                    />
                                </div>
                                <Checkbox
                                    label="Lisää kirjaus: Työllistymissuunnitelma on allekirjoitettu asiakkaan antamalla valtuutuksella."
                                    checked={valtuutusAllekirjoitus}
                                    onChange={(e) => setValtuutusAllekirjoitus(parseCheck(e))}
                                />
                                <Checkbox
                                    label="Asiakkaan äidinkieli on muu kuin suomi tai ruotsi (näytä tapaamissuositus)"
                                    checked={muuAidinkieliManuaali}
                                    onChange={(e) => setMuuAidinkieliManuaali(parseCheck(e))}
                                />
                            </div>
                        </Accordion>
                    </div>
                </Card>

                {/* 4. VALMIS SUUNNITELMATEKSTI */}
                <Card
                    title="4. Suunnitelmaluonnos (päivämäärät täytetty automaattisesti)"
                    icon={FileText}
                    headerAction={
                        isManuallyEdited && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setIsManuallyEdited(false);
                                    setCustomText(generatedDraft);
                                }}
                            >
                                <RotateCcw size={14} />
                                Palauta automaattinen luonnos
                            </Button>
                        )
                    }
                >
                    <NeutralAlert icon={Globe} title="Muokattava kirjaus">
                        Teksti päivittyy lomakkeen kenttien, enimmäistukiajan (24/48 kk) ja seurantapäivämäärien mukaan. Jos muokkaat tekstiä suoraan alla, automaattinen ylikirjoitus pysähtyy, kunnes painat <em>Palauta automaattinen luonnos</em>.
                    </NeutralAlert>

                    <textarea
                        className="form-input"
                        rows={16}
                        style={{ marginTop: '0.75rem', lineHeight: 1.55, fontFamily: 'inherit' }}
                        value={customText}
                        onChange={(e) => {
                            setIsManuallyEdited(true);
                            setCustomText(e.target.value);
                        }}
                    />
                </Card>
            </div>
        </Modal>
    );
};

export default OmoSuunnitelma;