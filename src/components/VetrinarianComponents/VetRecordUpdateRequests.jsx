import { createElement, useMemo, useState } from 'react';
import {
    CheckCircle2,
    ClipboardList,
    Eye,
    Loader2,
    RefreshCw,
    Search,
    Stethoscope
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatDisplayDateTime } from '../../lib/date';
import { fetchRecordUpdateRequests, updateRecordUpdateRequest } from '../../services/recordUpdateRequestService';

function currentUserId(user) {
    return user?.user_id || user?.userId || user?.id || null;
}

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function statusLabel(status) {
    const labels = {
        approved: 'Approved',
        assigned: 'Assigned',
        in_progress: 'In Progress',
        completed: 'Completed'
    };

    return labels[status] || status;
}

function statusClass(status) {
    const classes = {
        approved: 'bg-blue-50 text-blue-700',
        assigned: 'bg-indigo-50 text-indigo-700',
        in_progress: 'bg-violet-50 text-violet-700',
        completed: 'bg-green-50 text-green-700'
    };

    return classes[status] || 'bg-slate-100 text-slate-700';
}

export default function VetRecordUpdateRequests() {
    const navigate = useNavigate();
    const currentUser = useDashboardUser();
    const veterinarianUserId = currentUserId(currentUser);
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [assignmentRequest, setAssignmentRequest] = useState(null);
    const [actionLoading, setActionLoading] = useState('');

    const loadRequests = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const data = await fetchRecordUpdateRequests({
                status: 'approved,assigned,in_progress,completed'
            });
            setRequests(Array.isArray(data.requests) ? data.requests : []);
        } catch (error) {
            if (!isAutoRefresh) {
                toast.error(error.message || 'Failed to load record update requests.');
            }
        } finally {
            if (!isAutoRefresh) {
                setIsLoading(false);
            }
        }
    };

    useAutoRefresh(loadRequests, {
        enabled: Boolean(veterinarianUserId),
        refreshKey: `vet-record-update-requests-${veterinarianUserId}`
    });

    const visibleRequests = useMemo(() => {
        const query = normalize(searchQuery);

        return requests.filter((request) => {
            const assignedVet = request.assignedVeterinarianUserId ? String(request.assignedVeterinarianUserId) : '';
            if (assignedVet && assignedVet !== String(veterinarianUserId)) {
                return false;
            }

            if (!query) return true;

            return normalize([
                request.requestNumber,
                request.petName,
                request.petSpecies,
                request.petBreed,
                request.ownerName,
                request.requestedChanges,
                request.status
            ].join(' ')).includes(query);
        });
    }, [requests, searchQuery, veterinarianUserId]);

    const isRequestActionLoading = (action, request) => actionLoading === `${action}-${request?.requestId}`;

    const openRequest = (request) => {
        setSelectedRequest(request);
    };

    const assignRequestAndOpenEditor = async (request) => {
        if (!request) return;

        setActionLoading(`assign-${request.requestId}`);
        try {
            const response = await updateRecordUpdateRequest(request.requestId, {
                action: 'assign',
                userId: veterinarianUserId,
                assignedVeterinarianUserId: veterinarianUserId
            });

            setRequests(current => current.map(item => (
                item.requestId === response.request?.requestId ? response.request : item
            )));
            setSelectedRequest(current => (
                current?.requestId === response.request?.requestId ? response.request : current
            ));
            if (assignmentRequest?.requestId === response.request?.requestId) {
                setAssignmentRequest(null);
            }
            toast.success('Request assigned. Opening medical records.');
            openMedicalEditor(response.request || request);
        } catch (error) {
            toast.error(error.message || 'Failed to update request.');
        } finally {
            setActionLoading('');
        }
    };

    const openAssignmentConfirm = (request) => {
        setAssignmentRequest(request);
    };

    const openMedicalEditor = (request) => {
        window.sessionStorage.setItem('vet-record-update-pet-id', String(request.petId));
        window.sessionStorage.setItem('vet-record-update-request-id', String(request.requestId));
        navigate('/dashboard/vet/medical-records');
    };

    if (!veterinarianUserId) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Stethoscope className="mx-auto mb-3 size-10 text-slate-300" />
                    <h2 className="text-xl font-black text-slate-950">Record Update Requests</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">Could not identify the current veterinarian account.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-950">Record Update Requests</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        View approved owner requests, assign them to yourself, then open the pet medical record editor.
                    </p>
                </div>
                <Button variant="outline" onClick={() => loadRequests()} disabled={isLoading} className="gap-2">
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
            </div>



            <Card>
                <CardContent className="p-4">
                    <div>
                        <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search request, pet, owner, or requested update"
                            leftIcon={<Search className="size-4" />}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Request</TableHead>
                            <TableHead>Pet / Owner</TableHead>
                            <TableHead className="hidden lg:table-cell">Requested Update</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading requests...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : visibleRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                                    No record update requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            visibleRequests.map((request) => (
                                <TableRow key={request.requestId} className="hover:bg-slate-50">
                                    <TableCell>
                                        <p className="font-black text-slate-900">{request.requestNumber}</p>
                                        <p className="text-xs font-semibold text-slate-500">{formatDisplayDateTime(request.createdAt)}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-bold text-slate-900">{request.petName}</p>
                                        <p className="text-xs font-semibold text-slate-500">{request.ownerName}</p>
                                    </TableCell>
                                    <TableCell className="hidden max-w-md lg:table-cell">
                                        <p className="line-clamp-2 text-sm font-semibold text-slate-600">{request.requestedChanges}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`border-0 ${statusClass(request.status)}`}>{statusLabel(request.status)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                            <Button variant="outline" size="sm" onClick={() => openRequest(request)}>
                                                <Eye className="size-4" />
                                                Details
                                            </Button>
                                            {request.status !== 'completed' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => openAssignmentConfirm(request)}
                                                    disabled={Boolean(actionLoading)}
                                                    className="bg-green-600 text-white hover:bg-green-700"
                                                >
                                                    {isRequestActionLoading('assign', request) ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
                                                    Update
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Record Update Request</DialogTitle>
                        <DialogDescription>
                            Review the owner request, view medical records, or assign it to yourself and open the editor.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="space-y-5">
                            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                                <Detail label="Request" value={selectedRequest.requestNumber} />
                                <Detail label="Pet" value={selectedRequest.petName} />
                                <Detail label="Owner" value={selectedRequest.ownerName} />
                                <Detail label="Status" value={statusLabel(selectedRequest.status)} />
                            </div>

                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                                <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-500">Requested Update</h3>
                                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                                    {selectedRequest.requestedChanges || 'No details provided.'}
                                </p>
                            </section>

                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(assignmentRequest)} onOpenChange={(open) => !open && setAssignmentRequest(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Confirm Record Update</DialogTitle>
                        <DialogDescription>
                            This will change the request status to assigned and open the pet medical record editor for this patient.
                        </DialogDescription>
                    </DialogHeader>

                    {assignmentRequest && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                                <Detail label="Request" value={assignmentRequest.requestNumber} />
                                <div className="mt-3">
                                    <Detail label="Pet / Owner" value={`${assignmentRequest.petName} / ${assignmentRequest.ownerName}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignmentRequest(null)} disabled={Boolean(actionLoading)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => assignRequestAndOpenEditor(assignmentRequest)}
                            disabled={Boolean(actionLoading)}
                            className="bg-green-600 text-white hover:bg-green-700"
                        >
                            {isRequestActionLoading('assign', assignmentRequest) ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
                            Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Stat({ icon, label, value }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                    {createElement(icon, { className: 'size-5' })}
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-2xl font-black text-slate-950">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function Detail({ label, value }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-bold text-slate-800">{value || 'N/A'}</p>
        </div>
    );
}
