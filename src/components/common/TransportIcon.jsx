// --- src/components/common/TransportIcon.jsx ---
import React from 'react';
import { Bus, Train, Car, Navigation, MapPin } from 'lucide-react';

const TransportIcon = ({ type = 'bussi', iconSize = 24, containerSize = 48, customStyle = {} }) => {
    // Määritellään värit ja ikonit kulkuneuvotyypin mukaan (Sidottu espan2.css teemaan!)
    const getConfig = () => {
        const t = type.toLowerCase();
        
        // JUNA/KAUKO: VR on violetti -> Käytetään teeman tekoäly-violettia (--color-ai)
        if (t.includes('juna') || t.includes('kauko')) return { 
            Icon: Train, 
            bg: 'rgba(139, 92, 246, 0.1)', // --color-ai läpinäkyvänä
            color: 'var(--color-ai)'       // Teeman violetti (#8b5cf6)
        }; 
        
        // METRO: Metro on oranssi -> Käytetään teeman pääväriä (--color-primary)
        if (t.includes('metro')) return { 
            Icon: Train, 
            bg: 'rgba(255, 107, 0, 0.1)',  // --color-primary läpinäkyvänä
            color: 'var(--color-primary)'  // Teeman oranssi (#ff6b00)
        }; 
        
        // RATIKKA: Ratikka on vihreä -> Käytetään teeman success-väriä (--color-success)
        if (t.includes('ratikka') || t.includes('raitiovaunu')) return { 
            Icon: Train, 
            bg: 'rgba(30, 154, 90, 0.1)',  // --color-success läpinäkyvänä
            color: 'var(--color-success)'  // Teeman vihreä (#1e9a5a)
        }; 
        
        // LÄHI/AUTO: Neutraali harmaa -> Käytetään teeman harmaita (--color-text-secondary)
        if (t.includes('lähi') || t.includes('auto')) return { 
            Icon: Car, 
            bg: 'var(--color-background)', // Teeman off-white tausta (#faf7f5)
            color: 'var(--color-text-secondary)' // Teeman harmaa (#6b7785)
        }; 
        
        // BUSSI (Oletus): Bussi on sininen -> Käytetään teeman info-väriä (--color-info-text)
        return { 
            Icon: Bus, 
            bg: 'rgba(37, 99, 235, 0.1)',  // --color-info-text läpinäkyvänä
            color: 'var(--color-info-text)' // Teeman sininen (#2563eb)
        };
    };

    const { Icon, bg, color } = getConfig();

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: `${containerSize}px`, 
            height: `${containerSize}px`, 
            borderRadius: '50%', 
            backgroundColor: bg, 
            color: color,
            flexShrink: 0,
            ...customStyle
        }}>
            <Icon size={iconSize} />
        </div>
    );
};

export default TransportIcon;