import { createElement, useEffect, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { UserCog, Mail, Award, Archive, CheckCircle, UserPlus, Key, Stethoscope, Briefcase, Calendar, Loader2, MapPin, Phone, RotateCcw, ShieldCheck, Pencil, Save, X, Search, RefreshCw } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDate } from '../../lib/date';
import PasswordInput from '../shared/PasswordInput.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createAccount, deleteAccount, fetchAccounts as fetchAccountsService, updateAccountStatus, updatePersonnelAccountDetails } from '../../services/accountService';
import { resolveImageUrl } from '../../lib/image';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import PasswordRequirements from '../shared/PasswordRequirements.jsx';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../../lib/passwordPolicy.js';

const PERSONNEL_POSITION_OPTIONS = [
    { value: 'Nurse', label: 'Senior Nurse' },
    { value: 'Staff', label: 'Clinic Staff' },
    { value: 'Receptionist', label: 'Receptionist' },
    { value: 'Assistant', label: 'Assistant' },
    { value: 'Clinic Administrator', label: 'Clinic Administrator' },
    { value: 'Administrative Staff', label: 'Administrative Staff' }
];

const EMPLOYMENT_STATUS_OPTIONS = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' }
];

const employmentStatusLabels = EMPLOYMENT_STATUS_OPTIONS.reduce((labels, option) => ({
    ...labels,
    [option.value]: option.label
}), {});

export default function AccountManagement() {
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showCreateAccount, setShowCreateAccount] = useState(false);
    const [pendingStatusAction, setPendingStatusAction] = useState(null);
    const [pendingDeleteAction, setPendingDeleteAction] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isEditingPersonnel, setIsEditingPersonnel] = useState(false);
    const [personnelForm, setPersonnelForm] = useState({ position: '', employmentStatus: 'full-time', branchId: '' });
    const [deleteForm, setDeleteForm] = useState({ masterKey: '', reason: '' });
    const [isSavingPersonnel, setIsSavingPersonnel] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState({ veterinarians: [], staff: [], superadmins: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [branches, setBranches] = useState([]);

    // Create Account Form State
    const [createForm, setCreateForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'Veterinarian',
        branchId: '',
        hireDate: new Date().toISOString().split('T')[0],
        licenseNumber: '',
        specialization: '',
        position: 'Nurse',
        employmentStatus: 'full-time',
        masterKey: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchBranches()
            .then((data) => {
                const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
                setBranches(nextBranches);
                const main = nextBranches.find((branch) => branch.isMain) || nextBranches[0];
                if (main) {
                    setCreateForm((current) => current.branchId ? current : { ...current, branchId: String(main.id) });
                }
            })
            .catch((error) => console.error('Failed to load branches:', error));
    }, []);

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
            const nextAccounts = {
                veterinarians: data.veterinarians || [],
                staff: data.staff || [],
                superadmins: data.superadmins || []
            };

            setAccounts(nextAccounts);
            setSelectedUser((currentUser) => syncSelectedAccount(currentUser, nextAccounts));
        } catch (error) {
            console.error("Error fetching accounts:", error);
            toast.error("Failed to load accounts");
        } finally {
            setIsLoading(false);
        }
    };

    useAutoRefresh(fetchAccounts);

    const handleCreateRoleChange = (role) => {
        setCreateForm((currentForm) => ({
            ...currentForm,
            role,
            position: currentForm.position === 'Super Admin' ? 'Nurse' : currentForm.position
        }));
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();

        if (!isPasswordStrong(createForm.password)) {
            toast.error(PASSWORD_POLICY_MESSAGE);
            return;
        }

        setIsSubmitting(true);
        try {
            await createAccount(createForm);
            toast.success(`${createForm.role} account created successfully!`);
            setShowCreateAccount(false);
            fetchAccounts();
            setCreateForm({
                firstName: '', lastName: '', email: '', password: '',
                role: 'Veterinarian', hireDate: new Date().toISOString().split('T')[0],
                branchId: String((branches.find((branch) => branch.isMain) || branches[0])?.id || ''),
                licenseNumber: '', specialization: '',
                position: 'Nurse', employmentStatus: 'full-time', masterKey: ''
            });
        } catch (error) {
            console.error("Creation error:", error);
            clearCreatePasswordFields();
            toast.error("The account could not be created. Review the details and try again.");
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
    const getAccountImage = (account) => resolveImageUrl(
        account?.setProfilePic_url ||
        account?.profileImage ||
        account?.profile_image ||
        account?.profile_picture ||
        ''
    );
    const findAccountInBucket = (currentUser, nextAccounts) => {
        if (!currentUser) {
            return null;
        }

        const bucket = currentUser.type === 'vet'
            ? nextAccounts.veterinarians
            : currentUser.type === 'staff'
                ? nextAccounts.staff
                : currentUser.type === 'superadmin'
                    ? nextAccounts.superadmins
                    : [];

        return bucket.find((account) => String(account.user_id) === String(currentUser.user_id)) || null;
    };
    const syncSelectedAccount = (currentUser, nextAccounts) => {
        const syncedAccount = findAccountInBucket(currentUser, nextAccounts);

        return syncedAccount ? { ...syncedAccount, type: currentUser.type } : currentUser;
    };
    const formatEmploymentStatus = (value) => employmentStatusLabels[String(value || '').toLowerCase()] || displayValue(value);
    const getPersonnelFormFromUser = (user) => ({
        position: String(user?.postionn || '').trim(),
        employmentStatus: String(user?.employment_status || 'full-time').trim().toLowerCase(),
        branchId: String(user?.preferred_branch_id || '')
    });
    const openAccountDetails = (user, type) => {
        const detailsUser = { ...user, type };
        setSelectedUser(detailsUser);
        setPersonnelForm(getPersonnelFormFromUser(detailsUser));
        setIsEditingPersonnel(false);
        setShowDetails(true);
    };
    const closeAccountDetails = () => {
        if (isSavingPersonnel || isDeletingAccount) return;
        setShowDetails(false);
        setIsEditingPersonnel(false);
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
    const EditableProfileSelectField = ({
        icon,
        label,
        value,
        displayText,
        options,
        isEditing,
        disabled,
        onChange,
        accent = 'text-slate-950',
        allowCustom = false
    }) => (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    {createElement(icon, { className: 'size-4' })}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                    {isEditing ? (
                        <Select
                            value={value}
                            onValueChange={onChange}
                            disabled={disabled}
                            allowCustom={allowCustom}
                            onCreateOption={onChange}
                            customOptionLabel={(option) => `Use "${option}"`}
                        >
                            <SelectTrigger className="mt-2 h-10 bg-white">
                                <SelectValue placeholder={`Select ${label.toLowerCase()}`} displayValue={displayText || value} />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <p className={`mt-1 break-words text-sm font-bold ${accent}`}>{displayValue(displayText || value)}</p>
                    )}
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
        const currentStatus = isAccountActive(user.is_active) && !isAccountDeactivated(user);
        setPendingStatusAction({
            userId: user.user_id,
            currentStatus,
            type: user.type,
            name: `${user.first_Name || ''} ${user.last_Name || ''}`.trim() || 'this account',
            role: user.role || (user.type === 'vet' ? 'Veterinarian' : 'Admin'),
            email: user.mail_Address || user.email || ''
        });
    };

    const closeStatusConfirmation = () => {
        if (!isUpdatingStatus) {
            setPendingStatusAction(null);
        }
    };

    const openDeleteConfirmation = (user) => {
        setPendingDeleteAction({
            userId: user.user_id,
            type: user.type,
            name: getAccountName(user),
            role: getRoleLabel(user.type),
            email: user.mail_Address || user.email || ''
        });
        setDeleteForm({
            masterKey: '',
            reason: ''
        });
    };

    const closeDeleteConfirmation = () => {
        if (isDeletingAccount) return;

        setPendingDeleteAction(null);
        setDeleteForm({
            masterKey: '',
            reason: ''
        });
    };

    const handleToggleStatus = async () => {
        if (!pendingStatusAction) return;

        const { userId, currentStatus, type } = pendingStatusAction;
        const action = currentStatus ? 'archived' : 'restored';

        setIsUpdatingStatus(true);
        try {
            await updateAccountStatus(userId, { is_active: currentStatus ? 0 : 1, type });
            toast.success(`Account ${action}.`);
            fetchAccounts();
            setPendingStatusAction(null);
            setShowDetails(false);
        } catch (error) {
            console.error("Status update error:", error);
            toast.error("The account status could not be updated. Please try again.");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!pendingDeleteAction) return;

        if (!deleteForm.masterKey.trim()) {
            toast.error('Master key is required to archive an account.');
            return;
        }

        setIsDeletingAccount(true);
        try {
            await deleteAccount(pendingDeleteAction.userId, {
                type: pendingDeleteAction.type,
                masterKey: deleteForm.masterKey,
                reason: deleteForm.reason
            });
            toast.success('Account archived.');
            setPendingDeleteAction(null);
            setDeleteForm({ masterKey: '', reason: '' });
            setShowDetails(false);
            setSelectedUser(null);
            fetchAccounts();
        } catch (error) {
            console.error('Account delete error:', error);
            toast.error('The account could not be archived. Please try again or contact support.');
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const handleStartPersonnelEdit = () => {
        setPersonnelForm(getPersonnelFormFromUser(selectedUser));
        setIsEditingPersonnel(true);
    };

    const handleCancelPersonnelEdit = () => {
        setPersonnelForm(getPersonnelFormFromUser(selectedUser));
        setIsEditingPersonnel(false);
    };

    const handleSavePersonnelDetails = async () => {
        if (!selectedUser || selectedUser.type !== 'staff') return;

        const position = personnelForm.position.trim();
        const employmentStatus = personnelForm.employmentStatus;
        const branchId = personnelForm.branchId;

        if (!position) {
            toast.error('Position is required.');
            return;
        }

        if (!employmentStatusLabels[employmentStatus]) {
            toast.error('Select a valid employment status.');
            return;
        }
        if (!branches.some((branch) => String(branch.id) === String(branchId))) {
            toast.error('Select the branch this Admin account is assigned to.');
            return;
        }

        setIsSavingPersonnel(true);
        try {
            const response = await updatePersonnelAccountDetails(selectedUser.user_id, {
                type: selectedUser.type,
                position,
                employmentStatus,
                branchId: Number(branchId)
            });
            const assignedBranch = branches.find((branch) => String(branch.id) === String(branchId));
            const updatedAccount = response.account || {
                ...selectedUser,
                postionn: position,
                employment_status: employmentStatus,
                preferred_branch_id: Number(branchId),
                preferred_branch_name: assignedBranch?.name || ''
            };

            setSelectedUser((current) => current ? {
                ...current,
                postionn: updatedAccount.postionn ?? position,
                employment_status: updatedAccount.employment_status ?? employmentStatus,
                preferred_branch_id: updatedAccount.preferred_branch_id ?? Number(branchId),
                preferred_branch_name: updatedAccount.preferred_branch_name ?? assignedBranch?.name ?? ''
            } : current);
            setAccounts((current) => ({
                ...current,
                staff: current.staff.map((account) => (
                    String(account.user_id) === String(selectedUser.user_id)
                        ? {
                            ...account,
                            postionn: updatedAccount.postionn ?? position,
                            employment_status: updatedAccount.employment_status ?? employmentStatus,
                            preferred_branch_id: updatedAccount.preferred_branch_id ?? Number(branchId),
                            preferred_branch_name: updatedAccount.preferred_branch_name ?? assignedBranch?.name ?? ''
                        }
                        : account
                ))
            }));
            setIsEditingPersonnel(false);
            toast.success('Personnel details and assigned branch updated successfully.');
            fetchAccounts({ isAutoRefresh: true });
        } catch (error) {
            console.error('Personnel update error:', error);
            toast.error('Personnel details could not be updated. Please try again.');
        } finally {
            setIsSavingPersonnel(false);
        }
    };

    const isAccountDeactivated = (account) => (
        ['archived', 'deactivated'].includes(String(account?.account_status || '').toLowerCase())
        || (account?.type !== 'superadmin' && !isAccountActive(account?.is_active))
    );

    const getStatusBadge = (status, account) => {
        if (isAccountDeactivated(account)) {
            return <Badge className="bg-slate-100 text-slate-700">Archived</Badge>;
        }

        if (isAccountActive(status)) {
            return <Badge className="bg-green-500 text-white">Active</Badge>;
        }
        return <Badge className="bg-slate-100 text-slate-700">Archived</Badge>;
    };

    const getAccountCardTone = (type) => {
        if (type === 'vet') {
            return {
                avatarClass: 'bg-blue-100',
                iconClass: 'text-blue-600',
                icon: Stethoscope,
                subtitle: 'text-blue-700'
            };
        }

        if (type === 'superadmin') {
            return {
                avatarClass: 'bg-emerald-100',
                iconClass: 'text-emerald-600',
                icon: ShieldCheck,
                subtitle: 'text-emerald-700'
            };
        }

        return {
            avatarClass: 'bg-purple-100',
            iconClass: 'text-purple-600',
            icon: UserCog,
            subtitle: 'text-purple-700'
        };
    };

    const getRoleLabel = (type) => {
        if (type === 'vet') return 'Veterinarian';
        if (type === 'superadmin') return 'Super Admin';
        return 'Admin / Staff';
    };

    const getRoleBadgeClass = (type) => {
        if (type === 'vet') return 'border-blue-200 bg-blue-50 text-blue-700';
        if (type === 'superadmin') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        return 'border-violet-200 bg-violet-50 text-violet-700';
    };

    const getAccountName = (account) => {
        return displayValue(`${account?.first_Name || ''} ${account?.last_Name || ''}`.trim(), account?.mail_Address || 'Account');
    };

    const getAccountProfileText = (account) => {
        if (account.type === 'vet') {
            return displayValue(account.specialization, 'Veterinarian');
        }

        if (account.type === 'superadmin') {
            return 'System access';
        }

        return displayValue(account.postionn, 'Clinic personnel');
    };

    const getAccountMetaText = (account) => {
        if (account.type === 'vet') {
            return account.prc_license_number ? `PRC ${account.prc_license_number}` : displayValue(account.veterinarian_id, 'No license set');
        }

        if (account.type === 'superadmin') {
            return displayValue(account.employee_id, 'Super Admin');
        }

        return formatEmploymentStatus(account.employment_status);
    };

    const getAccountStatus = (account) => {
        if (isAccountDeactivated(account)) {
            return 'archived';
        }

        if (account.type === 'superadmin') {
            return 'privileged';
        }

        return isAccountActive(account.is_active) ? 'active' : 'archived';
    };

    const allAccountRows = [
        ...accounts.superadmins.map((account) => ({ ...account, type: 'superadmin' })),
        ...accounts.staff.map((account) => ({ ...account, type: 'staff' })),
        ...accounts.veterinarians.map((account) => ({ ...account, type: 'vet' }))
    ];

    const accountSearchQuery = searchQuery.trim().toLowerCase();

    const filteredAccountRows = allAccountRows.filter((account) => {
        if (roleFilter !== 'all' && account.type !== roleFilter) {
            return false;
        }

        if (statusFilter !== 'all' && getAccountStatus(account) !== statusFilter) {
            return false;
        }

        if (!accountSearchQuery) {
            return true;
        }

        return [
            getAccountName(account),
            account.mail_Address,
            getRoleLabel(account.type),
            getAccountProfileText(account),
            getAccountMetaText(account),
            account.phoneNumber,
            account.employee_id,
            account.veterinarian_id
        ].join(' ').toLowerCase().includes(accountSearchQuery);
    });

    const ProfileAvatar = ({ account, type, size = 'card' }) => {
        const [failedSrc, setFailedSrc] = useState('');
        const imageSrc = getAccountImage(account);
        const resolvedImageSrc = imageSrc && failedSrc !== imageSrc ? imageSrc : null;
        const tone = getAccountCardTone(type);
        const sizeClass = size === 'modal' ? 'h-16 w-16 text-xl' : 'h-12 w-12 text-sm';

        return (
            <div className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full ${tone.avatarClass} font-black ${tone.iconClass}`}>
                {resolvedImageSrc ? (
                    <img
                        src={resolvedImageSrc}
                        alt={`${displayValue(`${account?.first_Name || ''} ${account?.last_Name || ''}`, 'Account')} profile`}
                        className="h-full w-full object-cover"
                        onError={() => setFailedSrc(resolvedImageSrc)}
                    />
                ) : (
                    <span>{getInitials(account)}</span>
                )}
            </div>
        );
    };

    const StatusBadge = ({ account }) => {
        if (account.type === 'superadmin' && !isAccountDeactivated(account)) {
            return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Privileged</Badge>;
        }

        return getStatusBadge(account.is_active, account);
    };

    const AccountMobileRow = ({ account }) => (
        <button
            type="button"
            onClick={() => openAccountDetails(account, account.type)}
            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar account={account} type={account.type} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{getAccountName(account)}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">{account.mail_Address}</p>
                    </div>
                </div>
                <StatusBadge account={account} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={getRoleBadgeClass(account.type)}>{getRoleLabel(account.type)}</Badge>
                <Badge className="border-slate-200 bg-slate-50 text-slate-600">{getAccountProfileText(account)}</Badge>
            </div>
            <p className="mt-3 truncate text-xs font-semibold text-slate-500">{getAccountMetaText(account)}</p>
        </button>
    );
    const handleAccountRowKeyDown = (event, account) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        openAccountDetails(account, account.type);
    };

    return (
        <div className="space-y-5">
            <DashboardPageHeader
                title="Account Management"
                description="Manage clinic users, profile details, and account access."
                layout="stacked"
                actions={(
                    <Button onClick={() => setShowCreateAccount(true)} className="h-10 justify-center gap-2 bg-blue-600 text-white">
                        <UserPlus className="size-4" />
                        Create Account
                    </Button>
                )}
            />

            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_13rem_12rem_auto]">
                        <div>
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search name, email, license, position"
                                leftIcon={<Search className="size-4" />}
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger>
                                <SelectValue displayValue={roleFilter === 'all' ? 'All roles' : getRoleLabel(roleFilter)} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles</SelectItem>
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                                <SelectItem value="staff">Admin / Staff</SelectItem>
                                <SelectItem value="vet">Veterinarian</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue displayValue={
                                    statusFilter === 'all'
                                        ? 'All status'
                                        : statusFilter === 'active'
                                            ? 'Active'
                                            : statusFilter === 'archived'
                                                ? 'Archived'
                                                : 'Privileged'
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                                <SelectItem value="privileged">Privileged</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={isLoading}
                            onClick={() => fetchAccounts()}
                            className="size-10 justify-self-start lg:justify-self-end"
                            aria-label="Refresh accounts"
                            title="Refresh accounts"
                        >
                            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Account Directory</h2>
                        <p className="text-xs font-semibold text-slate-500">Open a row to review profile and access details.</p>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            <Loader2 className="size-4 animate-spin" />
                            Loading
                        </div>
                    ) : null}
                </div>

                <div className="hidden overflow-x-auto scrollbar-hide md:block">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-black">Account</th>
                                <th className="px-4 py-3 font-black">Role</th>
                                <th className="px-4 py-3 font-black">Profile</th>
                                <th className="px-4 py-3 font-black">Contact</th>
                                <th className="px-4 py-3 font-black">Access</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                [1, 2, 3, 4].map((item) => (
                                    <tr key={`account-loading-${item}`}>
                                        <td colSpan={5} className="px-4 py-4">
                                            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredAccountRows.length ? (
                                filteredAccountRows.map((account) => (
                                    <tr
                                        key={`${account.type}-${account.user_id}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Open account details for ${getAccountName(account)}`}
                                        onClick={() => openAccountDetails(account, account.type)}
                                        onKeyDown={(event) => handleAccountRowKeyDown(event, account)}
                                        className="cursor-pointer align-middle transition hover:bg-blue-50/30 focus:bg-blue-50/50 focus:outline-none"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <ProfileAvatar account={account} type={account.type} />
                                                <div className="min-w-0">
                                                    <p className="truncate font-black text-slate-950">{getAccountName(account)}</p>
                                                    <p className="truncate text-xs font-semibold text-slate-500">{account.mail_Address}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={getRoleBadgeClass(account.type)}>{getRoleLabel(account.type)}</Badge>
                                        </td>
                                        <td className="max-w-[16rem] px-4 py-3">
                                            <p className="truncate font-bold text-slate-800">{getAccountProfileText(account)}</p>
                                            <p className="truncate text-xs font-semibold text-slate-500">{getAccountMetaText(account)}</p>
                                        </td>
                                        <td className="max-w-[14rem] px-4 py-3">
                                            <p className="truncate font-semibold text-slate-700">{displayValue(account.phoneNumber || account.emergencyNumber, 'No phone')}</p>
                                            <p className="truncate text-xs font-semibold text-slate-500">{displayValue(account.personal_Address, 'No address')}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge account={account} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <p className="font-black text-slate-900">No accounts found</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">Adjust the search or filters to show more accounts.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-3 p-3 md:hidden">
                    {isLoading ? (
                        [1, 2, 3].map((item) => <div key={`account-mobile-loading-${item}`} className="h-24 animate-pulse rounded-xl bg-slate-100" />)
                    ) : filteredAccountRows.length ? (
                        filteredAccountRows.map((account) => (
                            <AccountMobileRow key={`${account.type}-${account.user_id}`} account={account} />
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <p className="font-black text-slate-900">No accounts found</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">Adjust the search or filters to show more accounts.</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* View Details Modal */}
            <Dialog open={showDetails} onOpenChange={(open) => open ? setShowDetails(true) : closeAccountDetails()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedUser && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-xl md:text-2xl">Account Details</DialogTitle>
                                <DialogDescription>Complete information and account management</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#f5f3ff_100%)] p-5 dark:border-slate-700 dark:bg-none dark:bg-slate-900">
                                    <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <ProfileAvatar account={selectedUser} type={selectedUser.type} size="modal" />
                                            <div className="min-w-0">
                                                <h3 className="truncate text-xl font-bold text-gray-900 dark:text-white">{selectedUser.first_Name} {selectedUser.last_Name}</h3>
                                                <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
                                                    {selectedUser.role} - {selectedUser.type === 'vet' ? displayValue(selectedUser.veterinarian_id) : selectedUser.type === 'superadmin' ? displayValue(selectedUser.employee_id, 'Super Admin') : displayValue(selectedUser.employee_id)}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedUser.type === 'superadmin' && !isAccountDeactivated(selectedUser) ? (
                                            <Badge className="bg-emerald-50 text-emerald-700">Super Admin</Badge>
                                        ) : getStatusBadge(selectedUser.is_active, selectedUser)}
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
                                    ) : selectedUser.type === 'superadmin' ? (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            <ProfileField icon={ShieldCheck} label="Access Role" value={selectedUser.role || 'Super Admin'} accent="text-emerald-700" />
                                            <ProfileField icon={UserCog} label="Employee ID" value={selectedUser.employee_id} accent="text-emerald-700" />
                                            <ProfileField icon={Calendar} label="Start Date" value={selectedUser.hire_date ? formatDisplayDate(selectedUser.hire_date) : ''} />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            <ProfileField icon={UserCog} label="Employee ID" value={selectedUser.employee_id} accent="text-purple-700" />
                                            <EditableProfileSelectField
                                                icon={MapPin}
                                                label="Assigned Branch"
                                                value={personnelForm.branchId}
                                                displayText={isEditingPersonnel
                                                    ? branches.find((branch) => String(branch.id) === personnelForm.branchId)?.name
                                                    : selectedUser.preferred_branch_name}
                                                options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                                                isEditing={isEditingPersonnel}
                                                disabled={isSavingPersonnel}
                                                onChange={(branchId) => setPersonnelForm((current) => ({ ...current, branchId }))}
                                                accent="text-blue-700"
                                            />
                                            <EditableProfileSelectField
                                                icon={UserCog}
                                                label="Position"
                                                value={personnelForm.position}
                                                displayText={isEditingPersonnel ? personnelForm.position : selectedUser.postionn}
                                                options={PERSONNEL_POSITION_OPTIONS}
                                                isEditing={isEditingPersonnel}
                                                disabled={isSavingPersonnel}
                                                onChange={(value) => setPersonnelForm((current) => ({ ...current, position: value }))}
                                                accent="text-purple-700"
                                                allowCustom
                                            />
                                            <EditableProfileSelectField
                                                icon={CheckCircle}
                                                label="Employment Status"
                                                value={personnelForm.employmentStatus}
                                                displayText={formatEmploymentStatus(isEditingPersonnel ? personnelForm.employmentStatus : selectedUser.employment_status)}
                                                options={EMPLOYMENT_STATUS_OPTIONS}
                                                isEditing={isEditingPersonnel}
                                                disabled={isSavingPersonnel}
                                                onChange={(value) => setPersonnelForm((current) => ({ ...current, employmentStatus: value }))}
                                            />
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
                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                        {selectedUser.type === 'staff' && (
                                            isEditingPersonnel ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={handleCancelPersonnelEdit}
                                                        disabled={isSavingPersonnel}
                                                        className="flex-1"
                                                    >
                                                        <X className="size-4 mr-2" /> Cancel Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        onClick={handleSavePersonnelDetails}
                                                        disabled={isSavingPersonnel}
                                                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                                                    >
                                                        {isSavingPersonnel ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save className="size-4 mr-2" /> Save Admin Assignment
                                                            </>
                                                        )}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleStartPersonnelEdit}
                                                    className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                                                >
                                                    <Pencil className="size-4 mr-2" /> Edit Employment Info
                                                </Button>
                                            )
                                        )}
                                        {selectedUser.type !== 'superadmin' && (
                                            isAccountDeactivated(selectedUser) ? (
                                                <Button
                                                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                                                    onClick={() => openStatusConfirmation(selectedUser)}
                                                    disabled={isSavingPersonnel || isDeletingAccount}
                                                >
                                                    <RotateCcw className="size-4 mr-2" /> Restore Account
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => openDeleteConfirmation(selectedUser)}
                                                    disabled={isSavingPersonnel || isDeletingAccount}
                                                    className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Archive className="size-4 mr-2" /> Archive Account
                                                </Button>
                                            )
                                        )}
                                        <Button variant="ghost" onClick={closeAccountDetails} disabled={isSavingPersonnel || isDeletingAccount}>Close</Button>
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
                                    Restore Account
                                </DialogTitle>
                                <DialogDescription>
                                    Confirm this account status change before it is applied.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600">Account</p>
                                <p className="mt-1 font-semibold text-slate-900">{pendingStatusAction.name}</p>
                                <p className="text-sm text-slate-500">{pendingStatusAction.role}</p>
                                {pendingStatusAction.email ? (
                                    <p className="mt-2 break-words text-sm font-semibold text-slate-700">{pendingStatusAction.email}</p>
                                ) : null}
                            </div>

                            <p className="text-sm text-slate-700">
                                This user will return to active account lists and regain login access.
                            </p>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeStatusConfirmation} disabled={isUpdatingStatus}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isUpdatingStatus}
                                    onClick={handleToggleStatus}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {isUpdatingStatus ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Restore Account'
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Archive Account Confirmation Modal */}
            <Dialog open={Boolean(pendingDeleteAction)} onOpenChange={(open) => !open && closeDeleteConfirmation()}>
                <DialogContent className="max-w-lg">
                    {pendingDeleteAction && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Archive Account</DialogTitle>
                                <DialogDescription>
                                    Master key verification is required before this account is archived.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-600">Account to archive</p>
                                    <p className="mt-1 font-bold text-slate-950">{pendingDeleteAction.name}</p>
                                    <p className="text-sm font-semibold text-slate-700">{pendingDeleteAction.role}</p>
                                    {pendingDeleteAction.email ? (
                                        <p className="mt-2 break-words text-sm font-semibold text-slate-800">{pendingDeleteAction.email}</p>
                                    ) : null}
                                </div>

                                <p className="text-sm font-semibold leading-6 text-slate-700">
                                    Existing records remain intact. The account is hidden from active lists and login access is blocked until a Super Admin restores it.
                                </p>

                                <div className="space-y-2">
                                    <Label className="text-slate-900">Reason</Label>
                                    <Textarea
                                        value={deleteForm.reason}
                                        onChange={(event) => setDeleteForm((current) => ({ ...current, reason: event.target.value }))}
                                        placeholder="Optional internal reason"
                                        disabled={isDeletingAccount}
                                        className="min-h-24"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-red-700">
                                        <Key className="size-4" />
                                        Master Key Verification
                                    </Label>
                                    <PasswordInput
                                        required
                                        placeholder="Enter Super Admin Key"
                                        value={deleteForm.masterKey}
                                        onChange={(event) => setDeleteForm((current) => ({ ...current, masterKey: event.target.value }))}
                                        inputClassName="border-slate-200 bg-slate-50"
                                        disabled={isDeletingAccount}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeDeleteConfirmation} disabled={isDeletingAccount}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isDeletingAccount}
                                    onClick={handleDeleteAccount}
                                    className="bg-slate-800 text-white hover:bg-slate-900"
                                >
                                    {isDeletingAccount ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Archiving...
                                        </>
                                    ) : (
                                        <>
                                            <Archive className="mr-2 h-4 w-4" />
                                            Archive Account
                                        </>
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
                                <Select value={createForm.role} onValueChange={handleCreateRoleChange}>
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

                        <div>
                                <Label className="mb-2 block text-gray-900">
                                    {createForm.role === 'Admin' ? 'Assigned Branch *' : 'Preferred Branch'}
                                </Label>
                                <Select
                                    value={createForm.branchId}
                                    onValueChange={(branchId) => setCreateForm({ ...createForm, branchId })}
                                >
                                    <SelectTrigger className="bg-gray-100 border-gray-300">
                                        <SelectValue
                                            placeholder="Select branch"
                                            displayValue={getBranchDisplayName(branches, createForm.branchId)}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.map((branch) => (
                                            <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Admin access is limited to this branch. Veterinarians may later change their preferred location.
                                </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-gray-900 mb-2 block">First Name</Label>
                                <Input placeholder="First Name" required value={createForm.firstName} onChange={(e) => setCreateForm({...createForm, firstName: e.target.value})} restriction="name" className="bg-gray-100" />
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Last Name</Label>
                                <Input placeholder="Last Name" required value={createForm.lastName} onChange={(e) => setCreateForm({...createForm, lastName: e.target.value})} restriction="name" className="bg-gray-100" />
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
                                <PasswordRequirements password={createForm.password} className="mt-2 sm:grid-cols-1" />
                            </div>
                        </div>

                        {createForm.role === 'Veterinarian' ? (
                            <div className="grid grid-cols-1 gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
                                <div>
                                    <Label className="text-blue-900">PRC License</Label>
                                    <Input placeholder="PRC-VET-00000" value={createForm.licenseNumber} onChange={(e) => setCreateForm({...createForm, licenseNumber: e.target.value})} restriction="alphanumeric" className="bg-white" />
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
