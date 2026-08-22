// --- src/components/sections/Tyotilanne/tyotilanneTekstiLogiikka.js ---
import { ENTITY_DEFINITIONS } from '../../../data/entityDefinitions'; 

const parseDate = (s) => {
    if (!s) return null;
    const p = s.split('.');
    if (p.length !== 3) return new Date(s);
    return new Date(p[2], p[1] - 1, p[0]);
};

const getLisatiedotString = (data) => {
    const osat = [];
    if (data.nimi) osat.push(`kohde: ${data.nimi}`);
    else if (data.tyonantaja) osat.push(`työnantaja: ${data.tyonantaja}`);
    else if (data.jarjestaja) osat.push(`järjestäjä: ${data.jarjestaja}`);
    else if (data.oppilaitos) osat.push(`oppilaitos: ${data.oppilaitos}`);

    if (data.paivatViikossa) osat.push(`${data.paivatViikossa} pv/vko`);
    if (data.tunnitPaivassa) osat.push(`${data.tunnitPaivassa} h/pv`);

    return osat.length > 0 ? ` (${osat.join(', ')})` : "";
};

const getPalveluNimi = (entity_key, isPast) => {
    if (entity_key === 'tyokokeilu') return isPast ? "työkokeiluun" : "työkokeilussa";
    if (entity_key === 'palkkatuki') return isPast ? "palkkatukityöhön" : "palkkatukityössä";
    if (entity_key === 'tyovoimakoulutus') return isPast ? "työvoimakoulutukseen" : "työvoimakoulutuksessa";
    if (entity_key === 'kuntouttava_tyotoiminta') return isPast ? "kuntouttavaan työtoimintaan" : "kuntouttavassa työtoiminnassa";
    return isPast ? "palveluun" : "palvelussa"; 
};

export const generoiLausuntoTeksti = (sessionServices = []) => {
    if (!sessionServices || sessionServices.length === 0) return "";

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const validServices = sessionServices.map(s => {
        const start = parseDate(s.data.alku);
        const end = parseDate(s.data.loppu);
        if (!start || !end) return null;
        return { ...s, start, end, isPast: end < now };
    }).filter(Boolean);

    const activeServices = validServices.filter(s => !s.isPast).sort((a, b) => a.start - b.start);
    const pastServices = validServices.filter(s => s.isPast).sort((a, b) => b.end - a.end); 

    const blocks = [];

    // --- 1. KÄYNNISSÄ OLEVAT JA TULEVAT ---
    activeServices.forEach((s, index) => {
        const def = ENTITY_DEFINITIONS[s.entity_key] || {};
        const isPresent = s.start <= now && s.end >= now;
        
        // Vaihteleva, inhimillinen aloitus
        let subjekti = index === 0 ? (isPresent ? "Tällä hetkellä asiakas on" : "Asiakas osallistuu") : (isPresent ? "Hän on myös" : "Hän osallistuu myös");
        
        const nimi = getPalveluNimi(s.entity_key, false); 
        
        let kohde = "";
        if (s.data.nimi || s.data.tyonantaja) kohde = ` kohteessa ${s.data.nimi || s.data.tyonantaja}`;
        else if (s.data.jarjestaja) kohde = ` (järjestäjä: ${s.data.jarjestaja})`;

        let laajuus = "";
        if (s.data.paivatViikossa || s.data.tunnitPaivassa) {
            const pv = s.data.paivatViikossa ? `${s.data.paivatViikossa} pv/vko` : "";
            const h = s.data.tunnitPaivassa ? `${s.data.tunnitPaivassa} h/pv` : "";
            laajuus = ` laajuudella ${[pv, h].filter(Boolean).join(', ')}`;
        }

        let line = `${subjekti} ${nimi}${kohde}${laajuus} ajalla ${s.data.alku}–${s.data.loppu}.`;

        if (def.isLawCritical) {
            const kestoPaivissa = Math.ceil((s.end - s.start) / (1000 * 60 * 60 * 24));
            if (kestoPaivissa >= 30) {
                line += ` Kyseessä on yli kuukauden kestävä palvelu (46 §).`;
            }
        }
        blocks.push(line);
    });

    // --- 2. MENNYT HISTORIA ---
    if (pastServices.length > 0) {
        const grouped = pastServices.reduce((acc, s) => {
            if (!acc[s.entity_key]) acc[s.entity_key] = [];
            acc[s.entity_key].push(s);
            return acc;
        }, {});

        const menneetOsuudet = [];
        const seenKeys = new Set();

        pastServices.forEach(s => {
            if (seenKeys.has(s.entity_key)) return;
            seenKeys.add(s.entity_key);

            const group = grouped[s.entity_key];
            const nimi = getPalveluNimi(s.entity_key, true); 

            if (group.length > 1) {
                const lukusana = group.length === 2 ? 'kahdesti' : group.length === 3 ? 'kolmesti' : `${group.length} kertaa`;
                const ajat = group.map(g => `${g.data.alku}–${g.data.loppu}`).join(' sekä ');
                menneetOsuudet.push(`${nimi} ${lukusana} (ajalla ${ajat})`);
            } else {
                const g = group[0];
                const lisatiedot = getLisatiedotString(g.data);
                menneetOsuudet.push(`${nimi}${lisatiedot} ajalla ${g.data.alku}–${g.data.loppu}`);
            }
        });

        let historiaTeksti = "Aiemmin hän on osallistunut ";
        if (menneetOsuudet.length === 1) {
            historiaTeksti += menneetOsuudet[0] + ".";
        } else {
            const last = menneetOsuudet.pop();
            historiaTeksti += menneetOsuudet.join(', ') + " sekä " + last + ".";
        }
        
        blocks.push(historiaTeksti);
    }

    return blocks.join('\n\n');
};