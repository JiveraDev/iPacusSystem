import { useEffect, useMemo, useState } from 'react';
import {
    Archive,
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
import { useDashboardUser } from '../dashboardRouter.jsx';
import { uploadImageFile } from '../../services/uploadService';
import { fetchPaymentMethods, requestPaymentMethodsOtp, updatePaymentMethods } from '../../services/paymentMethodService';
import { PAYMENT_METHOD_FALLBACK } from '../../hooks/usePaymentMethods';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ProtectedImage from '../shared/ProtectedImage';

const FILTERS = [
    { value: 'all', label: 'All methods' },
    { value: 'ewallet', label: 'E-wallets' },
    { value: 'bank_transfer', label: 'Bank transfers' },
];

function currentUserEmail(user) {
    return user?.mail_Address || user?.email || '';
}

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
    if (number.length <= 6) return number;
    return `${number.slice(0, 3)}${'*'.repeat(Math.max(4, number.length - 6))}${number.slice(-3)}`;
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

function validateDraft(method) {
    if (!method.label.trim()) return 'Display name is required.';
    if (method.methodType === 'ewallet' && method.accountNumber && !/^09\d{9}$/.test(method.accountNumber)) {
        return 'E-wallet number must contain 11 digits and begin with 09.';
    }
    if (method.methodType === 'bank_transfer' && method.accountNumber && (method.accountNumber.length < 6 || method.accountNumber.length > 17)) {
        return 'Bank account number must contain 6 to 17 digits.';
    }
    return '';
}

export default function PaymentMethodsManagement() {
    const currentUser = useDashboardUser();
    const [methods, setMethods] = useState(PAYMENT_METHOD_FALLBACK.map(normalizeMethod));
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingKey, setEditingKey] = useState('');
    const [draft, setDraft] = useState(emptyDraft);
    const [viewer, setViewer] = useState(null);

    const userEmail = currentUserEmail(currentUser);
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

    const loadMethods = async () => {
        setIsLoading(true);
        try {
            const data = await fetchPaymentMethods({ includeInactive: 1 });
            const nextMethods = Array.isArray(data.methods) && data.methods.length > 0
                ? data.methods.map(normalizeMethod)
                : PAYMENT_METHOD_FALLBACK.map(normalizeMethod);
            setMethods(nextMethods);
        } catch (error) {
            toast.error(error.message || 'Payment methods could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMethods();
    }, []);

    const openNewMethod = () => {
        setEditingKey('');
        setDraft(emptyDraft());
        setEditorOpen(true);
    };

    const openEditMethod = (method) => {
        setEditingKey(method.methodKey);
        setDraft({ ...method, qrFile: null });
        setEditorOpen(true);
    };

    const applyDraft = () => {
        const error = validateDraft(draft);
        if (error) {
            toast.error(error);
            return;
        }

        const nextKey = editingKey || methodKeyFromLabel(draft.label);
        if (!editingKey && methods.some((method) => method.methodKey === nextKey)) {
            toast.error('A payment method with this name already exists.');
            return;
        }

        const nextMethod = normalizeMethod({ ...draft, methodKey: nextKey, maskedAccountNumber: maskAccountNumber(draft.accountNumber) });
        nextMethod.qrFile = draft.qrFile || null;
        setMethods((current) => editingKey
            ? current.map((method) => method.methodKey === editingKey ? nextMethod : method)
            : [...current, nextMethod]);
        setEditorOpen(false);
        toast.info('Changes are ready. Verify by email and save to publish them.');
    };

    const toggleMethodArchive = (methodKey) => {
        setMethods((current) => current.map((method) => (
            method.methodKey === methodKey ? { ...method, isActive: !method.isActive } : method
        )));
    };

    const sendOtp = async () => {
        setIsSendingOtp(true);
        try {
            const response = await requestPaymentMethodsOtp({});
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
        const invalidMethod = methods.find((method) => validateDraft(method));
        if (invalidMethod) {
            toast.error(`${invalidMethod.label}: ${validateDraft(invalidMethod)}`);
            return;
        }
        if (!methods.some((method) => method.isActive)) {
            toast.error('Keep at least one payment method active.');
            return;
        }

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
                methods: nextMethods,
            });
            setMethods(Array.isArray(response.methods) ? response.methods.map(normalizeMethod) : nextMethods.map(normalizeMethod));
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
                        <Button type="button" variant="outline" onClick={loadMethods} disabled={isLoading || isSaving} className="h-10 gap-2">
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Refresh
                        </Button>
                        <Button type="button" onClick={openNewMethod} disabled={isSaving} className="h-10 gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
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
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search payment methods"
                            />
                            <Select value={filter} onValueChange={setFilter}>
                                <SelectTrigger><SelectValue placeholder="Filter methods" /></SelectTrigger>
                                <SelectContent>
                                    {FILTERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {isLoading ? (
                            <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                                <Loader2 className="size-4 animate-spin" /> Loading payment methods...
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
                                            <div className="flex shrink-0 gap-2">
                                                {method.qrImageUrl && (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setViewer({ src: method.qrImageUrl, alt: `${method.label} QR code` })}>
                                                        <Eye className="mr-2 size-4" /> QR
                                                    </Button>
                                                )}
                                                <Button type="button" variant="outline" size="sm" onClick={() => openEditMethod(method)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => toggleMethodArchive(method.methodKey)}>
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
                                    A code is sent to {userEmail || 'the Super Admin email'} before payment details are saved.
                                </p>
                            </div>
                            <Button type="button" variant="outline" onClick={sendOtp} disabled={isSendingOtp || isSaving} className="w-full gap-2 bg-white">
                                {isSendingOtp ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                Send Verification Code
                            </Button>
                            <div className="space-y-2">
                                <Label>6-Digit Code</Label>
                                <Input
                                    value={otpCode}
                                    onChange={(event) => setOtpCode(digits(event.target.value, 6))}
                                    inputMode="numeric"
                                    restriction="digits"
                                    maxLength={6}
                                    placeholder="000000"
                                    disabled={isSaving}
                                />
                            </div>
                            <Button type="button" onClick={saveMethods} disabled={isSaving || isLoading} className="w-full gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
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

            <Dialog open={editorOpen} onOpenChange={(open) => !isSaving && setEditorOpen(open)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingKey ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
                        <DialogDescription>
                            Configure an e-wallet or bank account. The full account number is visible only while editing.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Method Type</Label>
                            <Select
                                value={draft.methodType}
                                onValueChange={(value) => setDraft((current) => ({
                                    ...current,
                                    methodType: value,
                                    accountNumber: digits(current.accountNumber, value === 'bank_transfer' ? 17 : 11),
                                }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ewallet">E-wallet</SelectItem>
                                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g., BDO, BancNet, GCash" maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account Name</Label>
                            <Input value={draft.accountName} onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))} placeholder="Account holder name" maxLength={150} />
                        </div>
                        <div className="space-y-2">
                            <Label>{draft.methodType === 'bank_transfer' ? 'Bank Account Number' : 'Philippine Mobile Number'}</Label>
                            <Input
                                value={draft.accountNumber}
                                onChange={(event) => setDraft((current) => ({
                                    ...current,
                                    accountNumber: digits(event.target.value, current.methodType === 'bank_transfer' ? 17 : 11),
                                }))}
                                inputMode="numeric"
                                restriction="digits"
                                maxLength={draft.methodType === 'bank_transfer' ? 17 : 11}
                                placeholder={draft.methodType === 'bank_transfer' ? '6 to 17 digits' : '09XXXXXXXXX'}
                            />
                            <p className="text-xs font-semibold text-slate-500">
                                {draft.methodType === 'bank_transfer' ? 'Numbers only, maximum 17 digits.' : 'Use the 11-digit format beginning with 09.'}
                            </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Owner Instructions</Label>
                            <Textarea value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} className="min-h-24" maxLength={1000} placeholder="Tell owners how to pay and what proof to upload." />
                        </div>
                        {draft.methodType === 'ewallet' && (
                            <div className="space-y-2 md:col-span-2">
                                <Label>QR Image (Optional)</Label>
                                <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50">
                                    <Upload className="size-4" />
                                    {draft.qrFile?.name || (draft.qrImageUrl ? 'Replace QR image' : 'Upload QR image')}
                                    <input type="file" accept="image/*" className="hidden" onChange={(event) => setDraft((current) => ({ ...current, qrFile: event.target.files?.[0] || null }))} />
                                </label>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={applyDraft} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            <CreditCard className="mr-2 size-4" /> Apply Changes
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
