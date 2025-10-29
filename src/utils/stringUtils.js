// Aputoiminto: Muuttaa lauseen ensimmäisen kirjaimen pieneksi
export const toLowerFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
};

// Aputoiminto: Muodostaa listasta siistin lauseen (esim. "a, b ja c")
export const createListSentence = (items) => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' ja ');
    
    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return `${allButLast} ja ${last}`;
};
