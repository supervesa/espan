// --- src/components/sections/TyollistymisenEdellytykset/MarkkinaArvioPaneeli.jsx ---

import React, { useState, useEffect, useMemo } from 'react';
import Checkbox from '../../common/Checkbox';
import OptionGroup from '../../common/OptionGroup';
import AlertBox from '../../common/AlertBox';
import Tag from '../../common/Tag';
import { useSmartText } from './useSmartText';

const MarkkinaArvioPaneeli = ({ data, updateData, dbPhrases, actions, globalSignals, masterState = {} }) => {
    const { buildMarkkinaArvioText } = useSmartText();
    
    const [onPitkittynyt, setOnPitkittynyt] = useState(false);
    const [mahdollisuudet, setMahdollisuudet] = useState(null);
    const [activeTags, setActiveTags] = useState([]);
    const [includeLanguageWarning, setIncludeLanguageWarning] = useState(false);

    const markkinaPhrases = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'este_markkina'), [dbPhrases]);

    // --- UUSI LISÄYS: Synkronoidaan imurin asettamat signaalit takaisin UI-valinnoiksi ---
    useEffect(() => {
        if (globalSignals && markkinaPhrases.length > 0) {
            const imuroidutTags = markkinaPhrases
                .filter(phrase => globalSignals[phrase.phrase_key] === true)
                .map(phrase => ({
                    id: phrase.phrase_key,
                    frag: phrase.base_text
                }));
                
            if (imuroidutTags.length > 0) {
                setActiveTags(prev => {
                    const prevIds = prev.map(t => t.id).sort().join(',');
                    const newIds = imuroidutTags.map(t => t.id).sort().join(',');
                    return prevIds === newIds ? prev : imuroidutTags;
                });
            }
        }
    }, [globalSignals, markkinaPhrases]);

    const laskettuKestoKk = useMemo(() => {
        const dateStr = masterState.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.['[PÄIVÄMÄÄRÄ]'] || 
                        masterState.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ || 
                        masterState.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PVM;

        if (!dateStr) return 0;
        let startDate = null;
        if (dateStr.includes('.')) { 
            const parts = dateStr.split('.');
            if (parts.length === 3) startDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else if (dateStr.includes('-')) { 
            startDate = new Date(dateStr);
        }

        if (startDate && !isNaN(startDate.getTime())) {
            const today = new Date();
            let months = (today.getFullYear() - startDate.getFullYear()) * 12;
            months -= startDate.getMonth();
            months += today.getMonth();
            if (today.getDate() < startDate.getDate()) months--;
            return Math.max(0, months);
        }
        return 0;
    }, [masterState.suunnitelman_perustiedot]);

    useEffect(() => {
        if (laskettuKestoKk >= 12) {
            setOnPitkittynyt(true);
            if (actions && actions.setSignal) actions.setSignal('PITKA_TYOTTOMYYS', true);
        } else if (laskettuKestoKk > 0 && laskettuKestoKk < 12) {
            setOnPitkittynyt(false);
            if (actions && actions.setSignal) actions.setSignal('PITKA_TYOTTOMYYS', false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [laskettuKestoKk]);

    const heikkoKieliAvain = Object.keys(globalSignals || {}).find(key => key.startsWith('language_fi_a') && globalSignals[key]);
    const isHeikkoSuomi = !!heikkoKieliAvain;
    const suomiTaso = heikkoKieliAvain ? heikkoKieliAvain.replace('language_fi_', '').toUpperCase().replace('_', '.') : '';

    useEffect(() => {
        if (actions && typeof actions.setSignal === 'function') {
            actions.setSignal('HEIKKO_SUOMEN_KIELI', isHeikkoSuomi);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHeikkoSuomi]);

    const handlePitkittynytChange = (val) => {
        setOnPitkittynyt(val);
        if (actions && actions.setSignal) actions.setSignal('PITKA_TYOTTOMYYS', val);
    };

    useEffect(() => {
        const tagFragments = activeTags.map(tag => tag.frag);
        let uusiTeksti = buildMarkkinaArvioText(
            onPitkittynyt,
            mahdollisuudet?.label,
            tagFragments
        );
        
        if (includeLanguageWarning) {
            uusiTeksti += " Puutteellinen suomen kielen taito kaventaa tällä hetkellä merkittävästi työllistymismahdollisuuksia avoimilla markkinoilla.";
        }
        
        uusiTeksti = uusiTeksti.replace(/Työllistymistä haastaa lisäksi\.?\s*$/i, '').trim();
        
        if (data.freeText.box2 !== uusiTeksti) {
            updateData('freeText', { ...data.freeText, box2: uusiTeksti });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onPitkittynyt, mahdollisuudet, activeTags, buildMarkkinaArvioText, includeLanguageWarning]);

    const mahdOptions = [
        { id: 'erinomaiset', label: 'Erinomaiset' },
        { id: 'kohtalaiset', label: 'Kohtalaiset' },
        { id: 'heikot', label: 'Heikot' }
    ];

    const toggleTag = (phrase_key, base_text) => {
        let newTags;
        let isNowActive = false;
        if (activeTags.some(t => t.id === phrase_key)) {
            newTags = activeTags.filter(t => t.id !== phrase_key);
            isNowActive = false;
        } else {
            newTags = [...activeTags, { id: phrase_key, frag: base_text }];
            isNowActive = true;
        }
        setActiveTags(newTags);
        if (actions && actions.setSignal) actions.setSignal(phrase_key, isNowActive);
    };

    return (
        <div className="panel-gray">
            <h3 className="subsection-title">2. Työllistymismahdollisuudet avoimilla markkinoilla</h3>

            {laskettuKestoKk >= 12 && (
                <AlertBox type="warning" customStyle={{ marginBottom: '1rem' }}>
                    <strong>Järjestelmähuomio:</strong> Asiakkaan työttömyys on kestänyt yli 12 kk ({laskettuKestoKk} kk). Pitkäaikaistyöttömyyden status on huomioitu arviossa automaattisesti.
                </AlertBox>
            )}

            {isHeikkoSuomi && !includeLanguageWarning && (
                <AlertBox type="warning" customStyle={{ marginBottom: '1rem' }}>
                    <strong>Osaamiskartoituksen huomio:</strong> Asiakkaan suomen kielen taito on arvioitu puutteelliseksi (Taso {suomiTaso}).
                    <button type="button" onClick={() => setIncludeLanguageWarning(true)} style={{ display: 'block', marginTop: '0.75rem', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,176,32,0.2)', border: '1px solid var(--color-warning)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        + Lisää kielimuuri arvioon
                    </button>
                </AlertBox>
            )}

            <div className="custom-checkbox-row" style={{ marginBottom: '1.5rem' }}>
                <Checkbox label="Asiakkaan työttömyys on pitkittynyt" checked={onPitkittynyt} onChange={handlePitkittynytChange} />
            </div>

            <label className="stat-label">Lähiaikojen työllistymismahdollisuudet (Lakisääteinen arvio)</label>
            <OptionGroup options={mahdOptions} selectedValue={mahdollisuudet?.id} onChange={setMahdollisuudet} />

            <label className="stat-label" style={{ marginTop: '1.5rem' }}>Markkinaesteet (Älypalkki)</label>
            <div className="chip-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {markkinaPhrases.map(phrase => {
                    const isActive = activeTags.some(t => t.id === phrase.phrase_key);
                    const tagType = isActive ? (phrase.signal_type === 'vahvuus' ? 'success' : 'warning') : 'primary';
                    return (
                        <div key={phrase.phrase_key} onClick={() => toggleTag(phrase.phrase_key, phrase.base_text)} style={{ cursor: 'pointer' }}>
                            <Tag type={tagType}>{isActive ? '✓' : '+'} {phrase.short_title}</Tag>
                        </div>
                    );
                })}
            </div>

            <label className="icon-label" style={{ marginTop: '1.5rem' }}>Asiantuntijan 33 § arvio</label>
            <textarea className="modern-input" value={data.freeText.box2} onChange={(e) => updateData('freeText', { ...data.freeText, box2: e.target.value })} placeholder="Työllistymistä avoimille markkinoille haastaa tällä hetkellä..." rows={4} />
        </div>
    );
};

export default MarkkinaArvioPaneeli;