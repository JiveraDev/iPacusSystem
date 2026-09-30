import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Input } from '../../ui/input';
import { CheckCircle2, XCircle, Clock, AlertCircle, Search, ImageIcon, UserCheck, Loader2, ListChecks, Scissors, ChevronRight } from 'lucide-react';
import AddQueueDialog from './AddQueueDialog';
import { toast } from '../../reusecomponent/toast.jsx';
import { PhotoViewer } from '../../ui/photo-viewer';
import { formatDisplayDateTime } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import {
    getQueuePriorityLabel,
    normalizeQueuePriority,
    QUEUE_PRIORITY_OPTIONS
} from '../../lib/queuePriority';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchAccounts } from '../../services/accountService';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import {
    assignQueueToVeterinarian,
    fetchQueues as fetchQueuesService,
    updateQueueStatus
} from '../../services/queueService';
import { assignedBranchId, isBranchSelectionLocked, storedDashboardUser } from '../../lib/branchAccess.js';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import { useNavigate } from '../dashboardRouter.jsx';

function isGroomingQueue(item) {
    return ['grooming', 'pet grooming'].includes(String(item?.service_name || '').trim().toLowerCase());
}

function getQueueOwnerName(item) {
    const registeredOwnerName = [item?.first_Name, item?.last_Name]
        .filter(Boolean)
        .join(' ')
        .trim();

    return item?.owner_name || registeredOwnerName || 'Owner not provided';
}

function getQueueSourceLabel(sourceValue) {
    const source = String(sourceValue || 'admin').toLowerCase();

    if (source === 'self_service') return 'Self service';
    if (source === 'register') return 'On registration';
    if (source === 'booking_management') return 'Booking';
    return 'Admin entry';
}

function getQueueTime(value) {
    if (!value) return 'Time not available';

    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return 'Time not available';

    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function getQueueAge(value) {
    if (!value) return 'Wait time unavailable';

    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return 'Wait time unavailable';

    const totalMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (totalMinutes < 1) return 'Just arrived';
    if (totalMinutes < 60) return `${totalMinutes} min waiting`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} hr ${minutes} min waiting` : `${hours} hr waiting`;
}

export default function QueueManagement() {
    const navigate = useNavigate();
    const dashboardUser = useMemo(() => storedDashboardUser(), []);
    const lockedBranchId = assignedBranchId(dashboardUser);
    const branchFilterLocked = isBranchSelectionLocked(dashboardUser);
    const [queue, setQueue] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState(() => branchFilterLocked && lockedBranchId ? lockedBranchId : 'all');
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingImage, setViewingImage] = useState(null);
    const [veterinarians, setVeterinarians] = useState([]);
    const [selectedVetByQueue, setSelectedVetByQueue] = useState({});
    const [assigningQueueId, setAssigningQueueId] = useState(null);
    const [updatingQueueId, setUpdatingQueueId] = useState(null);
    const [queueToCancel, setQueueToCancel] = useState(null);

    const fetchQueues = async () => {
        try {
            const data = await fetchQueuesService();
            if (Array.isArray(data)) {
                setQueue(data);
            }
        } catch (error) {
            console.error('Error fetching queues:', error);
        } finally {
            setLoading(false);
        }
    };

    useAutoRefresh(fetchQueues);

    useAutoRefresh(async () => {
        try {
            const data = await fetchBranches({ assignedOnly: branchFilterLocked });
            const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
            setBranches(nextBranches);
            if (branchFilterLocked) {
                const assigned = nextBranches.find((branch) => String(branch.id) === lockedBranchId) || nextBranches[0];
                setBranchFilter(assigned ? String(assigned.id) : lockedBranchId || 'all');
            }
        } catch (error) {
            console.error('Failed to load branch filters:', error);
        }
    }, { intervalMs: 30000, refreshKey: `queue-branches-${branchFilterLocked}-${lockedBranchId}` });

    const fetchVeterinarians = async () => {
        try {
            const data = await fetchAccounts();

            if (Array.isArray(data.veterinarians)) {
                setVeterinarians(data.veterinarians.filter(vet => Number(vet.is_active ?? 1) === 1));
            }
        } catch (error) {
            console.error('Error fetching veterinarians:', error);
        }
    };

    useAutoRefresh(fetchVeterinarians, { intervalMs: 15000, refreshKey: 'queue-veterinarians' });

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleApprove = async (id) => {
        const updated = await updateStatus(id, 'in-progress');
        if (updated) {
            toast.success('Queue approved and moved to the approved list.');
        }
    };

    const openGroomingQueue = async (item) => {
        if (item.status === 'waiting') {
            const updated = await updateStatus(item.queue_id, 'in-progress');
            if (!updated) return;
        }

        if (item.booking_id) {
            sessionStorage.setItem('ipawcus-open-grooming-booking-id', String(item.booking_id));
        } else {
            toast.warning('This older grooming queue is not linked to a booking. Grooming Management will open to its work list.');
        }
        navigate('/dashboard/grooming');
    };

    const updateStatus = async (id, newStatus, reason = '') => {
        setUpdatingQueueId(id);

        try {
            const data = await updateQueueStatus({
                queue_id: id,
                status: newStatus,
                reason
            });
            if (!data.success) {
                throw new Error(data.error || data.message || 'The queue status could not be updated.');
            }

            setQueue(items =>
                items.map(item =>
                    item.queue_id === id ? { ...item, status: newStatus, has_active_assignment: 0 } : item
                )
            );
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.message || 'The queue status could not be updated. Refresh the queue and try again.');
            return false;
        } finally {
            setUpdatingQueueId(null);
        }
    };

    const confirmQueueCancellation = async () => {
        if (!queueToCancel) return;

        const updated = await updateStatus(
            queueToCancel.queue_id,
            'cancelled',
            'Cancelled by clinic staff from Queue Management.'
        );

        if (updated) {
            toast.success(`${formatQueueReference(queueToCancel)} was cancelled and removed from the active queue.`);
            setQueueToCancel(null);
        }
    };

    const getVetId = (vet) => String(vet.user_id || vet.id || vet.userId || '');

    const getVetName = (vet) => {
        if (vet?.veterinarian_name) {
            return vet.veterinarian_name;
        }

        const fullName = [vet.first_Name || vet.firstName || vet.first_name, vet.last_Name || vet.lastName || vet.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();

        const vetName = fullName ? `Dr. ${fullName}` : vet.mail_Address || vet.email || 'Veterinarian';
        const branchName = vet.preferred_branch_name || vet.branch_name;
        return branchName ? `${vetName} · ${branchName}` : vetName;
    };

    const getSelectedVetId = (queueId, item = null) => {
        const selected = selectedVetByQueue[String(queueId)];

        return selected || (item?.veterinarian_user_id ? String(item.veterinarian_user_id) : '');
    };

    const assignQueueToVet = async (queueId, veterinarianUserId, reason = 'Assigned from queue management') => {
        const vet = veterinarians.find(item => getVetId(item) === String(veterinarianUserId));
        const veterinarianName = vet ? getVetName(vet) : '';
        setAssigningQueueId(queueId);

        try {
            const data = await assignQueueToVeterinarian({
                queue_id: queueId,
                veterinarian_user_id: veterinarianUserId,
                veterinarian_name: veterinarianName,
                reason
            });

            if (!data.success) {
                throw new Error(data.error || data.message || 'The veterinarian could not be assigned to this queue.');
            }

            const assignment = data.assignment || {};
            setQueue(items =>
                items.map(item =>
                    item.queue_id === queueId
                        ? {
                            ...item,
                            status: 'in-progress',
                            assignment_id: assignment.assignment_id || item.assignment_id,
                            assignment_status: assignment.status || 'received',
                            veterinarian_user_id: assignment.veterinarian_user_id || veterinarianUserId,
                            veterinarian_name: assignment.veterinarian_name || veterinarianName,
                            received_at: assignment.received_at || new Date().toISOString(),
                            has_active_assignment: 1
                        }
                        : item
                )
            );
            toast.success('Queue assigned and moved to the veterinarian My List.');
        } catch (error) {
            toast.error(error.message || 'The veterinarian could not be assigned to this queue. Check their availability and try again.');
        } finally {
            setAssigningQueueId(null);
        }
    };

    const renderVetSelect = (item) => {
        const value = getSelectedVetId(item.queue_id, item);

        return (
            <Select
                value={value}
                onValueChange={(nextValue) => setSelectedVetByQueue(current => ({ ...current, [String(item.queue_id)]: nextValue }))}
            >
                <SelectTrigger className="h-8 min-w-[170px] bg-white text-xs dark:bg-slate-900">
                    <SelectValue
                        placeholder="Select vet"
                        displayValue={value ? getVetName(veterinarians.find(vet => getVetId(vet) === String(value)) || { veterinarian_name: item.veterinarian_name }) : ''}
                    />
                </SelectTrigger>
                <SelectContent>
                    {veterinarians.length === 0 ? (
                        <SelectItem value="none" disabled>No active vets</SelectItem>
                    ) : veterinarians.map(vet => (
                        <SelectItem key={getVetId(vet)} value={getVetId(vet)}>
                            {getVetName(vet)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    };

    const isSameLocalDay = (dateValue, referenceDate) => {
        const date = new Date(dateValue);
        return (
            date.getFullYear() === referenceDate.getFullYear() &&
            date.getMonth() === referenceDate.getMonth() &&
            date.getDate() === referenceDate.getDate()
        );
    };

    const filteredQueue = useMemo(() => {
        return queue.filter(item => {
            const ownerText = item.owner_name
                ? `${item.owner_name} (${item.owner_status === 'unregistered' ? 'Unregistered' : 'Registered'})`
                : `${item.first_Name || ''} ${item.last_Name || ''}`.trim();
            const queueReference = formatQueueReference(item);
            const matchesSearch = 
                item.pet_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ownerText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(item.queue_number || '').includes(searchTerm) ||
                queueReference.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
            const matchesService = serviceFilter === 'all' || item.service_name === serviceFilter;
            const matchesBranch = branchFilter === 'all' || String(item.branch_id) === branchFilter;

            return matchesSearch && matchesPriority && matchesService && matchesBranch;
        });
    }, [queue, searchTerm, priorityFilter, serviceFilter, branchFilter]);

    const now = new Date();
    const todayFilteredQueue = filteredQueue.filter(item => isSameLocalDay(item.timestamp, now));
    const activeQueue = todayFilteredQueue.filter(item => !['completed', 'done', 'cancelled'].includes(item.status));
    const completedQueue = todayFilteredQueue.filter(item => ['completed', 'done'].includes(item.status));
    
    const activeCount = todayFilteredQueue.filter(item => !['completed', 'done', 'cancelled'].includes(item.status)).length;
    const completedCount = todayFilteredQueue.filter(item => ['completed', 'done'].includes(item.status)).length;
    const cancelledCount = todayFilteredQueue.filter(item => item.status === 'cancelled').length;

    const services = useMemo(() => {
        return [...new Set(queue.map(item => item.service_name))].filter(Boolean);
    }, [queue]);
    const priorityFilterLabel = {
        all: 'All Priorities',
    }[priorityFilter] || getQueuePriorityLabel(priorityFilter);
    const serviceFilterLabel = serviceFilter === 'all' ? 'All Services' : getServiceDisplayName(serviceFilter);
    const hasActiveFilters = Boolean(
        searchTerm.trim()
        || priorityFilter !== 'all'
        || serviceFilter !== 'all'
        || (!branchFilterLocked && branchFilter !== 'all')
    );

    const getStatusBadge = (status) => {
        const variants = {
            'waiting': { variant: 'outline', icon: Clock, text: 'Waiting', darkClassName: 'dark:border-slate-600 dark:text-slate-200' },
            'in-progress': { variant: 'default', icon: AlertCircle, text: 'In Progress', darkClassName: 'dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200' },
            'completed': { variant: 'success', icon: CheckCircle2, text: 'Completed', darkClassName: 'dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
            'done': { variant: 'success', icon: CheckCircle2, text: 'Done', darkClassName: 'dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
            'cancelled': { variant: 'destructive', icon: XCircle, text: 'Cancelled', darkClassName: 'dark:border-red-900 dark:bg-red-950/60 dark:text-red-200' }
        };
        const { variant, icon: Icon, text, darkClassName } = variants[status] || variants['waiting'];
        return (
            <Badge
                variant={variant}
                className={`inline-flex whitespace-nowrap ${darkClassName}`}
            >
                <Icon className="size-3" />
                {text}
            </Badge>
        );
    };

    const getPriorityBadge = (priority) => {
        const normalizedPriority = normalizeQueuePriority(priority);
        if (normalizedPriority === 'urgent') return (
            <Badge variant="destructive" className="whitespace-nowrap dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">Urgent</Badge>
        );
        // if (normalizedPriority === 'low-test') return (
        //     <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
        //         Low-test
        //     </Badge>
        // );
        return <Badge variant="secondary" className="whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Normal</Badge>;
    };

    const formatDateTime = (value) => formatDisplayDateTime(value);

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            <DashboardPageHeader
                icon={ListChecks}
                title="Queue Management"
                description="Review today's arrivals, assign care, and move patients through the queue."
                layout="stacked"
                meta={(
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span><span className="text-blue-700 dark:text-blue-300">{activeCount}</span> active</span>
                        <span><span className="text-emerald-700 dark:text-emerald-300">{completedCount}</span> completed</span>
                        <span><span className="text-rose-700 dark:text-rose-300">{cancelledCount}</span> cancelled</span>
                    </div>
                )}
                actions={<AddQueueDialog onAddToQueue={fetchQueues} />}
                toolbar={(
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/60 md:grid-cols-2 xl:grid-cols-5">
                <div className="md:col-span-2 xl:col-span-2">
                    <Input 
                        placeholder="Search pet or queue ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leftIcon={<Search className="size-4" />}
                    />
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger><SelectValue displayValue={priorityFilterLabel} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        {QUEUE_PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger><SelectValue displayValue={serviceFilterLabel} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        {services.map(s => <SelectItem key={s} value={s}>{getServiceDisplayName(s)}</SelectItem>)}
                    </SelectContent>
                </Select>
                {branchFilterLocked ? (
                    <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {getBranchDisplayName(branches, branchFilter, 'Assigned clinic location')}
                    </div>
                ) : (
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger>
                            <SelectValue
                                placeholder="Clinic location"
                                displayValue={branchFilter === 'all'
                                    ? 'All assigned locations'
                                    : getBranchDisplayName(branches, branchFilter)}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All assigned locations</SelectItem>
                            {branches.map(branch => (
                                <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
                )}
            />

            <section
                aria-labelledby="active-queue-heading"
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <h2 id="active-queue-heading" className="text-sm font-bold text-slate-900 dark:text-white">Active queue</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Today's patients waiting for approval or currently in service.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {activeQueue.length} {activeQueue.length === 1 ? 'patient' : 'patients'}
                    </span>
                </div>

                <Table className="min-w-[1180px] table-fixed">
                    <colgroup>
                        <col className="w-[150px]" />
                        <col className="w-[180px]" />
                        <col className="w-[190px]" />
                        <col className="w-[145px]" />
                        <col className="w-[100px]" />
                        <col className="w-[225px]" />
                        <col className="w-[240px]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Queue</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Visit</TableHead>
                            <TableHead>Arrived</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status / assignment</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-14 text-center">
                                    <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400" role="status">
                                        <Loader2 className="size-5 animate-spin text-blue-600" />
                                        <span className="text-sm font-medium">Loading today's queue...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : activeQueue.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-14 text-center">
                                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                                        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            <ListChecks className="size-5" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {hasActiveFilters ? 'No queue entries match these filters' : 'No active queue entries'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {hasActiveFilters ? 'Try changing the search or filter selections.' : 'New arrivals will appear here automatically.'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : activeQueue.flatMap(item => {
                            const isExpanded = expandedRows.has(item.queue_id);
                            const detailsId = `queue-${item.queue_id}-details`;

                            return [
                                <TableRow key={item.queue_id} data-state={isExpanded ? 'selected' : undefined}>
                                    <TableCell>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <button
                                                type="button"
                                                aria-expanded={isExpanded}
                                                aria-controls={detailsId}
                                                aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${formatQueueReference(item)}`}
                                                onClick={() => toggleRow(item.queue_id)}
                                                className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                            >
                                                <ChevronRight
                                                    className={`size-4 transition-transform motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
                                                />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-slate-900 dark:text-white">{formatQueueReference(item)}</p>
                                                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{getQueueSourceLabel(item.queue_source)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="truncate font-semibold text-slate-900 dark:text-white" title={item.pet_name || ''}>{item.pet_name || 'Unnamed pet'}</p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={getQueueOwnerName(item)}>{getQueueOwnerName(item)}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="truncate font-medium text-slate-800 dark:text-slate-100" title={getServiceDisplayName(item.service_name)}>{getServiceDisplayName(item.service_name)}</p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={item.branch_name || 'Main Clinic'}>{item.branch_name || 'Main Clinic'}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{getQueueTime(item.timestamp)}</p>
                                        <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{getQueueAge(item.timestamp)}</p>
                                    </TableCell>
                                    <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col items-start gap-2">
                                            {getStatusBadge(item.status)}
                                            {item.status === 'in-progress' && !isGroomingQueue(item) ? renderVetSelect(item) : null}
                                            {isGroomingQueue(item) ? (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Grooming workflow</span>
                                            ) : item.status === 'waiting' ? (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Pending approval</span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isGroomingQueue(item) ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => openGroomingQueue(item)}
                                                        disabled={updatingQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px]"
                                                    >
                                                        {updatingQueueId === item.queue_id ? <Loader2 className="size-3 animate-spin" /> : <Scissors className="size-3" />}
                                                        {item.status === 'waiting' ? 'Send to Grooming' : 'Open Grooming'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => setQueueToCancel(item)}
                                                        disabled={updatingQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px]"
                                                    >
                                                        <XCircle className="size-3" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : item.status === 'waiting' ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(item.queue_id)}
                                                        disabled={updatingQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px]"
                                                    >
                                                        {updatingQueueId === item.queue_id
                                                            ? <Loader2 className="size-3 animate-spin" />
                                                            : <UserCheck className="size-3" />}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => setQueueToCancel(item)}
                                                        disabled={updatingQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px]"
                                                    >
                                                        <XCircle className="size-3" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : item.status === 'in-progress' ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            const selectedVetId = getSelectedVetId(item.queue_id, item);
                                                            if (!selectedVetId) {
                                                                toast.error('Select a veterinarian before assigning this queue.');
                                                                return;
                                                            }
                                                            assignQueueToVet(item.queue_id, selectedVetId, 'Reassigned by admin from queue management');
                                                        }}
                                                        disabled={assigningQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        {assigningQueueId === item.queue_id ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />}
                                                        {item.has_active_assignment ? 'Reassign' : 'Assign'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => setQueueToCancel(item)}
                                                        disabled={assigningQueueId === item.queue_id || updatingQueueId === item.queue_id}
                                                        className="h-8 px-2.5 text-[11px]"
                                                    >
                                                        <XCircle className="size-3" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>,
                                isExpanded && (
                                    <TableRow key={`${item.queue_id}-details`} id={detailsId} className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-950/50 dark:hover:bg-slate-950/50">
                                        <TableCell colSpan={7} className="border-l-2 border-l-blue-600 p-0">
                                            <div className="w-full max-w-full overflow-hidden p-4 sm:p-5">
                                                <div className="flex flex-col gap-6 lg:flex-row">
                                                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                                                        <DetailItem label="Complaint" value={item.complaint} isFullWidth />
                                                        <DetailItem label="Pet Owner" value={item.owner_status ? `${getQueueOwnerName(item)} (${item.owner_status})` : getQueueOwnerName(item)} />
                                                        <DetailItem label="Contact" value={item.contactNumber} />
                                                        <DetailItem label="Address" value={item.address} isFullWidth />
                                                        <DetailItem label="Source" value={getQueueSourceLabel(item.queue_source)} />
                                                        <DetailItem label={isGroomingQueue(item) ? 'Workflow' : 'Assigned Veterinarian'} value={isGroomingQueue(item) ? 'Grooming Management' : item.veterinarian_name || 'Unassigned'} />
                                                        <DetailItem label="Clinic Location" value={item.branch_name || 'Main Clinic'} />
                                                        <DetailItem label="Registration Time" value={formatDateTime(item.timestamp)} />
                                                    </div>
                                                    {item.image_path ? (
                                                        <div className="shrink-0">
                                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Issue Image</p>
                                                            <button
                                                                type="button"
                                                                aria-label={`View issue image for ${item.pet_name || 'this pet'}`}
                                                                className="group relative size-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 sm:size-40"
                                                                onClick={() => setViewingImage({ src: resolveImageUrl(item.image_path), alt: item.pet_name })}
                                                            >
                                                                <ProtectedImage src={item.image_path} className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" alt="Concern" />
                                                                <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                                                                    <ImageIcon className="size-5 text-white" />
                                                                </span>
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            ];
                        })}
                    </TableBody>
                </Table>
            </section>

            <section
                aria-labelledby="completed-queue-heading"
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <h2 id="completed-queue-heading" className="text-sm font-bold text-slate-900 dark:text-white">Completed today</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Patients whose queue workflow has been finished today.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {completedQueue.length} completed
                    </span>
                </div>

                <Table className="min-w-[820px] table-fixed">
                    <colgroup>
                        <col className="w-[150px]" />
                        <col className="w-[190px]" />
                        <col className="w-[220px]" />
                        <col className="w-[170px]" />
                        <col className="w-[130px]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Queue</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Visit</TableHead>
                            <TableHead>Registered</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {completedQueue.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No completed queue entries yet today.
                                </TableCell>
                            </TableRow>
                        ) : completedQueue.map(item => (
                            <TableRow key={item.queue_id}>
                                <TableCell>
                                    <p className="truncate font-bold text-slate-900 dark:text-white">{formatQueueReference(item)}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{getQueueSourceLabel(item.queue_source)}</p>
                                </TableCell>
                                <TableCell>
                                    <p className="truncate font-semibold text-slate-900 dark:text-white" title={item.pet_name || ''}>{item.pet_name || 'Unnamed pet'}</p>
                                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={getQueueOwnerName(item)}>{getQueueOwnerName(item)}</p>
                                </TableCell>
                                <TableCell>
                                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{getServiceDisplayName(item.service_name)}</p>
                                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{item.branch_name || 'Main Clinic'}</p>
                                </TableCell>
                                <TableCell>
                                    <p className="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">{formatDateTime(item.timestamp)}</p>
                                </TableCell>
                                <TableCell className="text-right">{getStatusBadge(item.status)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>

            <Dialog
                open={Boolean(queueToCancel)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen && updatingQueueId !== queueToCancel?.queue_id) {
                        setQueueToCancel(null);
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                            <XCircle className="size-5" />
                        </div>
                        <DialogTitle>Cancel this queue entry?</DialogTitle>
                        <DialogDescription>
                            {queueToCancel
                                ? `${formatQueueReference(queueToCancel)} for ${queueToCancel.pet_name || 'this pet'} will be removed from the active and approved queue lists.`
                                : 'This queue entry will be removed from the active list.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <p>
                            The cancelled entry stays in queue history for accountability and cannot be reactivated.
                        </p>
                        {queueToCancel?.has_active_assignment ? (
                            <p className="mt-2 font-medium text-red-700 dark:text-red-300">
                                This pet is assigned to a veterinarian. Cancelling will also close that active assignment.
                            </p>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setQueueToCancel(null)}
                            disabled={updatingQueueId === queueToCancel?.queue_id}
                        >
                            Keep Queue
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmQueueCancellation}
                            disabled={updatingQueueId === queueToCancel?.queue_id}
                        >
                            {updatingQueueId === queueToCancel?.queue_id ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <XCircle className="mr-2 size-4" />
                            )}
                            {updatingQueueId === queueToCancel?.queue_id ? 'Cancelling...' : 'Cancel Queue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {viewingImage && (
                <PhotoViewer src={viewingImage.src} alt={viewingImage.alt} open={!!viewingImage} onOpenChange={o => !o && setViewingImage(null)} />
            )}
        </div>
    );
}

function DetailItem({ label, value, isFullWidth = false }) {
    return (
        <div className={`space-y-1 ${isFullWidth ? "sm:col-span-2" : ""}`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
            <div className="min-h-[1.25rem] break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {value || <span className="text-slate-300 dark:text-slate-600">N/A</span>}
            </div>
        </div>
    );
}
