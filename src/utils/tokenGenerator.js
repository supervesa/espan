export const generateGreetingToken = (appointmentDate, existingTokens = []) => {
    const date = new Date(appointmentDate);
    const month = date.getMonth(); // 0 = Tammi, 11 = Joulu

    // 1. Etusanat (Adjektiivit)
    const adjectives = [
        'Mukavaa', 'Oikein mukavaa', 'Hyvää', 'Oikein hyvää', 
        'Sujuvaa', 'Rauhallista', 'Valoisaa', 'Iloista'
    ];
    
    // 2. Vuodenajat (Valinnainen mauste)
    // Jätetään aina mukaan myös tyhjä vaihtoehto (''), jolloin lause on puhdas esim. "Mukavaa päivää"
    let seasonWords = ['']; 
    
    if (month >= 2 && month <= 4) { // Maalis - Touko
        seasonWords.push('keväistä', 'aurinkoista');
    } else if (month >= 5 && month <= 7) { // Kesä - Elo
        seasonWords.push('kesäistä', 'aurinkoista', 'lämmintä');
    } else if (month >= 8 && month <= 10) { // Syys - Marras
        seasonWords.push('syksyistä', 'kuulasta', 'värikästä');
    } else { // Joulu - Helmi (11, 0, 1)
        seasonWords.push('talvista', 'raikasta'); 
    }

    // 3. Neutraalit ajanjaksot (Substantiivit)
    const timeframes = [
        'päivää', 
        'päivän jatkoa', 
        'viikkoa', 
        'viikon jatkoa'
    ];

    // 4. Generoidaan kaikki mahdolliset yhdistelmät
    let allPossible = [];
    adjectives.forEach(adj => {
        seasonWords.forEach(season => {
            timeframes.forEach(time => {
                // Rakennetaan lause nätisti (jos season on tyhjä, ei tuoteta tuplavälilyöntejä)
                const phrase = season ? `${adj} ${season} ${time}` : `${adj} ${time}`;
                allPossible.push(phrase);
            });
        });
    });

    // 5. Poistetaan yhdistelmät, jotka asiantuntija on JO käyttänyt (estää duplikaatit ICS-linkityksessä)
    const usedLower = existingTokens.map(t => t?.toLowerCase().trim());
    const available = allPossible.filter(token => !usedLower.includes(token.toLowerCase()));

    // 6. Arvotaan jäljelle jääneistä yksi sattumanvarainen
    if (available.length === 0) {
        // Hätävara, jos päivälle tehdään yli 100 varausta ja kaikki sanat on käytetty
        return `Oikein hyvää päivän jatkoa ${Math.floor(Math.random() * 1000)}`;
    }
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
};