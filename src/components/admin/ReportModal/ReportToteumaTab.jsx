// --- src/components/admin/ReportModal/ReportToteumaTab.jsx ---
import React from 'react';
import ProgressBar from '../../common/ProgressBar';
import SummaryRow from '../../common/SummaryRow';
import AdminAlert from '../../common/AdminAlert';
import Accordion from '../../common/Accordion';
import Timeline from '../../common/Timeline';

const ReportToteumaTab = ({ previewData }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <h4 className="icon-heading text-md" style={{ marginBottom: '1rem' }}>Jakson aikabudjetti</h4>
                    <SummaryRow label="Kalenteripäivät (ma-pe)" value={`${previewData.totalCalendarWorkDays} pv`} borderTop={false} />
                    <SummaryRow label="Kansalliset pyhät" value={`-${previewData.holidaysCount} pv`} iconColor={previewData.holidaysCount > 0 ? "var(--color-danger)" : "var(--color-text-secondary)"} />
                    <SummaryRow label="Merkityt lomat/estot" value={`-${previewData.blocksCount} pv`} iconColor={previewData.blocksCount > 0 ? "var(--color-danger)" : "var(--color-text-secondary)"} />
                    <SummaryRow label="Aktiiviset työpäivät" value={`${previewData.workingDays} pv`} />
                </div>

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
    );
};

export default ReportToteumaTab;