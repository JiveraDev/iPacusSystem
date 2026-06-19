import { createElement, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { UserCog, Mail, Award, Ban, CheckCircle, UserPlus, Key, Stethoscope, Briefcase, Calendar, Loader2, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDate } from '../../lib/date';
import PasswordInput from '../shared/PasswordInput.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createAccount, fetchAccounts as fetchAccountsService, updateAccountStatus } from '../../services/accountService';

export default function AccountManagement() {
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showCreateAccount, setShowCreateAccount] = useState(false);
    const [pendingStatusAction, setPendingStatusAction] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState({ veterinarians: [], staff: [] });

    // Create Account Form State
    const [createForm, setCreateForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'Veterinarian',
        hireDate: new Date().toISOString().split('T')[0],
        licenseNumber: '',
        specialization: '',
        position: 'Nurse',
        employmentStatus: 'full-time',
        masterKey: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const clearCreatePasswordFields = () => {
        setCreateForm((currentForm) => ({
            ...currentForm,
            password: '',
            masterKey: ''
        }));
    };

    const fetchAccounts = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        try {
            const data = await fetchAccountsService();
            setAccounts(data);
        } catch (error) {
            console.error("Error fetching accounts:", error);
            toast.error("Failed to load accounts");
        } finally {
            setIsLoading(false);
        }
    };

    useAutoRefresh(fetchAccounts);

    const handleCreateAccount = async (e) => {
        e.preventDefault();

        setIsSubmitting(true);
        try {
            await createAccount(createForm);
            toast.success(`${createForm.role} account created successfully!`);
            setShowCreateAccount(false);
            fetchAccounts();
            setCreateForm({
                firstName: '', lastName: '', email: '', password: '',
                role: 'Veterinarian', hireDate: new Date().toISOString().split('T')[0],
                licenseNumber: '', specialization: '',
                position: 'Nurse', employmentStatus: 'full-time', masterKey: ''
            });
        } catch (error) {
            console.error("Creation error:", error);
            clearCreatePasswordFields();
            toast.error(error.message || "An error occurred during account creation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAccountActive = (status) => status === true || status === 1 || status === '1' || status === 'active';
    const displayValue = (value, fallback = 'Not provided') => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };
    const getInitials = (account) => {
        const first = displayValue(account?.first_Name, '').charAt(0);
        const last = displayValue(account?.last_Name, '').charAt(0);
        return `${first}${last}`.trim() || 'IP';
    };
    const parseHistory = (value) => {
        if (!value) return [];
        try {
            const decoded = JSON.parse(value);
            if (Array.isArray(decoded)) {
                return decoded.map((entry) => {
                    if (typeof entry === 'string') return entry;
                    return [
                        entry.title,
                        entry.organization,
                        entry.company,
                        entry.description,
                        entry.year || entry.years || entry.date
                    ].filter(Boolean).join(' - ');
                }).filter(Boolean);
            }
        } catch {
            return String(value).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        }
        return String(value).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    };
    const ProfileField = ({ icon, label, value, accent = 'text-slate-950' }) => (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    {createElement(icon, { className: 'size-4' })}
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                    <p className={`mt-1 break-words text-sm font-bold ${accent}`}>{displayValue(value)}</p>
                </div>
            </div>
        </div>
    );
    const HistoryBlock = ({ title, value }) => {
        const rows = parseHistory(value);
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-black text-slate-950">{title}</h5>
                {rows.length ? (
                    <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
                        {rows.map((line, index) => <li key={`${title}-${index}`}>{line}</li>)}
                    </ul>
                ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-400">Not provided</p>
                )}
            </div>
        );
    };

    const openStatusConfirmation = (user) => {
        const currentStatus = isAccountActive(user.is_active);
        setPendingStatusAction({
            userId: user.user_id,
            currentStatus,
            type: user.type,
            name: `${user.first_Name || ''} ${user.last_Name || ''}`.trim() || 'this account',
            role: user.role || (user.type === 'vet' ? 'Veterinarian' : 'Admin')
        });
    };

    const closeStatusConfirmation = () => {
        if (!isUpdatingStatus) {
            setPendingStatusAction(null);
        }
    };

    const handleToggleStatus = async () => {
        if (!pendingStatusAction) return;

        const { userId, currentStatus, type } = pendingStatusAction;
        const action = currentStatus ? 'deactivate' : 'activate';

        setIsUpdatingStatus(true);
        try {
            await updateAccountStatus(userId, { is_active: currentStatus ? 0 : 1, type });
            toast.success(`Account ${action}d successfully`);
            fetchAccounts();
            setPendingStatusAction(null);
            setShowDetails(false);
        } catch (error) {
            console.error("Status update error:", error);
            toast.error(error.message || "An error occurred");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const getStatusBadge = (status) => {
        if (isAccountActive(status)) {
            return <Badge className="bg-green-500 text-white">Active</Badge>;
        }
        return <Badge className="bg-gray-500 text-white">Disabled</Badge>;
    };

    const EmptyCard = ({ title, description, icon }) => (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/10 flex flex-col justify-center min-h-[250px] shadow-none pointer-events-none">
            <CardContent className="flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                        {createElement(icon, { className: 'h-8 w-8 text-slate-200' })}
                    </div>
                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-tight">{title}</h3>
                    <p className="text-slate-300 text-sm mt-1">{description}</p>
                </div>
            </CardContent>
        </Card>
    );

    const UserCard = ({ user, type }) => (
        <Card className="p-4 md:p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${
                        type === 'vet' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                        {type === 'vet' ? <Stethoscope className="w-6 h-6 text-blue-600" /> : <UserCog className="w-6 h-6 text-purple-600" />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-bold text-gray-900 md:text-lg">{user.first_Name} {user.last_Name}</h3>
                        </div>
                        <p className="truncate text-sm text-gray-600">{type === 'vet' ? user.specialization : user.postionn}</p>
                    </div>
                </div>
                {getStatusBadge(user.is_active)}
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{user.mail_Address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span>{type === 'vet' ? `Lic: ${user.prc_license_number}` : user.employment_status}</span>
                </div>
            </div>

            <Button
                onClick={() => {
                    setSelectedUser({ ...user, type });
                    setShowDetails(true);
                }}
                variant="outline"
                className="w-full"
            >
                View Details
            </Button>
        </Card>
    );

    return (
        <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
                    <p className="text-sm text-gray-500">Manage staff and veterinarians</p>
                </div>
                <Button onClick={() => setShowCreateAccount(true)} className="w-full bg-blue-600 text-white sm:w-auto">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                </Button>
            </div>

            <div>
                <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Staff & Nurses</h2>
                    <p className="text-sm md:text-base text-gray-600">Active and approved clinic staff and nursing personnel</p>
                </div>
                <div className="responsive-grid gap-4 md:gap-6">
                    {isLoading ? [1,2].map(i => <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-xl" />) :
                     accounts.staff.length > 0 ? accounts.staff.map((user) => (
                        <UserCard key={user.user_id} user={user} type="staff" />
                    )) : (
                        <EmptyCard title="No Staff Found" description="Approved staff and nursing records will appear here." icon={UserCog} />
                    )}
                </div>
            </div>

            <div>
                <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Veterinarians</h2>
                    <p className="text-sm md:text-base text-gray-600">Active and approved licensed veterinarians</p>
                </div>
                <div className="responsive-grid gap-4 md:gap-6">
                    {isLoading ? [1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-xl" />) :
                     accounts.veterinarians.length > 0 ? accounts.veterinarians.map((user) => (
                        <UserCard key={user.user_id} user={user} type="vet" />
                    )) : (
                        <EmptyCard title="No Veterinarians Found" description="Licensed doctors added to the system will appear here." icon={Stethoscope} />
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedUser && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-xl md:text-2xl">Account Details</DialogTitle>
                                <DialogDescription>Complete information and account management</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#f5f3ff_100%)] p-5">
                                    <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-black ${
                                                selectedUser.type === 'vet' ? 'bg-blue-600' : 'bg-purple-600'
                                            }`}>
                                                {getInitials(selectedUser)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="truncate text-xl font-bold text-gray-900">{selectedUser.first_Name} {selectedUser.last_Name}</h3>
                                                <p className="text-sm font-semibold text-gray-600">
                                                    {selectedUser.role} · {selectedUser.type === 'vet' ? displayValue(selectedUser.veterinarian_id) : displayValue(selectedUser.employee_id)}
                                                </p>
                                            </div>
                                        </div>
                                        {getStatusBadge(selectedUser.is_active)}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-900">Personal Information</h4>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <ProfileField icon={Mail} label="Email Address" value={selectedUser.mail_Address} />
                                        <ProfileField icon={Phone} label="Phone Number" value={selectedUser.phoneNumber || selectedUser.emergencyNumber} />
                                        <ProfileField icon={MapPin} label="Address" value={selectedUser.personal_Address} />
                                        <ProfileField icon={Calendar} label="Birthdate" value={selectedUser.birthdate ? formatDisplayDate(selectedUser.birthdate) : ''} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-900">Professional Profile</h4>
                                    {selectedUser.type === 'vet' ? (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            <ProfileField icon={Award} label="Veterinarian ID" value={selectedUser.veterinarian_id} accent="text-blue-700" />
                                            <ProfileField icon={Award} label="PRC License" value={selectedUser.prc_license_number} accent="text-blue-700" />
                                            <ProfileField icon={Briefcase} label="Specialization" value={selectedUser.specialization} />
                                            <ProfileField icon={Calendar} label="Hire Date" value={selectedUser.hire_date ? formatDisplayDate(selectedUser.hire_date) : ''} />
                                            <ProfileField icon={ShieldCheck} label="Accepting Patients" value={Number(selectedUser.is_accepting_patients ?? 1) === 1 ? 'Yes' : 'No'} />
                                            <ProfileField icon={Briefcase} label="Years of Experience" value={selectedUser.years_of_experience} />
                                            <ProfileField icon={CheckCircle} label="Consultation Rate" value={selectedUser.consultation_rate ? `PHP ${selectedUser.consultation_rate}` : ''} />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            <ProfileField icon={UserCog} label="Employee ID" value={selectedUser.employee_id} accent="text-purple-700" />
                                            <ProfileField icon={UserCog} label="Position" value={selectedUser.postionn} accent="text-purple-700" />
                                            <ProfileField icon={CheckCircle} label="Employment Status" value={selectedUser.employment_status} />
                                            <ProfileField icon={Calendar} label="Hire Date" value={selectedUser.hire_date ? formatDisplayDate(selectedUser.hire_date) : ''} />
                                            <ProfileField icon={Briefcase} label="Years of Experience" value={selectedUser.years_of_experience} />
                                            <ProfileField icon={ShieldCheck} label="SSS Number" value={selectedUser.sss_number} />
                                            <ProfileField icon={ShieldCheck} label="PhilHealth Number" value={selectedUser.philhealth_number} />
                                            <ProfileField icon={ShieldCheck} label="TIN Number" value={selectedUser.tin_number} />
                                            <ProfileField icon={ShieldCheck} label="Pag-IBIG Number" value={selectedUser.pagibig_number} />
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <HistoryBlock title="Education History" value={selectedUser.education_history} />
                                    <HistoryBlock title="Experience History" value={selectedUser.experience_history} />
                                </div>

                                <div className="border-t pt-6">
                                    <h4 className="font-bold text-gray-900 mb-3 text-sm">Administrative Actions</h4>
                                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                        {(selectedUser.is_active === 1 || selectedUser.is_active === '1') ? (
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => openStatusConfirmation(selectedUser)}
                                            >
                                                <Ban className="size-4 mr-2" /> Deactivate Account
                                            </Button>
                                        ) : (
                                            <Button 
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => openStatusConfirmation(selectedUser)}
                                            >
                                                <CheckCircle className="size-4 mr-2" /> Activate Account
                                            </Button>
                                        )}
                                        <Button variant="ghost" onClick={() => setShowDetails(false)}>Close</Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Status Confirmation Modal */}
            <Dialog open={Boolean(pendingStatusAction)} onOpenChange={(open) => !open && closeStatusConfirmation()}>
                <DialogContent className="max-w-md">
                    {pendingStatusAction && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {pendingStatusAction.currentStatus ? 'Deactivate Account' : 'Activate Account'}
                                </DialogTitle>
                                <DialogDescription>
                                    Confirm this account status change before it is applied.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600">Account</p>
                                <p className="mt-1 font-semibold text-slate-900">{pendingStatusAction.name}</p>
                                <p className="text-sm text-slate-500">{pendingStatusAction.role}</p>
                            </div>

                            <p className="text-sm text-slate-700">
                                {pendingStatusAction.currentStatus
                                    ? 'This user will no longer be able to log in until the account is activated again.'
                                    : 'This user will regain access and can log in again.'}
                            </p>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeStatusConfirmation} disabled={isUpdatingStatus}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isUpdatingStatus}
                                    onClick={handleToggleStatus}
                                    className={pendingStatusAction.currentStatus ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}
                                >
                                    {isUpdatingStatus ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : pendingStatusAction.currentStatus ? (
                                        'Deactivate Account'
                                    ) : (
                                        'Activate Account'
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create Account Modal */}
            <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl">Create New Account</DialogTitle>
                        <DialogDescription>Super Admin Authorization Required</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateAccount} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-gray-900 mb-2 block">Account Type</Label>
                                <Select value={createForm.role} onValueChange={(v) => setCreateForm({...createForm, role: v})}>
                                    <SelectTrigger className="bg-gray-100 border-gray-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Veterinarian">Veterinarian</SelectItem>
                                        <SelectItem value="Admin">Admin / Staff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Hiring Date</Label>
                                <Input type="date" value={createForm.hireDate} onChange={(e) => setCreateForm({...createForm, hireDate: e.target.value})} className="bg-gray-100" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-gray-900 mb-2 block">First Name</Label>
                                <Input placeholder="First Name" required value={createForm.firstName} onChange={(e) => setCreateForm({...createForm, firstName: e.target.value})} className="bg-gray-100" />
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Last Name</Label>
                                <Input placeholder="Last Name" required value={createForm.lastName} onChange={(e) => setCreateForm({...createForm, lastName: e.target.value})} className="bg-gray-100" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-gray-900 mb-2 block">Email</Label>
                                <Input type="email" required placeholder="email@ipawcus.com" value={createForm.email} onChange={(e) => setCreateForm({...createForm, email: e.target.value})} className="bg-gray-100" />
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Password</Label>
                                <PasswordInput required placeholder="Password" value={createForm.password} onChange={(e) => setCreateForm({...createForm, password: e.target.value})} inputClassName="bg-gray-100" />
                            </div>
                        </div>

                        {createForm.role === 'Veterinarian' ? (
                            <div className="grid grid-cols-1 gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
                                <div>
                                    <Label className="text-blue-900">PRC License</Label>
                                    <Input placeholder="PRC-VET-00000" value={createForm.licenseNumber} onChange={(e) => setCreateForm({...createForm, licenseNumber: e.target.value})} className="bg-white" />
                                </div>
                                <div>
                                    <Label className="text-blue-900">Specialization</Label>
                                    <Input placeholder="e.g. Small Animal Surgery" value={createForm.specialization} onChange={(e) => setCreateForm({...createForm, specialization: e.target.value})} className="bg-white" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4 sm:grid-cols-2">
                                <div>
                                    <Label className="text-purple-900">Position</Label>
                                    <Select value={createForm.position} onValueChange={(v) => setCreateForm({...createForm, position: v})}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Nurse">Senior Nurse</SelectItem>
                                            <SelectItem value="Staff">Clinic Staff</SelectItem>
                                            <SelectItem value="Receptionist">Receptionist</SelectItem>
                                            <SelectItem value="Assistant">Assistant</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-purple-900">Status</Label>
                                    <Select value={createForm.employmentStatus} onValueChange={(v) => setCreateForm({...createForm, employmentStatus: v})}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="full-time">Full-time</SelectItem>
                                            <SelectItem value="part-time">Part-time</SelectItem>
                                            <SelectItem value="contract">Contract</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <Label className="text-red-600 flex items-center gap-2"><Key className="size-4" /> Master Key Verification</Label>
                            <PasswordInput required placeholder="Enter Super Admin Key" value={createForm.masterKey} onChange={(e) => setCreateForm({...createForm, masterKey: e.target.value})} inputClassName="bg-red-50 border-red-200" />
                        </div>

                        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                            <Button type="button" onClick={() => setShowCreateAccount(false)} variant="outline" className="flex-1">Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                {isSubmitting ? "Creating..." : "Confirm & Create"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
