import { useRef, useState } from 'react';
import { AlertCircle, FileText, HeartPulse, Loader2, RefreshCw, Stethoscope } from 'lucide-react';
import { Button } from '../../ui/button';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchPetMedicalRecords } from '../../services/petService';
import { formatDisplayDate } from '../../lib/date';
import './careWorkspace.css';

export default function PetMedicalOverview({ petId, ownerOnly = false, onOpenRecord }) {
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState(false);
    const requestSerial = useRef(0);
    const current = snapshot?.petId === String(petId) ? snapshot.records : null;
    const load = async () => {
        const serial = ++requestSerial.current;
        try {
            const records = await fetchPetMedicalRecords(petId, { ownerOnly });
            if (records.success === false) throw new Error('Medical overview unavailable');
            if (serial !== requestSerial.current) return;
            setSnapshot({ petId: String(petId), records });
            setError(false);
        } catch {
            if (serial === requestSerial.current) setError(true);
        }
    };
    useAutoRefresh(load, { enabled: Boolean(petId), refreshKey: `pet-overview:${petId}:${ownerOnly}` });
    const visits = Array.isArray(current?.serviceHistory) ? current.serviceHistory : [];
    const vaccines = Array.isArray(current?.vaccinations) ? current.vaccinations : [];
    const summaries = Array.isArray(current?.organizedRecords) ? current.organizedRecords : [];
    const recentVisits = [...visits].sort((left, right) => String(right.serviceDate || '').localeCompare(String(left.serviceDate || ''))).slice(0, 3);

    return (
        <section className="care-health-overview" aria-labelledby="pet-medical-overview-title">
            <header><div><h2 id="pet-medical-overview-title"><HeartPulse className="size-5" aria-hidden="true" />Medical overview</h2><p>Clinical visits, vaccinations, and organized care summaries.</p></div><Button type="button" variant="outline" className="gap-2" onClick={onOpenRecord}><FileText className="size-4" />Open complete medical record</Button></header>
            {error && <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><span className="flex items-center gap-2"><AlertCircle className="size-4" />Medical overview could not be refreshed.</span><Button type="button" size="sm" variant="outline" onClick={load}><RefreshCw className="size-3.5" />Retry</Button></div>}
            {!current && !error ? <div role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Loading medical overview…</div> : current && <>
                <dl className="care-health-metrics"><div><dt>Clinical visits</dt><dd>{visits.length}</dd></div><div><dt>Vaccine entries</dt><dd>{vaccines.length}</dd></div><div><dt>Care summaries</dt><dd>{summaries.length}</dd></div></dl>
                {summaries.length > 0 && <div className="care-medical-summaries"><h3>Organized care summaries</h3>{summaries.slice(0, 2).map((summary) => <article key={summary.groupId}><h4>{summary.title || 'Clinical summary'}</h4>{summary.summary && <p>{summary.summary}</p>}<span>{Array.isArray(summary.items) ? summary.items.length : 0} included records</span></article>)}</div>}
                <h3>Recent clinical visits</h3>
                {recentVisits.length ? <div className="care-medical-visits">{recentVisits.map((visit, index) => <article key={visit.id || visit.sourceId || index}><Stethoscope className="size-4" aria-hidden="true" /><div><h4>{visit.title || visit.serviceName || 'Clinical visit'}</h4><p>{[formatDisplayDate(visit.serviceDate), visit.veterinarianName].filter(Boolean).join(' · ')}</p>{typeof (visit.diagnosis || visit.summary) === 'string' && <p className="line-clamp-2">{visit.diagnosis || visit.summary}</p>}</div></article>)}</div> : <p className="px-5 pb-5 text-sm text-slate-500 dark:text-slate-400">No completed clinical visits have been recorded for this pet.</p>}
            </>}
        </section>
    );
}
