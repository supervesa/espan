// --- src/components/sections/PalkkatukiCalculator/hooks/useSmartAnalysis.js ---
import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';

export const useSmartAnalysis = (state, ptState, ika, ehto24_28_tayttyy, ehto3kk_tayttyy, handleSupportToggle, onUpdatePalkkatuki) => {
    const analysis = useMemo(() => {
        const detected = [];
        const suggestions = [];
        const fullStateStr = JSON.stringify(state || {}).toLowerCase();
        
        const onkoAlentuma = fullStateStr.includes('alentuma') || fullStateStr.includes('haaste') || fullStateStr.includes('työkyky_alentunut') || fullStateStr.includes('tyokyky_alentunut') || fullStateStr.includes('sairausloma');

        if (ika && ika >= 55) detected.push(`Ikä 55+ vuotta (${ika} v)`);
        else if (ika && ika < 25) detected.push(`Alle 25-vuotias (${ika} v)`);
        if (ehto24_28_tayttyy) detected.push('24/28 kk ehto (730 pv) täyttyy');
        else if (ehto3kk_tayttyy) detected.push('3 kk työttömyysehto täyttyy (Helsinki-lisä)');
        if (onkoAlentuma) detected.push('Työkyvyn alentuma havaittu');

        const onkoYhdistys = ptState.tyonantaja_yhdistys;

        if (onkoAlentuma) {
            suggestions.push({
                label: 'Puolla 70 % tukea (Työkyvyn alentuma)', info: 'Vamman tai sairauden perusteella.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '70_tyokyky'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        if (ehto3kk_tayttyy && ptState.kotikunta_helsinki) {
            suggestions.push({
                label: 'Puolla Helsinki-lisää (50 %)', info: 'Helsinkiläinen, väh. 3 kk työttömyys.', icon: <MapPin size={18} />,
                action: () => { handleSupportToggle('helsinkilisa_puolletaan', 'helsinkilisa_puollettu', true); }
            });
        }
        if (ehto24_28_tayttyy && onkoYhdistys) {
            suggestions.push({
                label: 'Puolla 100 % tukea (Yhdistys / 24 kk)', info: '24/28 kk ehto täyttyy.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '100_yhdistys'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        if (ika >= 55 && ehto24_28_tayttyy) {
            suggestions.push({
                label: 'Puolla 55-vuotiaiden työllistämistukea', info: '70% tuki ikäperusteella.',
                action: () => { onUpdatePalkkatuki('puoltoTyyppi', '55_tuki'); handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', true); }
            });
        }
        return { detected, suggestions };
    }, [ika, ehto24_28_tayttyy, ehto3kk_tayttyy, state, ptState.tyonantaja_yhdistys, ptState.kotikunta_helsinki, handleSupportToggle, onUpdatePalkkatuki]);

    return analysis;
};