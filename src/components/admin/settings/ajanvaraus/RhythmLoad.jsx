import React from 'react';
import Card from '../../../common/Card';
import AlertBox from '../../../common/AlertBox';
import { GitMerge, AlertTriangle, Zap, Activity, CalendarSync, ShieldAlert, Settings } from 'lucide-react';

const RhythmLoad = ({ valtuudet = {}, onUpdateValtuudet }) => {
    
    // Puretaan kategoriat auki (Varmistetaan tyhjien olioiden varalta oletukset)
    const tasapainotus = valtuudet?.tasapainotus || {};
    const ruuhkareaktiot = valtuudet?.ruuhkareaktiot || {};
    const ajanhallinta = valtuudet?.ajanhallinta || {};

    // Apufunktio käsittelemään syvälle upotetun JSON-olion päivityksen
    const handleChange = (kategoria, avain, arvo) => {
        const nykyinenKategoria = valtuudet[kategoria] || {};
        onUpdateValtuudet(kategoria, {
            ...nykyinenKategoria,
            [avain]: arvo
        });
    };

    return (
        <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '2px solid var(--color-border)' }}>
            
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 className="text-2xl fw-bold text-primary icon-heading" style={{ marginBottom: '0.5rem' }}>
                    <Settings size={28} /> Automaatio ja Kuormituksen hallinta
                </h2>
                <p className="text-base text-secondary lh-tight" style={{ maxWidth: '800px' }}>
                    Määritä säännöt, joiden puitteissa järjestelmä voi joustaa auki- ja varausajoista ruuhkan ja kausivaihtelun hallitsemiseksi. 
                    Mitä enemmän oikeuksia myönnät, sitä tiiviimmin automaatio pitää työviikkosi asetetussa tavoitetahdissa.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. LOHKO: Pitkän ajan rytmi */}
                <Card title="Liukuva tasapainotus" icon={CalendarSync} variant="default" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={tasapainotus.liukuva_tasaus_aktiivinen ?? false}
                                onChange={(e) => handleChange('tasapainotus', 'liukuva_tasaus_aktiivinen', e.target.checked)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-sm fw-semibold text-primary">Salli kalenterin liukuva tasaus</span>
                                <span className="text-xs text-secondary lh-tight mt-1">
                                    Järjestelmä saa siirtää normaalia ajanvarausta alkuperäisestä kohteesta, jos se purkaa kohdeviikon ähkyn ja sijoittuu hiljaisemmalle ajankohdalle.
                                </span>
                            </div>
                        </label>

                        {/* Näytetään alisäädöt vain, jos pääkytkin on päällä */}
                        {tasapainotus.liukuva_tasaus_aktiivinen && (
                            <div className="addon-child-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                
                                <div>
                                    <label className="icon-label mb-1 text-xs">Tasauksen aikaikkuna (+/- viikkoa)</label>
                                    <select 
                                        className="modern-select text-sm" 
                                        value={tasapainotus.tasaus_ikkuna_vko ?? 1} 
                                        onChange={(e) => handleChange('tasapainotus', 'tasaus_ikkuna_vko', parseInt(e.target.value, 10))}
                                    >
                                        <option value={1}>±1 viikko (Varovainen)</option>
                                        <option value={2}>±2 viikkoa (Tasapainottava)</option>
                                        <option value={3}>±3 viikkoa (Erittäin joustava)</option>
                                    </select>
                                </div>

                                <label className="custom-checkbox-row" style={{ padding: '0.2rem' }}>
                                    <input 
                                        type="checkbox" 
                                        className="modern-checkbox"
                                        checked={tasapainotus.hakeudu_kuoppiin ?? false}
                                        onChange={(e) => handleChange('tasapainotus', 'hakeudu_kuoppiin', e.target.checked)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span className="text-sm fw-semibold text-primary">Erääntyvien "Kaikututka"</span>
                                        <span className="text-xs text-secondary lh-tight mt-1">
                                            Hakeutuu aktiivisesti niille naapuriviikoille, joilla on poikkeuksellisen vähän aiempien poissaolojen aiheuttamia vanhentuvia asiakkuuksia.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>
                </Card>

                {/* 2. LOHKO: Ruuhkatilat ja pakotetut sijoitukset */}
                <Card title="Hätätilat & Ruuhkareaktiot" icon={AlertTriangle} variant="default" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    
                    <AlertBox type="warning" icon={ShieldAlert} customStyle={{ marginBottom: '1.25rem' }}>
                        <span className="fw-bold block text-sm">Ähkysuojaus (100% varattu)</span>
                        <span className="text-xs">Nämä luvat kytkeytyvät päälle ainoastaan silloin, kun kuluva viikko on lukittu tavoitemaksimin saavuttamisen myötä, mutta sääntö (esim. lakisääteinen 46 §) <strong>pakottaa</strong> järjestelmän löytämään ajan heti.</span>
                    </AlertBox>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={ruuhkareaktiot.uhraa_puskurit ?? false}
                                onChange={(e) => handleChange('ruuhkareaktiot', 'uhraa_puskurit', e.target.checked)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-sm fw-semibold text-primary">Uhraa kirjauspuskurit ruuhkassa</span>
                                <span className="text-xs text-secondary lh-tight mt-1">Järjestelmä poistaa oletetun puskurin nollaan (0 min) sijoittaessaan kriittistä asiakasta väliin.</span>
                            </div>
                        </label>

                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={ruuhkareaktiot.tiivista_tutut ?? false}
                                onChange={(e) => handleChange('ruuhkareaktiot', 'tiivista_tutut', e.target.checked)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-sm fw-semibold text-primary">Tiivistä tutut minimiin (Fast-track)</span>
                                <span className="text-xs text-secondary lh-tight mt-1">Jättää historiadata-keston huomioimatta ja puristaa keston tutulle rutiiniasiakkaalle oletusminimiin ruuhkapiikissä.</span>
                            </div>
                        </label>

                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={ruuhkareaktiot.vaihda_kanavaa_etaksi ?? false}
                                onChange={(e) => handleChange('ruuhkareaktiot', 'vaihda_kanavaa_etaksi', e.target.checked)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-sm fw-semibold text-primary">Salli ohitus etäkanavalle</span>
                                <span className="text-xs text-secondary lh-tight mt-1">Voi ehdottaa aikaa puheluna/videona etätyöpäivälle, vaikka kyseessä olisi normaali toimistoasiakkuus (lakisääteisiä lähivelvoitteita lukuunottamatta).</span>
                            </div>
                        </label>
                    </div>
                </Card>

                {/* 3. LOHKO: Uusi Holvidata ja Älykäs Kesto */}
                <Card title="Dynaaminen Ajanvaraus (Analytiikka)" icon={Activity} variant="bordered" style={{ backgroundColor: '#f8fafc', borderColor: 'var(--color-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Zap size={32} className="text-primary" />
                            <p className="text-xs fw-semibold text-primary lh-tight m-0">
                                Hyödynnä asiantuntijan työasemalle asennettua Data-holvia, joka kerää livenä tilastoa siitä, kuinka pitkiä tapaamiset ovat tosielämässä.
                            </p>
                        </div>

                        <hr style={{ borderColor: 'rgba(0,0,0,0.05)', margin: '0.5rem 0' }} />

                        <label className="custom-checkbox-row">
                            <input 
                                type="checkbox" 
                                className="modern-checkbox"
                                checked={ajanhallinta.salli_dynaamiset_kestot ?? false}
                                onChange={(e) => handleChange('ajanhallinta', 'salli_dynaamiset_kestot', e.target.checked)}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-sm fw-semibold text-primary">Salli dataperusteiset kestot</span>
                                <span className="text-xs text-secondary lh-tight mt-1">
                                    Ohittaa asetusvalikossa valitsemasi manuaaliset kellotusarviot (esim. 45 min). Ehdottaa kestoa laskennallisen mediaanin perusteella.
                                </span>
                            </div>
                        </label>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default RhythmLoad;