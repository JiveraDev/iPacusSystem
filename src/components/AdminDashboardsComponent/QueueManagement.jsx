import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Input } from '../../ui/input';
import { CheckCircle2, XCircle, Clock, AlertCircle, Search, ImageIcon, UserCheck, Loader2 } from 'lucide-react';
import AddQueueDialog from './AddQueueDialog';
import { toast } from '../../reusecomponent/toast.jsx';
import { PhotoViewer } from '../../ui/photo-viewer';
import { formatDisplayDateTime } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchAccounts } from '../../services/accountService';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import {
    assignQueueToVeterinarian,
    fetchQueues as fetchQueuesService,
    updateQueueStatus
} from '../../services/queueService';

export default function QueueManagement() {
    const [queue, setQueue] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');
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
            const data = await fetchBranches();
            setBranches(Array.isArray(data?.branches) ? data.branches : []);
        } catch (error) {
            console.error('Failed to load branch filters:', error);
        }
    }, { intervalMs: 30000, refreshKey: 'queue-branches' });

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

    const handleRowToggleKeyDown = (event, queueId) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        toggleRow(queueId);
    };

    const handleApprove = async (id) => {
        const updated = await updateStatus(id, 'in-progress');
        if (updated) {
            toast.success('Queue approved and moved to the approved list.');
        }
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
                throw new Error(data.error || data.message || 'Failed to update queue status.');
            }

            setQueue(items =>
                items.map(item =>
                    item.queue_id === id ? { ...item, status: newStatus, has_active_assignment: 0 } : item
                )
            );
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.message || 'Failed to update queue status.');
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
                throw new Error(data.error || data.message || 'Failed to assign veterinarian.');
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
            toast.error(error.message || 'Failed to assign veterinarian.');
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
                <SelectTrigger className="h-8 min-w-[150px] bg-white text-xs">
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
        all: 'Select Priority',
        normal: 'Normal',
        urgent: 'Urgent'
    }[priorityFilter] || 'Select Priority';
    const serviceFilterLabel = serviceFilter === 'all' ? 'Select Service' : getServiceDisplayName(serviceFilter);

    const getStatusBadge = (status) => {
        const variants = {
            'waiting': { variant: 'outline', icon: Clock, text: 'Waiting' },
            'in-progress': { variant: 'default', icon: AlertCircle, text: 'In Progress' },
            'completed': { variant: 'default', icon: CheckCircle2, text: 'Completed' },
            'done': { variant: 'default', icon: CheckCircle2, text: 'Done' },
            'cancelled': { variant: 'destructive', icon: XCircle, text: 'Cancelled' }
        };
        const { variant, icon: Icon, text } = variants[status] || variants['waiting'];
        return (
            <Badge variant={variant} className="flex items-center gap-1">
                <Icon className="size-3" />
                {text}
            </Badge>
        );
    };

    const getPriorityBadge = (priority) => {
        return priority === 'urgent' ? (
            <Badge variant="destructive">Urgent</Badge>
        ) : (
            <Badge variant="secondary">Normal</Badge>
        );
    };

    const getSourceBadge = (sourceValue) => {
        const source = (sourceValue || 'admin').toLowerCase();
        if (source === 'self_service') return <Badge variant="outline">Self Service</Badge>;
        if (source === 'register') return <Badge variant="outline">On Register</Badge>;
        if (source === 'booking_management') return <Badge variant="default" className="bg-[#155dfc]">Booking</Badge>;
        return <Badge variant="secondary">Admin</Badge>;
    };

    const formatDateTime = (value) => formatDisplayDateTime(value);

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#101828]">Current Queue</h2>
                    <p className="text-slate-500">Manage and track all patients in the queue</p>
                </div>
                <AddQueueDialog onAddToQueue={fetchQueues} />
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                    <span>Active: {activeCount}</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                    <span>Completed: {completedCount}</span>
                </div>
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                    <span>Cancelled: {cancelledCount}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 bg-white p-4 rounded-xl border border-slate-200">
                <div className="md:col-span-2 xl:col-span-2">
                    <Input 
                        placeholder="Search pet or queue ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leftIcon={<Search className="size-4" />}
                    />
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger><SelectValue placeholder="Select Priority" displayValue={priorityFilterLabel} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Select Priority</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger><SelectValue placeholder="Select Service" displayValue={serviceFilterLabel} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Select Service</SelectItem>
                        {services.map(s => <SelectItem key={s} value={s}>{getServiceDisplayName(s)}</SelectItem>)}
                    </SelectContent>
                </Select>
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
            </div>

            {/* Active Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="w-full">
                    <Table className="w-full table-auto">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-10 text-center px-1">#</TableHead>
                                <TableHead className="font-bold text-slate-900">Pet</TableHead>
                                <TableHead className="hidden md:table-cell">Service</TableHead>
                                <TableHead className="hidden lg:table-cell">Time</TableHead>
                                <TableHead className="w-20">Priority</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                                <TableHead className="text-right pr-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10">Loading queue data...</TableCell></TableRow>
                            ) : activeQueue.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No active queue entries</TableCell></TableRow>
                            ) : activeQueue.flatMap(item => {
                                const isExpanded = expandedRows.has(item.queue_id);
                                return [
                                    <TableRow
                                        key={item.queue_id}
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={isExpanded}
                                        onClick={() => toggleRow(item.queue_id)}
                                        onKeyDown={(event) => handleRowToggleKeyDown(event, item.queue_id)}
                                        className={`cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc] ${isExpanded ? "bg-blue-50/30" : "hover:bg-slate-50/50"}`}
                                    >
                                        <TableCell className="text-center font-bold text-slate-600 px-1">{formatQueueReference(item)}</TableCell>
                                        <TableCell className="font-semibold text-slate-900">
                                            <div className="truncate max-w-[80px] sm:max-w-none">{item.pet_name}</div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-slate-600 text-sm truncate max-w-[120px]">
                                            {getServiceDisplayName(item.service_name)}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-slate-500 text-xs">
                                            {formatDateTime(item.timestamp)}
                                        </TableCell>
                                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell className="text-right pr-4" onClick={(event) => event.stopPropagation()}>
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                {item.status === 'waiting' ? (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleApprove(item.queue_id)} 
                                                            disabled={updatingQueueId === item.queue_id}
                                                            className="bg-blue-600 hover:bg-blue-700 h-8 px-2 text-[11px] font-bold"
                                                        >
                                                            {updatingQueueId === item.queue_id
                                                                ? <Loader2 className="mr-1 size-3 animate-spin" />
                                                                : <UserCheck className="mr-1 size-3" />}
                                                            Approve
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="destructive" 
                                                            onClick={() => setQueueToCancel(item)}
                                                            disabled={updatingQueueId === item.queue_id}
                                                            className="h-8 px-2 text-[11px] font-bold"
                                                        >
                                                            <XCircle className="mr-1 size-3" />
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : item.status === 'in-progress' && (
                                                    <>
                                                        {renderVetSelect(item)}
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
                                                            className="h-8 px-2 text-[11px] font-bold"
                                                        >
                                                            {assigningQueueId === item.queue_id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <UserCheck className="mr-1 size-3" />}
                                                            {item.has_active_assignment ? 'Reassign' : 'Assign'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => setQueueToCancel(item)}
                                                            disabled={
                                                                assigningQueueId === item.queue_id
                                                                || updatingQueueId === item.queue_id
                                                            }
                                                            className="h-8 px-2 text-[11px] font-bold"
                                                        >
                                                            <XCircle className="mr-1 size-3" />
                                                            Cancel
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>,
                                    isExpanded && (
                                        <TableRow key={`${item.queue_id}-details`} className="bg-slate-50/50 border-b">
                                            <TableCell colSpan={7} className="p-0">
                                                <div className="p-4 sm:p-6 w-full max-w-full overflow-hidden">
                                                    <div className="flex flex-col lg:flex-row gap-6">
                                                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                                            <DetailItem label="Complaint" value={item.complaint} isFullWidth />
                                                            <DetailItem label="Pet Owner" value={item.owner_name ? `${item.owner_name} (${item.owner_status})` : `${item.first_Name} ${item.last_Name}`} />
                                                            <DetailItem label="Contact" value={item.contactNumber} />
                                                            <DetailItem label="Address" value={item.address} isFullWidth />
                                                            <DetailItem label="Source" value={getSourceBadge(item.queue_source)} />
                                                            <DetailItem label="Assigned Veterinarian" value={item.veterinarian_name || 'Unassigned'} />
                                                            <DetailItem label="Clinic Location" value={item.branch_name || 'Main Clinic'} />
                                                            <DetailItem label="Registration Time" value={formatDateTime(item.timestamp)} />
                                                        </div>
                                                        {item.image_path && (
                                                            <div className="shrink-0">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Issue Image</p>
                                                                <div 
                                                                    className="relative group w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm cursor-pointer"
                                                                    onClick={() => setViewingImage({ src: resolveImageUrl(item.image_path), alt: item.pet_name })}
                                                                >
                                                                    <ProtectedImage src={item.image_path} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Concern" />
                                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <ImageIcon className="text-white size-5" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                ];
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Completed Section */}
            {completedQueue.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-800 px-1">Completed Today</h3>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table className="w-full table-auto">
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="w-24 text-center px-1">Queue ID</TableHead>
                                    <TableHead className="font-bold text-slate-900">Pet</TableHead>
                                    <TableHead className="hidden sm:table-cell">Service</TableHead>
                                    <TableHead className="hidden md:table-cell">Time</TableHead>
                                    <TableHead className="text-right pr-4">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {completedQueue.map(item => (
                                    <TableRow key={item.queue_id} className="hover:bg-slate-50/50">
                                        <TableCell className="text-center font-bold text-slate-500 px-1">{formatQueueReference(item)}</TableCell>
                                        <TableCell className="font-semibold text-slate-900">{item.pet_name}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-slate-600 text-sm">{getServiceDisplayName(item.service_name)}</TableCell>
                                        <TableCell className="hidden md:table-cell text-slate-500 text-xs">{formatDateTime(item.timestamp)}</TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Badge className="bg-emerald-600 text-[10px] h-5 px-1.5 py-0">Completed</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

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
            <div className="text-sm text-slate-700 break-words leading-relaxed min-h-[1.25rem]">
                {value || <span className="text-slate-300">N/A</span>}
            </div>
        </div>
    );
}
