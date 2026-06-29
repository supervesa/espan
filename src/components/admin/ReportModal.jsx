import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Button from '../common/Button';
import { FileSpreadsheet, X, Download, Calendar } from 'lucide-react';

// Apufunktio: Hakee kiinteät 14 päivän (2 viikon) jaksot
const getFixedPeriods = () => {
    const periods = [];
    // Valitaan jokin satunnainen "ankkuri"-maanantai menneisyydestä (esim. 5.1.2026)
    const anchorDate = new Date('2026-01-05T00:00:00'); 
    const today = new Date();
    
    // Lasketaan kuinka monta 14 päivän jaksoa on kulunut ankkurista
    const diffTime = Math.abs(today - anchorDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentPeriodIndex = Math.floor(diffDays / 14);

    // Luodaan valikkoon 5 edellistä jaksoa ja kuluva jakso
    for (let i = currentPeriodIndex + 1; i >= currentPeriodIndex - 4; i--) {
        const start = new Date(anchorDate);
        start.setDate(start.getDate() + (i * 14));
        const end = new Date(start);
        end.setDate(end.getDate() + 13);

        const isCurrent = today >= start && today <= end;
        
        periods.push({
            id: i,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            label: `${start.getDate()}.${start.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${start.getFullYear()} ${isCurrent ? '(Kuluva)' : '(Menneisyys)'}`
        });
    }
    return periods;
};

const ReportModal = ({ isOpen, onClose, expertId }) => {
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const generatedPeriods = getFixedPeriods();
            setPeriods(generatedPeriods);
            setSelectedPeriod(generatedPeriods[1]); // Valitaan oletuksena uusin MENNYT jakso
        }
    }, [isOpen]);

    const generateExcelCSV = async () => {
        if (!selectedPeriod) return;
        setGenerating(true);

        try {
            // 1. Haetaan jakson tiedot Supabasesta
            const [locRes, excRes, holidayRes] = await Promise.all([
                supabase.schema('espan').from('expert_daily_locations').select('*').eq('expert_id', expertId).gte('date', selectedPeriod.startDate).lte('date', selectedPeriod.endDate),
                supabase.schema('espan').from('availability').select('*').eq('expert_id', expertId).gte('start_time', `${selectedPeriod.startDate} 00:00:00`).lte('start_time', `${selectedPeriod.endDate} 23:59:59`),
                supabase.schema('espan').from('national_holidays_cache').select('*').gte('date', selectedPeriod.startDate).lte('date', selectedPeriod.endDate)
            ]);

            const locations = locRes.data || [];
            const exceptions = excRes.data || [];
            const holidays = holidayRes.data || [];

            // 2. Rakennetaan CSV-data (Käytetään puolipistettä, jotta se aukeaa nätisti suomalaisessa Excelissä)
            // Tämä näyttää täysin käsin kirjoitetulta!
            let csvContent = "Päivämäärä;Viikonpäivä;Sijainti;Lisätieto\n";
            
            let officeCount = 0;
            let remoteCount = 0;
            let workingDays = 0;

            const startD = new Date(selectedPeriod.startDate);
            const endD = new Date(selectedPeriod.endDate);
            const weekdaysFi = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];

            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Hypätään viikonloppujen yli

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
                } else {
                    workingDays++;
                    if (loc) {
                        locationName = loc.location_name;
                        if (loc.location_type === 'lahityo') officeCount++;
                        if (loc.location_type === 'eta' || loc.location_type === 'eta_pankki') remoteCount++;
                        if (loc.location_type === 'eta_pankki') info = "Keskittymispäivä";
                    } else {
                        locationName = "Ei merkintää";
                    }
                }

                csvContent += `${displayDate};${weekdayName};${locationName};${info}\n`;
            }

            // Lasketaan käsin-tehdyn näköinen yhteenveto loppuun
            const targetDays = Math.ceil(workingDays * 0.5);
            const percent = workingDays > 0 ? Math.round((officeCount / workingDays) * 100) : 0;

            csvContent += `\n`;
            csvContent += `YHTEENVETO (14 pv jakso)\n`;
            csvContent += `Aktiiviset työpäivät (pyhät/lomat vähennetty);${workingDays}\n`;
            csvContent += `Lähityöpäivät;${officeCount}\n`;
            csvContent += `Etätyöpäivät;${remoteCount}\n`;
            csvContent += `Vaatimus (50%);${targetDays}\n`;
            csvContent += `Toteutunut lähityöaste;${percent} %\n`;

            // 3. Luodaan tiedosto ja ladataan se selaimeen
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF on UTF-8 BOM, jotta Excel ymmärtää ääkköset
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Toteuma_${selectedPeriod.startDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            onClose(); // Suljetaan ikkuna onnistuneen latauksen jälkeen

        } catch (error) {
            console.error(error);
            alert("Virhe tiedoston luonnissa.");
        } finally {
            setGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-primary)' }}>
                        <FileSpreadsheet size={28} />
                        <h3 className="text-xl fw-bold m-0">Lataa jakson toteuma</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <p className="text-sm text-secondary mb-3">
                        Valitse haluamasi kiinteä 2 viikon seurantajakso. Järjestelmä luo Excel-yhteensopivan taulukon, joka sisältää päiväkohtaiset sijainnit ja nollavelan mukaisen yhteenvedon.
                    </p>
                    
                    <label className="text-sm fw-semibold text-primary">Seurantajakso</label>
                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-secondary)' }} />
                        <select 
                            className="modern-select" 
                            style={{ paddingLeft: '2.2rem' }}
                            value={selectedPeriod?.id || ''} 
                            onChange={e => setSelectedPeriod(periods.find(p => p.id === parseInt(e.target.value)))}
                        >
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button variant="primary" icon={Download} onClick={generateExcelCSV} disabled={generating} fullWidth>
                        {generating ? 'Luodaan tiedostoa...' : 'Lataa Excel (.csv)'}
                    </Button>
                </div>

            </div>
        </div>
    );
};

export default ReportModal;