// --- src/components/common/SortableList.jsx ---
import React from 'react';
import { ChevronUp, ChevronDown, Edit2 } from 'lucide-react';
import Button from './Button';
import Badge from './Badge'; // Tuodaan uusi Badge-komponentti (alla)

const SortableList = ({ items, onMoveUp, onMoveDown, onEdit, keyField = 'id', labelField = 'title' }) => {
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item, index) => (
                <div 
                    key={item[keyField]} 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--border-radius)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="text-base fw-semibold text-primary">{index + 1}.</span>
                        <div>
                            <div className="text-base fw-medium">{item[labelField]}</div>
                            {item.description && <div className="text-sm text-secondary">{item.description}</div>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {item.status && <Badge variant={item.status.type}>{item.status.label}</Badge>}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginRight: '0.5rem' }}>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                icon={ChevronUp} 
                                disabled={index === 0}
                                onClick={() => onMoveUp(item, index)} 
                                style={{ padding: '0.2rem' }}
                            />
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                icon={ChevronDown} 
                                disabled={index === items.length - 1}
                                onClick={() => onMoveDown(item, index)}
                                style={{ padding: '0.2rem' }}
                            />
                        </div>
                        
                        {onEdit && (
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                icon={Edit2} 
                                onClick={() => onEdit(item)} 
                            >
                                Muokkaa
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SortableList;