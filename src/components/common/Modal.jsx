import React, { useEffect } from 'react';
import { createPortal } from 'react-dom'; // Tarvitaan portalia varten
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, icon: Icon, children, footer, maxWidth = '900px' }) => {
    // Estetään taustan skrollaus kun modaali on auki
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    // Luodaan modaali Portalilla suoraan body-elementtiin
    return createPortal(
        <div 
            className="admin-modal-overlay" 
            style={{ 
                zIndex: 9999, // Varmistetaan äärimmäinen korkeus
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(2px)'
            }}
            onClick={onClose}
        >
            <div 
                className="admin-modal-content" 
                style={{ 
                    maxWidth, 
                    padding: 0, 
                    overflow: 'hidden', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    maxHeight: '90vh',
                    position: 'relative', // Tärkeä sulkunapin sijoittelulle
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    width: '95%'
                }} 
                onClick={e => e.stopPropagation()} // Estetään modaalin sulkeutuminen sisältöä klikatessa
            >
                
                {/* Header */}
                <div className="admin-modal-header" style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
                    <h3 className="icon-heading text-primary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {Icon && <Icon size={22} />} 
                        <span style={{ fontWeight: 700 }}>{title}</span>
                    </h3>
                    
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            className="modal-close-button" 
                            style={{ 
                                position: 'absolute',
                                top: '1.2rem',
                                right: '1.2rem',
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#64748b',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body (Vieritettävä sisältö) */}
                <div className="admin-modal-body-scroll" style={{ padding: '2rem', overflowY: 'auto', flexGrow: 1 }}>
                    {children}
                </div>

                {/* Footer (Napit) */}
                {footer && (
                    <div className="admin-modal-footer" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body // Kohde mihin modaali "lennätetään"
    );
};

export default Modal;