import React, { useMemo } from 'react';
import { calculateMonthsDifference } from '../../../utils/dateUtils';

const ATmtGuidance = ({ currentSectionState, state, knowledgeData }) => {
    
    const aTmtGuide = useMemo(() => {
        const guide = {};
        if (knowledgeData) {
            knowledgeData.filter(k => k.category === 'A-TMT Ohjeet').forEach(item => {
                guide[item.phrase_key || item.title] = {
                    aTmtStatus: item.metadata?.aTmtStatus,
                    priority: item.metadata?.priority || 0
                };
            });
        }
        return guide;
    }, [knowledgeData]);

    const recommendation = useMemo(() => {
        const selectedKeys = Object.keys(currentSectionState || {}).filter(k => 
            currentSectionState[k] === true || (typeof currentSectionState[k] === 'object' && currentSectionState[k] !== null)
        );
        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        
        let highestPriority = -1;
        let recommendedKey = null;

        selectedKeys.forEach(key => {
            const guide = aTmtGuide[key];
            if (guide && guide.priority > highestPriority) {
                highestPriority = guide.priority;
                recommendedKey = key;
            }
        });

        return {
            status: aTmtGuide[recommendedKey]?.aTmtStatus || "Ei määritetty",
            months: calculateMonthsDifference(tyonhakuAlkanut)
        };
    }, [currentSectionState, state.suunnitelman_perustiedot, aTmtGuide]);

    return (
        <div className="guidance-box a-tmt-guidance">
            <p>A-TMT suositus: <strong className="recommended-status">{recommendation.status}</strong> ({recommendation.months} kk)</p>
        </div>
    );
};

export default ATmtGuidance;