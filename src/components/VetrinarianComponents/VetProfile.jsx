import { createElement, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent } from '../../ui/card';
import { Tabs, TabsContent } from '../../ui/tabs';
import {
    Award,
    Calendar,
    Check,
    Clock3,
    Loader2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Save,
    User,
    Video
} from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDate } from '../../lib/date';
import { cleanProfileHistory, parseProfileHistory } from '../../lib/profileHistory';
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../../lib/philippinePhone';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useUserUpdate } from '../dashboardRouter.jsx';
import PasswordChangeCard from '../shared/PasswordChangeCard.jsx';
import ProfileHistoryEditor from '../shared/ProfileHistoryEditor.jsx';
import ThemeToggle from '../shared/ThemeToggle.jsx';
import NotificationPreferencesCard from '../shared/NotificationPreferencesCard.jsx';
import ProfileWorkspaceHeader from '../shared/ProfileWorkspaceHeader.jsx';
import UnsavedProfileChangesDialog from '../shared/UnsavedProfileChangesDialog.jsx';
import {
    PROFILE_DISPLAY_VALUE_CLASS,
    profileInputClass,
    profileLabelClass
} from '../shared/profileUiStyles.js';
import { fetchProfile, updateProfile } from '../../services/profileService';
import { uploadImageFile } from '../../services/uploadService';
import { fetchVetSchedules, updateVetSchedules } from '../../services/vetScheduleService';

const TIME_SLOTS = [
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
    '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
];
const DAYS = [
    { key: 'monday', label: 'Monday', shortLabel: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
    { key: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
    { key: 'friday', label: 'Friday', shortLabel: 'Fri' },
    { key: 'saturday', label: 'Saturday', shortLabel: 'Sat' }
];

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
    educationHistory: [],
    experienceHistory: []
};

function normalizeDate(value) {
    return value ? String(value).split(' ')[0] : '';
}

function sortTimeSlots(slots) {
    return [...new Set(slots)].sort((first, second) => TIME_SLOTS.indexOf(first) - TIME_SLOTS.indexOf(second));
}

function createEmptyAvailability() {
    return DAYS.reduce((availability, day) => ({
        ...availability,
        [day.key]: []
    }), {});
}

function cloneAvailability(source) {
    return DAYS.reduce((nextAvailability, day) => ({
        ...nextAvailability,
        [day.key]: [...(source[day.key] || [])]
    }), {});
}

function getAvailabilityChanges(nextAvailability, previousAvailability) {
    return DAYS.flatMap(day => TIME_SLOTS.flatMap(time => {
        const isAvailable = (nextAvailability[day.key] || []).includes(time);
        const wasAvailable = (previousAvailability[day.key] || []).includes(time);

        return isAvailable === wasAvailable
            ? []
            : [{ day: day.key, time, isAvailable }];
    }));
}

function buildAvailabilityByDay(schedules) {
    const nextAvailability = createEmptyAvailability();

    schedules.forEach(schedule => {
        const day = String(schedule.day_of_week || '').toLowerCase();
        const isAvailable = Number(schedule.is_available) === 1 || schedule.is_available === true;

        if (isAvailable && day in nextAvailability && schedule.time_slot) {
            nextAvailability[day] = sortTimeSlots([...nextAvailability[day], schedule.time_slot]);
        }
    });

    return nextAvailability;
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
    const [availability, setAvailability] = useState(() => createEmptyAvailability());
    const [savedAvailability, setSavedAvailability] = useState(() => createEmptyAvailability());
    const [activeAvailabilityDay, setActiveAvailabilityDay] = useState(DAYS[0].key);
    const [isEditingAvailability, setIsEditingAvailability] = useState(false);
    const [isSavingAvailability, setIsSavingAvailability] = useState(false);
    const [profileData, setProfileData] = useState(emptyProfile);
    const [savedProfile, setSavedProfile] = useState(emptyProfile);
    const [imageFile, setImageFile] = useState(null);
    const [imageError, setImageError] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
    const [pendingProfileTab, setPendingProfileTab] = useState('');
    const [isProfileLeaveDialogOpen, setIsProfileLeaveDialogOpen] = useState(false);

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
                    educationHistory: parseProfileHistory(data.education_history, data.education ? 'Education' : ''),
                    experienceHistory: parseProfileHistory(data.experience_history)
                };

                setProfileData(normalized);
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

    useAutoRefresh(async () => {
        if (!userId) return;

        const data = await fetchVetSchedules(userId);
        if (Array.isArray(data)) {
            const nextAvailability = buildAvailabilityByDay(data);
            setAvailability(nextAvailability);
            setSavedAvailability(cloneAvailability(nextAvailability));
        }
    }, {
        enabled: Boolean(userId) && activeTab === 'profile' && !isEditingAvailability && !isSavingAvailability,
        refreshKey: `vet-profile-availability-${userId || 'none'}`
    });

    const toggleTimeSlot = (day, time) => {
        setAvailability(prev => ({
            ...prev,
            [day]: !(prev[day] || []).includes(time)
                ? sortTimeSlots([...(prev[day] || []), time])
                : (prev[day] || []).filter(slot => slot !== time)
        }));
    };

    const setDayAvailability = (day, slots) => {
        setAvailability(prev => ({
            ...prev,
            [day]: sortTimeSlots(slots)
        }));
    };

    const handleCancelAvailability = () => {
        setAvailability(cloneAvailability(savedAvailability));
        setIsEditingAvailability(false);
    };

    const handleSaveAvailability = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return false;
        }

        const changes = getAvailabilityChanges(availability, savedAvailability);

        if (changes.length === 0) {
            setIsEditingAvailability(false);
            return true;
        }

        setIsSavingAvailability(true);

        try {
            await Promise.all(changes.map(change => updateVetSchedules({
                user_id: userId,
                day: change.day,
                time: change.time,
                is_available: change.isAvailable ? 1 : 0
            })));

            setSavedAvailability(cloneAvailability(availability));
            setIsEditingAvailability(false);
            toast.success('Online consultation availability updated');
            return true;
        } catch (error) {
            console.error('Failed to update schedule:', error);
            toast.error('Some availability changes could not be saved. Your schedule has been refreshed.');

            try {
                const data = await fetchVetSchedules(userId);
                if (Array.isArray(data)) {
                    const refreshedAvailability = buildAvailabilityByDay(data);
                    setAvailability(refreshedAvailability);
                    setSavedAvailability(cloneAvailability(refreshedAvailability));
                }
            } catch (refreshError) {
                console.error('Failed to refresh schedule:', refreshError);
            }

            return false;
        } finally {
            setIsSavingAvailability(false);
        }
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImageFile(file);
        setProfileData(prev => ({ ...prev, profileImage: URL.createObjectURL(file) }));
        setImageError(false);
    };

    const handleSave = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
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
                finalImageUrl = await uploadImageFile(imageFile, 'user') || finalImageUrl;
            }

            const payload = {
                role,
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                email: profileData.email,
                phoneNumber: normalizedPhone,
                address: profileData.address,
                profileImage: finalImageUrl,
                educationHistory: cleanProfileHistory(profileData.educationHistory),
                experienceHistory: cleanProfileHistory(profileData.experienceHistory)
            };

            await updateProfile({ userId, role, payload });

            const normalized = {
                ...profileData,
                phone: normalizedPhone,
                profileImage: finalImageUrl,
                educationHistory: cleanProfileHistory(profileData.educationHistory),
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
            toast.success('Profile updated successfully!');
            return true;
        } catch (error) {
            console.error('Save profile error:', error);
            toast.error(error.message || 'Failed to save profile');
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

        if (activeTab === 'profile' && (isEditing || isEditingAvailability)) {
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
        const saved = isEditingAvailability
            ? await handleSaveAvailability()
            : await handleSave();
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
                    accountLabel="Veterinarian Account"
                    displayName={getFullName(profileData)}
                    secondaryLabel={`License: ${profileData.licenseNumber || 'Not set'}`}
                    imageSrc={profileImageSrc || ''}
                    imageUnavailable={imageError && Boolean(profileData.profileImage)}
                    isEditing={isEditing}
                    onImageChange={handleImageChange}
                    onImageError={setImageError}
                    action={activeTab === 'profile' && !isEditing ? (
                        <Button
                            onClick={() => setIsEditing(true)}
                            disabled={isEditingAvailability || isSavingAvailability}
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
                                    <ProfileInput label="Email Address" icon={Mail} type="email" value={profileData.email} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, email: value })} />
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
                                    title="Education"
                                    helperText="Add school, degree, major, description, and year range."
                                    items={profileData.educationHistory}
                                    onChange={(items) => setProfileData({ ...profileData, educationHistory: items })}
                                    isEditing={isEditing && !isSaving}
                                    titlePlaceholder="School or degree title"
                                    descriptionPlaceholder="Major or license training"
                                    yearsPlaceholder="e.g., 2018 - 2022"
                                    emptyText="No education entries yet."
                                />
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

                            <AvailabilityEditor
                                availability={availability}
                                activeDay={activeAvailabilityDay}
                                isEditing={isEditingAvailability}
                                isSaving={isSavingAvailability}
                                profileIsEditing={isEditing}
                                onActiveDayChange={setActiveAvailabilityDay}
                                onEdit={() => setIsEditingAvailability(true)}
                                onCancel={handleCancelAvailability}
                                onSave={handleSaveAvailability}
                                onTimeToggle={toggleTimeSlot}
                                onDaySlotsChange={setDayAvailability}
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
            </Tabs>

            <UnsavedProfileChangesDialog
                open={isProfileLeaveDialogOpen}
                onStay={handleStayOnProfile}
                onSave={handleSaveAndLeaveProfile}
                isSaving={isSaving || isSavingAvailability}
                title={isEditingAvailability ? 'Save availability first' : undefined}
                description={isEditingAvailability ? 'Save your online consultation schedule before opening another tab.' : undefined}
                saveLabel={isEditingAvailability ? 'Save availability' : undefined}
            />
        </div>
    );
}

function AvailabilityEditor({
    availability,
    activeDay,
    isEditing,
    isSaving,
    profileIsEditing,
    onActiveDayChange,
    onEdit,
    onCancel,
    onSave,
    onTimeToggle,
    onDaySlotsChange
}) {
    const activeDayDetails = DAYS.find(day => day.key === activeDay) || DAYS[0];
    const activeSlots = availability[activeDayDetails.key] || [];
    const morningSlots = TIME_SLOTS.filter(time => time.endsWith('AM'));
    const afternoonSlots = TIME_SLOTS.filter(time => time.endsWith('PM'));
    const weeklySlotCount = DAYS.reduce(
        (total, day) => total + (availability[day.key] || []).length,
        0
    );

    const renderTimeButton = time => {
        const isSelected = activeSlots.includes(time);

        return (
            <button
                key={`${activeDayDetails.key}-${time}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onTimeToggle(activeDayDetails.key, time)}
                disabled={isSaving}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
                    isSelected
                        ? 'border-[#155dfc] bg-[#155dfc] text-white hover:bg-[#0d4acf]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#155dfc] hover:bg-blue-50 hover:text-[#155dfc]'
                }`}
            >
                {isSelected && <Check className="size-3.5 shrink-0" />}
                {time}
            </button>
        );
    };

    return (
        <section className="border-t border-slate-100 pt-8">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Video className="size-5 text-[#155dfc]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#101828]">Online Consultation Availability</h3>
                        <p className="mt-0.5 text-sm text-[#4a5565]">
                            Choose a day, then set the times pet owners can book.
                        </p>
                    </div>
                </div>

                {!isEditing && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onEdit}
                        disabled={profileIsEditing || isSaving}
                        title={profileIsEditing ? 'Save or cancel your profile changes first' : undefined}
                        className="w-full shrink-0 sm:w-auto"
                    >
                        <Pencil className="size-4" />
                        Edit availability
                    </Button>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Weekly schedule</p>
                        <p className="text-xs font-medium text-slate-500">
                            {weeklySlotCount} slot{weeklySlotCount === 1 ? '' : 's'} total
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="tablist" aria-label="Consultation availability days">
                        {DAYS.map(day => {
                            const daySlotCount = (availability[day.key] || []).length;
                            const isActive = day.key === activeDayDetails.key;

                            return (
                                <button
                                    key={day.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-controls="availability-day-panel"
                                    onClick={() => onActiveDayChange(day.key)}
                                    className={`min-w-0 rounded-lg border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 ${
                                        isActive
                                            ? 'border-[#155dfc] bg-blue-50 text-[#155dfc] shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                    }`}
                                >
                                    <span className="block text-sm font-bold">{day.shortLabel}</span>
                                    <span className={`mt-0.5 block text-[11px] font-medium ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
                                        {daySlotCount === 0 ? 'Not set' : `${daySlotCount} slot${daySlotCount === 1 ? '' : 's'}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    id="availability-day-panel"
                    role="tabpanel"
                    className="p-4 sm:p-5"
                >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h4 className="font-bold text-slate-950">{activeDayDetails.label}</h4>
                            <p className="mt-0.5 text-sm text-slate-500">
                                {isEditing
                                    ? `${activeSlots.length} of ${TIME_SLOTS.length} half-hour slots selected`
                                    : `${activeSlots.length} available slot${activeSlots.length === 1 ? '' : 's'}`}
                            </p>
                        </div>

                        {isEditing && (
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDaySlotsChange(activeDayDetails.key, [])}
                                    disabled={activeSlots.length === 0 || isSaving}
                                    className="flex-1 text-slate-600 sm:flex-none"
                                >
                                    Clear day
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDaySlotsChange(activeDayDetails.key, TIME_SLOTS)}
                                    disabled={activeSlots.length === TIME_SLOTS.length || isSaving}
                                    className="flex-1 sm:flex-none"
                                >
                                    Select all
                                </Button>
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-5">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    <Clock3 className="size-3.5" />
                                    Morning
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                    {morningSlots.map(renderTimeButton)}
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    <Clock3 className="size-3.5" />
                                    Afternoon
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                    {afternoonSlots.map(renderTimeButton)}
                                </div>
                            </div>
                        </div>
                    ) : activeSlots.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                            {activeSlots.map(time => (
                                <div
                                    key={`${activeDayDetails.key}-summary-${time}`}
                                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700"
                                >
                                    <Clock3 className="size-3.5 text-slate-400" />
                                    {time}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                            <Clock3 className="mb-2 size-5 text-slate-400" />
                            <p className="text-sm font-semibold text-slate-700">No times set for {activeDayDetails.label}</p>
                            <p className="mt-1 text-xs text-slate-500">Use Edit availability to add bookable times.</p>
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">Changes apply to your recurring weekly schedule.</p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onCancel}
                                disabled={isSaving}
                                className="flex-1 sm:flex-none"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={onSave}
                                disabled={isSaving}
                                className="flex-1 bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:flex-none"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="size-4" />
                                        Save availability
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function ProfileInput({ label, icon, value, onChange, disabled, type = 'text', className = '', inputMode, maxLength, placeholder = '', error = '' }) {
    const iconElement = icon ? createElement(icon, { className: 'size-4' }) : null;

    return (
        <div className={`space-y-2 ${className}`}>
            <Label className={profileLabelClass()}>
                {iconElement}
                {label}
            </Label>
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
