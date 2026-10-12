import { useCallback, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    DatabaseBackup,
    Download,
    HardDriveDownload,
    Loader2,
    RefreshCw,
    ShieldCheck,
    XCircle
} from 'lucide-react';

import { useAutoRefresh } from '../../hooks/useAutoRefresh.js';
import { toast } from '../../reusecomponent/toast.jsx';
import { Button } from '../../ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.jsx';
import { downloadLocalSystemBackup, fetchSystemBackups } from '../../services/systemBackupService.js';

const EMPTY_DATA = {
    backups: [],
    latestVerified: null,
    hasRunning: false,
    localDownloadOnly: true
};

const EMPTY_DOWNLOAD_PROGRESS = {
    phase: 'idle',
    percent: null,
    loadedBytes: 0,
    totalBytes: 0
};

function formatDate(value) {
    if (!value) return 'Not yet';
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime())
        ? value
        : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function StatusBadge({ backup }) {
    const details = backup.status === 'completed'
        ? { label: backup.downloadReady ? 'Ready' : 'Downloaded locally', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' }
        : backup.status === 'running'
            ? { label: 'Preparing', icon: Loader2, className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' }
            : backup.status === 'interrupted'
                ? { label: 'Interrupted', icon: AlertTriangle, className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' }
                : { label: 'Failed safely', icon: XCircle, className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' };
    const Icon = details.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${details.className}`}>
            <Icon className={`size-3.5 ${backup.status === 'running' ? 'animate-spin' : ''}`} aria-hidden="true" />
            {details.label}
        </span>
    );
}

export default function BackupManagement({ open, onOpenChange }) {
    const [data, setData] = useState(EMPTY_DATA);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(EMPTY_DOWNLOAD_PROGRESS);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const loadBackups = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) setLoading(true);
        try {
            const response = await fetchSystemBackups({ suppressServerUnavailable: isAutoRefresh });
            setData({ ...EMPTY_DATA, ...response });
            setLoadError('');
        } catch (error) {
            if (!isAutoRefresh) setLoadError(error.message || 'Backup download history could not be loaded.');
            throw error;
        } finally {
            if (!isAutoRefresh) setLoading(false);
        }
    }, []);

    useAutoRefresh(loadBackups, {
        enabled: open,
        intervalMs: downloading ? 1500 : 4000,
        refreshKey: open ? `backup-download-${downloading ? 'active' : 'open'}` : 'backup-download-closed'
    });

    const runningBackup = useMemo(
        () => data.backups.find((backup) => backup.status === 'running') || null,
        [data.backups]
    );

    const activeProgress = useMemo(() => {
        if (downloadProgress.phase === 'transferring') {
            const hasTotal = downloadProgress.totalBytes > 0;
            return {
                title: 'Downloading backup to this device',
                stage: hasTotal
                    ? `${formatBytes(downloadProgress.loadedBytes)} of ${formatBytes(downloadProgress.totalBytes)} received`
                    : `${formatBytes(downloadProgress.loadedBytes)} received`,
                percent: Number.isFinite(downloadProgress.percent) ? downloadProgress.percent : null
            };
        }

        if (downloadProgress.phase === 'saving' || downloadProgress.phase === 'complete') {
            return {
                title: 'Finishing local download',
                stage: 'Passing the verified ZIP to your browser',
                percent: 100
            };
        }

        const serverPercent = Number(runningBackup?.progressPercent);
        return {
            title: 'Preparing your backup',
            stage: runningBackup?.progressStage || 'Creating a consistent database and media snapshot',
            percent: Number.isFinite(serverPercent) && serverPercent > 1 ? serverPercent : null
        };
    }, [downloadProgress, runningBackup]);

    const createLocalDownload = async () => {
        setDownloading(true);
        setDownloadProgress({ ...EMPTY_DOWNLOAD_PROGRESS, phase: 'preparing' });
        try {
            await downloadLocalSystemBackup({ onProgress: setDownloadProgress });
            toast.success('Complete backup downloaded. No server backup copy was retained.');
        } catch (error) {
            toast.error(error.message || 'The local backup could not be completed. Temporary server files were removed.');
        } finally {
            setDownloading(false);
            await loadBackups().catch(() => {});
        }
    };

    const closeModal = (nextOpen) => {
        if (!nextOpen && !downloading) {
            setHistoryExpanded(false);
            onOpenChange?.(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={closeModal}>
            <DialogContent className="max-w-5xl p-0" showClose={!downloading}>
                <DialogHeader className="mb-0 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
                    <div className="flex items-start gap-3 pr-8">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            <HardDriveDownload className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <DialogTitle className="text-slate-950 dark:text-white">Download System Backup</DialogTitle>
                            <DialogDescription className="mt-1 leading-5 dark:text-slate-300">
                                Create a complete recovery ZIP and save it to the Super Admin’s computer.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {loading && data.backups.length === 0 ? (
                    <div className="flex min-h-[24rem] items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        <Loader2 className="size-5 animate-spin" /> Loading backup history
                    </div>
                ) : loadError ? (
                    <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
                        <AlertTriangle className="size-9 text-amber-600" aria-hidden="true" />
                        <p className="mt-3 font-black text-slate-950 dark:text-white">Backup download is unavailable</p>
                        <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
                        <Button className="mt-4" variant="outline" onClick={() => loadBackups().catch(() => {})}>Try Again</Button>
                    </div>
                ) : (
                    <div className="space-y-5 p-4 sm:p-6">
                        <section className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                                <div>
                                    <h3 className="font-black text-slate-950 dark:text-white">Local download only</h3>
                                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">The server creates a temporary complete package, streams it to this browser, and deletes its temporary ZIP and recovery state immediately afterward. Only the audit result remains in the database.</p>
                                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Choose the final folder through your browser’s download settings or Save As prompt.</p>
                                </div>
                            </div>
                            <Button type="button" className="w-full md:w-56 md:min-w-56" onClick={createLocalDownload} disabled={downloading || data.hasRunning}>
                                <Download />
                                {downloading || data.hasRunning ? 'Download in progress' : 'Create & Download ZIP'}
                            </Button>
                        </section>

                        {runningBackup || downloading ? (
                            <section className="min-h-40 rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900" aria-live="polite" aria-busy="true">
                                <div className="flex items-start gap-3">
                                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-700 dark:text-blue-300" aria-hidden="true" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="min-w-0 truncate font-black text-slate-950 dark:text-white" title={activeProgress.title}>{activeProgress.title}</p>
                                            <p className="min-w-20 whitespace-nowrap text-right text-sm font-bold text-blue-700 dark:text-blue-300">
                                                {activeProgress.percent === null ? 'In progress' : `${activeProgress.percent}%`}
                                            </p>
                                        </div>
                                        <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-300" title={activeProgress.stage}>{activeProgress.stage}</p>
                                        <div
                                            className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"
                                            role="progressbar"
                                            aria-label={activeProgress.title}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={activeProgress.percent ?? undefined}
                                        >
                                            {activeProgress.percent === null ? (
                                                <div className="backup-progress-indeterminate h-full w-2/5 rounded-full bg-blue-600" />
                                            ) : (
                                                <div
                                                    className="h-full rounded-full bg-blue-600 transition-[width] duration-500 motion-reduce:transition-none"
                                                    style={{ width: `${Math.max(0, Math.min(100, activeProgress.percent))}%` }}
                                                />
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Keep this window open. Large databases and media libraries can take several minutes.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        ) : null}

                        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className={`flex items-center gap-2 px-2 py-2 ${historyExpanded ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}>
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-slate-800/70"
                                    aria-expanded={historyExpanded}
                                    aria-controls="backup-audit-history-panel"
                                    onClick={() => setHistoryExpanded((expanded) => !expanded)}
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <DatabaseBackup className="size-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-black text-slate-950 dark:text-white">Download audit history</span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{data.backups.length} attempts · audit records only</span>
                                    </span>
                                    <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${historyExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>
                                {historyExpanded ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => loadBackups().catch(() => {})} disabled={loading}>
                                        <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
                                    </Button>
                                ) : null}
                            </div>

                            {historyExpanded ? (
                                <div id="backup-audit-history-panel" className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                            {data.backups.length === 0 ? (
                                <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
                                    <DatabaseBackup className="size-8 text-slate-400" aria-hidden="true" />
                                    <p className="mt-2 font-black text-slate-950 dark:text-white">No local downloads yet</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create the first complete ZIP and keep it in a protected folder on the Super Admin’s computer.</p>
                                </div>
                            ) : (
                                <div className="max-h-[24rem] overflow-auto overscroll-contain" tabIndex={0} aria-label="Scrollable backup audit history, five records visible">
                                    <Table className="min-w-[760px]">
                                        <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                                        <TableRow><TableHead>Attempt</TableHead><TableHead>Created</TableHead><TableHead>Coverage</TableHead><TableHead>Status</TableHead><TableHead>Size</TableHead><TableHead>Retention</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {data.backups.map((backup) => (
                                            <TableRow key={backup.id} className="h-[4.25rem]">
                                                <TableCell><p className="font-black text-slate-950 dark:text-white">Complete export</p><p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">#{backup.id} · {backup.reference.slice(0, 8)}</p></TableCell>
                                                <TableCell className="whitespace-nowrap"><p>{formatDate(backup.completedAt || backup.startedAt)}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{backup.createdBy}</p></TableCell>
                                                <TableCell><p>{backup.changedRows.toLocaleString()} rows</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{backup.includedFiles.toLocaleString()} files</p></TableCell>
                                                <TableCell><StatusBadge backup={backup} />{backup.errorMessage ? <p className="mt-1 line-clamp-2 max-w-64 text-xs text-rose-700 dark:text-rose-300" title={backup.errorMessage}>{backup.errorMessage}</p> : null}</TableCell>
                                                <TableCell className="whitespace-nowrap font-semibold">{formatBytes(backup.archiveSize)}</TableCell>
                                                <TableCell className="text-xs font-semibold text-slate-500 dark:text-slate-400">{backup.status === 'completed' && !backup.downloadReady ? 'Local device only' : 'Temporary only'}</TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                                </div>
                            ) : null}
                        </section>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
