import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { User, Save } from 'lucide-react';

export default function ProfileManagement() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const userId = currentUser.id || currentUser.user_id;
    const role = currentUser.role;

    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState({
        salutation: 'Ms.',
        firstName: '',
        lastName: '',
        extension: 'none',
        position: '',
        email: '',
        phone: '',
        licenseNumber: '',
        sssNumber: '',
        philhealthNumber: '',
        tinNumber: '',
        pagibigNumber: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/profile?userId=${userId}&role=${role}`);
                const data = await response.json();
                if (response.ok) {
                    setProfile({
                        salutation: 'Ms.',
                        firstName: data.first_Name || '',
                        lastName: data.last_Name || '',
                        extension: 'none',
                        position: data.postionn || 'Admin',
                        email: data.mail_Address || '',
                        phone: data.phoneNumber || '',
                        licenseNumber: data.employee_id || '',
                        sssNumber: data.sss_number || '',
                        philhealthNumber: data.philhealth_number || '',
                        tinNumber: data.tin_number || '',
                        pagibigNumber: data.pagibig_number || ''
                    });
                }
            } catch (error) {
                console.error("Failed to load profile:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, [userId, role]);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate save
        setTimeout(() => {
            setIsSaving(false);
            setIsEditing(false);
        }, 1000);
    };

    const getFullName = () => {
        const { salutation, firstName, lastName, extension } = profile;
        let fullName = '';
        if (salutation) fullName += salutation + ' ';
        fullName += firstName + ' ' + lastName;
        if (extension && extension !== 'none') fullName += ', ' + extension;
        return fullName;
    };

    if (isLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                Loading profile...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-bold text-[24px] text-[#101828] mb-2">
                    Profile Management
                </h2>
                <p className="text-[16px] text-[#4a5565]">
                    Manage your professional information and credentials
                </p>
            </div>

            <Card className="bg-gradient-to-br from-[#155dfc] to-[#1447e6] text-white">
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 rounded-full p-4">
                            <User className="size-12 text-white" />
                        </div>
                        <div>
                            <h3 className="text-[24px] mb-1">
                                {getFullName()}
                            </h3>
                            <p className="text-[16px] text-white/90">
                                {profile.position}
                            </p>
                            <p className="text-[14px] text-white/80 mt-1">
                                {profile.email}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-[20px] text-[#101828]">
                        Professional Information
                    </CardTitle>
                    {!isEditing && (
                        <Button
                            onClick={() => setIsEditing(true)}
                            variant="outline"
                            className="border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff]"
                        >
                            Edit Profile
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                Salutation / Title <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={profile.salutation}
                                onValueChange={(value) => setProfile({ ...profile, salutation: value })}
                                disabled={!isEditing}
                            >
                                <SelectTrigger className="bg-[#f3f3f5] border-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Dr.">Dr.</SelectItem>
                                    <SelectItem value="Mr.">Mr.</SelectItem>
                                    <SelectItem value="Ms.">Ms.</SelectItem>
                                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                                    <SelectItem value="Prof.">Prof.</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                First Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                value={profile.firstName}
                                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                                disabled={!isEditing}
                                className="bg-[#f3f3f5] border-0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                Last Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                value={profile.lastName}
                                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                                disabled={!isEditing}
                                className="bg-[#f3f3f5] border-0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                Professional Extension
                            </Label>
                            <Select
                                value={profile.extension}
                                onValueChange={(value) => setProfile({ ...profile, extension: value })}
                                disabled={!isEditing}
                            >
                                <SelectTrigger className="bg-[#f3f3f5] border-0">
                                    <SelectValue placeholder="Select extension" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="DVM">DVM (Doctor of Veterinary Medicine)</SelectItem>
                                    <SelectItem value="VMD">VMD (Veterinariae Medicinae Doctoris)</SelectItem>
                                    <SelectItem value="PhD">PhD (Doctor of Philosophy)</SelectItem>
                                    <SelectItem value="MVSc">MVSc (Master of Veterinary Science)</SelectItem>
                                    <SelectItem value="RVT">RVT (Registered Veterinary Technician)</SelectItem>
                                    <SelectItem value="CVT">CVT (Certified Veterinary Technician)</SelectItem>
                                    <SelectItem value="LVT">LVT (Licensed Veterinary Technician)</SelectItem>
                                    <SelectItem value="RN">RN (Registered Nurse)</SelectItem>
                                    <SelectItem value="BSN">BSN (Bachelor of Science in Nursing)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                Position / Role <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={profile.position}
                                onValueChange={(value) => setProfile({ ...profile, position: value })}
                                disabled={!isEditing}
                            >
                                <SelectTrigger className="bg-[#f3f3f5] border-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Veterinarian">Veterinarian</SelectItem>
                                    <SelectItem value="Senior Veterinarian">Senior Veterinarian</SelectItem>
                                    <SelectItem value="Chief Veterinarian">Chief Veterinarian</SelectItem>
                                    <SelectItem value="Veterinary Surgeon">Veterinary Surgeon</SelectItem>
                                    <SelectItem value="Veterinary Technician">Veterinary Technician</SelectItem>
                                    <SelectItem value="Veterinary Nurse">Veterinary Nurse</SelectItem>
                                    <SelectItem value="Clinic Administrator">Clinic Administrator</SelectItem>
                                    <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[16px] text-[#0a0a0a]">
                                License Number <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                value={profile.licenseNumber}
                                onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
                                disabled={!isEditing}
                                placeholder="e.g., VET-2024-001"
                                className="bg-[#f3f3f5] border-0"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-[18px] text-[#101828] mb-4">
                            Government Identifications
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">SSS Number</Label>
                                <Input type="text" value={profile.sssNumber} onChange={(e) => setProfile({ ...profile, sssNumber: e.target.value })} disabled={!isEditing} className="bg-[#f3f3f5] border-0" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">PhilHealth Number</Label>
                                <Input type="text" value={profile.philhealthNumber} onChange={(e) => setProfile({ ...profile, philhealthNumber: e.target.value })} disabled={!isEditing} className="bg-[#f3f3f5] border-0" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">TIN Number</Label>
                                <Input type="text" value={profile.tinNumber} onChange={(e) => setProfile({ ...profile, tinNumber: e.target.value })} disabled={!isEditing} className="bg-[#f3f3f5] border-0" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">Pag-IBIG Number</Label>
                                <Input type="text" value={profile.pagibigNumber} onChange={(e) => setProfile({ ...profile, pagibigNumber: e.target.value })} disabled={!isEditing} className="bg-[#f3f3f5] border-0" />
                            </div>
                        </div>
                    </div>
                    <div className="border-t pt-6">
                        <h4 className="font-bold text-[18px] text-[#101828] mb-4">
                            Contact Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">
                                    Email Address <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="email"
                                    value={profile.email}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    disabled={!isEditing}
                                    className="bg-[#f3f3f5] border-0"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#0a0a0a]">
                                    Phone Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="tel"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    disabled={!isEditing}
                                    placeholder="(042) 373-5678"
                                    className="bg-[#f3f3f5] border-0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-[18px] text-[#101828] mb-2">
                            Full Professional Name Preview
                        </h4>
                        <p className="text-[16px] text-[#4a5565] mb-2">
                            This is how your name will appear on official documents and records:
                        </p>
                        <div className="bg-[#eff6ff] border border-[#bedbff] rounded-lg p-4">
                            <p className="font-bold text-[20px] text-[#155dfc]">
                                {getFullName()}
                            </p>
                            <p className="text-[16px] text-[#4a5565] mt-1">
                                {profile.position} - License: {profile.licenseNumber}
                            </p>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex gap-4 pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#155dfc] hover:bg-[#1447e6]"
                            >
                                <Save className="size-4 mr-2" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                                onClick={() => setIsEditing(false)}
                                variant="outline"
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
