// --- src/components/sections/PalkkatukiCalculator/utils.js ---

export const parseAnyDate = (val) => {
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