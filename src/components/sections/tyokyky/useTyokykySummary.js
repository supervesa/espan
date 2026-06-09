// --- src/components/sections/tyokyky/useTyokykySummary.js ---
import { useMemo } from 'react';

const createListSentence = (items) => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' ja ');
    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return `${allButLast} ja ${last}`;
};

export const useTyokykySummary = (state, dbPhrases = [], arvioKysymykset = []) => {
    return useMemo(() => {
        if (!state) return '';

        let generatedParts = [];

        // 1. PÄÄVALINTA
        const paavalintaAvainsana = state['custom-tyokyky_paavalinta'];
        const aktiivinenPaavalinta = dbPhrases.find(p => p.avainsana === paavalintaAvainsana && p.grouping_key === 'tyokyky_paavalinta');

        if (aktiivinenPaavalinta) {
            let paavalintaTeksti = aktiivinenPaavalinta.teksti || aktiivinenPaavalinta.base_text;
            
            if (paavalintaAvainsana === 'tyokyky_alentunut' && state['custom-tyokyky_alentuma_kuvaus']) {
                paavalintaTeksti += ` ${state['custom-tyokyky_alentuma_kuvaus']}`;
            }
            
            if (paavalintaTeksti) generatedParts.push(paavalintaTeksti.trim());
        }

        // 2. ASIAKKAAN OMA ARVIO
        if (arvioKysymykset && arvioKysymykset.length > 0) {
            const arvioTekstit = arvioKysymykset
                .map(q => {
                    const vastaus = state[`custom-tyokyky_arvio_${q.id}`];
                    // KORJAUS: Ei enää tuplata etuliitettä, jos kysymyksen tekstissä lukee jo "arvio"
                    return vastaus ? `${q.teksti}: ${vastaus}` : null;
                })
                .filter(Boolean);
            
            if (arvioTekstit.length > 0) {
                // KORJAUS: Muutettu puskemaan teksti suoraan ilman ylimääräistä kovakoodattua "Asiakkaan oma arvio..." -lausetta
                generatedParts.push(`${arvioTekstit.join(', ')}.`);
            }
        }

        // 3. PALVELUOHJAUKSET JA TOIMENPITEET
        let valitutExtrat = [];
        try {
            if (state['custom-tyokyky_valitut_extrat']) {
                valitutExtrat = JSON.parse(state['custom-tyokyky_valitut_extrat']);
            }
        } catch(e) {}

        const palveluohjaukset = dbPhrases.filter(p => p.grouping_key === 'tyokyky_palveluohjaus' && valitutExtrat.includes(p.avainsana));
        if (palveluohjaukset.length > 0) {
            const palveluNimet = palveluohjaukset.map(p => (p.lyhyt || p.short_title || p.teksti || p.base_text).toLowerCase());
            generatedParts.push(`Asiakas ohjataan seuraaviin palveluihin: ${createListSentence(palveluNimet)}.`);
        }

        const toimenpiteet = dbPhrases.filter(p => (p.grouping_key === 'tyokyky_toimenpide' || p.grouping_key === 'toimenpide') && valitutExtrat.includes(p.avainsana));
        
        toimenpiteet.forEach(toim => {
            let toimTeksti = toim.teksti || toim.base_text || '';
            
            if (toim.muuttujat) {
                Object.keys(toim.muuttujat).forEach((vKey) => {
                    const savedValue = state[`custom-tyokyky_var_${toim.avainsana}_${vKey}`];
                    if (savedValue) {
                        toimTeksti = toimTeksti.replace(`[${vKey}]`, savedValue);
                    }
                });
            }
            
            // KORJAUS: Älykkäämpi tyhjien muuttujien ja roikkuvien sanojen siivous
            toimTeksti = toimTeksti
                .replace(/\s*\[.*?\]\s*"?mennessä"?/gi, '') // Poistaa tyhjän muuttujan ja siihen mahd. liittyvän "mennessä" -sanan
                .replace(/\s*\[.*?\]/g, '')                 // Poistaa muut tyhjät hakasulut
                .replace(/\s+"?mennessä"?\./gi, '.')        // Jos "mennessä" jäi silti orpona pisteen eteen
                .replace(/\s+/g, ' ')                       // Poistaa vahingossa jääneet tuplavälilyönnit
                .trim();

            if (toimTeksti) generatedParts.push(toimTeksti);
        });

        // 4. VAPAA SANA
        const vapaaSana = state['custom-tyokyky_lisatieto'] || '';
        if (vapaaSana.trim()) {
            generatedParts.push(vapaaSana.trim());
        }

        const yhdistettyLause = generatedParts.join(' ').replace(/\.\./g, '.').trim();
        return yhdistettyLause + (yhdistettyLause && !yhdistettyLause.endsWith('.') ? '.' : '');
        
    }, [state, dbPhrases, arvioKysymykset]);
};