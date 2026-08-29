import { useMemo, useRef, useState } from 'react';
import {
    Archive,
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    Eye,
    Landmark,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    ShieldCheck,
    Upload,
    WalletCards,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { uploadImageFile } from '../../services/uploadService';
import { fetchPaymentMethods, requestPaymentMethodsOtp, updatePaymentMethods } from '../../services/paymentMethodService';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const FILTERS = [
    { value: 'all', label: 'All methods' },
    { value: 'ewallet', label: 'E-wallets' },
    { value: 'bank_transfer', label: 'Bank transfers' },
];

const MAX_QR_FILE_BYTES = 8 * 1024 * 1024;
const QR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function digits(value, maxLength = 17) {
    return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

function methodKeyFromLabel(value) {
    const base = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return base || `payment_${Date.now().toString(36)}`;
}

function maskAccountNumber(value) {
    const number = digits(value);
    if (!number) return 'Not configured';
    const visibleDigits = Math.min(2, number.length);
    return `${'*'.repeat(Math.max(4, number.length - visibleDigits))}${number.slice(-visibleDigits)}`;
}

function normalizeInlineText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeMethod(method) {
    const key = method.methodKey || method.key || method.value || methodKeyFromLabel(method.label);
    const methodType = method.methodType === 'bank_transfer' ? 'bank_transfer' : 'ewallet';
    const accountNumber = digits(method.accountNumber || '', methodType === 'bank_transfer' ? 17 : 11);

    return {
        methodKey: key,
        value: key,
        label: method.label || key,
        methodType,
        accountName: method.accountName || '',
        accountNumber,
        maskedAccountNumber: method.maskedAccountNumber || maskAccountNumber(accountNumber),
        instructions: method.instructions || '',
        qrImageUrl: method.qrImageUrl || '',
        isActive: method.isActive !== false,
        requiresProof: true,
        qrFile: null,
    };
}

function emptyDraft() {
    return normalizeMethod({
        methodKey: '',
        label: '',
        methodType: 'ewallet',
        accountName: '',
        accountNumber: '',
        instructions: '',
        qrImageUrl: '',
        isActive: true,
    });
}

function validateDraft(method, { requirePaymentDestination = false } = {}) {
    const errors = {};
    const label = normalizeInlineText(method.label);
    const accountName = normalizeInlineText(method.accountName);

    if (!label) errors.label = 'Display name is required.';
    if (label.length > 100) errors.label = 'Display name must contain 100 characters or fewer.';
    if (!accountName) errors.accountName = 'Account name is required.';
    if (accountName.length > 150) errors.accountName = 'Account name must contain 150 characters or fewer.';
    if (method.methodType === 'ewallet' && method.accountNumber && !/^09\d{9}$/.test(method.accountNumber)) {
        errors.accountNumber = 'E-wallet number must contain 11 digits and begin with 09.';
    }
    if (method.methodType === 'bank_transfer' && method.accountNumber && (method.accountNumber.length < 6 || method.accountNumber.length > 17)) {
        errors.accountNumber = 'Bank account number must contain 6 to 17 digits.';
    }
    if (requirePaymentDestination && method.methodType === 'bank_transfer' && !method.accountNumber) {
        errors.accountNumber = 'Bank account number is required.';
    }
    if (
        requirePaymentDestination
        && method.methodType === 'ewallet'
        && !method.accountNumber
        && !method.qrFile
        && !method.qrImageUrl
    ) {
        errors.accountNumber = 'Enter a mobile number or upload a QR image.';
    }
    if (method.qrFile && !QR_IMAGE_TYPES.has(method.qrFile.type)) {
        errors.qrFile = 'QR image must be a JPG, PNG, GIF, or WebP file.';
    } else if (method.qrFile && method.qrFile.size > MAX_QR_FILE_BYTES) {
        errors.qrFile = 'QR image must be no larger than 8 MB.';
    }

    return errors;
}

function firstValidationMessage(errors) {
    return Object.values(errors)[0] || '';
}

function methodsFingerprint(methods) {
    return JSON.stringify(methods.map((method) => ({
        methodKey: method.methodKey,
        label: method.label,
        methodType: method.methodType,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        instructions: method.instructions,
        qrImageUrl: method.qrImageUrl,
        isActive: method.isActive,
        qrFile: method.qrFile
            ? [method.qrFile.name, method.qrFile.size, method.qrFile.lastModified, method.qrFile.type]
            : null,
    })));
}

export default function PaymentMethodsManagement() {
    const [methods, setMethods] = useState([]);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingKey, setEditingKey] = useState('');
    const [draft, setDraft] = useState(emptyDraft);
    const [draftErrors, setDraftErrors] = useState({});
    const [baselineFingerprint, setBaselineFingerprint] = useState(() => methodsFingerprint([]));
    const [serverRevision, setServerRevision] = useState('');
    const [verificationEmail, setVerificationEmail] = useState('');
    const [loadError, setLoadError] = useState('');
    const [viewer, setViewer] = useState(null);
    const readGenerationRef = useRef(0);
    const interactionVersionRef = useRef(0);
    const readAbortControllerRef = useRef(null);

    const currentFingerprint = useMemo(() => methodsFingerprint(methods), [methods]);
    const hasUnsavedChanges = currentFingerprint !== baselineFingerprint;
    const protectedStateRef = useRef({ editorOpen: false, hasUnsavedChanges: false, isSaving: false });
    protectedStateRef.current = { editorOpen, hasUnsavedChanges, isSaving };
    const filteredMethods = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return methods.filter((method) => {
            const matchesType = filter === 'all' || method.methodType === filter;
            const matchesSearch = !query || [method.label, method.accountName, method.instructions]
                .join(' ')
                .toLowerCase()
                .includes(query);
            return matchesType && matchesSearch;
        });
    }, [filter, methods, searchQuery]);

    const protectPendingReads = () => {
        interactionVersionRef.current += 1;
        readAbortControllerRef.current?.abort();
        readAbortControllerRef.current = null;
    };

    const loadMethods = async ({ isAutoRefresh = false } = {}) => {
        const generation = readGenerationRef.current + 1;
        readGenerationRef.current = generation;
        const interactionVersion = interactionVersionRef.current;
        readAbortControllerRef.current?.abort();
        const controller = new AbortController();
        readAbortControllerRef.current = controller;

        if (!isAutoRefresh) setIsLoading(true);
        if (!isAutoRefresh) setLoadError('');
        try {
            const data = await fetchPaymentMethods(
                { includeInactive: 1 },
                { signal: controller.signal },
            );
            if (
                controller.signal.aborted
                || generation !== readGenerationRef.current
                || interactionVersion !== interactionVersionRef.current
                || protectedStateRef.current.editorOpen
                || protectedStateRef.current.hasUnsavedChanges
                || protectedStateRef.current.isSaving
            ) {
                return;
            }
            if (!Array.isArray(data.methods) || !/^pmr_[a-f0-9]{64}$/.test(String(data.revision || ''))) {
                throw new Error('Payment method configuration response is incomplete.');
            }
            const nextMethods = data.methods.map(normalizeMethod);
            setMethods(nextMethods);
            setBaselineFingerprint(methodsFingerprint(nextMethods));
            setServerRevision(data.revision);
            setVerificationEmail(String(data.verificationEmail || '').trim());
            setLoadError('');
        } catch (error) {
            if (controller.signal.aborted || generation !== readGenerationRef.current) return;
            if (!isAutoRefresh) {
                const message = error.message || 'Payment methods could not be loaded.';
                setLoadError(message);
                toast.error(message);
            } else {
                throw error;
            }
        } finally {
            if (generation === readGenerationRef.current) {
                if (readAbortControllerRef.current === controller) {
                    readAbortControllerRef.current = null;
                }
                if (!isAutoRefresh) setIsLoading(false);
            }
        }
    };

    useAutoRefresh(({ isAutoRefresh }) => loadMethods({
        isAutoRefresh: isAutoRefresh || !isLoading,
    }), {
        enabled: !hasUnsavedChanges && !editorOpen && !isSaving,
        refreshKey: 'payment-methods-management',
    });

    const openNewMethod = () => {
        protectPendingReads();
        setEditingKey('');
        setDraft(emptyDraft());
        setDraftErrors({});
        setEditorOpen(true);
    };

    const openEditMethod = (method) => {
        protectPendingReads();
        setEditingKey(method.methodKey);
        setDraft({ ...method, qrFile: null });
        setDraftErrors({});
        setEditorOpen(true);
    };

    const updateDraft = (field, value) => {
        protectPendingReads();
        setDraft((current) => ({ ...current, [field]: value }));
        setDraftErrors((current) => {
            const fieldsToClear = field === 'accountNumber' || field === 'qrFile'
                ? ['accountNumber', 'qrFile']
                : [field];
            if (!fieldsToClear.some((fieldName) => current[fieldName])) return current;
            const next = { ...current };
            fieldsToClear.forEach((fieldName) => delete next[fieldName]);
            return next;
        });
    };

    const applyDraft = () => {
        const errors = validateDraft(draft, { requirePaymentDestination: true });
        const normalizedLabel = normalizeInlineText(draft.label);
        const duplicateLabel = methods.some((method) => (
            method.methodKey !== editingKey
            && normalizeInlineText(method.label).toLowerCase() === normalizedLabel.toLowerCase()
        ));
        if (duplicateLabel) {
            errors.label = 'A payment method with this display name already exists.';
        }
        setDraftErrors(errors);
        const error = firstValidationMessage(errors);
        if (error) {
            toast.error(error);
            return;
        }

        const nextKey = editingKey || methodKeyFromLabel(normalizedLabel);
        if (!editingKey && methods.some((method) => method.methodKey === nextKey)) {
            setDraftErrors({ label: 'A payment method with this name already exists.' });
            toast.error('A payment method with this name already exists.');
            return;
        }
        const nextMethod = normalizeMethod({
            ...draft,
            label: normalizedLabel,
            accountName: normalizeInlineText(draft.accountName),
            instructions: String(draft.instructions || '').trim(),
            methodKey: nextKey,
            maskedAccountNumber: maskAccountNumber(draft.accountNumber),
            qrImageUrl: draft.methodType === 'ewallet' ? draft.qrImageUrl : '',
        });
        nextMethod.qrFile = draft.qrFile || null;
        setMethods((current) => editingKey
            ? current.map((method) => method.methodKey === editingKey ? nextMethod : method)
            : [...current, nextMethod]);
        setEditorOpen(false);
        toast.info('Changes are ready. Verify by email and save to publish them.');
    };

    const activeMethodCount = methods.filter((method) => method.isActive).length;

    const toggleMethodArchive = (methodKey) => {
        const method = methods.find((item) => item.methodKey === methodKey);
        if (method?.isActive && activeMethodCount <= 1) {
            toast.error('Keep at least one payment method active.');
            return;
        }
        protectPendingReads();
        setMethods((current) => current.map((method) => (
            method.methodKey === methodKey ? { ...method, isActive: !method.isActive } : method
        )));
    };

    const sendOtp = async () => {
        setIsSendingOtp(true);
        try {
            const response = await requestPaymentMethodsOtp({});
            setVerificationEmail(String(response.email || '').trim());
            toast.success(response.message || 'Verification code sent.');
        } catch (error) {
            toast.error(error.message || 'Verification code could not be sent.');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const saveMethods = async () => {
        if (!/^\d{6}$/.test(otpCode.trim())) {
            toast.error('Enter the 6-digit email verification code.');
            return;
        }
        const invalidMethod = methods.find((method) => firstValidationMessage(validateDraft(method)));
        if (invalidMethod) {
            toast.error(`${invalidMethod.label}: ${firstValidationMessage(validateDraft(invalidMethod))}`);
            return;
        }
        if (!methods.some((method) => method.isActive)) {
            toast.error('Keep at least one payment method active.');
            return;
        }
        if (!/^pmr_[a-f0-9]{64}$/.test(serverRevision)) {
            toast.error('Refresh the payment methods before saving changes.');
            return;
        }

        protectPendingReads();
        setIsSaving(true);
        try {
            const nextMethods = [];
            for (const method of methods) {
                let qrImageUrl = method.qrImageUrl;
                if (method.qrFile) {
                    qrImageUrl = await uploadImageFile(method.qrFile, 'payment_qr');
                }
                nextMethods.push({ ...method, qrImageUrl, qrFile: undefined });
            }

            const response = await updatePaymentMethods({
                code: otpCode.trim(),
                revision: serverRevision,
                methods: nextMethods,
            });
            if (!Array.isArray(response.methods) || !/^pmr_[a-f0-9]{64}$/.test(String(response.revision || ''))) {
                throw new Error('Saved payment method response is incomplete. Refresh before making more changes.');
            }
            const savedMethods = response.methods.map(normalizeMethod);
            setMethods(savedMethods);
            setBaselineFingerprint(methodsFingerprint(savedMethods));
            setServerRevision(response.revision);
            setOtpCode('');
            toast.success(response.message || 'Payment methods saved securely.');
        } catch (error) {
            toast.error(error.message || 'Payment methods could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Payment Methods"
                description="Add and manage e-wallet and bank-transfer details used across owner payments, invoices, refunds, and reports."
                layout="stacked"
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => loadMethods()}
                            disabled={isLoading || isSaving || hasUnsavedChanges}
                            title={hasUnsavedChanges ? 'Save the pending changes before refreshing.' : 'Refresh payment methods'}
                            className="h-10 gap-2"
                        >
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Refresh
                        </Button>
                        <Button type="button" onClick={openNewMethod} disabled={isLoading || isSaving || Boolean(loadError) || !serverRevision} className="h-10 gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            <Plus className="size-4" />
                            Add Method
                        </Button>
                    </div>
                )}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="space-y-4">
                    <Card className="border-slate-200 shadow-none">
                        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_13rem]">
                            <Label htmlFor="payment-method-search" className="sr-only">Search payment methods</Label>
                            <Input
                                id="payment-method-search"
                                name="paymentMethodSearch"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search payment methods"
                                aria-label="Search payment methods"
                            />
                            <div>
                                <Label htmlFor="payment-method-filter" className="sr-only">Filter payment methods</Label>
                                <Select value={filter} onValueChange={setFilter} disabled={isLoading || Boolean(loadError)}>
                                <SelectTrigger id="payment-method-filter" aria-label="Filter payment methods"><SelectValue placeholder="Filter methods" /></SelectTrigger>
                                <SelectContent>
                                    {FILTERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {isLoading ? (
                            <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                                <Loader2 className="size-4 animate-spin" /> Loading payment methods...
                            </div>
                        ) : loadError && methods.length === 0 ? (
                            <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center" role="alert">
                                <AlertTriangle className="mb-3 size-9 text-amber-600" />
                                <p className="font-bold text-slate-800 dark:text-slate-100">Payment methods could not be loaded.</p>
                                <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => loadMethods()} className="mt-4" disabled={isLoading}>
                                    <RefreshCw className="size-4" /> Retry
                                </Button>
                            </div>
                        ) : filteredMethods.length === 0 ? (
                            <div className="min-h-48 p-8 text-center">
                                <WalletCards className="mx-auto mb-3 size-9 text-slate-300" />
                                <p className="font-bold text-slate-800">No payment methods match this view.</p>
                                <p className="mt-1 text-sm text-slate-500">Change the filter or add a new method.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredMethods.map((method) => {
                                    const MethodIcon = method.methodType === 'bank_transfer' ? Landmark : WalletCards;
                                    return (
                                        <article key={method.methodKey} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                                                    <MethodIcon className="size-5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="truncate font-black text-slate-950">{method.label}</h3>
                                                        <Badge className={method.isActive ? 'border-0 bg-emerald-50 text-emerald-700' : 'border-0 bg-slate-100 text-slate-600'}>
                                                            {method.isActive ? 'Active' : 'Archived'}
                                                        </Badge>
                                                        <Badge className="border-0 bg-blue-50 text-blue-700">
                                                            {method.methodType === 'bank_transfer' ? 'Bank transfer' : 'E-wallet'}
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-1 truncate text-sm font-semibold text-slate-600">{method.accountName || 'No account name'}</p>
                                                    <p className="mt-1 font-mono text-sm font-bold tracking-wide text-slate-800">
                                                        {method.maskedAccountNumber || maskAccountNumber(method.accountNumber)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                                                {method.qrImageUrl && (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setViewer({ src: method.qrImageUrl, alt: `${method.label} QR code` })} className="flex-1 sm:flex-none">
                                                        <Eye className="mr-2 size-4" /> QR
                                                    </Button>
                                                )}
                                                <Button type="button" variant="outline" size="sm" onClick={() => openEditMethod(method)} disabled={isSaving} className="flex-1 sm:flex-none">
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => toggleMethodArchive(method.methodKey)} disabled={isSaving} className="flex-1 sm:flex-none">
                                                    {method.isActive ? <Archive className="mr-2 size-4" /> : <RotateCcw className="mr-2 size-4" />}
                                                    {method.isActive ? 'Archive' : 'Restore'}
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <aside>
                    <Card className="border-blue-200 bg-blue-50 shadow-none xl:sticky xl:top-4">
                        <CardContent className="space-y-4 p-4">
                            <div>
                                <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
                                    <ShieldCheck className="size-5 text-[#155dfc]" />
                                    Publish Changes
                                </h3>
                                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                    A code is sent to {verificationEmail || 'the current Super Admin email'} before payment details are saved.
                                </p>
                            </div>
                            <Button type="button" variant="outline" onClick={sendOtp} disabled={isSendingOtp || isSaving || !hasUnsavedChanges || Boolean(loadError)} className="w-full gap-2 bg-white">
                                {isSendingOtp ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                Send Verification Code
                            </Button>
                            <div className="space-y-2">
                                <Label htmlFor="payment-method-otp">6-Digit Code</Label>
                                <Input
                                    id="payment-method-otp"
                                    name="paymentMethodOtp"
                                    value={otpCode}
                                    onChange={(event) => setOtpCode(digits(event.target.value, 6))}
                                    inputMode="numeric"
                                    restriction="digits"
                                    maxLength={6}
                                    placeholder="000000"
                                    autoComplete="one-time-code"
                                    aria-label="6-digit payment settings verification code"
                                    disabled={isSaving || !hasUnsavedChanges}
                                />
                            </div>
                            <Button type="button" onClick={saveMethods} disabled={isSaving || isLoading || !hasUnsavedChanges || Boolean(loadError) || !serverRevision} className="w-full gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                Save Payment Methods
                            </Button>
                            <div className="rounded-lg border border-emerald-200 bg-white p-3 text-sm font-semibold leading-5 text-emerald-700">
                                <CheckCircle2 className="mr-2 inline size-4" />
                                Account numbers are encrypted in the database and masked outside edit mode.
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>

            <Dialog open={editorOpen} onOpenChange={(open) => {
                if (isSaving) return;
                setEditorOpen(open);
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingKey ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
                        <DialogDescription>
                            Configure an e-wallet or bank account. The full account number is visible only while editing.
                        </DialogDescription>
                    </DialogHeader>
                    <form id="payment-method-editor" onSubmit={(event) => {
                        event.preventDefault();
                        applyDraft();
                    }} className="grid gap-4 py-2 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="payment-method-type">Method Type</Label>
                            <Select
                                value={draft.methodType}
                                onValueChange={(value) => {
                                    setDraft((current) => ({
                                        ...current,
                                        methodType: value,
                                        accountNumber: digits(current.accountNumber, value === 'bank_transfer' ? 17 : 11),
                                        qrFile: value === 'bank_transfer' ? null : current.qrFile,
                                        qrImageUrl: value === 'bank_transfer' ? '' : current.qrImageUrl,
                                    }));
                                    setDraftErrors((current) => {
                                        const next = { ...current };
                                        delete next.accountNumber;
                                        delete next.qrFile;
                                        return next;
                                    });
                                }}
                                disabled={isSaving}
                            >
                                <SelectTrigger id="payment-method-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ewallet">E-wallet</SelectItem>
                                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payment-method-label">Display Name <span aria-hidden="true" className="text-red-600">*</span></Label>
                            <Input
                                id="payment-method-label"
                                name="paymentMethodLabel"
                                value={draft.label}
                                onChange={(event) => updateDraft('label', event.target.value)}
                                onBlur={(event) => updateDraft('label', normalizeInlineText(event.target.value))}
                                placeholder="e.g., BDO, BancNet, GCash"
                                maxLength={100}
                                required
                                disabled={isSaving}
                                aria-invalid={Boolean(draftErrors.label)}
                                aria-describedby={draftErrors.label ? 'payment-method-label-error' : undefined}
                            />
                            {draftErrors.label && <p id="payment-method-label-error" className="text-xs font-semibold text-red-600 dark:text-red-400">{draftErrors.label}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payment-account-name">Account Name <span aria-hidden="true" className="text-red-600">*</span></Label>
                            <Input
                                id="payment-account-name"
                                name="accountName"
                                value={draft.accountName}
                                onChange={(event) => updateDraft('accountName', event.target.value)}
                                onBlur={(event) => updateDraft('accountName', normalizeInlineText(event.target.value))}
                                placeholder="Name shown on the receiving account"
                                autoComplete="name"
                                autoCapitalize="words"
                                maxLength={150}
                                required
                                disabled={isSaving}
                                aria-invalid={Boolean(draftErrors.accountName)}
                                aria-describedby={draftErrors.accountName ? 'payment-account-name-error' : 'payment-account-name-help'}
                            />
                            {draftErrors.accountName ? (
                                <p id="payment-account-name-error" className="text-xs font-semibold text-red-600 dark:text-red-400">{draftErrors.accountName}</p>
                            ) : (
                                <p id="payment-account-name-help" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Enter the exact personal or business name owners will see when paying.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payment-account-number">
                                {draft.methodType === 'bank_transfer' ? 'Bank Account Number' : 'Philippine Mobile Number'}
                                {draft.methodType === 'bank_transfer' && <span aria-hidden="true" className="text-red-600">*</span>}
                            </Label>
                            <Input
                                id="payment-account-number"
                                name="accountNumber"
                                value={draft.accountNumber}
                                onChange={(event) => updateDraft('accountNumber', digits(event.target.value, draft.methodType === 'bank_transfer' ? 17 : 11))}
                                inputMode="numeric"
                                restriction="digits"
                                maxLength={draft.methodType === 'bank_transfer' ? 17 : 11}
                                placeholder={draft.methodType === 'bank_transfer' ? '6 to 17 digits' : '09XXXXXXXXX'}
                                required={draft.methodType === 'bank_transfer'}
                                disabled={isSaving}
                                aria-invalid={Boolean(draftErrors.accountNumber)}
                                aria-describedby="payment-account-number-help"
                            />
                            <p id="payment-account-number-help" className={`text-xs font-semibold ${draftErrors.accountNumber ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                {draftErrors.accountNumber || (draft.methodType === 'bank_transfer'
                                    ? 'Numbers only, 6 to 17 digits.'
                                    : 'Use 11 digits beginning with 09, or provide a QR image below.')}
                            </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="payment-owner-instructions">Owner Instructions</Label>
                            <Textarea
                                id="payment-owner-instructions"
                                name="instructions"
                                value={draft.instructions}
                                onChange={(event) => updateDraft('instructions', event.target.value)}
                                onBlur={(event) => updateDraft('instructions', event.target.value.trim())}
                                className="min-h-24"
                                maxLength={1000}
                                placeholder="Tell owners how to pay and what proof to upload."
                                disabled={isSaving}
                            />
                        </div>
                        {draft.methodType === 'ewallet' && (
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="payment-qr-image">QR Image (Optional when a mobile number is provided)</Label>
                                <label htmlFor="payment-qr-image" className={`flex min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center text-sm font-bold transition ${isSaving ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500' : 'cursor-pointer bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40'} ${draftErrors.qrFile ? 'border-red-400 dark:border-red-700' : 'border-slate-300 dark:border-slate-700'}`}>
                                    <Upload className="size-4" />
                                    {draft.qrFile?.name || (draft.qrImageUrl ? 'Replace QR image' : 'Upload QR image')}
                                    <input
                                        id="payment-qr-image"
                                        name="qrImage"
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        className="hidden"
                                        disabled={isSaving}
                                        onChange={(event) => updateDraft('qrFile', event.target.files?.[0] || null)}
                                    />
                                </label>
                                {draftErrors.qrFile && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{draftErrors.qrFile}</p>}
                                {!draftErrors.qrFile && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">JPG, PNG, GIF, or WebP; maximum 8 MB.</p>}
                            </div>
                        )}
                    </form>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" form="payment-method-editor" disabled={isSaving} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                            {editingKey ? 'Apply Changes' : 'Complete Add Method'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Payment QR image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}
