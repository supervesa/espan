// --- src/utils/anonymizer.js ---

// 1. Säännölliset lausekkeet (Regex)
export const companyRegex = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(Oy|Oyj|Ab|Tmi|Ky|Ay|ry|säätiö|osuuskunta|kaupunki|kunta)\b/gi;
export const schoolRegex = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(yliopisto|lukio|ammattiopisto|amk|ammattikorkeakoulu|opisto|akatemia|koulu|koulutuskeskus|instituutti|aikuisopisto|kansanopisto)\b/gi;
export const hetuRegex = /\b\d{6}[A-Y+-]\d{3}[A-Z0-9]\b/gi;
export const dateRegex = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

// 2. Tunnistetaan, onko tekstissä korjattavaa
export const hasAnonymizationRisks = (text) => {
    if (!text) return false;
    return text.match(companyRegex) || text.match(schoolRegex) || text.match(hetuRegex) || text.match(dateRegex);
};

// 3. Generoidaan visuaalinen esikatselu-HTML
export const getHighlightedAnonymizationHTML = (text) => {
    if (!text) return '<span style="color: var(--color-text-muted); font-style: italic;">Liitä teksti alla olevaan kenttään nähdäksesi esikatselun...</span>';
    
    // XSS-suoja
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const greenStyle = 'background-color: #d1fae5; color: #065f46; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px solid #34d399; font-size: 0.85em; margin: 0 2px;';
    const redStyle = 'background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #f87171; font-size: 0.85em; margin: 0 2px; cursor: help;';
    const warningStyle = 'background-color: #fffbeb; color: #b45309; padding: 2px 4px; border-radius: 4px; font-weight: 600; border: 1px dashed #fbbf24; font-size: 0.85em; margin: 0 2px; cursor: help;';

    html = html.replace(/(\[ORGANISAATIO\]|\[OPPILAITOS\]|\[HETU\]|\[PVM: \d{2}\/\d{4}\])/g, `<span style="${greenStyle}">$1</span>`);
    html = html.replace(companyRegex, `<span style="${redStyle}" title="Tekoälylle ei tulisi lähettää työnantajien nimiä">$&</span>`);
    html = html.replace(schoolRegex, `<span style="${redStyle}" title="Tekoälylle ei tulisi lähettää oppilaitosten nimiä">$&</span>`);
    html = html.replace(hetuRegex, `<span style="${redStyle}" title="Sisältää henkilötunnuksen!">$&</span>`);
    html = html.replace(dateRegex, `<span style="${warningStyle}" title="Päivämäärä yksinkertaistetaan muotoon KK/VVVV">$&</span>`);

    return html.replace(/\n/g, '<br />');
};

// 4. Varsinainen puhdistustoiminto tekstikentälle
export const anonymizeText = (text) => {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(companyRegex, '[ORGANISAATIO]');
    cleaned = cleaned.replace(schoolRegex, '[OPPILAITOS]');
    cleaned = cleaned.replace(hetuRegex, '[HETU]');
    // Säilytetään kuukausi AI:n aikalaskuja varten
    cleaned = cleaned.replace(dateRegex, (match, d, m, y) => `[PVM: ${m.padStart(2, '0')}/${y}]`);
    return cleaned;
};