// --- src/utils/regex/core.js ---

// 1. HENKILÖ- JA YRITYSTIETOJEN TUNNISTUS (Anonymisointi)
export const HETU_PATTERN = /\b\d{6}[A-Y+-]\d{3}[A-Z0-9]\b/gi;
export const COMPANY_PATTERN = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(Oy|Oyj|Ab|Tmi|Ky|Ay|ry|säätiö|osuuskunta|kaupunki|kunta)\b/gi;
export const SCHOOL_PATTERN = /\b([A-ZÅÄÖ][a-zA-ZåäöÅÄÖ0-9]*[\s-]){1,4}(yliopisto|lukio|ammattiopisto|amk|ammattikorkeakoulu|opisto|akatemia|koulu|koulutuskeskus|instituutti|aikuisopisto|kansanopisto)\b/gi;

// 2. PÄIVÄMÄÄRÄ-VÄLIEN TUNNISTUS (esim. "15.01.2024 - 31.05.2024")
export const DATE_RANGE_PATTERN = /(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{4})/;
export const SINGLE_DATE_PATTERN = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

// Apufunktio: Suomi-pvm (16.6.2024) -> ISO-pvm (2024-06-16)
export const parseFinnishDateToISO = (finDate) => {
    if (!finDate) return null;
    const parts = finDate.split('.');
    if (parts.length !== 3) return null;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
};

// 3. TEKOÄLYN TEKSTIN PURKU (Ammatit ja Alat)
export const extractAIOccupations = (text) => {
    if (!text) return { esco: '', finesco: '' };
    
    const finescoEscoMatch = text.match(/alalle:\s*([^.]+)\.\s*Tarkempana tavoiteammattina on\s*([^.]+)\./i);
    const justEscoMatch = text.match(/tavoiteammattina on\s*([^.]+)\./i);
    const justFinescoMatch = text.match(/alalle:\s*([^.]+)\./i);

    let esco = ''; let finesco = '';
    
    if (finescoEscoMatch) {
        finesco = finescoEscoMatch[1].trim();
        esco = finescoEscoMatch[2].trim();
    } else if (justEscoMatch) {
        esco = justEscoMatch[1].trim();
    } else if (justFinescoMatch) {
        finesco = justFinescoMatch[1].trim();
    }

    return { esco, finesco };
};