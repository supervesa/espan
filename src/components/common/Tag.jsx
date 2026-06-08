import React from 'react';
import { X } from 'lucide-react';

const Tag = ({ children, type = 'primary', onRemove, customStyle = {} }) => {
    const className = `tag-dismissible tag-dismissible--${type}`;

    return (
        <span className={className} style={{ alignSelf: 'flex-start', ...customStyle }}>
            {children}
            {onRemove && (
                <button 
                    onClick={onRemove} 
                    className="btn-tag-dismiss" 
                    title="Poista tägi"
                >
                    <X size={14} />
                </button>
            )}
        </span>
    );
};

export default Tag;