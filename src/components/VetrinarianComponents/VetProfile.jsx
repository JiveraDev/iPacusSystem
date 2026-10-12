import { createElement, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent } from '../../ui/card';
import { Tabs, TabsContent } from '../../ui/tabs';
import {
    Award,
    Calendar,
    Loader2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Save,
    User
} from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDate } from '../../lib/date';
import { cleanProfileHistory, parseProfileHistory } from '../../lib/profileHistory';
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../../lib/philippinePhone';
import { useDashboardUser, useUserUpdate } from '../dashboardRouter.jsx';
import PasswordChangeCard from '../shared/PasswordChangeCard.jsx';
import GoogleAccountLinkControl from '../shared/GoogleAccountLinkControl.jsx';
import ProfileHistoryEditor from '../shared/ProfileHistoryEditor.jsx';
import ThemeToggle from '../shared/ThemeToggle.jsx';
import NotificationPreferencesCard from '../shared/NotificationPreferencesCard.jsx';
import ProfileWorkspaceHeader from '../shared/ProfileWorkspaceHeader.jsx';
import StaffActivityHistory from '../shared/StaffActivityHistory.jsx';
import UnsavedProfileChangesDialog from '../shared/UnsavedProfileChangesDialog.jsx';
import {
    PROFILE_DISPLAY_VALUE_CLASS,
    profileInputClass,
    profileLabelClass
} from '../shared/profileUiStyles.js';
import { fetchProfile, updateProfile } from '../../services/profileService';
import { uploadImageFile } from '../../services/uploadService';
import VetBookingSchedulePanel from '../shared/VetBookingSchedulePanel.jsx';
import VetOnlineAvailabilityPanel from '../shared/VetOnlineAvailabilityPanel.jsx';

const emptyProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: normalizePhilippinePhoneInput(''),
    licenseNumber: '',
    specialization: '',
    address: '',
    hireDate: '',
    isActive: false,
    profileImage: '',
    yearsOfExperience: '',
    experienceHistory: []
};

function normalizeDate(value) {
    return value ? String(value).split(' ')[0] : '';
}

function getFullName(profile) {
    return `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Veterinarian Profile';
}

export default function VetProfile({ onForgotPassword }) {
    const contextUser = useDashboardUser();
    const onUserUpdate = useUserUpdate();
    const currentUser = contextUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || currentUser.user_id;
    const role = currentUser.role || 'Veterinarian';

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingAvailability, setIsSavingAvailability] = useState(false);
    const [isSavingOnlineAvailability, setIsSavingOnlineAvailability] = useState(false);
    const [profileData, setProfileData] = useState(emptyProfile);
    const [savedProfile, setSavedProfile] = useState(emptyProfile);
    const [imageFile, setImageFile] = useState(null);
    const [imageError, setImageError] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
    const [pendingProfileTab, setPendingProfileTab] = useState('');
    const [isProfileLeaveDialogOpen, setIsProfileLeaveDialogOpen] = useState(false);

    useEffect(() => {
        const preview = profileData.profileImage;
        return () => {
            if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
        };
    }, [profileData.profileImage]);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                if (!userId) return;

                const data = await fetchProfile({ userId, role });

                const normalized = {
                    firstName: data.first_Name || '',
                    lastName: data.last_Name || '',
                    email: data.mail_Address || '',
                    phone: normalizePhilippinePhoneInput(data.phoneNumber || ''),
                    licenseNumber: data.prc_license_number || '',
                    specialization: data.specialization || '',
                    address: data.personal_Address || '',
                    hireDate: normalizeDate(data.hire_date),
                    isActive: Number(data.is_active) === 1 || data.is_active === true,
                    profileImage: data.setProfilePic_url || '',
                    yearsOfExperience: data.years_of_experience ?? '',
                    experienceHistory: parseProfileHistory(data.experience_history)
                };

                setProfileData(normalized);
                setSavedProfile(normalized);
                setImageError(false);
            } catch (error) {
                console.error('Failed to load profile:', error);
                toast.error(error.message || 'Your veterinarian profile could not be loaded. Refresh the page or try again.');
            } finally {
                setIsLoading(false);
            }
        };
        loadProfile();
    }, [userId, role]);

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file || isSaving) return;

        setImageFile(file);
        setProfileData(prev => ({ ...prev, profileImage: URL.createObjectURL(file) }));
        setImageError(false);
        event.target.value = '';
    };

    const handleSave = async () => {
        if (!userId) {
            toast.error('Your session has expired. Log in again to update your profile.');
            return false;
        }

        const nextPhoneError = getPhilippinePhoneError(profileData.phone, { optional: true });
        if (nextPhoneError) {
            setPhoneError(nextPhoneError);
            toast.error(nextPhoneError);
            return false;
        }

        setPhoneError('');
        const normalizedPhone = normalizePhilippinePhoneForSubmit(profileData.phone, { optional: true });
        setIsSaving(true);
        let finalImageUrl = profileData.profileImage;

        try {
            if (imageFile) {
                finalImageUrl = await uploadImageFile(imageFile, 'user');
            }

            const payload = {
                role,
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                email: profileData.email,
                phoneNumber: normalizedPhone,
                address: profileData.address,
                profileImage: finalImageUrl,
                experienceHistory: cleanProfileHistory(profileData.experienceHistory)
            };

            await updateProfile({ userId, role, payload });

            const normalized = {
                ...profileData,
                phone: normalizedPhone,
                profileImage: finalImageUrl,
                experienceHistory: cleanProfileHistory(profileData.experienceHistory)
            };

            const updatedUser = {
                ...currentUser,
                firstName: normalized.firstName,
                first_Name: normalized.firstName,
                lastName: normalized.lastName,
                last_Name: normalized.lastName,
                email: normalized.email,
                mail_Address: normalized.email,
                phoneNumber: normalizedPhone,
                phone: normalizedPhone,
                address: normalized.address,
                personal_Address: normalized.address,
                profileImage: finalImageUrl,
                setProfilePic_url: finalImageUrl
            };

            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            onUserUpdate?.(updatedUser);
            setProfileData(normalized);
            setSavedProfile(normalized);
            setImageFile(null);
            setImageError(false);
            setIsEditing(false);
            toast.success('Veterinarian profile updated.');
            return true;
        } catch (error) {
            console.error('Save profile error:', error);
            toast.error(error.message || 'Your veterinarian profile could not be saved. Review the details and try again.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setProfileData(savedProfile);
        setImageFile(null);
        setImageError(false);
        setPhoneError('');
        setIsEditing(false);
    };

    const handleProfileTabChange = (nextTab) => {
        if (nextTab === activeTab) return;
        if (isSavingAvailability || isSavingOnlineAvailability) return;

        if (activeTab === 'profile' && isEditing) {
            setPendingProfileTab(nextTab);
            setIsProfileLeaveDialogOpen(true);
            return;
        }

        setActiveTab(nextTab);
    };

    const handleStayOnProfile = () => {
        setPendingProfileTab('');
        setIsProfileLeaveDialogOpen(false);
        setActiveTab('profile');
    };

    const handleSaveAndLeaveProfile = async () => {
        const saved = await handleSave();
        if (!saved) return;

        setIsProfileLeaveDialogOpen(false);
        setActiveTab(pendingProfileTab || 'profile');
        setPendingProfileTab('');
    };

    if (isLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                Loading profile...
            </div>
        );
    }

    const profileImageSrc = imageError ? null : profileData.profileImage;

    return (
        <div className="mx-auto max-w-6xl">
            <Tabs
                value={activeTab}
                onValueChange={handleProfileTabChange}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <ProfileWorkspaceHeader
                    activeTab={activeTab}
                    showActivityTab
                    accountLabel="Veterinarian Account"
                    displayName={getFullName(profileData)}
                    secondaryLabel={`License: ${profileData.licenseNumber || 'Not set'}`}
                    imageSrc={profileImageSrc || ''}
                    imageUnavailable={imageError && Boolean(profileData.profileImage)}
                    isEditing={isEditing && !isSaving}
                    onImageChange={handleImageChange}
                    onImageError={setImageError}
                    action={activeTab === 'profile' && !isEditing ? (
                        <Button
                            onClick={() => setIsEditing(true)}
                            disabled={isSavingAvailability || isSavingOnlineAvailability}
                            className="h-11 w-full bg-white px-5 font-black text-blue-800 shadow-sm hover:bg-blue-50 sm:w-auto"
                        >
                            <Pencil />
                            Edit Profile
                        </Button>
                    ) : null}
                />

                <TabsContent value="profile" className="m-0">
                    <Card className="overflow-hidden rounded-none border-0 bg-white shadow-none dark:bg-slate-900">
                        <CardContent className="space-y-8 p-4 sm:p-6 lg:p-8">
                            <section>
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Personal Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ProfileInput label="First Name" icon={User} value={profileData.firstName} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, firstName: value })} />
                                    <ProfileInput label="Last Name" icon={User} value={profileData.lastName} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, lastName: value })} />
                                    <ProfileInput label="Email Address" icon={Mail} labelAction={<GoogleAccountLinkControl />} type="email" value={profileData.email} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, email: value })} />
                                    <ProfileInput
                                        label="Phone Number"
                                        icon={Phone}
                                        value={profileData.phone}
                                        disabled={!isEditing || isSaving}
                                        onChange={(value) => {
                                            setPhoneError('');
                                            setProfileData({ ...profileData, phone: normalizePhilippinePhoneInput(value) });
                                        }}
                                        inputMode="tel"
                                        maxLength={13}
                                        placeholder="+639"
                                        error={phoneError}
                                    />
                                    <ProfileInput label="Address" icon={MapPin} value={profileData.address} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, address: value })} className="md:col-span-2" />
                                </div>
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Professional Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className={profileLabelClass()}>
                                            <Award className="size-4" />
                                            Specialization
                                        </Label>
                                        <DisplayValue value={profileData.specialization} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={profileLabelClass()}>
                                            <Award className="size-4" />
                                            License Number
                                        </Label>
                                        <DisplayValue value={profileData.licenseNumber} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={profileLabelClass()}>
                                            <Calendar className="size-4" />
                                            Total Years of Experience
                                        </Label>
                                        <DisplayValue value={profileData.yearsOfExperience} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={profileLabelClass()}>
                                            <Calendar className="size-4" />
                                            Hire Date
                                        </Label>
                                        <DisplayValue value={formatDisplayDate(profileData.hireDate)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={profileLabelClass()}>
                                            <Award className="size-4" />
                                            Currently Active
                                        </Label>
                                        <DisplayValue value={profileData.isActive ? 'Yes' : 'No'} />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-8 border-t border-slate-100 pt-8">
                                <ProfileHistoryEditor
                                    title="Professional Experience"
                                    helperText="Add role titles, clinic names, responsibilities, and years."
                                    items={profileData.experienceHistory}
                                    onChange={(items) => setProfileData({ ...profileData, experienceHistory: items })}
                                    isEditing={isEditing && !isSaving}
                                    titlePlaceholder="Role title or workplace"
                                    descriptionPlaceholder="Role or specialty"
                                    yearsPlaceholder="e.g., 2022 - Present"
                                    emptyText="No experience entries yet."
                                />
                            </section>

                            <VetBookingSchedulePanel
                                veterinarianId={userId}
                                disabled={isEditing || isSaving || isSavingOnlineAvailability}
                                onSavingChange={setIsSavingAvailability}
                            />

                            <VetOnlineAvailabilityPanel
                                veterinarianId={userId}
                                disabled={isEditing || isSaving || isSavingAvailability}
                                onSavingChange={setIsSavingOnlineAvailability}
                            />

                            {isEditing && (
                                <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                                    <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="h-11 w-full sm:w-[140px]">Cancel</Button>
                                    <Button onClick={handleSave} disabled={isSaving} className="h-11 w-full bg-[#155dfc] hover:bg-[#0d4acf] sm:w-[180px]">
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

                <TabsContent value="security" className="m-0 bg-slate-50/70 p-4 dark:bg-slate-950/40 sm:p-6">
                    <PasswordChangeCard userId={userId} onForgotPassword={onForgotPassword} />
                </TabsContent>

                <TabsContent value="notifications" className="m-0 bg-slate-50/70 p-4 dark:bg-slate-950/40 sm:p-6">
                    <NotificationPreferencesCard user={currentUser} />
                </TabsContent>

                <TabsContent value="appearance" className="m-0 bg-slate-50/70 p-4 dark:bg-slate-950/40 sm:p-6">
                    <ThemeToggle />
                </TabsContent>
                <TabsContent value="activity" className="m-0 bg-white p-4 dark:bg-slate-900 sm:p-6">
                    {activeTab === 'activity' && <StaffActivityHistory />}
                </TabsContent>
            </Tabs>

            <UnsavedProfileChangesDialog
                open={isProfileLeaveDialogOpen}
                onStay={handleStayOnProfile}
                onSave={handleSaveAndLeaveProfile}
                isSaving={isSaving}
            />
        </div>
    );
}

function ProfileInput({ label, icon, labelAction, value, onChange, disabled, type = 'text', className = '', inputMode, maxLength, placeholder = '', error = '' }) {
    const iconElement = icon ? createElement(icon, { className: 'size-4' }) : null;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex min-h-7 items-center justify-between gap-2">
                <Label className={profileLabelClass()}>
                    {iconElement}
                    {label}
                </Label>
                {labelAction}
            </div>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                inputMode={inputMode}
                maxLength={maxLength}
                placeholder={placeholder}
                className={profileInputClass(error ? 'border-red-500' : '')}
            />
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}

function DisplayValue({ value }) {
    return (
        <p className={PROFILE_DISPLAY_VALUE_CLASS}>
            {value || <span className="font-medium text-slate-400">Not set</span>}
        </p>
    );
}
