import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Clock3, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/button';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchStaffActivity, fetchStaffActivityOptions } from '../../services/staffActivityService';

const DEFAULT_PAGE_SIZE = 50;
const QUIET_PERIOD_MS = 30 * 60 * 1000;
const controlClass = 'h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-900 outline-none transition-colors hover:border-slate-400 focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-300/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:focus-visible:border-slate-400 dark:focus-visible:ring-slate-600/60';
const roleNames = { admin: 'Admin', veterinarian: 'Veterinarian', super_admin: 'Super Admin' };
const targetNames = {
    bookings: 'Booking',
    queues: 'Queue entry',
    visits: 'POS billing',
    inventory: 'Inventory item',
    boarding: 'Boarding record',
    'record-update-requests': 'Medical record update',
    'vet-diagnoses': 'Diagnosis',
    accounts: 'Account',
    'pet-owner-accounts': 'Pet owner account',
    'service-catalog': 'Service',
    'online-consultations': 'Online consultation',
    grooming: 'Grooming workflow',
    'vet-presence': 'Vet availability',
    vet_schedules: 'Vet schedule',
    'veterinarian-branch-schedules': 'Branch schedule',
    pets: 'Medical record',
    pet_information: 'Pet record',
};

function activityTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    });
}

function activityDay(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function activityClock(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    });
}

function activityDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function activityTarget(row) {
    if (row.target_label) {
        const rawLabel = String(row.target_label).trim();
        if (/^#?\s*\d+$/.test(rawLabel)) {
            return targetNames[row.target_type] || 'Recorded activity';
        }
        const cleanedLabel = rawLabel
            .replace(/\s*[—–-]\s*(?:(?:booking|grooming|record)(?:\s+id)?\s*)?#?\s*\d+\s*$/iu, '')
            .replace(/\b(?:booking|grooming|record)(?:\s+id)?\s*#?\s*\d+\s*$/iu, '')
            .trim();
        if (cleanedLabel) return cleanedLabel;
        if (row.target_type === 'grooming') return 'Grooming workflow';
        if (cleanedLabel === rawLabel) return rawLabel;
    }
    const details = Array.isArray(row.action_details) ? row.action_details : [];
    const namedDetail = details.find((detail) => (
        ['Patient', 'Product', 'Products', 'Item', 'Context', 'Service', 'Service name', 'Location', 'Room'].includes(detail?.label)
        && detail?.value
    ));
    if (namedDetail) return String(namedDetail.value);
    return row.action_label || targetNames[row.target_type] || 'Recorded activity';
}

function isReadableDetail(detail) {
    return detail?.label
        && detail?.value !== undefined
        && detail?.value !== null
        && !/(^|\s)ID$/i.test(String(detail.label));
}

function readableActionSummary(row) {
    const details = Array.isArray(row.action_details)
        ? row.action_details.filter(isReadableDetail)
        : [];
    const referenceLabels = new Set(['Patient', 'Product', 'Products', 'Item', 'Context', 'Location', 'Room']);
    const operationalDetails = row.target_label
        ? details.filter((detail) => !referenceLabels.has(detail.label))
        : details;
    const visibleDetails = (operationalDetails.length > 0 ? operationalDetails : details).slice(0, 3);
    if (visibleDetails.length > 0) {
        return visibleDetails.map((detail) => `${detail.label}: ${detail.value}`).join(' | ');
    }
    const storedSummary = String(row.action_summary || '').trim();
    if (storedSummary && !/(^|\||\s)[A-Za-z ]+ ID\s*:/i.test(storedSummary) && !/#\d+/.test(storedSummary)) {
        return storedSummary;
    }
    return row.action_label || 'Activity recorded.';
}

function rangeStart(range) {
    const durations = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return durations[range] ? new Date(Date.now() - durations[range]).toISOString() : '';
}

function quietDuration(milliseconds) {
    const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return [days ? `${days}d` : '', hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ');
}

function buildTimeline(rows) {
    const timeline = [];
    let currentDay = '';
    let quietPeriods = 0;
    let currentQuietPeriod = null;

    if (rows.length > 0) {
        const newestTime = new Date(rows[0].created_at).getTime();
        const currentGap = Date.now() - newestTime;
        if (Number.isFinite(currentGap) && currentGap >= QUIET_PERIOD_MS) {
            quietPeriods += 1;
            currentQuietPeriod = {
                duration: quietDuration(currentGap),
                from: rows[0].created_at,
                to: new Date().toISOString(),
            };
        }
    }

    rows.forEach((row, index) => {
        const day = activityDay(row.created_at);
        if (day !== currentDay) {
            currentDay = day;
            timeline.push({ type: 'day', key: `day-${row.created_at}-${index}`, label: day });
        }
        timeline.push({ type: 'activity', key: row.activity_id, row });

        const olderRow = rows[index + 1];
        if (!olderRow) return;
        const newerTime = new Date(row.created_at).getTime();
        const olderTime = new Date(olderRow.created_at).getTime();
        const gap = newerTime - olderTime;
        if (Number.isFinite(gap) && gap >= QUIET_PERIOD_MS) {
            quietPeriods += 1;
            timeline.push({
                type: 'quiet',
                key: `quiet-${row.activity_id}-${olderRow.activity_id}`,
                duration: quietDuration(gap),
                from: olderRow.created_at,
                to: row.created_at,
            });
        }
    });

    return { timeline, quietPeriods, currentQuietPeriod };
}

function ActivitySelect({ label, value, onChange, children, className = '' }) {
    return (
        <label className={`block min-w-0 space-y-1.5 ${className}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</span>
            <span className="relative block">
                <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
                    {children}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            </span>
        </label>
    );
}

export default function StaffActivityHistory({ scope = 'self', lockedUserId = '', subjectName = '', showHeading = true, pageSize = DEFAULT_PAGE_SIZE }) {
    const showEveryone = scope === 'all';
    const [rows, setRows] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [options, setOptions] = useState({ users: [], branches: [], roles: [] });
    const [offset, setOffset] = useState(0);
    const [userId, setUserId] = useState(lockedUserId);
    const [role, setRole] = useState('');
    const [branchId, setBranchId] = useState('');
    const [module, setModule] = useState('major');
    const [timeRange, setTimeRange] = useState('all');

    useEffect(() => {
        if (!showEveryone) return;
        let cancelled = false;
        fetchStaffActivityOptions()
            .then((data) => {
                if (!cancelled) {
                    setOptions({
                        users: data.users || [],
                        branches: data.branches || [],
                        roles: data.roles || [],
                    });
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [showEveryone]);

    const load = useCallback(async ({ isAutoRefresh = false } = {}) => {
        try {
            const data = await fetchStaffActivity({
                scope,
                userId,
                role,
                branchId,
                module,
                from: rangeStart(timeRange),
                offset,
                limit: pageSize,
            });
            setRows(data.activities || []);
            setHasMore(Boolean(data.hasMore));
            setError('');
        } catch (loadError) {
            if (!isAutoRefresh || loading) setError(loadError.message || 'Activity log could not be loaded.');
            throw loadError;
        } finally {
            setLoading(false);
        }
    }, [scope, userId, role, branchId, module, timeRange, offset, pageSize, loading]);

    useAutoRefresh(load, {
        refreshKey: `activity-log-${scope}-${userId}-${role}-${branchId}-${module}-${timeRange}-${offset}`,
    });

    const changeFilter = (setter) => (value) => {
        setter(value);
        setOffset(0);
    };
    const hasActiveFilters = module !== 'major' || timeRange !== 'all' || Boolean(userId || role || branchId);
    const clearFilters = () => {
        setTimeRange('all');
        setUserId(lockedUserId);
        setRole('');
        setBranchId('');
        setModule('major');
        setOffset(0);
    };
    const { timeline, quietPeriods, currentQuietPeriod } = buildTimeline(rows);

    return (
        <section className="space-y-5 text-slate-900 dark:text-slate-100">
            {showHeading && (
                <div className="min-w-0" data-dashboard-heading-plain>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {subjectName ? `${subjectName}’s Activity Log` : showEveryone ? 'Activity Log' : 'My Activity Log'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {subjectName
                            ? 'Chronological account and clinic activity for this user.'
                            : showEveryone
                                ? 'Complete staff action records organized by time, activity, and branch.'
                                : 'Your chronological account and clinic activity.'}
                    </p>
                </div>
            )}

            <div className="activity-log-print-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activity filters</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Inventory, booking, queue, POS, medical record update, diagnosis, and online consultation actions are included.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters} className="h-9 shrink-0 gap-2 self-start sm:self-auto">
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Clear filters
                    </Button>
                </div>
                <div className={`grid gap-3 sm:grid-cols-2 ${showEveryone ? 'xl:grid-cols-5' : ''}`}>
                    <ActivitySelect label="Module" value={module} onChange={changeFilter(setModule)}>
                        <option value="major">All listed activity</option>
                        <option value="inventory">Inventory only</option>
                        <option value="bookings">Bookings only</option>
                        <option value="queues">Queue only</option>
                        <option value="pos">POS &amp; payments</option>
                        <option value="medical-records">Medical record updates</option>
                        <option value="diagnosis">Diagnosis only</option>
                        <option value="online-consultations">Online consultation only</option>
                    </ActivitySelect>
                    <ActivitySelect label="Time" value={timeRange} onChange={changeFilter(setTimeRange)}>
                        <option value="all">All</option>
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                    </ActivitySelect>
                    {showEveryone && !lockedUserId && (
                        <ActivitySelect label="User" value={userId} onChange={changeFilter(setUserId)}>
                            <option value="">All users</option>
                            {options.users.map((user) => <option key={user.user_id} value={user.user_id}>{user.name} ({roleNames[user.role] || user.role})</option>)}
                        </ActivitySelect>
                    )}
                    {showEveryone && (
                        <ActivitySelect label="Role" value={role} onChange={changeFilter(setRole)}>
                            <option value="">All roles</option>
                            {options.roles.map((option) => (
                                <option key={option} value={option}>{roleNames[option] || option.replaceAll('_', ' ')}</option>
                            ))}
                        </ActivitySelect>
                    )}
                    {showEveryone && (
                        <ActivitySelect label="Location" value={branchId} onChange={changeFilter(setBranchId)}>
                            <option value="">All branches</option>
                            {options.branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}
                        </ActivitySelect>
                    )}
                </div>
            </div>

            {error && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {error}
                </div>
            )}

            {loading && rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading activity log...</div>
            ) : error && rows.length === 0 ? null : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-5 py-12 text-center dark:border-slate-700">
                    <Activity className="size-6 text-slate-400" />
                    <p className="text-sm font-semibold">No matching log entries</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">New successful staff activity is recorded immediately and appears here automatically.</p>
                </div>
            ) : (
                <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'} on this page</span>
                        <span>{quietPeriods} quiet {quietPeriods === 1 ? 'period' : 'periods'} of 30 minutes or longer</span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        <table className="activity-log-table w-full min-w-[900px] border-collapse text-left text-sm">
                            <caption className="sr-only">Chronological staff activity log</caption>
                            <thead className="bg-slate-50 text-xs font-semibold text-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                                <tr>
                                    <th scope="col" className="w-[23%] px-4 py-3 uppercase tracking-wide">User</th>
                                    <th scope="col" className="w-[14%] px-4 py-3 uppercase tracking-wide">Module</th>
                                    <th scope="col" className="w-[28%] px-4 py-3 uppercase tracking-wide">Activity</th>
                                    <th scope="col" className="w-[18%] px-4 py-3 uppercase tracking-wide">Reference</th>
                                    <th scope="col" className="w-[17%] px-4 py-3 uppercase tracking-wide">Date &amp; time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {currentQuietPeriod && (
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40">
                                <td colSpan={5} className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-start gap-2">
                                        <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                        <span>
                                            No matching activity has been recorded for <strong className="font-semibold text-slate-700 dark:text-slate-300">{currentQuietPeriod.duration}</strong>
                                            {' '}since {activityTime(currentQuietPeriod.from)}. This quiet period is ongoing.
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        )}
                        {timeline.map((item) => {
                            if (item.type === 'day') {
                                return (
                                    <tr key={item.key} className="bg-slate-50 dark:bg-slate-950/60">
                                        <th scope="rowgroup" colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</th>
                                    </tr>
                                );
                            }
                            if (item.type === 'quiet') {
                                return (
                                    <tr key={item.key}>
                                        <td colSpan={5} className="border-y border-dashed border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                            <span className="flex items-start gap-2">
                                                <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                                <span>
                                                    No matching activity recorded for <strong className="font-semibold text-slate-700 dark:text-slate-300">{item.duration}</strong>
                                                    {' '}({activityTime(item.from)} to {activityTime(item.to)}).
                                                </span>
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }

                            const row = item.row;
                            const actorName = row.actor_name || subjectName || 'Staff member';
                            const moduleName = row.target_type
                                ? (targetNames[row.target_type] || String(row.target_type).replaceAll('-', ' ').replaceAll('_', ' '))
                                : 'Activity';
                            return (
                                <tr key={item.key} className="align-top transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-4">
                                            <div className="min-w-0">
                                                <p className="break-words font-semibold text-slate-800 dark:text-slate-100">{actorName}</p>
                                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{roleNames[row.actor_role] || row.actor_role || 'Staff'}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {moduleName}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{row.action_label}</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{readableActionSummary(row)}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-slate-700 dark:text-slate-200">{activityTarget(row) || 'No record reference'}</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{row.branch_name || 'Branch not recorded'}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <time className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-200" dateTime={row.created_at}>{activityClock(row.created_at)}</time>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{activityDate(row.created_at)}</p>
                                        </td>
                                </tr>
                            );
                        })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Quiet periods are calculated between consecutive entries in the currently filtered log.
                    </p>
                </div>
            )}

            {(offset > 0 || hasMore) && (
                <div className="activity-log-print-hidden flex items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">Showing {offset + 1}–{offset + rows.length}</span>
                    <Button type="button" variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} aria-label="Previous activity log page"><ChevronLeft className="size-4" /> Previous</Button>
                    <Button type="button" variant="outline" size="sm" disabled={!hasMore} onClick={() => setOffset(offset + pageSize)} aria-label="Next activity log page">Next <ChevronRight className="size-4" /></Button>
                </div>
            )}
        </section>
    );
}
