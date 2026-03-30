// --- src/components/sections/PalkkatukiCalculator/hooks/useTextGenerator.js ---
import { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabaseClient'; 
import { PALKKATUKI_LISAHUOMIOT } from '../../../../data/constants';

export const useTextGenerator = (ptState, tkCalc, isUnder25, onUpdatePalkkatuki) => {
    const [estoFraasi, setEstoFraasi] = useState('');

    useEffect(() => {
        const fetchFraasi = async () => {
            try {
                const { data, error } = await supabase
                    .from('phrases')
                    .select('base_text')
                    .eq('phrase_key', 'tyokokeilu_maksimi_taynna')
                    .single();
                if (data && !error) setEstoFraasi(data.base_text);
            } catch (err) {
                console.error("Virhe fraasin haussa:", err);
            }
        };
        fetchFraasi();
    }, []);

    const lisahuomiotStr = JSON.stringify(ptState.lisahuomiot || {});

    useEffect(() => {
        let lauseet = [];

        if (ptState.kirjaa_tyokokeilu_esto && estoFraasi && tkCalc.isMaxedOut) {
            const karenssiTxt = isUnder25 ? "3 kuukautta" : "12 kuukautta";
            lauseet.push(estoFraasi.replace('[KARENSSI_KK]', karenssiTxt));
        }

        if (ptState.palkkatuki_puolletaan || ptState.helsinkilisa_puolletaan || ptState.tyokokeilu_puolletaan) {
            if (ptState.helsinkilisa_puolletaan && ptState.palkkatuki_puolletaan) {
                let ptPeruste = "ammatillisen osaamisen puutteiden perusteella (50 %)";
                if (ptState.puoltoTyyppi === '100_yhdistys') ptPeruste = "yhdistykselle 24 kk työttömyyden perusteella (100 %)";
                if (ptState.puoltoTyyppi === '70_tyokyky') ptPeruste = "työkyvyn alentuman perusteella (70 %)";
                if (ptState.puoltoTyyppi === '55_tuki') ptPeruste = "55-vuotiaiden työllistämistukena";
                lauseet.push(`Asiakkaalle voidaan puoltaa valtion palkkatukea ${ptPeruste} tai vaihtoehtoisesti Helsinki-lisää (50 % palkkauskustannuksista, enintään 1500 €/kk).`);
                lauseet.push(`Huomioitavaa on, että tuet ovat toisensa poissulkevia, ja työnantaja voi saada vain toista näistä tuista kerrallaan. Helsinki-lisän myöntäminen edellyttää valtion palkkatuesta luopumista kyseisessä työsuhteessa.`);
            } else if (ptState.helsinkilisa_puolletaan) {
                const kesto = ptState.onko_oppisopimus ? "koko oppisopimuksen ajalle" : "enintään 12 kuukauden ajalle";
                lauseet.push(`Asiakkaalle voidaan myöntää Helsinki-lisä (50 % palkkauskustannuksista, enintään 1500 €/kk). Tukea myönnetään ${kesto}.`);
            } else if (ptState.palkkatuki_puolletaan) {
                let peruste = "ammatillisen osaamisen puutteiden perusteella (50 %)";
                if (ptState.puoltoTyyppi === '100_yhdistys') peruste = "yhdistykselle 24 kk työttömyyden perusteella (100 %)";
                if (ptState.puoltoTyyppi === '70_tyokyky') peruste = "työkyvyn alentuman perusteella (70 %)";
                if (ptState.puoltoTyyppi === '55_tuki') peruste = "55-vuotiaiden työllistämistukena";
                lauseet.push(`Asiakkaalle voidaan puoltaa palkkatukea ${peruste}.`);
            }
            if (ptState.tyokokeilu_puolletaan && !tkCalc.isMaxedOut) {
                const liite = lauseet.length > 0 ? "Lisäksi puolletaan " : "Asiakkaalle puolletaan ";
                const kestoTieto = tkCalc.remainingMonths > 0 ? ` enintään ${tkCalc.remainingMonths} kuukaudeksi` : '';
                lauseet.push(`${liite}työkokeilua${kestoTieto}.`);
            }
        }

        const currentHuomiot = ptState.lisahuomiot || {};
        const valitutHuomiot = Object.values(PALKKATUKI_LISAHUOMIOT).filter(h => currentHuomiot[h.id] === true).map(h => h.teksti);
        if (valitutHuomiot.length > 0) {
            const prefix = lauseet.length > 0 ? '\n\n' : '';
            lauseet.push(`${prefix}${valitutHuomiot.join(' ')}`);
        }

        let uusiKappale = lauseet.join(' ').trim();
        if (ptState.puoltoKappale !== uusiKappale) {
            onUpdatePalkkatuki('puoltoKappale', uusiKappale);
        }
    }, [ptState.palkkatuki_puolletaan, ptState.helsinkilisa_puolletaan, ptState.tyokokeilu_puolletaan, ptState.puoltoTyyppi, ptState.onko_oppisopimus, ptState.kirjaa_tyokokeilu_esto, estoFraasi, isUnder25, tkCalc.isMaxedOut, tkCalc.remainingMonths, ptState.puoltoKappale, lisahuomiotStr, onUpdatePalkkatuki]);
};