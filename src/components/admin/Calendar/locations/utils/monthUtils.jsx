export const getMonthStart = (date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
};

export const getCalendarDays = (monthStart) => {
    const start = new Date(monthStart);
    const dayOfWeek = start.getDay(); 
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() - offset);
    
    const days = [];
    for (let i = 0; i < 42; i++) { 
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    return days;
};

export const formatDateLocal = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

// Uusi pomminvarma paikallisen ajan kääntäjä lomiin ja estoihin
export const getSafeLocalDayString = (dbString) => {
    if (!dbString) return '';
    const d = new Date(dbString);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

// Palautettu alkuperäinen funktio, jotta aiemmat importit eivät kaadu!
export const parseDBDateLocal = (dbString) => {
    if (!dbString) return { datePart: '', timeStr: '', isWholeDay: false };
    
    if (dbString.includes('00:00:00')) {
        return { datePart: dbString.substring(0, 10), timeStr: '00:00', isWholeDay: true };
    }
    
    const d = new Date(dbString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { datePart: `${year}-${month}-${day}`, timeStr: `${hours}:${minutes}`, isWholeDay: false };
};