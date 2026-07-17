// --- src/components/sections/TyollistymisenEdellytykset/ElamantilannePaneeli.jsx ---

import React, { useState, useEffect, useMemo } from 'react';
import AlertBox from '../../common/AlertBox';
import Tag from '../../common/Tag';
import CopyButton from '../../common/CopyButton';
import { useSmartText } from './useSmartText';
import { formatFinnishList } from '../../../utils/textAggregator';
import { HeartPulse, Activity, FileText, Sparkles, Plus } from 'lucide-react';
import PalveluhistoriaNosto from './PalveluhistoriaNosto'; // UUSI LISÄYS: Tuodaan uusi komponentti!

const ElamantilannePaneeli = ({ data, updateData, dbPhrases, actions, globalSignals = {}, masterState = {} }) => {
    const { sniffText, buildSentence } = useSmartText();
    
    const [activeTags, setActiveTags] = useState([]);
    const [haistetutSignaalit, setHaistetutSignaalit] = useState([]);

    const elamaPhrases = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'este_elamantila'), [dbPhrases]);
    const vireillaOptions = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'etuus_vireilla'), [dbPhrases]);
    const hylattyOptions = useMemo(() => dbPhrases.filter(p => p.grouping_key === 'etuus_hylatty'), [dbPhrases]);

    // --- Synkronoidaan imurin asettamat signaalit takaisin UI-valinnoiksi ---
    useEffect(() => {
        if (globalSignals && elamaPhrases.length > 0) {
            const imuroidutTags = elamaPhrases
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
    }, [globalSignals, elamaPhrases]);

    const handleTextChange = (e) => {
        const text = e.target.value;
        updateData('freeText', { ...data.freeText, box3: text });
        setHaistetutSignaalit(sniffText(text, elamaPhrases));
    };

    const lisaaTekstiin = (uusiLause) => {
        if (!uusiLause) return;
        const vanhaTeksti = data.freeText.box3 || '';
        if (vanhaTeksti.includes(uusiLause)) return;
        
        const yhdistetty = vanhaTeksti ? `${vanhaTeksti}\n\n${uusiLause}` : uusiLause;
        updateData('freeText', { ...data.freeText, box3: yhdistetty.trim() });
    };

    const asiakasIka = useMemo(() => {
        const sv = masterState.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.['[SYNTYMÄVUOSI]'] || 
                   masterState.suunnitelman_perustiedot?.syntymavuosi?.muuttujat?.SYNTYMÄVUOSI;
        if (!sv) return null;
        const vuosi = parseInt(String(sv).replace(/\D/g, ''), 10);
        return vuosi ? new Date().getFullYear() - vuosi : null;
    }, [masterState.suunnitelman_perustiedot]);

    // Sanakirja oikeaoppiseen taivutukseen
    const TUKI_SANAKIRJA = {
        'asumistuki': 'asumistukea',
        'toimeentulotuki': 'toimeentulotukea',
        'sairauspäiväraha': 'sairauspäivärahaa',
        'kotihoidon tuki': 'kotihoidon tukea',
        'opintotuki': 'opintotukea',
        'yleistuki': 'yleistukea'
    };

    const koontiOsiot = useMemo(() => {
        let osiot = [];
        
        // 1. Työnhaun tilanteen selvitys
        const hakeeKokoaikatyota = Object.keys(globalSignals).some(k => k.toLowerCase().includes('kokoaikatyotyö') || k.toLowerCase().includes('kokoaika'));
        const hakeeEtuutta = Object.keys(globalSignals).some(k => k.toLowerCase().includes('työttömyysetuus') || k.toLowerCase().includes('etuus'));
        
        let hakuTeksti = '';
        if (hakeeKokoaikatyota && hakeeEtuutta) {
            hakuTeksti = "kokoaikatyötä ja työttömyysetuutta";
        } else if (hakeeKokoaikatyota) {
            hakuTeksti = "kokoaikatyötä";
        } else if (hakeeEtuutta) {
            hakuTeksti = "työttömyysetuutta";
        }

        // 2. Muiden tukien kokoaminen ja taivutus
        let muutTuetSet = new Set();
        const ttAnswers = masterState.tyottomyysturva?.answers || {};
        const muutTuetPhrases = dbPhrases.filter(p => p.grouping_key === 'muut_tuet');

        muutTuetPhrases.forEach(etuus => {
            const signalKey = etuus.metadata?.signal_key;
            if (ttAnswers[etuus.phrase_key] === true || (signalKey && globalSignals[signalKey] === true)) {
                let baseWord = etuus.short_title || etuus.base_text || '';
                if (baseWord.trim().length > 0) {
                    let perusNimi = baseWord.toLowerCase().trim();
                    
                    if (TUKI_SANAKIRJA[perusNimi]) {
                        muutTuetSet.add(TUKI_SANAKIRJA[perusNimi]);
                    } else {
                        let tukiNimi = perusNimi;
                        if (!tukiNimi.endsWith('a') && !tukiNimi.endsWith('ä')) {
                            tukiNimi += (tukiNimi.includes('ä') || tukiNimi.includes('y') || tukiNimi.includes('ö')) ? 'ä' : 'a';
                        }
                        muutTuetSet.add(tukiNimi);
                    }
                }
            }
        });

        const muutTuet = Array.from(muutTuetSet);
        
        // 3. Lauseen yhdistäminen nätiksi kokonaisuudeksi
        if (hakuTeksti && muutTuet.length > 0) {
            const tuetTekstina = formatFinnishList(muutTuet);
            osiot.push({ id: 'perus_yhdistetty', teksti: `Asiakas hakee ${hakuTeksti} sekä saa näiden lisäksi ${tuetTekstina}.` });
        } else if (hakuTeksti) {
            osiot.push({ id: 'perus', teksti: `Asiakas hakee ${hakuTeksti}.` });
        } else if (muutTuet.length > 0) {
            const tuetTekstina = formatFinnishList(muutTuet);
            osiot.push({ id: 'muut_tuet', teksti: `Asiakas saa ${tuetTekstina}.` });
        }

        // 4. Nuorisotakuu
        if (asiakasIka && asiakasIka < 25) {
            osiot.push({ id: 'nuorisotakuu', teksti: "Asiakas kuuluu ikänsä puolesta nuorisotakuun piiriin." });
        }

        return osiot;
    }, [globalSignals, asiakasIka, masterState.tyottomyysturva?.answers, dbPhrases]);

    const isTyokykyAlentunut = globalSignals['TYOKYKY_ALENTUNUT'] || masterState.tyokyky?.tyokyky_paavalinta === 'tyokyky_alentunut';
    const isTyokykySelvityksessa = globalSignals['TYOKYKY_SELVITYKSESSA'] || masterState.tyokyky?.tyokyky_paavalinta === 'tyokyky_selvityksessa';
    const hasDigiEste = globalSignals['puutteelliset_digitaidot'] || globalSignals['ei_pankkitunnuksia'] || masterState['custom-digitaidot'] === 'heikot';

    return (
        <div className="panel-gray">
            <h3 className="subsection-title">3. Elämäntilanne, toimintakyky ja etuushistoria</h3>
            
            <div className="grid-cols-2" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <label className="icon-label"><Activity size={18} /> Vireillä olevat hakemukset</label>
                    <select className="modern-select" onChange={(e) => lisaaTekstiin(vireillaOptions.find(p => p.phrase_key === e.target.value)?.base_text)} defaultValue="">
                        <option value="" disabled>Valitse vireillä oleva...</option>
                        {vireillaOptions.map(p => <option key={p.id} value={p.phrase_key}>{p.short_title}</option>)}
                    </select>
                </div>
                <div>
                    <label className="icon-label"><HeartPulse size={18} /> Hylätyt päätökset</label>
                    <select className="modern-select" onChange={(e) => lisaaTekstiin(hylattyOptions.find(p => p.phrase_key === e.target.value)?.base_text)} defaultValue="">
                        <option value="" disabled>Valitse hylätty päätös...</option>
                        {hylattyOptions.map(p => <option key={p.id} value={p.phrase_key}>{p.short_title}</option>)}
                    </select>
                </div>
            </div>

            {koontiOsiot.length > 0 && (
                <div className="smart-analysis-box" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(139, 92, 246, 0.03)', borderColor: 'var(--color-ai)', borderStyle: 'dashed' }}>
                    <div className="smart-analysis-header" style={{ color: 'var(--color-ai)', marginBottom: '12px' }}>
                        <Sparkles size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Esitäytettävä perustilanne (Valitse lisättävät)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {koontiOsiot.map(osio => (
                            <div key={osio.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563', fontStyle: 'italic' }}>{osio.teksti}</p>
                                <button type="button" onClick={() => lisaaTekstiin(osio.teksti)} className="btn btn--secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}><Plus size={14} /> Lisää</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* UUSI LISÄYS: Tuotu asiantuntijapalveluiden historia imurista */}
            <PalveluhistoriaNosto 
                services={masterState.services} 
                onInject={lisaaTekstiin} 
            />

            {(isTyokykyAlentunut || isTyokykySelvityksessa || hasDigiEste) && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(isTyokykyAlentunut || isTyokykySelvityksessa) && (
                        <AlertBox type="warning">
                            <strong>Työkykymoduuli:</strong> Asiakkaan työkyky on merkitty {isTyokykyAlentunut ? 'alentuneeksi' : 'selvitettäväksi'}.
                            <button type="button" onClick={() => lisaaTekstiin(isTyokykyAlentunut ? "Asiakkaalla on todettu osatyökykyisyys tai terveydellisiä rajoitteita." : "Asiakkaan työkyky on parhaillaan selvityksessä.")} className="btn-link" style={{marginLeft: '0.5rem'}}>+ Lisää arvioon</button>
                        </AlertBox>
                    )}
                    {hasDigiEste && (
                        <AlertBox type="warning">
                            <strong>Osaamiskartoitus:</strong> Asiakkaalla on merkitty puutteellisia digitaitoja tai puuttuva tunnistautuminen.
                            <button type="button" onClick={() => lisaaTekstiin("Sähköinen asiointi ja itsenäinen työnhaku ovat haastavia puutteellisten digitaitojen vuoksi.")} className="btn-link" style={{marginLeft: '0.5rem'}}>+ Lisää este arvioon</button>
                        </AlertBox>
                    )}
                </div>
            )}

            <label className="stat-label">Arjen konteksti (Haistelija)</label>
            <div className="chip-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {elamaPhrases.map(phrase => {
                    const isActive = activeTags.some(t => t.id === phrase.phrase_key);
                    const isSniffed = !isActive && haistetutSignaalit.includes(phrase.phrase_key);
                    return (
                        <div key={phrase.phrase_key} onClick={() => {
                            const newTags = isActive ? activeTags.filter(t => t.id !== phrase.phrase_key) : [...activeTags, { id: phrase.phrase_key, frag: phrase.base_text }];
                            setActiveTags(newTags);
                            if (actions?.onSelect) {
                                actions.onSelect(masterState.suunnitelman_perustiedot ? 'suunnitelman_perustiedot' : 'tyollistymisen_edellytykset', phrase.phrase_key, true);
                            }
                            const lause = buildSentence(newTags.map(t => t.frag), "Työllistymisen edellytyksiin vaikuttavat tällä hetkellä ", ".");
                            const currentText = data.freeText.box3.replace(/Työllistymisen edellytyksiin vaikuttavat tällä hetkellä.*?\./g, '').trim();
                            updateData('freeText', { ...data.freeText, box3: currentText ? `${lause}\n\n${currentText}`.trim() : lause });
                        }} style={{ cursor: 'pointer' }}>
                            <Tag type={isActive ? 'success' : 'primary'} customStyle={isSniffed ? { boxShadow: '0 0 0 3px rgba(255,176,32,0.4)' } : {}}>
                                {isActive ? '✓' : '+'} {phrase.short_title}
                            </Tag>
                        </div>
                    );
                })}
            </div>

            <label className="icon-label" style={{ marginTop: '1.5rem' }}><FileText size={18} /> Viranomaisteksti</label>
            <textarea className="modern-input" value={data.freeText.box3} onChange={handleTextChange} rows={5} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <CopyButton textToCopy={data.freeText.box3} label="Kopioi asiakirjaan" />
            </div>
        </div>
    );
};

export default ElamantilannePaneeli;