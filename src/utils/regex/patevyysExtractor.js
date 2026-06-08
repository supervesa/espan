// --- src/utils/regex/patevyysExtractor.js ---

export const extractPatevyydet = (text, dbPatevyydet = []) => {
    let remainingText = text;
    const foundPatevyydet = [];

    // Järjestetään pätevyydet pisimmästä lyhimpään, ettei "EA" vie osumaa "EA1":ltä
    const sortedPatevyydet = [...dbPatevyydet].sort((a, b) => b.nimi.length - a.nimi.length);

    sortedPatevyydet.forEach(patevyys => {
        // Luodaan regex, joka hakee kortin nimeä. 
        // Valinnainen loppu (?:[a-zäöå]+)? sallii esim. "Työturvallisuuskortti" tai "Työturvallisuuskortin"
        const cleanName = patevyys.nimi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapetaan erikoismerkit
        const regex = new RegExp(`\\b(${cleanName}(?:[a-zäöå]+)?)\\b`, 'gi');

        if (regex.test(remainingText)) {
            // Lisätään löytynyt kortti listaan (sama formaatti kuin ui odottaa)
            foundPatevyydet.push({ id: patevyys.id, nimi: patevyys.nimi });
            
            // Poistetaan löytö tekstistä, jotta siitä ei jää roskasanoja
            remainingText = remainingText.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
        }
    });

    return {
        remainingText,
        foundPatevyydet
    };
};