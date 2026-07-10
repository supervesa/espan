import React, { useState } from 'react';
import { 
    BrainCircuit, Calculator, Zap, Building, AlertCircle, Coins, 
    FileText, RotateCcw, MinusCircle, Briefcase, Copy, AlertTriangle, Info 
} from 'lucide-react';
import Modal from '../../common/Modal';
import NeutralAlert from '../../common/NeutralAlert'; // UUSI KOMPONENTTI TUOTU
import { OHJEET, PALKKATUKI_LISAHUOMIOT } from '../../../data/constants';

import { usePalkkatukiMath } from './hooks/usePalkkatukiMath';
import { useTyokokeiluMath } from './hooks/useTyokokeiluMath';
import { useSmartAnalysis } from './hooks/useSmartAnalysis';
import { useTextGenerator } from './hooks/useTextGenerator';
import { parseAnyDate } from './utils';

import './palkkatuki.css';

const PalkkatukiCalculator = ({ state, actions }) => {
    const { onUpdatePalkkatuki, onUpdateCustomText } = actions;
    const [showModal, setShowModal] = useState(false);
    const ptState = state.palkkatuki || {};

    const handleSupportToggle = (avain, signaaliNimi, isChecked) => {
        if(onUpdatePalkkatuki) onUpdatePalkkatuki(avain, isChecked);
        if (isChecked && actions.onAddSignal) actions.onAddSignal(signaaliNimi);
        else if (!isChecked && actions.onRemoveSignal) actions.onRemoveSignal(signaaliNimi);
    };

    const handleLisahuomioToggle = (id) => {
        const current = ptState.lisahuomiot || {};
        if(onUpdatePalkkatuki) onUpdatePalkkatuki('lisahuomiot', { ...current, [id]: !current[id] });
    };

    // Vastaanotetaan uudet tiedot Hookista
    const { 
        ika, 
        alkuperainenAlkuPvm, 
        perusKestoPv, 
        perusKestoTxt, 
        hyvaksytytPaivat, 
        ehto24_28_tayttyy, 
        ehto3kk_tayttyy,
        activeStartTxt,
        resetReason,
        isAutoReset
    } = usePalkkatukiMath(state, ptState, actions);

    const { tkCalc, isUnder25 } = useTyokokeiluMath(state, ika, ptState, actions);
    
    // HUOM: hyvaksytytPaivat lisätty tähän argumentiksi Smart Analysis 3.1:tä varten!
    const analysis = useSmartAnalysis(state, ptState, ika, ehto24_28_tayttyy, ehto3kk_tayttyy, hyvaksytytPaivat, tkCalc, handleSupportToggle, onUpdatePalkkatuki);
    
    useTextGenerator(ptState, tkCalc, isUnder25, onUpdatePalkkatuki);

    const tkText = ptState.tyokokeilu_historia || '';

    return (
        <>
            <section className="section-container">
                <div className="section-header">
                    <h2 className="section-title thv-section-title">
                        <Coins size={22} color="var(--color-primary)" /> Palkkatuki ja muut tuet
                    </h2>
                    <button onClick={() => setShowModal(true)} className="btn btn--secondary">Näytä ohjeet</button>
                </div>

                {/* 1. PALKKATUKI LASKURI */}
                <div className="side-bordered-panel">
                    <h3 className="icon-heading">
                        <Calculator size={20} /> Palkkatuen 24 / 28 kk Säännön Laskuri
                    </h3>
                    
                    {/* KORJATTU: Käytetään uutta, siistiä yhteiskomponenttia */}
                    {isAutoReset && (
                        <NeutralAlert title="Huomio!" className="mb-6">
                            Työttömyyden kesto on nollattu automaattisesti ({activeStartTxt}), koska asiakas on: <strong>{resetReason}</strong>. Alkupäivä oli alunperin {alkuperainenAlkuPvm}.
                        </NeutralAlert>
                    )}

                    <div className="grid-cols-2 mb-6">
                        <div>
                            <span className="stat-label">Laskettu ikä</span>
                            <strong className="stat-value">{ika !== null ? `${ika} vuotta` : 'Ei tiedossa'}</strong>
                        </div>
                        <div>
                            <span className="stat-label">
                                Laskennan alkupiste ({activeStartTxt || '-'})
                            </span>
                            <strong className="stat-value">{perusKestoTxt}</strong>
                        </div>
                    </div>

                    <div className="card-inner">
                        <div className="grid-cols-2">
                            <div>
                                <label className="icon-label" title="Ohittaa automaattisen laskennan">
                                    <RotateCcw size={16} color="var(--color-primary)" /> Manuaalinen nollaus (esim. sairaus)
                                </label>
                                <input type="text" placeholder="pp.kk.vvvv" className="form-input" value={ptState.nollausPvm || ''} onChange={(e) => onUpdatePalkkatuki('nollausPvm', e.target.value)} />
                            </div>
                            <div>
                                <label className="icon-label">
                                    <MinusCircle size={16} color="var(--color-warning)" /> Sallitut katkot (viim. 28 kk)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input type="number" placeholder="0" className="form-input" value={ptState.vahennysPv || ''} onChange={(e) => onUpdatePalkkatuki('vahennysPv', e.target.value)} style={{ width: '100px' }} />
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>päivää</span>
                                </div>
                            </div>
                        </div>
                        <div className="footer-row-dashed">
                            <div>
                                <span className="stat-label">Hyväksytty aika tarkastelujaksolla:</span>
                                <strong className="stat-value">Hyväksytty aika: {hyvaksytytPaivat} pv</strong>
                            </div>
                            <div>
                                {ehto24_28_tayttyy ? <span className="tag tag--success">24 kk ehto täyttyy</span> : (ehto3kk_tayttyy ? <span className="tag tag--warning">3 kk ehto täyttyy</span> : null)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. TYÖKOKEILUN LASKURI */}
                <div className="side-bordered-panel side-bordered-panel--alt">
                    <h3 className="icon-heading">
                        <Briefcase size={20} /> Työkokeilun 6 kk Säännön Laskuri (Laki 55 §)
                    </h3>

                    <div className="grid-cols-2">
                        <div className="flex-col-gap">
                            <div className="card-inner flex-grow">
                                <label className="icon-label">
                                    <Copy size={16} color="var(--color-primary)" /> Liitä aiemmat työkokeilut
                                </label>
                                <p className="stat-label">
                                    Järjestelmä etsii tekstistä historiajaksojen päivämääräparit.
                                </p>
                                <textarea 
                                    className="form-input text-mono" 
                                    rows="4" 
                                    placeholder="Liitä aiempi historia tähän..."
                                    value={tkText}
                                    onChange={(e) => onUpdatePalkkatuki('tyokokeilu_historia', e.target.value)}
                                />
                            </div>

                            {ptState.suunniteltu_tk_alku && ptState.suunniteltu_tk_loppu && (
                                <div className="card-inner-sm" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                                    <label className="custom-checkbox-row" style={{ margin: 0, padding: 0 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={ptState.huomioi_suunniteltu_tk !== false} 
                                            onChange={(e) => onUpdatePalkkatuki('huomioi_suunniteltu_tk', e.target.checked)} 
                                        />
                                        <div>
                                            <strong style={{ display: 'block', fontSize: '0.95rem' }}>Huomioi uusi suunniteltu kokeilu:</strong>
                                            <span style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                                                {parseAnyDate(ptState.suunniteltu_tk_alku)?.toLocaleDateString('fi-FI')} - {parseAnyDate(ptState.suunniteltu_tk_loppu)?.toLocaleDateString('fi-FI')}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex-col-gap">
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="stat-box">
                                    <span className="stat-label">Nollaussääntö ({isUnder25 ? 'Alle 25v' : 'Yli 25v'})</span>
                                    <strong className="stat-value" style={{ color: (tkCalc.periods.length === 0 || tkCalc.isReset) ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                                        {tkCalc.periods.length === 0 ? 'Ei aiempaa historiaa' : (tkCalc.isReset ? 'Nollautunut!' : `Vaatii ${isUnder25 ? '3 kk' : '12 kk'} tauon`)}
                                    </strong>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-label">Jäljellä</span>
                                    <strong className="stat-value-xl" style={{ color: tkCalc.isMaxedOut ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                                        {tkCalc.remainingMonths} kk
                                    </strong>
                                </div>
                            </div>
                            
                            {tkCalc.isMaxedOut && (
                                <div className="alert-box alert-box--warning">
                                    <div className="alert-box-content">
                                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <span className="alert-box-text">
                                            <strong>Työkokeilun enimmäiskesto (6 kk) on täyttynyt.</strong><br/>
                                            Uuden työkokeilun myöntäminen edellyttää, että asiakas on ollut vähintään {isUnder25 ? '3 kuukautta' : '12 kuukautta'} yhdenjaksoisesti työttömänä.
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => onUpdatePalkkatuki('kirjaa_tyokokeilu_esto', !ptState.kirjaa_tyokokeilu_esto)}
                                        className="btn btn--secondary alert-box-btn"
                                        style={{ 
                                            borderColor: ptState.kirjaa_tyokokeilu_esto ? 'var(--color-danger)' : 'var(--color-border)',
                                            color: ptState.kirjaa_tyokokeilu_esto ? 'var(--color-danger)' : 'var(--color-text-primary)'
                                        }}
                                    >
                                        <FileText size={16} /> 
                                        {ptState.kirjaa_tyokokeilu_esto ? 'Poista lainsäädäntöteksti asiakirjasta' : 'Kirjaa perustelu tulosteeseen'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. RATKAISUKESKUS 3.0 */}
                <div className="thv-resolution-hub">
                    <div className="thv-resolution-header">
                        <BrainCircuit size={22} /> Järjestelmän analyysi
                    </div>
                    
                    <div className="thv-resolution-grid">
                        <div className="thv-resolution-column">
                            <h4 className="thv-column-title">Havaitut kriteerit ja signaalit:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {analysis.detected.map((item, i) => (
                                    <div key={i} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                        fontSize: '0.85rem', fontWeight: '500', color: 'var(--color-text-primary)',
                                        backgroundColor: 'var(--color-background)', padding: '0.5rem', 
                                        borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' 
                                    }}>
                                        {item.icon} <span>{item.label}</span>
                                    </div>
                                ))}
                                {analysis.detected.length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>Ei erityisiä ehtoja havaittu vielä.</div>}
                            </div>
                        </div>
                        <div className="thv-resolution-column">
                            <h4 className="thv-column-title">Ratkaisuehdotukset:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {analysis.suggestions.map((sugg, i) => (
                                    <div key={i} className={`thv-suggestion-item status-${sugg.status}`} style={{ marginBottom: '0.5rem', opacity: sugg.status === 'blocked' ? 0.8 : 1 }}>
                                        {sugg.action ? (
                                            <button type="button" onClick={sugg.action} className="thv-action-button">
                                                {sugg.icon || <Zap size={18} />} {sugg.label}
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: sugg.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                {sugg.icon} {sugg.label}
                                            </div>
                                        )}
                                        <p className="thv-resolution-info" style={{ marginTop: '0.4rem', color: sugg.status === 'blocked' ? 'var(--color-danger)' : 'inherit' }}>
                                            {sugg.info}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. TARKENTAVAT TIEDOT */}
                <div className="questions-container">
                    <h3 className="icon-heading">
                        <Building size={20} /> Tarkentavat tiedot
                    </h3>
                    
                    <div className="grid-cols-2 mb-6">
                        <label className="custom-checkbox-row">
                            <input type="checkbox" checked={!!ptState.tyonantaja_yhdistys} onChange={(e) => onUpdatePalkkatuki('tyonantaja_yhdistys', e.target.checked)} />
                            Työnantaja on yhdistys/säätiö
                        </label>
                    </div>

                    <h4>Puollot</h4>
                    {ptState.palkkatuki_puolletaan && ptState.helsinkilisa_puolletaan && (
                        <div className="tag tag--warning" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <AlertCircle size={16} /> <strong>Huom:</strong> Valittu molemmat tuet – tulostetaan vaihtoehtoisina.
                        </div>
                    )}
                   <div className="flex-col-gap" style={{ gap: '0.5rem' }}>
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                checked={!!ptState.palkkatuki_puolletaan} 
                                onChange={(e) => handleSupportToggle('palkkatuki_puolletaan', 'palkkatuki_puollettu', e.target.checked)} 
                            />
                            Puolletaan valtion palkkatukea
                        </label>
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                checked={!!ptState.helsinkilisa_puolletaan} 
                                onChange={(e) => handleSupportToggle('helsinkilisa_puolletaan', 'helsinkilisa_puollettu', e.target.checked)} 
                            />
                            Puolletaan Helsinki-lisää (Väh. 3 kk työttömyys)
                        </label>
                        
                        <label className="custom-checkbox-row" style={{ opacity: tkCalc.isMaxedOut ? 0.5 : 1 }}>
                            <input 
                                type="checkbox" 
                                checked={!!ptState.tyokokeilu_puolletaan} 
                                disabled={tkCalc.isMaxedOut}
                                onChange={(e) => handleSupportToggle('tyokokeilu_puolletaan', 'tyokokeilu_puollettu', e.target.checked)} 
                            />
                            Puolletaan työkokeilua {tkCalc.remainingMonths > 0 && !tkCalc.isMaxedOut ? `(Max ${tkCalc.remainingMonths} kk)` : ''}
                        </label>
                        
                        <label className="custom-checkbox-row" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                            <input type="checkbox" checked={!!ptState.onko_oppisopimus} onChange={(e) => onUpdatePalkkatuki('onko_oppisopimus', e.target.checked)} />
                            Kyseessä on oppisopimus (Vaikuttaa Helsinki-lisän kestoon)
                        </label>
                    </div>

                    <h4>Lisäehdot ja huomiot</h4>
                    <div className="flex-col-gap" style={{ gap: '0.5rem' }}>
                        {Object.values(PALKKATUKI_LISAHUOMIOT).map(huomio => (
                            <label key={huomio.id} className="custom-checkbox-row">
                                <input type="checkbox" checked={!!ptState.lisahuomiot?.[huomio.id]} onChange={() => handleLisahuomioToggle(huomio.id)} />
                                {huomio.label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* 5. ESIKATSELU */}
                <div className="thv-locked-text-container">
                    <div className="thv-locked-text-header">
                        <FileText size={16} /> Esikatselu asiakirjaan
                    </div>
                    <div className="thv-locked-text-body" style={{ backgroundColor: 'var(--color-surface)', padding: '1.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)' }}>
                        {ptState.puoltoKappale || <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Tee valintoja yläpuolelta nähdäksesi tekstin...</span>}
                    </div>
                    <div className="custom-text-container" style={{ borderTop: 'none', paddingTop: '1rem', marginTop: '1rem' }}>
                        <textarea className="form-input" rows="3" placeholder="Vapaa sana..." value={state['custom-palkkatuki'] || ''} onChange={(e) => onUpdateCustomText('palkkatuki', e.target.value)} />
                    </div>
                </div>
            </section>

            <Modal show={showModal} onClose={() => setShowModal(false)} title="Helsinki-lisän ja palkkatuen ehdot">
                <div className="modal-content-inner">
                    <h5 style={{ color: 'var(--color-primary)' }}>Helsinki-lisä (Uudistunut)</h5>
                    <p>Helsinkiläiselle työttömälle, joka on ollut työtön vähintään 3 kuukautta.</p>
                    <ul style={{ paddingLeft: '1.5rem' }}>
                        <li>50 % palkkauskustannuksista, max. 1500 €/kk.</li>
                        <li>Kesto max 12 kk (oppisopimuksessa koko kesto).</li>
                        <li>Rajoitus: Ei voi yhdistää valtion palkkatukeen samanaikaisesti.</li>
                    </ul>
                    <hr />
                    {OHJEET.KAPPALEET.map((kappale, index) => (
                        <div key={index} style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ color: 'var(--color-primary)' }}>{kappale.otsikko}</h5>
                            {kappale.teksti && <p>{kappale.teksti}</p>}
                            {kappale.lista && (
                                <ul style={{ paddingLeft: '1.5rem' }}>
                                    {kappale.lista.map((item, i) => (
                                        <li key={i} dangerouslySetInnerHTML={{ __html: item }}></li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </Modal>
        </>
    );
};

export default PalkkatukiCalculator;