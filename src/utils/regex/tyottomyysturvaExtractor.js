/**
 * Työttömyysturvan ja tukien erikoistunut regex-purkaja.
 * Etsii tekstistä asiakkaan tilanteeseen liittyvät tuet ja velvollisuudet.
 */
export const extractTyottomyysturva = (text, dbPhrases = []) => {
    const answers = {};
    const foundPhrases = [];
    let remainingText = text;

    if (!text) return { answers, foundPhrases, remainingText };

    const targetGroupings = ['tt_ehdottomat', 'tt_yleiset', 'muut_tuet'];

    dbPhrases.forEach(phrase => {
        // Käsittele vain työttömyysturvaan liittyvät fraasit
        if (!targetGroupings.includes(phrase.grouping_key)) return;
        
        // Haetaan fraasin nimi/tunniste
        const title = (phrase.short_title || phrase.base_text || phrase.phrase_key || '').toLowerCase();
        let matchRegex = null;

        // Määritellään joustavat RegEx-säännöt eri tuille (hyväksyy esim. "opintotukea", "opintotuen")
        if (/opintotuk/i.test(title)) matchRegex = /opintotukea?/i;
        else if (/toimeentulotuk/i.test(title)) matchRegex = /toimeentulotukea?/i;
        else if (/yleistuk/i.test(title)) matchRegex = /yleistukea?/i;
        else if (/asumistuk/i.test(title)) matchRegex = /asumistukea?/i;
        else if (/sairauspäiväraha/i.test(title)) matchRegex = /sairauspäivärahaa?/i;
        else if (/kotihoidon/i.test(title)) matchRegex = /kotihoidon\s*tukea?/i;
        else if (/kokoaikatyöt/i.test(title)) matchRegex = /kokoaikatyötä?/i;
        else if (/työttömyysetuut/i.test(title)) matchRegex = /työttömyysetuutta?/i;
        else if (/rekisteröitynyt|ilmoittanut muutoksesta/i.test(title)) matchRegex = /(rekisteröitynyt|työnhakijaksi)/i;

        // Jos regex on määritelty ja teksti osuu siihen
        if (matchRegex && matchRegex.test(remainingText)) {
            const ttKey = phrase.phrase_key || phrase.id;
            answers[ttKey] = true;
            foundPhrases.push(phrase);
            
            // Emme tuhoa näitä sanoja tekstistä (remainingText.replace), 
            // koska lauseet kuten "saa opintotukea ja yleistukea" menisivät muodottomiksi.
            // On parempi vain rekisteröidä osuma.
        }
    });

    return { answers, foundPhrases, remainingText };
};