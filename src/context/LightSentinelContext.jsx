// --- src/context/LightSentinelContext.jsx ---
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient'; // Varmista oikea polku

const LightSentinelContext = createContext();

export function LightSentinelProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [securitySignal, setSecuritySignal] = useState('GREEN');

    useEffect(() => {
        // 1. Haetaan istunto
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSessionState(session);
        });

        // 2. Kuunnellaan muutoksia
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            handleSessionState(currentSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 3. Hybridiajastin (Tarkistaa minuutin välein, onko lokaali aika umpeutunut)
    useEffect(() => {
        if (!session) return;

        const interval = setInterval(() => {
            const expiryStr = localStorage.getItem('espan_auth_expiry');
            if (expiryStr) {
                const expiry = parseInt(expiryStr, 10);
                if (Date.now() > expiry) {
                    console.log("Sentinel: Paikallinen istuntoaika umpeutui. Pakotetaan uloskirjaus.");
                    logout();
                }
            }
        }, 60000); // 60 sekuntia

        return () => clearInterval(interval);
    }, [session]);

    const handleSessionState = (currentSession) => {
        setSession(currentSession);
        if (currentSession) {
            fetchProfile(currentSession.user.id);
        } else {
            setProfile(null);
            setIsLoading(false);
        }
    };

    const fetchProfile = async (userId) => {
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Tarkistetaan moduulioikeus! (Jos 'jobs' on false, heitetään heti ulos)
            if (profileData && profileData.permissions?.jobs !== true) {
                console.warn("Sentinel: Käyttäjällä ei ole Espan-moduulin (jobs) käyttöoikeutta.");
                await logout();
                return;
            }

            let roleData = null;
            if (profileData?.role) {
                const { data } = await supabase
                    .from('role_permissions')
                    .select('*')
                    .eq('role', profileData.role)
                    .single();
                roleData = data;
            }

            if (profileData) {
                setProfile({
                    ...profileData,
                    role_permissions: roleData || { can_manage_users: false }
                });
            }
            setSecuritySignal('GREEN');
        } catch (err) {
            console.error("Virhe profiilin latauksessa:", err);
            setSecuritySignal('RED');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        localStorage.removeItem('espan_auth_expiry');
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
    };

    // Helpot apumuuttujat UI:ta varten
    const userRole = profile?.circle || 'expert'; // expert, supervisor, manager
    const isManager = profile?.role_permissions?.can_manage_users === true;

    return (
        <LightSentinelContext.Provider value={{ 
            session, 
            profile, 
            isLoading, 
            securitySignal,
            userRole,
            isManager,
            logout
        }}>
            {children}
        </LightSentinelContext.Provider>
    );
}

export const useLightSentinel = () => {
    const context = useContext(LightSentinelContext);
    if (context === undefined) {
        throw new Error('useLightSentinel pitää olla LightSentinelProviderin sisällä');
    }
    return context;
};