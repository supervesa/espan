export const getBestSuggestion = (rules, signals, kestoKk) => {
    if (!rules || rules.length === 0) return null;

    // Prioriteetti 1: Palvelun päättyminen (46 §)
    // Laukaisin: Palvelun päättymiseen 30 päivää tai vähemmän
    if (signals.palvelun_loppu_aika !== undefined && signals.palvelun_loppu_aika <= 30) {
        const rule = rules.find(r => r.title.includes("46 §"));
        if (rule) return { priority: 1, rule, reason: `Palvelun päättymiseen ${signals.palvelun_loppu_aika} pv`, type: 'paattyminen' };
    }

    // Prioriteetti 2: Aktivointijakso
    // Laukaisin: ETUUS_TOIMEENTULOTUKI tai tt_etuus_yleistuki
    if (signals.ETUUS_TOIMEENTULOTUKI || signals.tt_etuus_yleistuki) {
        const rule = rules.find(r => r.metadata?.triggers?.require_yleistuki === true);
        if (rule) return { priority: 2, rule, reason: "Aktivointijakso (Etuus havaittu)", type: 'aktivointi' };
    }

    // Prioriteetti 3: Lakisääteinen perusrytmi (6kk / 3kk)
    // A-Haara: 6kk
    if (kestoKk >= 6) {
        const rule = rules.find(r => r.title.includes("Täydentävät"));
        if (rule) return { priority: 3, rule, reason: `Työnhaku kestänyt ${kestoKk} kk`, type: 'normi' };
    }
    
    // B-Haara: 3kk (Tämä voisi olla oma sääntönsä tulevaisuudessa, mutta tässä toteutuksessa jätämme tämän perusrytmin alle)
    if (kestoKk >= 3) {
        const rule = rules.find(r => r.title.includes("Työnhakukeskustelu"));
        if (rule) return { priority: 3, rule, reason: `Työnhaku kestänyt ${kestoKk} kk`, type: 'normi' };
    }

    return null;
};