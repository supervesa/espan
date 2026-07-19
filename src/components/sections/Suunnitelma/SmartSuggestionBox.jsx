import React, { useMemo } from 'react';
import { Briefcase, GraduationCap, HeartPulse, Rocket } from 'lucide-react';
import SmartResolutionHub from '../../common/SmartResolutionHub';

const SmartSuggestionBox = ({ activeSignals, dbPhrases, onTogglePath }) => {
    
    // 1. Muotoillaan näytettävät signaalit yhteistä komponenttia varten
    const displaySignals = useMemo(() => 
        Object.entries(activeSignals)
            .filter(([key, value]) => value && !key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i))
            .map(([key]) => ({ label: key.replace(/_/g, ' ') })), 
    [activeSignals]);

    // 2. Lasketaan polut (Sama vanha logiikka, siirrettynä tänne)
    const strategyPaths = useMemo(() => {
        const paths = {
            'A': { title: 'Työ edellä', icon: <Briefcase size={16} />, phrases: [] },
            'B': { title: 'Koulutus edellä', icon: <GraduationCap size={16} />, phrases: [] },
            'C': { title: 'Työkyky ja tuki', icon: <HeartPulse size={16} />, phrases: [] },
            'Y': { title: 'Yrittäjyys', icon: <Rocket size={16} />, phrases: [] }
        };

        dbPhrases.forEach(phrase => {
            if (phrase.triggerit && phrase.triggerit.length > 0) {
                phrase.triggerit.forEach(t => {
                    if (activeSignals[t.signal_key]) {
                        const path = paths[t.strategy_path];
                        if (path && !path.phrases.find(p => p.id === phrase.id)) {
                            path.phrases.push(phrase);
                        }
                    }
                });
            }
        });
        return paths;
    }, [dbPhrases, activeSignals]);

    // 3. Muutetaan datamuoto common-komponentille sopivaksi propsiksi
    const strategies = Object.entries(strategyPaths)
        .filter(([_, pathData]) => pathData.phrases.length > 0) // Näytetään vain jos on toimenpiteitä
        .map(([key, pathData]) => ({
            id: key,
            title: pathData.title,
            icon: pathData.icon,
            items: pathData.phrases.map(p => ({ id: p.id, label: p.lyhenne })),
            actionLabel: `Valitse polku ${key}`,
            onAction: () => onTogglePath(pathData.phrases)
        }));

    return (
        <SmartResolutionHub 
            signals={displaySignals}
            strategies={strategies}
        />
    );
};

export default SmartSuggestionBox;