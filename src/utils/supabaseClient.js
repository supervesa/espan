import { createClient } from '@supabase/supabase-js';

// --- 1. VANHA PILVI-YHTEYS (Pysyy ennallaan) ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Vanhan Supabasen ympäristömuuttujat puuttuvat!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// --- 2. UUSI MAC MINI -YHTEYS (Macbase) ---
const macbaseUrl = import.meta.env.VITE_MACBASE_URL;
const macbaseAnonKey = import.meta.env.VITE_MACBASE_ANON_KEY;

if (!macbaseUrl || !macbaseAnonKey) {
    console.error('Macbasen ympäristömuuttujat puuttuvat!');
}

export const macbase = createClient(macbaseUrl, macbaseAnonKey, {
    db: {
        schema: 'espan' // Tämä ohjaa haut automaattisesti oikeaan huoneeseen
    }
});