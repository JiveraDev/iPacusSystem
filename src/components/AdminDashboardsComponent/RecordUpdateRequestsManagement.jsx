import { createElement, useMemo, useState } from 'react';
import {
    CheckCircle2,
    Eye,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    XCircle
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { formatDisplayDateTime } from '../../lib/date';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { fetchVeterinarians } from '../../services/accountService';
import { fetchRecordUpdateRequests, updateRecordUpdateRequest } from '../../services/recordUpdateRequestService';
import { openProtectedDocument } from '../../hooks/useConsentDocumentSource';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function vetId(vet) {
    return String(vet?.user_id || vet?.userId || vet?.id || '');
}

function vetName(vet) {
    return [vet?.first_Name || vet?.firstName, vet?.last_Name || vet?.lastName].filter(Boolean).join(' ') || vet?.mail_Address || 'Veterinarian name unavailable';
}

function statusLabel(status) {
    const labels = {
        pending_admin_review: 'Pending Review',
        approved: 'Approved',
        assigned: 'Assigned',
        in_progress: 'In Progress',
        completed: 'Completed',
        rejected: 'Rejected',
        cancelled: 'Cancelled'
    };

    return labels[status] || status;
}

function statusClass(status) {
    const classes = {
        pending_admin_review: 'bg-amber-50 text-amber-700',
        approved: 'bg-blue-50 text-blue-700',
        assigned: 'bg-indigo-50 text-indigo-700',
        in_progress: 'bg-violet-50 text-violet-700',
        completed: 'bg-green-50 text-green-700',
        rejected: 'bg-red-50 text-red-700',
        cancelled: 'bg-slate-100 text-slate-600'
    };

    return classes[status] || 'bg-slate-100 text-slate-700';
}

function paymentLabel(status) {
    const labels = {
        pending: 'Pending',
        submitted: 'Proof Submitted',
        verified: 'Verified',
        waived: 'Waived',
        rejected: 'Rejected'
    };

    return labels[status] || status;
}

function isImageProof(path) {
    return /\.(png|jpe?g|gif|webp|bmp)(?:[?#].*)?$/i.test(String(path || ''));
}

export default function RecordUpdateRequestsManagement() {
    const [requests, setRequests] = useState([]);
    const [veterinarians, setVeterinarians] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedVetId, setSelectedVetId] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [actionLoading, setActionLoading] = useState('');
    const [viewer, setViewer] = useState(null);

    const loadData = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const [requestResult, veterinarianResult] = await Promise.allSettled([
                fetchRecordUpdateRequests(),
                fetchVeterinarians()
            ]);

            if (requestResult.status === 'rejected') {
                throw requestResult.reason;
            }

            const requestData = requestResult.value;
            setRequests(Array.isArray(requestData.requests) ? requestData.requests : []);
            if (veterinarianResult.status === 'fulfilled') {
                const veterinarianData = veterinarianResult.value;
                setVeterinarians(Array.isArray(veterinarianData.veterinarians) ? veterinarianData.veterinarians : []);
            } else {
                console.error('Failed to load veterinarians for record update assignment:', veterinarianResult.reason);
                setVeterinarians([]);
                if (!isAutoRefresh) {
                    toast.error('Requests loaded, but veterinarian choices are temporarily unavailable.');
                }
            }
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

    useAutoRefresh(loadData, { refreshKey: 'admin-record-update-requests' });

    const filteredRequests = useMemo(() => {
        const query = normalize(searchQuery);

        return requests.filter((request) => {
            if (statusFilter === 'active' && ['completed', 'rejected', 'cancelled'].includes(request.status)) {
                return false;
            }

            if (statusFilter !== 'active' && statusFilter !== 'all' && request.status !== statusFilter) {
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
                request.paymentMethod,
                request.status,
                request.paymentStatus
            ].join(' ')).includes(query);
        });
    }, [requests, searchQuery, statusFilter]);

    const openReview = (request) => {
        const assignedVetId = request.assignedVeterinarianUserId
            ? String(request.assignedVeterinarianUserId)
            : '';
        const assignedVetIsAvailable = assignedVetId
            && veterinarians.some(vet => vetId(vet) === assignedVetId);

        setSelectedRequest(request);
        setSelectedVetId(assignedVetIsAvailable ? assignedVetId : '');
        setAdminNotes(request.adminNotes || '');
    };

    const updateRequest = async (action, extraPayload = {}) => {
        if (!selectedRequest) return;
        const normalizedVetId = selectedVetId === 'none' ? '' : selectedVetId;
        const selectedVetIsAvailable = normalizedVetId
            && veterinarians.some(vet => vetId(vet) === normalizedVetId);

        if ((action === 'approve' || action === 'assign') && normalizedVetId && !selectedVetIsAvailable) {
            setSelectedVetId('');
            toast.error('That veterinarian is no longer available. Select another active veterinarian.');
            return;
        }

        setActionLoading(action);
        try {
            const response = await updateRecordUpdateRequest(selectedRequest.requestId, {
                action,
                userId: currentUserId(currentUser),
                assignedVeterinarianUserId: selectedVetIsAvailable ? Number(normalizedVetId) : null,
                adminNotes,
                ...extraPayload
            });

            setRequests(current => current.map(request => (
                request.requestId === selectedRequest.requestId ? response.request : request
            )));
            setSelectedRequest(response.request);
            toast.success(action === 'reject' ? 'Request rejected.' : 'Request updated.');
        } catch (error) {
            toast.error(error.message || 'Failed to update request.');
        } finally {
            setActionLoading('');
        }
    };

    const activeRequestStatuses = ['pending_admin_review', 'approved', 'assigned', 'in_progress'];
    const selectedRequestIsActive = activeRequestStatuses.includes(selectedRequest?.status);
    const paymentIsCleared = ['verified', 'waived'].includes(selectedRequest?.paymentStatus);
    const primaryAction = selectedRequest?.status === 'pending_admin_review'
        ? 'approve'
        : ['approved', 'assigned', 'in_progress'].includes(selectedRequest?.status)
            ? 'assign'
            : '';
    const veterinarianIsSelected = Boolean(selectedVetId && selectedVetId !== 'none');
    const selectedVetIsAvailable = veterinarianIsSelected
        && veterinarians.some(vet => vetId(vet) === selectedVetId);
    const isReassignment = ['assigned', 'in_progress'].includes(selectedRequest?.status);
    const selectedVetIsCurrent = veterinarianIsSelected
        && String(selectedRequest?.assignedVeterinarianUserId || '') === selectedVetId;
    const primaryActionDisabled = Boolean(actionLoading)
        || !paymentIsCleared
        || (primaryAction === 'assign' && (!selectedVetIsAvailable || (isReassignment && selectedVetIsCurrent)));
    const primaryActionLabel = selectedRequest?.status === 'pending_admin_review'
        ? (veterinarianIsSelected ? 'Approve & Assign' : 'Approve')
        : isReassignment
            ? 'Reassign'
            : 'Assign';
    const assignmentHelper = !paymentIsCleared
        ? 'Verify or waive payment before approving or assigning this request.'
        : primaryAction === 'assign' && !selectedVetIsAvailable
            ? 'Select an active veterinarian to continue.'
            : isReassignment && selectedVetIsCurrent
                ? 'Choose a different active veterinarian to reassign this request.'
                : '';

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                icon={FileText}
                title="Record Update Requests"
                description="Review owner payment proofs, approve requests, and assign them to veterinarians."
                petHover
                petKind="cat"
                petAccent="coral"
                layout="stacked"
                actions={(
                    <Button variant="outline" onClick={() => loadData()} disabled={isLoading} className="gap-2">
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                    </Button>
                )}
                toolbar={(
                <div className="space-y-3">
                    <div data-filter-bar data-session-persist="off" className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/60 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search requests or pets"
                                leftIcon={<Search className="size-4" />}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue
                                    displayValue={statusFilter === 'active' ? 'Active Requests' : statusFilter === 'all' ? 'All Requests' : statusLabel(statusFilter)}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active Requests</SelectItem>
                                <SelectItem value="all">All Requests</SelectItem>
                                <SelectItem value="pending_admin_review">Pending Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                )}
            />

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Request</TableHead>
                            <TableHead>Pet / Owner</TableHead>
                            <TableHead className="hidden lg:table-cell">Payment</TableHead>
                            <TableHead className="hidden xl:table-cell">Assigned Vet</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading requests...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                                    No record update requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map((request) => (
                                <TableRow key={request.requestId} className="hover:bg-slate-50">
                                    <TableCell>
                                        <p className="font-black text-slate-900">{request.requestNumber}</p>
                                        <p className="text-xs font-semibold text-slate-500">{formatDisplayDateTime(request.createdAt)}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-bold text-slate-900">{request.petName}</p>
                                        <p className="text-xs font-semibold text-slate-500">{request.ownerName}</p>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <PaymentBadge request={request} />
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell text-sm font-semibold text-slate-600">
                                        {request.assignedVeterinarianName || 'Unassigned'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`border-0 ${statusClass(request.status)}`}>{statusLabel(request.status)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => openReview(request)}>
                                            <Eye className="size-4" />
                                            Review
                                        </Button>
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
                        <DialogTitle>Review Record Update Request</DialogTitle>
                        <DialogDescription>
                            Verify payment before approving and assigning the request to a veterinarian.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="space-y-5">
                            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                                <Detail label="Request" value={selectedRequest.requestNumber} />
                                <Detail label="Pet" value={selectedRequest.petName} />
                                <Detail label="Owner" value={selectedRequest.ownerName} />
                                <Detail label="Created" value={formatDisplayDateTime(selectedRequest.createdAt)} />
                                <Detail label="Payment Method" value={selectedRequest.paymentMethod} />
                                <Detail label="Amount" value={`PHP ${Number(selectedRequest.paymentAmount || 0).toLocaleString()}`} />
                                <Detail label="Payment Status" value={paymentLabel(selectedRequest.paymentStatus)} />
                                <Detail label="Status" value={statusLabel(selectedRequest.status)} />
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                <section className="rounded-xl border border-slate-200 bg-white p-4">
                                    <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-500">Requested Update</h3>
                                    <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                                        {selectedRequest.requestedChanges || 'No details provided.'}
                                    </p>
                                </section>

                                <section className="rounded-xl border border-slate-200 bg-white p-4">
                                    <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Payment Proof</h3>
                                    {selectedRequest.paymentProofUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isImageProof(selectedRequest.paymentProofUrl)) {
                                                    setViewer({ src: selectedRequest.paymentProofUrl, alt: 'Payment proof' });
                                                    return;
                                                }
                                                openProtectedDocument(selectedRequest.paymentProofUrl)
                                                    .catch((error) => toast.error(error.message || 'The payment proof could not be opened.'));
                                            }}
                                            className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left"
                                        >
                                            <div className="flex h-40 items-center justify-center bg-white">
                                                {isImageProof(selectedRequest.paymentProofUrl) ? (
                                                    <ProtectedImage src={selectedRequest.paymentProofUrl} alt="Payment proof" className="h-full w-full object-cover" />
                                                ) : (
                                                    <FileText className="size-12 text-slate-400" aria-hidden="true" />
                                                )}
                                            </div>
                                            <p className="p-3 text-xs font-bold text-[#155dfc]">Open payment proof</p>
                                        </button>
                                    ) : (
                                        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                                            No proof uploaded. Cash or counter verification may be needed.
                                        </p>
                                    )}
                                    <div className="mt-4 space-y-2">
                                        <Label htmlFor="review-record-payment-reference">Transaction Number Submitted by Pet Owner</Label>
                                        <Input
                                            id="review-record-payment-reference"
                                            value={selectedRequest.paymentReference || ''}
                                            readOnly
                                            placeholder="No transaction number submitted"
                                            className="bg-slate-50 font-mono tracking-wide"
                                        />
                                        <p className="text-xs font-medium text-slate-500">
                                            Compare this number with the uploaded payment proof before updating the payment status.
                                        </p>
                                    </div>
                                </section>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Assign Veterinarian</Label>
                                    <Select value={selectedVetId || 'none'} onValueChange={setSelectedVetId}>
                                        <SelectTrigger>
                                            <SelectValue
                                                displayValue={
                                                    selectedVetId
                                                        ? vetName(veterinarians.find(vet => vetId(vet) === selectedVetId))
                                                        : 'Unassigned'
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned</SelectItem>
                                            {veterinarians.map((vet) => (
                                                <SelectItem key={vetId(vet)} value={vetId(vet)}>
                                                    {vetName(vet)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {assignmentHelper && (
                                        <p className="text-xs font-semibold text-amber-700" role="status">
                                            {assignmentHelper}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Admin Notes</Label>
                                    <Textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {selectedRequestIsActive && !paymentIsCleared && (
                                <Button
                                    variant="outline"
                                    onClick={() => updateRequest('verify_payment')}
                                    disabled={Boolean(actionLoading)}
                                    className="border-green-200 text-green-700 hover:bg-green-50"
                                >
                                    {actionLoading === 'verify_payment' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                    Verify Payment
                                </Button>
                            )}
                            {selectedRequestIsActive && (
                                <Button
                                    variant="outline"
                                    onClick={() => updateRequest('reject')}
                                    disabled={Boolean(actionLoading)}
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                >
                                    {actionLoading === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                                    Reject
                                </Button>
                            )}
                            {primaryAction && (
                                <Button
                                    onClick={() => updateRequest(primaryAction)}
                                    disabled={primaryActionDisabled}
                                    className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                                    title={assignmentHelper || primaryActionLabel}
                                >
                                    {actionLoading === primaryAction ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                    {primaryActionLabel}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Payment proof'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
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

function PaymentBadge({ request }) {
    const isVerified = request.paymentStatus === 'verified';
    const className = isVerified ? 'bg-green-50 text-green-700' : request.paymentStatus === 'submitted' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';

    return (
        <div className="space-y-1">
            <Badge className={`border-0 ${className}`}>{paymentLabel(request.paymentStatus)}</Badge>
            <p className="text-xs font-semibold text-slate-500">
                {request.paymentMethod} - PHP {Number(request.paymentAmount || 0).toLocaleString()}
            </p>
            {request.paymentReference && (
                <p className="max-w-52 truncate text-xs font-semibold text-slate-500" title={request.paymentReference}>
                    Ref: {request.paymentReference}
                </p>
            )}
        </div>
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
