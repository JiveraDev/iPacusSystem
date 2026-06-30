import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, CreditCard, Eye, Loader2, RefreshCw, Save, ShieldCheck, Upload } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { resolveImageUrl } from '../../lib/image';
import { uploadImageFile } from '../../services/uploadService';
import { fetchPaymentMethods, requestPaymentMethodsOtp, updatePaymentMethods } from '../../services/paymentMethodService';
import { PAYMENT_METHOD_FALLBACK } from '../../hooks/usePaymentMethods';

const METHOD_HELP = {
    qrph: 'QR payment image and account display shown to pet owners.',
    maya: 'Mobile wallet name and number used in owner payment screens.',
    gcash: 'Mobile wallet name and number used in owner payment screens.',
    bank_transfer: 'Bank account name, bank name, account number, and transfer notes.'
};

function currentUserId(user) {
    return user?.user_id || user?.userId || user?.id || null;
}

function currentUserEmail(user) {
    return user?.mail_Address || user?.email || '';
}

function normalizeAccountNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeMethod(method) {
    const key = method.methodKey || method.key || method.value;
    const rawAccountNumber = method.accountNumber || '';
    const accountNumber = /x/i.test(rawAccountNumber) ? '' : rawAccountNumber;

    return {
        methodKey: key,
        value: key,
        label: method.label || key,
        accountName: method.accountName || '',
        accountNumber: normalizeAccountNumber(accountNumber),
        instructions: method.instructions || '',
        qrImageUrl: method.qrImageUrl || '',
        requiresProof: true
    };
}

export default function PaymentMethodsManagement() {
    const currentUser = useDashboardUser();
    const [methods, setMethods] = useState(PAYMENT_METHOD_FALLBACK.map(normalizeMethod));
    const [qrFile, setQrFile] = useState(null);
    const [otpCode, setOtpCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [skipOtp, setSkipOtp] = useState(false);
    const [viewer, setViewer] = useState(null);

    const userEmail = currentUserEmail(currentUser);
    const userId = currentUserId(currentUser);
    const qrMethod = useMemo(() => methods.find(method => method.methodKey === 'qrph'), [methods]);

    const loadMethods = async () => {
        setIsLoading(true);
        try {
            const data = await fetchPaymentMethods({ includeInactive: 1 });
            const nextMethods = Array.isArray(data.methods) && data.methods.length > 0
                ? data.methods.map(normalizeMethod)
                : PAYMENT_METHOD_FALLBACK.map(normalizeMethod);
            setMethods(nextMethods);
            setQrFile(null);
        } catch (error) {
            toast.error(error.message || 'Failed to load payment methods.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMethods();
    }, []);

    const updateMethod = (methodKey, patch) => {
        setMethods(current => current.map(method => (
            method.methodKey === methodKey ? { ...method, ...patch } : method
        )));
    };

    const sendOtp = async () => {
        if (!userId && !userEmail) {
            toast.error('Super Admin account email is required.');
            return;
        }

        setIsSendingOtp(true);
        try {
            const response = await requestPaymentMethodsOtp({ userId, email: userEmail });
            toast.success(response.message || 'Verification code sent.');
        } catch (error) {
            toast.error(error.message || 'Failed to send verification code.');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const saveMethods = async () => {
        if (!skipOtp && !/^\d{6}$/.test(otpCode.trim())) {
            toast.error('Enter the 6-digit email verification code.');
            return;
        }

        setIsSaving(true);
        try {
            let nextMethods = methods.map((method) => ({
                ...method,
                accountNumber: normalizeAccountNumber(method.accountNumber)
            }));

            if (qrFile) {
                const qrImageUrl = await uploadImageFile(qrFile, 'payment_qr');
                nextMethods = nextMethods.map(method => (
                    method.methodKey === 'qrph' ? { ...method, qrImageUrl } : method
                ));
            }

            const response = await updatePaymentMethods({
                userId,
                email: userEmail,
                code: skipOtp ? '' : otpCode.trim(),
                skipOtp,
                methods: nextMethods
            });

            setMethods(Array.isArray(response.methods) ? response.methods.map(normalizeMethod) : nextMethods);
            setQrFile(null);
            setOtpCode('');
            toast.success(response.message || 'Payment methods updated.');
        } catch (error) {
            toast.error(error.message || 'Failed to update payment methods.');
        } finally {
            setIsSaving(false);
        }
    };

    const qrPreviewUrl = qrFile ? URL.createObjectURL(qrFile) : resolveImageUrl(qrMethod?.qrImageUrl || '');

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-950">Payment Methods</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        Manage the clinic payment names, numbers, instructions, and QRPH image used by owner payment screens.
                    </p>
                </div>
                <Button type="button" variant="outline" onClick={loadMethods} disabled={isLoading || isSaving} className="gap-2">
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-4">
                    {methods.map((method) => (
                        <Card key={method.methodKey} className="border-slate-200">
                            <CardContent className="space-y-4 p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                                            <CreditCard className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-black text-slate-950">{method.label}</h3>
                                                <Badge className="border-0 bg-green-50 text-green-700">Enabled</Badge>
                                            </div>
                                            <p className="mt-1 text-sm font-semibold text-slate-500">{METHOD_HELP[method.methodKey]}</p>
                                        </div>
                                    </div>
                                    <Badge className="w-fit border-0 bg-slate-100 text-slate-700">{method.methodKey}</Badge>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Display Name</Label>
                                        <Input
                                            value={method.label}
                                            onChange={(event) => updateMethod(method.methodKey, { label: event.target.value })}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Account Name</Label>
                                        <Input
                                            value={method.accountName}
                                            onChange={(event) => updateMethod(method.methodKey, { accountName: event.target.value })}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Account Number</Label>
                                        <Input
                                            value={method.accountNumber}
                                            onChange={(event) => updateMethod(method.methodKey, {
                                                accountNumber: normalizeAccountNumber(event.target.value)
                                            })}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="Account number"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Owner Instructions</Label>
                                        <Textarea
                                            value={method.instructions}
                                            onChange={(event) => updateMethod(method.methodKey, { instructions: event.target.value })}
                                            className="min-h-24"
                                            disabled={isSaving}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <aside className="space-y-4">
                    <Card className="border-slate-200">
                        <CardContent className="space-y-4 p-5">
                            <div>
                                <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
                                    <Camera className="size-5 text-[#155dfc]" />
                                    QRPH Image
                                </h3>
                                <p className="mt-1 text-sm font-semibold text-slate-500">Upload the image owners scan for QRPH payments.</p>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                <div className="flex h-56 items-center justify-center bg-white">
                                    {qrPreviewUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => setViewer({ src: qrPreviewUrl, alt: 'QRPH payment code' })}
                                            className="h-full w-full"
                                        >
                                            <img src={qrPreviewUrl} alt="QRPH payment code" className="h-full w-full object-contain" />
                                        </button>
                                    ) : (
                                        <Camera className="size-12 text-slate-300" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 p-3">
                                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#155dfc] px-4 text-sm font-bold text-white hover:bg-[#0d4acf]">
                                        <Upload className="size-4" />
                                        Upload QRPH
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(event) => setQrFile(event.target.files?.[0] || null)}
                                            disabled={isSaving}
                                            className="hidden"
                                        />
                                    </label>
                                    {qrPreviewUrl && (
                                        <Button type="button" variant="outline" onClick={() => setViewer({ src: qrPreviewUrl, alt: 'QRPH payment code' })} className="gap-2">
                                            <Eye className="size-4" />
                                            View Image
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={skipOtp ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}>
                        <CardContent className="space-y-4 p-5">
                            <div>
                                <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
                                    <ShieldCheck className={`size-5 ${skipOtp ? 'text-amber-700' : 'text-[#155dfc]'}`} />
                                    {skipOtp ? 'OTP Bypass Enabled' : 'Email OTP Required'}
                                </h3>
                                <p className="mt-1 text-sm font-semibold text-slate-600">
                                    {skipOtp
                                        ? 'Debug mode lets you save without an email code. Turn it off for normal verification.'
                                        : `Codes are sent to ${userEmail || 'the Super Admin email'} before payment details can be changed.`}
                                </p>
                            </div>

                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">Debug OTP Bypass</p>
                                    <p className="text-xs font-semibold text-slate-500">Save payment changes without email OTP.</p>
                                </div>
                                <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${skipOtp ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                    <span className={`inline-block size-5 rounded-full bg-white shadow transition ${skipOtp ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </span>
                                <Checkbox
                                    checked={skipOtp}
                                    onCheckedChange={setSkipOtp}
                                    disabled={isSaving}
                                    className="sr-only"
                                />
                            </label>

                            <Button type="button" variant="outline" onClick={sendOtp} disabled={skipOtp || isSendingOtp || isSaving} className="w-full gap-2 bg-white">
                                {isSendingOtp ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                Send Verification Code
                            </Button>

                            <div className="space-y-2">
                                <Label>6-Digit Code</Label>
                                <Input
                                    value={otpCode}
                                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric"
                                    placeholder="000000"
                                    disabled={skipOtp || isSaving}
                                />
                            </div>

                            <Button type="button" onClick={saveMethods} disabled={isSaving || isLoading} className="w-full gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                {skipOtp ? 'Save Without OTP' : 'Save Payment Methods'}
                            </Button>

                            <div className="rounded-lg border border-green-200 bg-white p-3 text-sm font-semibold text-green-700">
                                <CheckCircle2 className="mr-2 inline size-4" />
                                Active methods: QRPH, Maya, GCash, and Bank Transfer only.
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Payment QR image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}
