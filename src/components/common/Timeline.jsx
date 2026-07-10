// --- src/components/common/Timeline.jsx ---
import React from 'react';
import { ArrowDown } from 'lucide-react';
import Badge from './Badge'; // Otetaan käyttöön teidän oma Badge!

/**
 * items: Array of objects { 
 * id: string,
 * title: string (esim. "Pankki-etäpäivä 18.11."), 
 * subtitle: string (esim. "Kuitattu ansiolla: Malminkatu 27.8."),
 * badgeText: string (esim. "Käytetty" tai "Ansaittu"),
 * badgeVariant: string ('success' | 'danger' | 'warning' | 'default' | 'primary')
 * }
 */
const Timeline = ({ items = [], className = '' }) => {
    if (!items || items.length === 0) {
        return (
            <div className="text-center text-secondary font-italic text-sm" style={{ padding: '1rem 0' }}>
                Ei kirjauksia aikajanalla.
            </div>
        );
    }

    return (
        <div className={`timeline-wrapper ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div key={item.id || index} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* Aikajanan rivi */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            backgroundColor: 'var(--color-background)', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '8px', 
                            border: '1px solid var(--color-border)' 
                        }}>
                            {/* Vasen laita: Tunniste/Badge */}
                            {item.badgeText && (
                                <div style={{ marginRight: '1rem', flexShrink: 0 }}>
                                    <Badge variant={item.badgeVariant || 'default'}>
                                        {item.badgeText}
                                    </Badge>
                                </div>
                            )}

                            {/* Keskiosa: Tekstitiedot */}
                            <div style={{ flexGrow: 1 }}>
                                <div className="fw-semibold text-md text-primary">{item.title}</div>
                                {item.subtitle && (
                                    <div className="text-secondary text-sm font-italic" style={{ marginTop: '2px' }}>
                                        {item.subtitle}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Liitosnuoli rivien välissä (ei tulosteta viimeisen jälkeen) */}
                        {!isLast && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                margin: '0.25rem 0 -0.25rem 0',
                                color: 'var(--color-border)',
                                zIndex: 2
                            }}>
                                <ArrowDown size={16} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default Timeline;