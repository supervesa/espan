// --- src/components/admin/ReportModal.jsx ---
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Button from '../common/Button';
import Modal from '../common/Modal';
import ProgressBar from '../common/ProgressBar';
import Timeline from '../common/Timeline';
import SummaryRow from '../common/SummaryRow';
import AdminAlert from '../common/AdminAlert';
import Accordion from '../common/Accordion';
import { FileSpreadsheet, Download, Calendar, Clock } from 'lucide-react';

// Apufunktio: Hakee kiinteät 14 päivän (2 viikon) jaksot
const getFixedPeriods = () => {
    const periods = [];
    const anchorDate = new Date('2026-01-05T00:00:00'); 
    const today = new Date();
    
    const diffTime = Math.abs(today - anchorDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentPeriodIndex = Math.floor(diffDays / 14);

    for (let i = currentPeriodIndex + 1; i >= currentPeriodIndex - 4; i--) {
        const start = new Date(anchorDate);
        start.setDate(start.getDate() + (i * 14));
        const end = new Date(start);
        end.setDate(end.getDate() + 13);

        const isCurrent = today >= start && today <= end;
        
        periods.push({
            id: `14d_${i}`,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            label: `${start.getDate()}.${start.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${start.getFullYear()} ${isCurrent ? '(Kuluva)' : '(Menneisyys)'}`,
            type: '14d'
        });
    }
    return periods;
};

// Apufunktio: Hakee kalenterikuukausien jaksot (esim. Heinäkuu, Kesäkuu)
const getMonthlyPeriods = () => {
    const periods = [];
    const today = new Date();
    
    // Luodaan viimeiset 4 kuukautta (sisältäen kuluvan)
    for (let i = 0; i < 4; i++) {
        const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-11
        const monthNameFi = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'][month];
        
        // Koko kuukausi
        const startFull = new Date(year, month, 1);
        const endFull = new Date(year, month + 1, 0); 
        
        periods.push({
            id: `month_${year}_${month}_full`,
            startDate: startFull.toISOString().split('T')[0],
            endDate: endFull.toISOString().split('T')[0],
            label: `${monthNameFi} ${year} (Koko kuukausi)`,
            shortLabel: `${monthNameFi} ${year}`, // Pikatägejä varten
            type: 'month',
            isCurrentMonth: i === 0
        });

        // Kuukauden alkupuolisko (1.-15.)
        const endHalf1 = new Date(year, month, 15);
        periods.push({
            id: `month_${year}_${month}_h1`,
            startDate: startFull.toISOString().split('T')[0],
            endDate: endHalf1.toISOString().split('T')[0],
            label: `${monthNameFi}n alkupuolisko (1.-15. pv)`,
            type: 'month'
        });

        // Kuukauden loppupuolisko (16. - loppu)
        const startHalf2 = new Date(year, month, 16);
        periods.push({
            id: `month_${year}_${month}_h2`,
            startDate: startHalf2.toISOString().split('T')[0],
            endDate: endFull.toISOString().split('T')[0],
            label: `${monthNameFi}n loppupuolisko (16. pv alkaen)`,
            type: 'month'
        });
    }
    return periods;
};

const ReportModal = ({ isOpen, onClose, expertId }) => {
    const [monthlyPeriods, setMonthlyPeriods] = useState([]);
    const [fixedPeriods, setFixedPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [generating, setGenerating] = useState(false);
    
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    // Eristetään pikatägejä varten vain ne objektit, jotka kuvaavat "Koko kuukautta" (max 3 kpl)
    const quickTagPeriods = monthlyPeriods.filter(p => p.id.endsWith('_full')).slice(0, 3);

    // 1. Alustetaan jaksot, kun modaali aukeaa
    useEffect(() => {
        if (isOpen) {
            const mPeriods = getMonthlyPeriods();
            const fPeriods = getFixedPeriods();
            setMonthlyPeriods(mPeriods);
            setFixedPeriods(fPeriods);
            // Valitaan oletuksena kuluvan kuukauden kokonaiskatsaus
            setSelectedPeriod(mPeriods[0]); 
        }
    }, [isOpen]);

    // 2. Haetaan data ja lasketaan esikatselu, kun jakso vaihtuu
    useEffect(() => {
        if (isOpen && selectedPeriod) {
            fetchPreviewData(selectedPeriod);
        }
    }, [isOpen, selectedPeriod]);

    const fetchPreviewData = async (period) => {
        setLoadingPreview(true);
        try {
            const [locRes, excRes, holidayRes, ledgerRes] = await Promise.all([
                supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', expertId).gte('date', period.startDate).lte('date', period.endDate),
                supabase.schema('espan').from('availability').select('*').eq('expert_id', expertId).gte('start_time', `${period.startDate} 00:00:00`).lte('start_time', `${period.endDate} 23:59:59`),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', period.startDate).lte('date', period.endDate),
                supabase.schema('espan').from('expert_remote_bank_ledger').select('*').eq('expert_id', expertId) 
            ]);

            const locations = locRes.data || [];
            const exceptions = excRes.data || [];
            const holidays = holidayRes.data || [];
            const ledgerAll = ledgerRes.data || [];

            let officeCount = 0;
            let remoteCount = 0;
            let workingDays = 0;
            let holidaysCount = 0;
            let blocksCount = 0;

            const startD = new Date(period.startDate);
            const endD = new Date(period.endDate);
            let totalCalendarWorkDays = 0;

            // A. Lasketaan päiväkohtainen "Nollavelka-aikabudjetti"
            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;

                totalCalendarWorkDays++;
                const dStr = d.toISOString().split('T')[0];
                const isHoliday = holidays.find(h => h.date === dStr);
                const isBlocked = exceptions.some(e => e.is_blocked && e.meeting_type === 'estetty' && e.start_time.startsWith(dStr));
                const loc = locations.find(l => l.date === dStr);

                if (isHoliday) {
                    holidaysCount++;
                } else if (isBlocked) {
                    blocksCount++;
                } else {
                    workingDays++;
                    if (loc) {
                        if (loc.location_type === 'lahityo') officeCount++;
                        if (loc.location_type === 'eta' || loc.location_type === 'eta_pankki') remoteCount++;
                    }
                }
            }

            const targetDays = Math.ceil(workingDays * 0.5);
            const percent = workingDays > 0 ? Math.round((officeCount / workingDays) * 100) : 0;

            // B. Eristetään tämän jakson sisäiset pankkitapahtumat
            const periodLedgerEvents = ledgerAll.filter(row => {
                if (row.transaction_type === -1 && row.used_date >= period.startDate && row.used_date <= period.endDate) return true;
                if (row.transaction_type === 1 && row.earned_date >= period.startDate && row.earned_date <= period.endDate) return true;
                return false;
            });

            // Rakennetaan niistä suoraan Timeline-komponentille sopiva taulukko
            const timelineItems = periodLedgerEvents.map(event => {
                if (event.transaction_type === -1) {
                    const linkedEarned = ledgerAll.find(r => r.id === event.linked_earned_id);
                    const earnedDateStr = linkedEarned?.earned_date ? linkedEarned.earned_date.split('-').reverse().join('.') : '??';
                    
                    const earnedText = linkedEarned ? `Perustuu kertyneeseen saldoon: ${earnedDateStr}` : 'Ei kohdistettua saldoa (Vanha data)';
                    
                    return {
                        id: event.id,
                        title: `Käytetty: ${event.used_date.split('-').reverse().join('.')}`,
                        subtitle: earnedText,
                        badgeText: 'Käytetty saldo',
                        badgeVariant: 'warning',
                        date: event.used_date
                    };
                } else {
                    return {
                        id: event.id,
                        title: `Kertynyt: ${event.earned_date.split('-').reverse().join('.')}`,
                        subtitle: event.description, // Säilytetään alkuperäinen kuvaus tietokannasta ("Uhrattu" jos vanha)
                        badgeText: 'Kertynyt saldo',
                        badgeVariant: 'success',
                        date: event.earned_date
                    };
                }
            }).sort((a, b) => new Date(a.date) - new Date(b.date));

            // C. Lasketaan tiliotteen kokonaissaldot jaksolle
            const balanceStart = ledgerAll.filter(row => {
                const dateToCheck = row.transaction_type === -1 ? row.used_date : row.earned_date;
                return dateToCheck && dateToCheck < period.startDate;
            }).reduce((sum, row) => sum + row.transaction_type, 0);

            const earnedInPeriod = periodLedgerEvents.filter(r => r.transaction_type === 1).length;
            const usedInPeriod = periodLedgerEvents.filter(r => r.transaction_type === -1).length;
            const balanceEnd = balanceStart + earnedInPeriod - usedInPeriod;

            setPreviewData({
                officeCount, remoteCount, workingDays, holidaysCount, blocksCount, targetDays, percent, totalCalendarWorkDays,
                timelineItems, balanceStart, balanceEnd, earnedInPeriod, usedInPeriod,
                raw: { locations, exceptions, holidays, ledgerAll } 
            });

        } catch (error) {
            console.error("Virhe esikatselun latauksessa:", error);
        } finally {
            setLoadingPreview(false);
        }
    };

    const generateExcelCSV = () => {
        if (!selectedPeriod || !previewData) return;
        setGenerating(true);

        try {
            const { locations, exceptions, holidays, ledgerAll } = previewData.raw;
            let csvContent = "Päivämäärä;Viikonpäivä;Sijainti;Lisätieto\n";

            const startD = new Date(selectedPeriod.startDate);
            const endD = new Date(selectedPeriod.endDate);
            const weekdaysFi = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];

            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;

                const dStr = d.toISOString().split('T')[0];
                const displayDate = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
                const weekdayName = weekdaysFi[dayOfWeek];

                const isHoliday = holidays.find(h => h.date === dStr);
                const isBlocked = exceptions.some(e => e.is_blocked && e.meeting_type === 'estetty' && e.start_time.startsWith(dStr));
                const loc = locations.find(l => l.date === dStr);

                let locationName = "";
                let info = "";

                if (isHoliday) {
                    locationName = "Pyhä";
                    info = isHoliday.name;
                } else if (isBlocked) {
                    locationName = "Loma / Poissa";
                    info = "(Kalenteriin merkitty kokopäiväinen esto)";
                } else {
                    if (loc) {
                        locationName = loc.location_name;
                        
                        if (loc.location_type === 'eta_pankki') {
                            const ledgerUsed = ledgerAll.find(r => r.transaction_type === -1 && r.used_date === dStr);
                            if (ledgerUsed && ledgerUsed.linked_earned_id) {
                                const linkedEarned = ledgerAll.find(r => r.id === ledgerUsed.linked_earned_id);
                                if (linkedEarned) {
                                    info = `Käytetty etäpäiväsaldo (Perustuu saldoon: ${linkedEarned.earned_date.split('-').reverse().join('.')})`;
                                } else {
                                    info = "Käytetty etäpäiväsaldo";
                                }
                            } else {
                                info = "Käytetty etäpäiväsaldo";
                            }
                        }

                        const dayAppointments = exceptions.filter(e => !e.is_blocked && e.start_time.startsWith(dStr));
                        if (dayAppointments.length > 0) {
                            const contactMethods = dayAppointments.map(e => e.contact_method);
                            const hasKaynti = contactMethods.includes('kaynti');
                            const hasPuhelu = contactMethods.includes('puhelu');
                            
                            let aptText = "";
                            if (hasKaynti && hasPuhelu) aptText = "Sisältää lähi- ja etätapaamisia";
                            else if (hasKaynti) aptText = "Sisältää lähitapaamisen";
                            else if (hasPuhelu) aptText = "Sisältää etätapaamisen / puhelun";
                            
                            info = info ? `${info} | ${aptText}` : aptText;
                        }

                    } else {
                        locationName = "Ei merkintää";
                    }
                }

                csvContent += `${displayDate};${weekdayName};${locationName};${info}\n`;
            }

            csvContent += `\n`;
            csvContent += `YHTEENVETO (${previewData.totalCalendarWorkDays} pv jakso)\n`;
            csvContent += `Aktiiviset työpäivät (pyhät/lomat vähennetty);${previewData.workingDays}\n`;
            csvContent += `Lähityöpäivät;${previewData.officeCount}\n`;
            csvContent += `Etätyöpäivät;${previewData.remoteCount}\n`;
            csvContent += `Hyvitetyt etäpäivät (Käytetty saldo);${previewData.usedInPeriod}\n`;
            csvContent += `Lähityövaatimus (50%);${previewData.targetDays}\n`;
            csvContent += `Toteutunut lähityöaste (saldot huomioitu);${previewData.percent} %\n`;

            csvContent += `\n`;
            csvContent += `ETÄPÄIVÄPANKIN TILIOTE TÄLLÄ JAKSOLLA\n`;
            csvContent += `Saldo jakson alussa;${previewData.balanceStart} pv\n`;
            csvContent += `Kertynyt jaksolla;+${previewData.earnedInPeriod} pv\n`;
            csvContent += `Käytetty jaksolla;-${previewData.usedInPeriod} pv\n`;
            csvContent += `Saldo jakson lopussa;${previewData.balanceEnd} pv\n`;

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const fileNameDate = selectedPeriod.type === 'month' ? selectedPeriod.label.replace(/[^a-z0-9äö]/gi, '_').toLowerCase() : selectedPeriod.startDate;
            link.setAttribute("download", `Toteuma_${fileNameDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            onClose(); 

        } catch (error) {
            console.error("Virhe CSV:n luonnissa:", error);
            alert("Virhe tiedoston luonnissa.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSelectChange = (e) => {
        const value = e.target.value;
        const found = [...monthlyPeriods, ...fixedPeriods].find(p => p.id === value);
        if (found) setSelectedPeriod(found);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Lataa jakson toteuma" 
            icon={FileSpreadsheet} 
            maxWidth="800px"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Sulje</Button>
                    <Button variant="primary" icon={Download} onClick={generateExcelCSV} disabled={generating || loadingPreview || !previewData}>
                        {generating ? 'Luodaan tiedostoa...' : 'Lataa Excel (.csv)'}
                    </Button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. YLÄOSA: Pikatägit ja Jakson valinta */}
                <div style={{ backgroundColor: 'var(--color-surface)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    
                    {/* Pikatägit kuukausille */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <Clock size={16} className="text-secondary" />
                        <span className="text-sm fw-semibold text-secondary">Pikavalinnat (Kuukausitaso):</span>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {quickTagPeriods.map(p => (
                                <button
                                    key={`quick_${p.id}`}
                                    onClick={() => setSelectedPeriod(p)}
                                    className={`chip ${selectedPeriod?.id === p.id ? 'chip--active' : ''}`}
                                >
                                    {p.shortLabel} {p.isCurrentMonth && '(Kuluva)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 -1.25rem 1.25rem -1.25rem' }} />

                    {/* Tarkempi pudotusvalikko */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ minWidth: '150px' }}>
                            <label className="text-sm fw-semibold text-primary mb-1 block">Tarkempi rajaus</label>
                            <span className="text-xs text-secondary">Etsi muu jakso luettelosta</span>
                        </div>
                        <div style={{ flexGrow: 1 }}>
                            <select 
                                className="modern-select" 
                                value={selectedPeriod?.id || ''} 
                                onChange={handleSelectChange}
                            >
                                <optgroup label="Kuukausitoteumat (Arkipäivät)">
                                    {monthlyPeriods.map(p => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Juoksevat 14 pv jaksot (Liukuva)">
                                    {fixedPeriods.map(p => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. ESIKATSELU */}
                {loadingPreview ? (
                    <div className="text-center text-secondary" style={{ padding: '4rem 0' }}>Ladataan ja lasketaan esikatselua...</div>
                ) : previewData ? (
                    <div className="view-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Prosenttipalkki ja varoitukset */}
                        <div>
                            <ProgressBar 
                                value={previewData.percent} 
                                target={50} 
                                label="Lähityöaste (Toteuma)" 
                                subLabel={`${previewData.officeCount} / ${previewData.targetDays} pv (Aktiivisia päiviä: ${previewData.workingDays})`} 
                            />
                            
                            {previewData.percent < 50 && (
                                <AdminAlert type="warning" className="mt-3">
                                    <strong>Huomio:</strong> Lähityöaste jää alle 50 % tavoitteen. Varmista, että olet hyödyntänyt kertyneitä etäpäiviä tämän vajeen kattamiseksi.
                                </AdminAlert>
                            )}
                        </div>

                        {/* 2-palstainen asettelu: Aikabudjetti ja Tiliote */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            
                            {/* Vasen: Aikabudjetti */}
                            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                                <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}>Jakson aikabudjetti</h4>
                                <SummaryRow label={`Kalenteripäivät (ma-pe)`} value={`${previewData.totalCalendarWorkDays} pv`} borderTop={false} />
                                <SummaryRow label="Kansalliset pyhät" value={`-${previewData.holidaysCount} pv`} iconColor={previewData.holidaysCount > 0 ? "var(--color-danger)" : "var(--color-text-secondary)"} />
                                <SummaryRow label="Merkityt lomat/estot" value={`-${previewData.blocksCount} pv`} iconColor={previewData.blocksCount > 0 ? "var(--color-danger)" : "var(--color-text-secondary)"} />
                                <SummaryRow label="Aktiiviset työpäivät" value={`${previewData.workingDays} pv`} />
                            </div>

                            {/* Oikea: Pankkitilanne */}
                            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                                <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}>Etäpäiväpankki</h4>
                                <SummaryRow label="Saldo jakson alussa" value={`${previewData.balanceStart} pv`} borderTop={false} />
                                <SummaryRow label="Kertynyt tällä jaksolla" value={`+${previewData.earnedInPeriod} pv`} iconColor="var(--color-success)" />
                                <SummaryRow label="Käytetty tällä jaksolla" value={`-${previewData.usedInPeriod} pv`} iconColor="var(--color-warning)" />
                                <SummaryRow label="Saldo jakson lopussa" value={`${previewData.balanceEnd} pv`} />
                                
                                {previewData.timelineItems.length > 0 && (
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <Accordion title="Tapahtumien ketjutus">
                                            <Timeline items={previewData.timelineItems} />
                                        </Accordion>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                ) : null}

            </div>
        </Modal>
    );
};

export default ReportModal;