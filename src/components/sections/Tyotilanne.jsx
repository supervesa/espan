import React, { useState, useMemo } from 'react';
import { PhraseOption } from '../PhraseOption';

const parseFinnishDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
};

const calculateMonthsDifference = (startDate) => {
    if (!startDate) return 0;
    const start = parseFinnishDate(startDate);
    if (!start) return 0;
    const now = new Date();
    const yearsDifference = now.getFullYear() - start.getFullYear();
    const monthsDifference = now.getMonth() - start.getMonth();
    const totalMonths = yearsDifference * 12 + monthsDifference;
    if (now.getDate() < start.getDate()) {
        return Math.max(0, totalMonths - 1);
    }
    return Math.max(0, totalMonths);
};

// Ota propsina myös planData ja knowledgeData
const Tyotilanne = ({ state, actions, planData, knowledgeData }) => {
    const sectionData = planData.aihealueet.find(s => s.id === 'tyotilanne');
    const { onSelect, onUpdateVariable, onUpdateCustomText } = actions;

    const [additionalInfo, setAdditionalInfo] = useState({});
    const handleAdditionalInfoChange = (key, value) => {
        setAdditionalInfo(prev => ({ ...prev, [key]: value }));
    };

    // Muutetaan Tietopankin A-TMT -ohjeet takaisin vanhan aTmtGuide-objektin muotoon!
    const aTmtGuide = useMemo(() => {
        const guide = {};
        if (knowledgeData) {
            knowledgeData.filter(k => k.category === 'A-TMT Ohjeet').forEach(item => {
                guide[item.title] = {
                    aTmtStatus: item.metadata?.aTmtStatus,
                    description: item.content_text,
                    legalNotes: item.metadata?.legalNotes,
                    requiredInfo: item.metadata?.requiredInfo || null,
                    priority: item.metadata?.priority || 0
                };
            });
        }
        return guide;
    }, [knowledgeData]);

    const aTmtRecommendation = useMemo(() => {
        const selectedAvainsanas = state.tyotilanne ? Object.keys(state.tyotilanne) : [];

        const tyonhakuAlkanut = state.suunnitelman_perustiedot?.tyonhaku_alkanut?.muuttujat?.PÄIVÄMÄÄRÄ;
        const unemploymentMonths = calculateMonthsDifference(tyonhakuAlkanut);

        if (selectedAvainsanas.length === 0) {
            return {
                recommendedStatus: "Ei valittu",
                justification: [],
                needsInfo: [],
                conflict: false,
                unemploymentDuration: unemploymentMonths
            };
        }

        let highestPriority = -1;
        let recommendedAvainsana = null;
        const justifications = [];
        let requiredInfos = new Set();
        let conflict = false;

        selectedAvainsanas.forEach(key => {
            const guide = aTmtGuide[key];
            if (guide && guide.priority > highestPriority) {
                highestPriority = guide.priority;
                recommendedAvainsana = key;
            }
        });

        selectedAvainsanas.forEach(key => {
            const guide = aTmtGuide[key];
            if (guide) {
                 if (guide.aTmtStatus && guide.description) justifications.push(`**${guide.aTmtStatus}:** ${guide.description}`);
                 if (guide.legalNotes) justifications.push(`*Laki:* ${guide.legalNotes}`);
                 if (guide.requiredInfo) {
                     guide.requiredInfo.forEach(infoKey => requiredInfos.add(infoKey));
                 }
            }
        });

        const finalNeedsInfo = new Set();
        const recommendedGuide = recommendedAvainsana ? aTmtGuide[recommendedAvainsana] : null;

        if (recommendedAvainsana) {
            if (recommendedGuide?.requiredInfo) {
                recommendedGuide.requiredInfo.forEach(infoKey => finalNeedsInfo.add(infoKey));
            }
            if (selectedAvainsanas.includes('osa_aikainen')) {
                finalNeedsInfo.add('tyoaika_h_vko');
                finalNeedsInfo.add('kesto_yli_2vko');
                finalNeedsInfo.add('sopimuksen_tyyppi');
            }
             if (selectedAvainsanas.includes('lomautettu')) {
                finalNeedsInfo.add('lomautuksen_tyyppi');
             }
        } else {
             requiredInfos.forEach(infoKey => finalNeedsInfo.add(infoKey));
        }

         if (selectedAvainsanas.includes('tyoton') && selectedAvainsanas.includes('palkkatuki')) {
             conflict = true;
             justifications.push("⚠️ **Ristiriita:** 'Työtön' ja 'Palkkatuella' eivät yleensä voi olla valittuna samanaikaisesti.");
         }

        return {
            recommendedStatus: recommendedGuide?.aTmtStatus || "Tarkista valinnat",
            justification: justifications,
            needsInfo: Array.from(finalNeedsInfo),
            conflict: conflict,
            unemploymentDuration: unemploymentMonths
        };
    }, [state.tyotilanne, state.suunnitelman_perustiedot, aTmtGuide]); // Lisätty aTmtGuide dependencyyn

    if (!sectionData) return null; // Varmistus renderöinnille

    return (
        <section className="section-container">
            <h2 className="section-title">{sectionData.otsikko}</h2>
            <div className="options-container">
                {sectionData.fraasit.map(phrase => {
                    const isSelected = state[sectionData.id]?.[phrase.avainsana];
                    const selectionState = isSelected ? state[sectionData.id][phrase.avainsana] : null;
                    return (
                        <PhraseOption
                            key={phrase.avainsana}
                            phrase={phrase}
                            section={sectionData}
                            isSelected={selectionState}
                            onSelect={onSelect}
                            onUpdateVariable={onUpdateVariable}
                        />
                    );
                })}
            </div>
             <div className="custom-text-container">
                <label htmlFor={`custom-text-${sectionData.id}`}>Lisätiedot tai omat muotoilut:</label>
                <textarea
                    id={`custom-text-${sectionData.id}`}
                    rows="3"
                    placeholder="Kirjoita tähän vapaata tekstiä..."
                    value={state[`custom-${sectionData.id}`] || ''}
                    onChange={(e) => onUpdateCustomText(sectionData.id, e.target.value)}
                />
            </div>

            <div className="guidance-box a-tmt-guidance">
                <h3>Ohje A-TMT-statuksen kirjaamiseen</h3>
                 <p className='info-note'>(Työttömyyden kesto n. {aTmtRecommendation.unemploymentDuration} kk)</p>
                {aTmtRecommendation.conflict && (
                    <p className="warning">⚠️ **Varoitus:** Valinnoissasi saattaa olla ristiriita. Tarkista tilanne.</p>
                )}
                <p>Valintojesi perusteella suositeltu A-TMT-status:</p>
                <p className="recommended-status"><strong>{aTmtRecommendation.recommendedStatus}</strong></p>

                {aTmtRecommendation.justification.length > 0 && (
                    <div className="justification">
                        <h4>Perustelut ja huomiot (PDF):</h4>
                        {aTmtRecommendation.justification.map((note, index) => (
                             <blockquote key={index}>
                                {note.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                                    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
                                    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
                                    return <React.Fragment key={i}>{part.split('\n').map((line, j)=><React.Fragment key={j}>{line}<br/></React.Fragment>)}</React.Fragment>;
                                })}
                             </blockquote>
                        ))}
                    </div>
                )}
                {aTmtRecommendation.needsInfo.length > 0 && (
                    <div className="additional-info-request">
                        <h4>Tarvittavat lisätiedot tarkennusta varten:</h4>
                        {aTmtRecommendation.needsInfo.includes('kesto_yli_2vko') && (
                            <div className="info-row">
                                <label>Kesto yli 2 vko?</label>
                                <select value={additionalInfo.kesto_yli_2vko || ''} onChange={(e) => handleAdditionalInfoChange('kesto_yli_2vko', e.target.value)}>
                                    <option value="">Valitse...</option>
                                    <option value="kylla">Kyllä</option>
                                    <option value="ei">Ei</option>
                                </select>
                            </div>
                        )}
                        {aTmtRecommendation.needsInfo.includes('kesto_yli_1kk') && (
                            <div className="info-row">
                                <label>Kesto yli 1 kk?</label>
                                 <select value={additionalInfo.kesto_yli_1kk || ''} onChange={(e) => handleAdditionalInfoChange('kesto_yli_1kk', e.target.value)}>
                                    <option value="">Valitse...</option>
                                    <option value="kylla">Kyllä</option>
                                    <option value="ei">Ei</option>
                                </select>
                            </div>
                        )}
                         {aTmtRecommendation.needsInfo.includes('tyoaika_h_vko') && (
                            <div className="info-row">
                               <label>Työaika (h/vko):</label>
                               <input type="number" min="0" value={additionalInfo.tyoaika_h_vko || ''} onChange={(e) => handleAdditionalInfoChange('tyoaika_h_vko', e.target.value)} placeholder="Tunnit"/>
                                {additionalInfo.tyoaika_h_vko !== undefined && additionalInfo.tyoaika_h_vko !== '' && parseInt(additionalInfo.tyoaika_h_vko) < 4 && <span className='info-note'>(Huom: Alle 4h/vko = JL työtön)</span>}
                            </div>
                        )}
                        {aTmtRecommendation.needsInfo.includes('lomautuksen_tyyppi') && (
                             <div className="info-row">
                                <label>Lomautuksen tyyppi:</label>
                                <select value={additionalInfo.lomautuksen_tyyppi || ''} onChange={(e) => handleAdditionalInfoChange('lomautuksen_tyyppi', e.target.value)}>
                                    <option value="">Valitse...</option>
                                    <option value="kokoaikainen">Kokoaikainen</option>
                                    <option value="lyhennetty_tyoaika">Lyhennetty työaika</option>
                                </select>
                             </div>
                         )}
                         {aTmtRecommendation.needsInfo.includes('sopimuksen_tyyppi') && (
                             <div className="info-row">
                                <label>Sopimuksen tyyppi:</label>
                                <select value={additionalInfo.sopimuksen_tyyppi || ''} onChange={(e) => handleAdditionalInfoChange('sopimuksen_tyyppi', e.target.value)}>
                                    <option value="">Valitse...</option>
                                    <option value="toistaiseksi">Toistaiseksi voimassa oleva</option>
                                    <option value="maaräaikainen">Määräaikainen</option>
                                    <option value="nollatunti">Nollatunti/Vaihteleva (ei taattuja)</option>
                                    <option value="vaihteleva_taattu">Vaihteleva (taatut min. tunnit)</option>
                                    <option value="puite">Puite/Runkosopimus</option>
                                </select>
                             </div>
                         )}
                         <p className='info-note'>Nämä lisätiedot auttavat A-TMT-kirjauksessa, mutta eivät tallennu tähän suunnitelmaan.</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default Tyotilanne;