import { createElement, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { User, Save, Mail, Phone, MapPin, Briefcase, Calendar, BadgeCheck, Camera, Loader2, IdCard } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { resolveImageUrl } from '../../lib/image';
import { formatDisplayDate } from '../../lib/date';
import { cleanProfileHistory, parseProfileHistory } from '../../lib/profileHistory';
import { useDashboardUser, useUserUpdate } from '../dashboardRouter.jsx';
import PasswordChangeCard from '../shared/PasswordChangeCard.jsx';
import ProfileHistoryEditor from '../shared/ProfileHistoryEditor.jsx';
import ThemeToggle from '../shared/ThemeToggle.jsx';
import NotificationPreferencesCard from '../shared/NotificationPreferencesCard.jsx';
import { fetchProfile, updateProfile } from '../../services/profileService';
import { uploadImageFile } from '../../services/uploadService';

const emptyProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    employeeId: '',
    position: '',
    hireDate: '',
    employmentStatus: 'full-time',
    sssNumber: '',
    philhealthNumber: '',
    tinNumber: '',
    pagibigNumber: '',
    yearsOfExperience: '',
    profileImage: '',
    educationHistory: [],
    experienceHistory: []
};

function normalizeDate(value) {
    return value ? String(value).split(' ')[0] : '';
}

function getFullName(profile) {
    return `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Admin Profile';
}

export default function ProfileManagement({ onLogout }) {
    const contextUser = useDashboardUser();
    const onUserUpdate = useUserUpdate();
    const currentUser = contextUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || currentUser.user_id;
    const role = currentUser.role || 'Admin';

    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState(emptyProfile);
    const [savedProfile, setSavedProfile] = useState(emptyProfile);
    const [imageFile, setImageFile] = useState(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                if (!userId) return;

                const data = await fetchProfile({ userId, role });

                const normalized = {
                    firstName: data.first_Name || '',
                    lastName: data.last_Name || '',
                    email: data.mail_Address || '',
                    phone: data.phoneNumber || '',
                    address: data.personal_Address || '',
                    employeeId: data.employee_id || '',
                    position: data.postionn || 'Admin',
                    hireDate: normalizeDate(data.hire_date),
                    employmentStatus: data.employment_status || 'full-time',
                    sssNumber: data.sss_number || '',
                    philhealthNumber: data.philhealth_number || '',
                    tinNumber: data.tin_number || '',
                    pagibigNumber: data.pagibig_number || '',
                    yearsOfExperience: data.years_of_experience ?? '',
                    profileImage: data.setProfilePic_url || '',
                    educationHistory: parseProfileHistory(data.education_history),
                    experienceHistory: parseProfileHistory(data.experience_history)
                };

                setProfile(normalized);
                setSavedProfile(normalized);
                setImageError(false);
            } catch (error) {
                console.error('Failed to load profile:', error);
                toast.error(error.message || 'Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };
        loadProfile();
    }, [userId, role]);

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImageFile(file);
        setProfile(prev => ({ ...prev, profileImage: URL.createObjectURL(file) }));
        setImageError(false);
    };

    const handleSave = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        setIsSaving(true);
        let finalImageUrl = profile.profileImage;

        try {
            if (imageFile) {
                finalImageUrl = await uploadImageFile(imageFile, 'user') || finalImageUrl;
            }

            const payload = {
                role,
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                phoneNumber: profile.phone,
                address: profile.address,
                profileImage: finalImageUrl,
                employeeId: profile.employeeId,
                position: profile.position,
                hireDate: profile.hireDate,
                employmentStatus: profile.employmentStatus,
                sssNumber: profile.sssNumber,
                philhealthNumber: profile.philhealthNumber,
                tinNumber: profile.tinNumber,
                pagibigNumber: profile.pagibigNumber,
                yearsOfExperience: profile.yearsOfExperience,
                educationHistory: cleanProfileHistory(profile.educationHistory),
                experienceHistory: cleanProfileHistory(profile.experienceHistory)
            };

            await updateProfile({ userId, role, payload });

            const normalized = {
                ...profile,
                profileImage: finalImageUrl,
                educationHistory: cleanProfileHistory(profile.educationHistory),
                experienceHistory: cleanProfileHistory(profile.experienceHistory)
            };

            const updatedUser = {
                ...currentUser,
                firstName: normalized.firstName,
                first_Name: normalized.firstName,
                lastName: normalized.lastName,
                last_Name: normalized.lastName,
                email: normalized.email,
                mail_Address: normalized.email,
                phoneNumber: normalized.phone,
                phone: normalized.phone,
                address: normalized.address,
                personal_Address: normalized.address,
                profileImage: finalImageUrl,
                setProfilePic_url: finalImageUrl
            };

            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            onUserUpdate?.(updatedUser);
            setProfile(normalized);
            setSavedProfile(normalized);
            setImageFile(null);
            setImageError(false);
            setIsEditing(false);
            toast.success('Profile saved successfully!');
        } catch (error) {
            console.error('Save profile error:', error);
            toast.error(error.message || 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setProfile(savedProfile);
        setImageFile(null);
        setImageError(false);
        setIsEditing(false);
    };

    if (isLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                Loading profile...
            </div>
        );
    }

    const profileImageSrc = imageError ? null : resolveImageUrl(profile.profileImage);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="mb-1 font-bold text-[24px] text-[#101828]">Profile Management</h2>
                    <p className="text-[16px] text-[#4a5565]">Manage your professional information and credentials</p>
                </div>
                {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} className="bg-[#155dfc] hover:bg-[#1447e6]">
                        Edit Profile
                    </Button>
                )}
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="mb-6 grid grid-cols-2 sm:inline-grid sm:grid-cols-4">
                    <TabsTrigger value="profile">Profile Details</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                    <Card className="overflow-hidden border-slate-200 shadow-xl rounded-2xl bg-white">
                        <div className="bg-gradient-to-r from-[#155dfc] to-[#0f766e] px-4 py-8 sm:px-8">
                            <div className="flex flex-col items-center gap-6 sm:flex-row">
                                <div className="relative">
                                    <div className="size-32 overflow-hidden rounded-full border-4 border-white bg-white/20 shadow-xl">
                                        {profileImageSrc ? (
                                            <img
                                                src={profileImageSrc}
                                                alt={getFullName(profile)}
                                                className="size-full object-cover"
                                                onError={() => setImageError(true)}
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center bg-white">
                                                <User className="size-16 text-[#155dfc]" />
                                            </div>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <label className="absolute bottom-1 right-1 flex size-11 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-[#155dfc] text-white shadow-lg hover:bg-blue-700">
                                            <Camera className="size-5" />
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                        </label>
                                    )}
                                </div>
                                <div className="min-w-0 text-center text-white sm:text-left">
                                    <h3 className="break-words text-[28px] font-bold">{getFullName(profile)}</h3>
                                    <p className="mt-1 text-[18px] text-white/90">{profile.position || 'Admin'}</p>
                                    <p className="mt-1 text-[16px] text-white/80">Employee ID: {profile.employeeId || 'Not set'}</p>
                                </div>
                            </div>
                        </div>

                        <CardContent className="space-y-8 p-4 sm:p-8">
                            <section>
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Personal Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ProfileInput label="First Name" icon={User} value={profile.firstName} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, firstName: value })} />
                                    <ProfileInput label="Last Name" icon={User} value={profile.lastName} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, lastName: value })} />
                                    <ProfileInput label="Email Address" icon={Mail} type="email" value={profile.email} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, email: value })} />
                                    <ProfileInput label="Phone Number" icon={Phone} value={profile.phone} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, phone: value })} />
                                    <ProfileInput label="Address" icon={MapPin} value={profile.address} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, address: value })} className="md:col-span-2" />
                                </div>
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Employment Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ProfileInput label="Employee ID" icon={IdCard} value={profile.employeeId} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, employeeId: value })} />
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                                            <Briefcase className="size-4" />
                                            Position / Role
                                        </Label>
                                        {isEditing ? (
                                            <Select value={profile.position} onValueChange={(value) => setProfile({ ...profile, position: value })} disabled={isSaving}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="Select position" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Clinic Administrator">Clinic Administrator</SelectItem>
                                                    <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                                                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                                                    <SelectItem value="Nurse">Nurse</SelectItem>
                                                    <SelectItem value="Assistant">Assistant</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <DisplayValue value={profile.position} />
                                        )}
                                    </div>
                                    <ProfileInput label="Total Years of Experience" icon={Calendar} type="number" value={profile.yearsOfExperience} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, yearsOfExperience: value })} />
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                                            <BadgeCheck className="size-4" />
                                            Employment Status
                                        </Label>
                                        {isEditing ? (
                                            <Select value={profile.employmentStatus} onValueChange={(value) => setProfile({ ...profile, employmentStatus: value })} disabled={isSaving}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="full-time">Full-time</SelectItem>
                                                    <SelectItem value="part-time">Part-time</SelectItem>
                                                    <SelectItem value="contract">Contract</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <DisplayValue value={profile.employmentStatus} />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                                            <Calendar className="size-4" />
                                            Hire Date
                                        </Label>
                                        {isEditing ? (
                                            <Input type="date" value={profile.hireDate} onChange={(event) => setProfile({ ...profile, hireDate: event.target.value })} disabled={isSaving} className="h-11" />
                                        ) : (
                                            <DisplayValue value={formatDisplayDate(profile.hireDate)} />
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Government Identifications</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ProfileInput label="SSS Number" icon={IdCard} value={profile.sssNumber} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, sssNumber: value })} />
                                    <ProfileInput label="PhilHealth Number" icon={IdCard} value={profile.philhealthNumber} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, philhealthNumber: value })} />
                                    <ProfileInput label="TIN Number" icon={IdCard} value={profile.tinNumber} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, tinNumber: value })} />
                                    <ProfileInput label="Pag-IBIG Number" icon={IdCard} value={profile.pagibigNumber} disabled={!isEditing || isSaving} onChange={(value) => setProfile({ ...profile, pagibigNumber: value })} />
                                </div>
                            </section>

                            <section className="space-y-8 border-t border-slate-100 pt-8">
                                <ProfileHistoryEditor
                                    title="Education"
                                    helperText="Add school, degree, major, description, and year range."
                                    items={profile.educationHistory}
                                    onChange={(items) => setProfile({ ...profile, educationHistory: items })}
                                    isEditing={isEditing && !isSaving}
                                    titlePlaceholder="School or degree title"
                                    descriptionPlaceholder="Major, certification, administration training, or description"
                                    yearsPlaceholder="e.g., 2018 - 2022"
                                    emptyText="No education entries yet."
                                />
                                <ProfileHistoryEditor
                                    title="Professional Experience"
                                    helperText="Add role titles, clinic/company names, responsibilities, and years."
                                    items={profile.experienceHistory}
                                    onChange={(items) => setProfile({ ...profile, experienceHistory: items })}
                                    isEditing={isEditing && !isSaving}
                                    titlePlaceholder="Role title or workplace"
                                    descriptionPlaceholder="Responsibilities, department, or description"
                                    yearsPlaceholder="e.g., 2022 - Present"
                                    emptyText="No experience entries yet."
                                />
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <h4 className="mb-2 text-[18px] font-bold text-[#101828]">Professional Name Preview</h4>
                                <div className="rounded-lg border border-[#bedbff] bg-[#eff6ff] p-4">
                                    <p className="break-words text-[20px] font-bold text-[#155dfc]">{getFullName(profile)}</p>
                                    <p className="mt-1 text-[16px] text-[#4a5565]">
                                        {profile.position || 'Admin'} - Employee ID: {profile.employeeId || 'Not set'}
                                    </p>
                                </div>
                            </section>

                            {isEditing && (
                                <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                                    <Button onClick={handleCancel} variant="outline" disabled={isSaving} className="h-11 w-full sm:w-[140px]">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={isSaving} className="h-11 w-full bg-[#155dfc] hover:bg-[#1447e6] sm:w-[180px]">
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 size-4" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security">
                    <PasswordChangeCard userId={userId} onForgotPassword={onLogout} />
                </TabsContent>

                <TabsContent value="notifications">
                    <NotificationPreferencesCard user={currentUser} />
                </TabsContent>

                <TabsContent value="appearance">
                    <ThemeToggle />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ProfileInput({ label, icon, value, onChange, disabled, type = 'text', className = '' }) {
    const iconElement = icon ? createElement(icon, { className: 'size-4' }) : null;

    return (
        <div className={`space-y-2 ${className}`}>
            <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                {iconElement}
                {label}
            </Label>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className="h-11"
            />
        </div>
    );
}

function DisplayValue({ value }) {
    return (
        <p className="flex min-h-11 items-center rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[15px] text-[#4a5565]">
            {value || 'Not set'}
        </p>
    );
}
