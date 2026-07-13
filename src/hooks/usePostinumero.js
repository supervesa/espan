import { useMemo } from 'react';

// Nämä ohjataan Viipurinkadulle vuoden 2026 loppuun asti
const VIIPURINKATU_POSTINUMEROT = [
    '00500', '00510', '00520', '00530', '00540', '00550', '00560'
];

// 1. PUHDAS LOGIIKKAFUNKTIO (Käytetään analytiikassa)
export const getAlueJaToimipiste = (postinumero) => {
    const defaultResult = { alue: 'Tuntematon', toimipiste: 'Malminkatu' };
    
    if (!postinumero || String(postinumero).length !== 5) {
        return defaultResult;
    }

    const cleanPostinro = String(postinumero);
    const prefix = cleanPostinro.substring(0, 3);
    
    let alue = 'Tuntematon';
    let toimipiste = 'Malminkatu';

    // Alueen päättely
    if (['001', '002', '005'].includes(prefix)) {
        alue = 'Keskinen';
    } else if (['003', '004'].includes(prefix)) {
        alue = 'Länsi';
    } else if (['006', '007'].includes(prefix)) {
        alue = 'Pohjoinen';
    } else if (['008', '009'].includes(prefix)) {
        alue = 'Itä';
    }

    // Toimipisteen päättely
    const currentYear = new Date().getFullYear();

    if (currentYear <= 2026 && VIIPURINKATU_POSTINUMEROT.includes(cleanPostinro)) {
        toimipiste = 'Viipurinkatu';
    } else if (alue === 'Itä') {
        toimipiste = 'Itäkeskus';
    } else {
        toimipiste = 'Malminkatu';
    }

    return { alue, toimipiste };
};

// 2. REACT HOOK (Käytetään komponenteissa)
export const usePostinumero = (postinumero) => {
    return useMemo(() => getAlueJaToimipiste(postinumero), [postinumero]);
};