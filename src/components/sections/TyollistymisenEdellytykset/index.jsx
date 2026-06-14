// --- src/components/sections/TyollistymisenEdellytykset/index.jsx ---

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import TavoitteetPaneeli from './TavoitteetPaneeli';
import MarkkinaArvioPaneeli from './MarkkinaArvioPaneeli';
import ElamantilannePaneeli from './ElamantilannePaneeli';
import CopyButton from '../../common/CopyButton';

const TyollistymisenEdellytykset = ({ state, actions }) => {
    const [phrases, setPhrases] = useState([]);
    const [loading, setLoading] = useState(true);

    // Kootaan kaikki 3 paneelin tarvitsema data yhteen turvalliseen tilaan
    const [data, setData] = useState({
        escoNimi: state.asiakas?.tavoiteammatti_esco_nimi || '',
        finescoAla: state.asiakas?.tavoiteammatti_finesco_ala || '',
        vaihtoehtoisetAlat: [],
        tyottomyydenKestoKk: state.asiakas?.tyottomyyden_kesto_kk || 0,
        etuudet: { elake: 'none', kuntoutus: 'none' },
        freeText: { box1: '', box2: '', box3: '' }
    });

    const updateData = (key, value) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    // Haetaan juuri ne fraasit ja etuudet, joita nämä paneelit käyttävät
    useEffect(() => {
        const fetchPhrases = async () => {
            try {
                const { data: dbData, error } = await supabase
                    .from('phrases')
                    .select('*')
                    .in('grouping_key', ['vahvuus_haku', 'este_markkina', 'este_elamantila', 'etuus_vireilla', 'etuus_hylatty', 'muut_tuet']);
                
                if (!error && dbData) {
                    setPhrases(dbData);
                }
            } catch (e) {
                console.error("Virhe fraasien latauksessa", e);
            } finally {
                setLoading(false);
            }
        };
        fetchPhrases();
    }, []);

    // Synkronoidaan työttömyyden kesto suoraan asiakastiedoista
    useEffect(() => {
        const uusiKesto = state.asiakas?.tyottomyyden_kesto_kk;
        if (uusiKesto !== undefined && uusiKesto !== data.tyottomyydenKestoKk) {
            updateData('tyottomyydenKestoKk', uusiKesto);
        }
    }, [state.asiakas?.tyottomyyden_kesto_kk, data.tyottomyydenKestoKk]);

    // --- UUSI LISÄYS: IMUROIDUN VAPAAN TEKSTIN INJEKTIO ---
    // Tämä kuuntelee URA-imurin jättämää vapaata tekstiä ja sijoittaa sen "Viranomaisteksti"-kenttään (box3)
    useEffect(() => {
        const imuroituTeksti = state['custom-edellytykset'];
        
        if (imuroituTeksti && imuroituTeksti.trim().length > 0) {
            setData(prev => {
                const vanhaBox3 = prev.freeText.box3 || '';
                // Estetään saman tekstin lisäys uudelleen
                if (!vanhaBox3.includes(imuroituTeksti)) {
                    return {
                        ...prev,
                        freeText: {
                            ...prev.freeText,
                            box3: vanhaBox3 ? `${vanhaBox3}\n\n${imuroituTeksti}` : imuroituTeksti
                        }
                    };
                }
                return prev;
            });
            
            // Tyhjennetään globaali välimuisti, jotta teksti ei injektoidu uudelleen sivun päivittyessä
            if (actions && actions.onUpdateCustomText) {
                actions.onUpdateCustomText('edellytykset', '');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state['custom-edellytykset']]);

    // Kootaan kaikkien laatikoiden tekstit yhteen lennossa
    const koontiTeksti = `${data.freeText.box1}\n\n${data.freeText.box2}\n\n${data.freeText.box3}`.trim();

    // Synkronoidaan valmis 33 § koontiteksti globaaliin tilaan
    useEffect(() => {
        const nykyinenGlobaaliTeksti = state.customTexts?.edellytykset || '';
        
        if (actions && actions.onUpdateCustomText && koontiTeksti && koontiTeksti !== nykyinenGlobaaliTeksti) {
            // Emme tallenna koontia takaisin 'edellytykset'-avaimella, koska se sotkisi imuroinnin.
            // Tallennetaan se mieluummin valmiiksi arvioksi:
            actions.onUpdateCustomText('lopullinen_33_arvio', koontiTeksti);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [koontiTeksti]);

    if (loading) return <div className="section-container">Ladataan arviota ja tietokantaa...</div>;

    return (
        <section className="section-container">
            <div className="section-header">
                <h2 className="section-title thv-section-title">Työllistymisen edellytysten arviointi</h2>
            </div>

            {/* LAATIKKO 1 */}
            <TavoitteetPaneeli 
                data={data} 
                updateData={updateData} 
                dbPhrases={phrases} 
                actions={actions}
                globalSignals={state.signals || {}} 
                masterState={state} 
            />

            {/* LAATIKKO 2 */}
            <MarkkinaArvioPaneeli 
                data={data} 
                updateData={updateData} 
                dbPhrases={phrases} 
                actions={actions}
                globalSignals={state.signals || {}} 
                masterState={state} 
            />

            {/* LAATIKKO 3 */}
            <ElamantilannePaneeli 
                data={data} 
                updateData={updateData} 
                dbPhrases={phrases} 
                actions={actions}
                globalSignals={state.signals || {}} 
                masterState={state} 
            />

            {/* VIRALLINEN KOONTI-IKKUNA */}
            <div className="subsection" style={{ marginTop: '3rem', borderTop: '2px solid var(--color-primary)', paddingTop: '1.5rem' }}>
                <h3 className="subsection-title" style={{ color: 'var(--color-primary)' }}>Lopullinen 33 § asiantuntija-arvio</h3>
                <textarea 
                    className="modern-input" 
                    value={koontiTeksti}
                    readOnly
                    rows={12}
                    style={{ backgroundColor: '#F9FAFB', cursor: 'text' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <CopyButton textToCopy={koontiTeksti} label="Kopioi asiakirjaan" />
                </div>
            </div>
        </section>
    );
};

export default TyollistymisenEdellytykset;