// --- src/utils/dateUtils.js ---

export const parseFinnishDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (s.includes('T')) return new Date(s);
    if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return null;
};

export const toISODate = (val) => {
    const d = parseFinnishDate(val);
    if (!d || isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const calculateMonthsDifference = (startDate) => {
    if (!startDate) return 0;
    const start = parseFinnishDate(startDate);
    if (!start) return 0;
    const now = new Date();
    const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, diff);
};