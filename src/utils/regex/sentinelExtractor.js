/**
 * SENTINEL EXTRACTOR
 * Poimii identiteetin kannalta kriittiset tiedot ennen muuta käsittelyä.
 */
export const extractSentinelData = (text) => {
    const results = {
        variables: {},
        signals: []
    };

    if (!text) return results;

    // 1. TYÖNHAUN ALKU
    const thAlkuRegex = /Asiakkaan\s+työnhaku\s+on\s+alkanut\s*(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const thMatch = text.match(thAlkuRegex);
    if (thMatch && thMatch[1]) {
        results.variables['tyonhaku_alkanut'] = thMatch[1];
    }

    // 2. KOTIKUNTA
    const kuntaRegex = /Asiakkaan\s+kotikunta\s+on\s+([A-ZÄÖÅ][a-zäöå-]+)/i;
    const kuntaMatch = text.match(kuntaRegex);
    if (kuntaMatch && kuntaMatch[1]) {
        results.variables['kotikunta'] = kuntaMatch[1].trim();
    }

  // 3. ÄIDINKIELI (Korjattu: Ei enää ahneita välilyöntejä, pysähtyy heti kielen nimen jälkeen)
    const kieliRegex = /Asiakkaan\s+äidinkieli\s+on\s+([a-zäöåA-ZÄÖÅ-]+)/i;
    const kieliMatch = text.match(kieliRegex);
    if (kieliMatch && kieliMatch[1]) {
        const kieli = kieliMatch[1].trim().toLowerCase();
        results.variables['aidinkieli'] = kieli;
        results.signals.push({ id: kieli, label: `Kieli: ${kieli}` });
    }

    // 4. SYNTYMÄVUOSI
    const svRegex = /(?:syntynyt\s+vuonna\s+|syntymävuosi\s*[:\s]\s*|s\.\s*)(\d{4})/i;
    const svMatch = text.match(svRegex);
    if (svMatch && svMatch[1]) {
        results.variables['syntymavuosi'] = svMatch[1];
    }

    // 5. LAADINTARIVI & TAPAAMISTAPA
    const laadittuRegex = /Tämä\s+suunnitelma\s+laadittiin\s+([^0-9]+)?(\d{1,2}\.\d{1,2}\.\d{4})/i;
    const laadittuMatch = text.match(laadittuRegex);
    
    if (laadittuMatch) {
        const tapaTeksti = laadittuMatch[1] ? laadittuMatch[1].toLowerCase() : '';
        const pvm = laadittuMatch[2];
        
        results.variables['edellinen_tapaaminen_pvm'] = pvm;
        
        // TÄMÄ PUUTTUI: Laitetaan päivämäärä takaisin näkyviin signaalina
        results.signals.push({ 
            id: 'edellinen_tapaaminen_pvm', 
            label: `Aiempi suunnitelma laadittu: ${pvm}` 
        });

        if (tapaTeksti.includes('puhelin')) {
            results.variables['yhteydenottotapa'] = 'PUHELIN';
            results.signals.push({ id: 'puhelin_tapaaminen', label: 'Tapa: Puhelin' });
        } else if (tapaTeksti.includes('käynti') || tapaTeksti.includes('kaynti')) {
            results.variables['yhteydenottotapa'] = 'KÄYNTI';
            results.signals.push({ id: 'kayntitapaaminen', label: 'Tapa: Käynti' });
        }
    }
    return results;
};