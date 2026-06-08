import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, icon: Icon, children, footer, maxWidth = '900px' }) => {
    if (!isOpen) return null;

    return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content" style={{ maxWidth, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                
                {/* Header */}
                <div className="admin-modal-header" style={{ padding: '1.5rem 2rem' }}>
                    <h3 className="icon-heading text-primary" style={{ margin: 0 }}>
                        {Icon && <Icon size={20} />} {title}
                    </h3>
                    {onClose && (
                        <button onClick={onClose} className="modal-close-button" style={{ top: '1.5rem', right: '1.5rem' }}>
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Body (Vieritettävä sisältö) */}
                <div className="admin-modal-body-scroll" style={{ padding: '2rem', overflowY: 'auto' }}>
                    {children}
                </div>

                {/* Footer (Napit) */}
                {footer && (
                    <div className="admin-modal-footer" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;