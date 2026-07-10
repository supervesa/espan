// --- src/components/admin/PlanCalculator/useTargetCalculator.js ---
import { useMemo } from 'react';

export const useTargetCalculator = (latestSnapshot, unreportedPlans, kurotusViikot = 4, perusVanheneminen = 15) => {
    return useMemo(() => {
        if (!latestSnapshot || !latestSnapshot.asiakkaat_yht) return null;

        const salkku = latestSnapshot.asiakkaat_yht;
        const voimassaProsentti = latestSnapshot.voimassa_prosentti;
        const tavoiteProsentti = latestSnapshot.tavoite_prosentti;

        // 1. NÄYTTÖ: Karu todellisuus (Koko salkku)
        const kunnossaKpl = Math.round((salkku * voimassaProsentti) / 100);
        const vanhentuneetKpl = Math.max(0, salkku - kunnossaKpl);

        // 2. NÄYTTÖ: Operatiivinen Tavoite (Kiri)
        const tavoiteKpl = Math.round((salkku * tavoiteProsentti) / 100);
        
        // Puhdas vaje = Tavoite miinus nykyiset kunnossa olevat miinus jo Espanissa tehdyt uudet!
        const vajeKpl = Math.max(0, tavoiteKpl - kunnossaKpl - unreportedPlans);

        // 3. KAPASITEETTI: Mitä kalenterilta vaaditaan viikossa
        // Jaetaan vaje halutulle kurotusajalle (esim. 4 viikkoa)
        const kirinViikkotahti = vajeKpl > 0 ? Math.ceil(vajeKpl / kurotusViikot) : 0;
        
        // Lopullinen tilaus kalenterille = Perusylläpito + Kiri
        const kokonaisViikkotahti = perusVanheneminen + kirinViikkotahti;

        return {
            todellisuus: {
                salkku,
                kunnossaKpl,
                vanhentuneetKpl,
                perusVanheneminen
            },
            tavoite: {
                tavoiteKpl,
                vajeKpl,
                kurotusViikot,
                kirinViikkotahti,
                kokonaisViikkotahti
            }
        };
    }, [latestSnapshot, unreportedPlans, kurotusViikot, perusVanheneminen]);
};