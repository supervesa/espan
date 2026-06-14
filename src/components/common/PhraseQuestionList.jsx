import React from 'react';

/**
 * Renderöi listan kysymyksiä phrases-taulun rakenteen mukaisesti siististi yhdellä rivillä.
 */
const PhraseQuestionList = ({ questions = [], answers = {}, onAnswerChange, filterFn }) => {
    
    const visibleQuestions = filterFn ? questions.filter(filterFn) : questions;

    if (visibleQuestions.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleQuestions.map((q) => {
                const currentAnswer = answers[q.phrase_key];
                
                return (
                    <div key={q.phrase_key} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', // Pakottaa tekstin vasemmalle ja napit oikealle
                        alignItems: 'center',            // Keskittää ne pystysuunnassa
                        padding: '12px 0', 
                        borderBottom: '1px solid var(--color-border)',
                        gap: '20px'                      // Varmistaa ettei teksti ja napit osu toisiinsa
                    }}>
                        <span style={{ 
                            fontSize: '0.875rem', 
                            color: 'var(--color-text-primary)', 
                            flex: 1,                      // Teksti vie kaiken vapaan tilan
                            lineHeight: '1.4'
                        }}>
                            {q.base_text}
                        </span>
                        
                        <div className="boolean-buttons" style={{ 
                            display: 'flex', 
                            gap: '6px', 
                            flexShrink: 0                // Estää nappeja pienenemästä
                        }}>
                            <button 
                                className={currentAnswer === true ? 'selected' : ''} 
                                onClick={() => onAnswerChange(q, true)}
                                style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                            >
                                Kyllä
                            </button>
                            <button 
                                className={currentAnswer === false ? 'selected' : ''} 
                                onClick={() => onAnswerChange(q, false)}
                                style={{ 
                                    padding: '6px 16px', 
                                    fontSize: '0.8rem',
                                    ...(currentAnswer === false ? { backgroundColor: 'var(--color-text-secondary)', color: 'white' } : {})
                                }}
                            >
                                Ei
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PhraseQuestionList;