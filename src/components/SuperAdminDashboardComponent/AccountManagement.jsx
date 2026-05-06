import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { UserCog, Mail, Phone, MapPin, Award, Ban, CheckCircle, UserPlus, Key, Plus, AlertTriangle, Stethoscope, Briefcase, Calendar } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';

export default function AccountManagement() {
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showCreateAccount, setShowCreateAccount] = useState(false);
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

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/accounts`);
            if (response.ok) {
                const data = await response.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error("Error fetching accounts:", error);
            toast.error("Failed to load accounts");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();

        if (createForm.masterKey !== import.meta.env.VITE_MASTER_KEY) {
            toast.error("Invalid Master Key. Authorization denied.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/accounts/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm)
            });

            if (response.ok) {
                toast.success(`${createForm.role} account created successfully!`);
                setShowCreateAccount(false);
                fetchAccounts();
                setCreateForm({
                    firstName: '', lastName: '', email: '', password: '',
                    role: 'Veterinarian', hireDate: new Date().toISOString().split('T')[0],
                    licenseNumber: '', specialization: '',
                    position: 'Nurse', employmentStatus: 'full-time', masterKey: ''
                });
            } else {
                const data = await response.json();
                toast.error(data.message || "Failed to create account");
            }
        } catch (error) {
            console.error("Creation error:", error);
            toast.error("An error occurred during account creation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus, type) => {
        const action = currentStatus ? 'deactivate' : 'activate';
        if (!window.confirm(`Are you sure you want to ${action} this account?`)) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/accounts/${userId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: currentStatus ? 0 : 1, type })
            });

            if (response.ok) {
                toast.success(`Account ${action}d successfully`);
                fetchAccounts();
                setShowDetails(false);
            } else {
                toast.error(`Failed to ${action} account`);
            }
        } catch (error) {
            console.error("Status update error:", error);
            toast.error("An error occurred");
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'active' || status === 1 || status === '1') {
            return <Badge className="bg-green-500 text-white">Active</Badge>;
        }
        return <Badge className="bg-gray-500 text-white">Disabled</Badge>;
    };

    const EmptyCard = ({ title, description, icon: Icon }) => (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/10 flex flex-col justify-center min-h-[250px] shadow-none pointer-events-none">
            <CardContent className="flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Icon className="h-8 w-8 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-tight">{title}</h3>
                    <p className="text-slate-300 text-sm mt-1">{description}</p>
                </div>
            </CardContent>
        </Card>
    );

    const UserCard = ({ user, type }) => (
        <Card className="p-4 md:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        type === 'vet' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                        {type === 'vet' ? <Stethoscope className="w-6 h-6 text-blue-600" /> : <UserCog className="w-6 h-6 text-purple-600" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base md:text-lg">{user.first_Name} {user.last_Name}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{type === 'vet' ? user.specialization : user.postionn}</p>
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
                    <p className="text-sm text-gray-500">Manage staff and veterinarians</p>
                </div>
                <Button onClick={() => setShowCreateAccount(true)} className="bg-blue-600 text-white">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                </Button>
            </div>

            <div>
                <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Staff & Nurses</h2>
                    <p className="text-sm md:text-base text-gray-600">Active and approved clinic staff and nursing personnel</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-black ${
                                                selectedUser.type === 'vet' ? 'bg-blue-600' : 'bg-purple-600'
                                            }`}>
                                                {selectedUser.first_Name[0]}{selectedUser.last_Name[0]}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900">{selectedUser.first_Name} {selectedUser.last_Name}</h3>
                                                <p className="text-sm text-gray-600">{selectedUser.role}</p>
                                            </div>
                                        </div>
                                        {getStatusBadge(selectedUser.is_active)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-3">Personal Information</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 text-sm">
                                                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-gray-500">Email Address</p>
                                                    <p className="font-medium text-gray-900">{selectedUser.mail_Address}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-sm">
                                                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-gray-500">Hire Date</p>
                                                    <p className="font-medium text-gray-900">{selectedUser.hire_date}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-3">Professional Information</h4>
                                        {selectedUser.type === 'vet' ? (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3 text-sm">
                                                    <Award className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">PRC License</p>
                                                        <p className="font-medium text-blue-600">{selectedUser.prc_license_number}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3 text-sm">
                                                    <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Specialization</p>
                                                        <p className="font-medium">{selectedUser.specialization}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3 text-sm">
                                                    <UserCog className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Position</p>
                                                        <p className="font-medium text-purple-600">{selectedUser.postionn}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3 text-sm">
                                                    <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <p className="font-medium uppercase">{selectedUser.employment_status}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h4 className="font-bold text-gray-900 mb-3 text-sm">Administrative Actions</h4>
                                    <div className="flex gap-3">
                                        {(selectedUser.is_active === 1 || selectedUser.is_active === '1') ? (
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => handleToggleStatus(selectedUser.user_id, true, selectedUser.type)}
                                            >
                                                <Ban className="size-4 mr-2" /> Deactivate Account
                                            </Button>
                                        ) : (
                                            <Button 
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => handleToggleStatus(selectedUser.user_id, false, selectedUser.type)}
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

            {/* Create Account Modal */}
            <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl">Create New Account</DialogTitle>
                        <DialogDescription>Super Admin Authorization Required</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateAccount} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-gray-900 mb-2 block">First Name</Label>
                                <Input placeholder="First Name" required value={createForm.firstName} onChange={(e) => setCreateForm({...createForm, firstName: e.target.value})} className="bg-gray-100" />
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Last Name</Label>
                                <Input placeholder="Last Name" required value={createForm.lastName} onChange={(e) => setCreateForm({...createForm, lastName: e.target.value})} className="bg-gray-100" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-gray-900 mb-2 block">Email</Label>
                                <Input type="email" required placeholder="email@ipawcus.com" value={createForm.email} onChange={(e) => setCreateForm({...createForm, email: e.target.value})} className="bg-gray-100" />
                            </div>
                            <div>
                                <Label className="text-gray-900 mb-2 block">Password</Label>
                                <Input type="password" required placeholder="Password" value={createForm.password} onChange={(e) => setCreateForm({...createForm, password: e.target.value})} className="bg-gray-100" />
                            </div>
                        </div>

                        {createForm.role === 'Veterinarian' ? (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                            <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
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
                            <Input type="password" required placeholder="Enter Super Admin Key" value={createForm.masterKey} onChange={(e) => setCreateForm({...createForm, masterKey: e.target.value})} className="bg-red-50 border-red-200" />
                        </div>

                        <div className="flex gap-3 pt-2">
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
