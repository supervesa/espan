import React from 'react';
import { ChevronDown } from 'lucide-react';

const Accordion = ({ title, children, defaultOpen = false }) => {
    return (
        <details className="modern-accordion" open={defaultOpen}>
            <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontWeight: '500' }}>
                {title}
                <ChevronDown size={16} className="accordion-icon" />
            </summary>
            <div className="discussion-content" style={{ padding: '1rem 0' }}>
                {children}
            </div>
        </details>
    );
};

export default Accordion;