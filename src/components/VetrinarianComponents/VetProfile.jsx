import { createElement, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { User, Mail, Phone, MapPin, Award, Calendar, Save, Video, Camera, Loader2 } from 'lucide-react';
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
import { fetchVetSchedules, updateVetSchedules } from '../../services/vetScheduleService';

const TIME_SLOTS = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
];
const DAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
];

const emptyProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    specialization: '',
    address: '',
    consultationRate: '',
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

export default function VetProfile({ onLogout }) {
    const contextUser = useDashboardUser();
    const onUserUpdate = useUserUpdate();
    const currentUser = contextUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || currentUser.user_id;
    const role = currentUser.role || 'Veterinarian';

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [availability, setAvailability] = useState(() => createEmptyAvailability());
    const [profileData, setProfileData] = useState(emptyProfile);
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
                    licenseNumber: data.prc_license_number || '',
                    specialization: data.specialization || '',
                    address: data.personal_Address || '',
                    consultationRate: data.consultation_rate || '',
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

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                if (!userId) return;

                const data = await fetchVetSchedules(userId);
                if (Array.isArray(data)) {
                    setAvailability(buildAvailabilityByDay(data));
                }
            } catch (error) {
                console.error('Failed to fetch schedules:', error);
            }
        };
        fetchSchedules();
    }, [userId]);

    const toggleTimeSlot = async (day, time) => {
        const daySlots = availability[day] || [];
        const isCurrentlyAvailable = daySlots.includes(time);
        const newStatus = !isCurrentlyAvailable;

        setAvailability(prev => ({
            ...prev,
            [day]: newStatus
                ? sortTimeSlots([...(prev[day] || []), time])
                : (prev[day] || []).filter(slot => slot !== time)
        }));

        try {
            await updateVetSchedules({
                user_id: userId,
                day,
                time,
                is_available: newStatus ? 1 : 0
            });

            toast.success('Availability updated');
        } catch (error) {
            console.error('Failed to update schedule:', error);
            toast.error('Failed to update availability');
            setAvailability(prev => ({
                ...prev,
                [day]: isCurrentlyAvailable
                    ? sortTimeSlots([...(prev[day] || []), time])
                    : (prev[day] || []).filter(slot => slot !== time)
            }));
        }
    };

    const specializationOptions = [
        'Small Animal Medicine',
        'Large Animal Medicine',
        'Emergency & Critical Care',
        'Surgery',
        'Internal Medicine',
        'Dermatology',
        'Cardiology',
        'Oncology',
        'Orthopedics',
        'Dentistry',
        'Exotic Animal Medicine',
        'General Practice'
    ];

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
            return;
        }

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
                phoneNumber: profileData.phone,
                address: profileData.address,
                profileImage: finalImageUrl,
                licenseNumber: profileData.licenseNumber,
                specialization: profileData.specialization,
                consultationRate: profileData.consultationRate,
                hireDate: profileData.hireDate,
                isActive: profileData.isActive ? 1 : 0,
                yearsOfExperience: profileData.yearsOfExperience,
                educationHistory: cleanProfileHistory(profileData.educationHistory),
                experienceHistory: cleanProfileHistory(profileData.experienceHistory)
            };

            await updateProfile({ userId, role, payload });

            const normalized = {
                ...profileData,
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
                phoneNumber: normalized.phone,
                phone: normalized.phone,
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
        } catch (error) {
            console.error('Save profile error:', error);
            toast.error(error.message || 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setProfileData(savedProfile);
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

    const profileImageSrc = imageError ? null : resolveImageUrl(profileData.profileImage);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-bold text-[24px] text-[#101828]">Profile</h2>
                    <p className="mt-1 text-[16px] text-[#4a5565]">Manage your professional information</p>
                </div>
                {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} className="bg-[#155dfc] hover:bg-[#0d4acf]">
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
                        <div className="bg-gradient-to-r from-[#155dfc] to-[#6d5dfc] px-4 py-8 sm:px-8">
                            <div className="flex flex-col items-center gap-6 sm:flex-row">
                                <div className="relative">
                                    <div className="size-32 overflow-hidden rounded-full border-4 border-white bg-white/20 shadow-xl">
                                        {profileImageSrc ? (
                                            <img
                                                src={profileImageSrc}
                                                alt={getFullName(profileData)}
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
                                    <h3 className="break-words text-[28px] font-bold">{getFullName(profileData)}</h3>
                                    <p className="mt-1 text-[18px] text-white/90">{profileData.specialization || 'Veterinarian'}</p>
                                    <p className="mt-1 text-[16px] text-white/80">License: {profileData.licenseNumber || 'Not set'}</p>
                                </div>
                            </div>
                        </div>

                        <CardContent className="space-y-8 p-4 sm:p-8">
                            <section>
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Personal Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ProfileInput label="First Name" icon={User} value={profileData.firstName} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, firstName: value })} />
                                    <ProfileInput label="Last Name" icon={User} value={profileData.lastName} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, lastName: value })} />
                                    <ProfileInput label="Email Address" icon={Mail} type="email" value={profileData.email} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, email: value })} />
                                    <ProfileInput label="Phone Number" icon={Phone} value={profileData.phone} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, phone: value })} />
                                    <ProfileInput label="Address" icon={MapPin} value={profileData.address} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, address: value })} className="md:col-span-2" />
                                </div>
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <h3 className="mb-4 text-[18px] font-bold text-[#101828]">Professional Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                                            <Award className="size-4" />
                                            Specialization
                                        </Label>
                                        {isEditing ? (
                                            <Select value={profileData.specialization} onValueChange={(value) => setProfileData({ ...profileData, specialization: value })} disabled={isSaving}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="Select specialization" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {specializationOptions.map(spec => (
                                                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <DisplayValue value={profileData.specialization} />
                                        )}
                                    </div>
                                    <ProfileInput label="License Number" icon={Award} value={profileData.licenseNumber} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, licenseNumber: value })} />
                                    <ProfileInput label="Total Years of Experience" icon={Calendar} type="number" value={profileData.yearsOfExperience} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, yearsOfExperience: value })} />
                                    <ProfileInput label="Consultation Rate (PHP)" icon={Award} type="number" value={profileData.consultationRate} disabled={!isEditing || isSaving} onChange={(value) => setProfileData({ ...profileData, consultationRate: value })} />
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-[15px] font-bold text-[#101828]">
                                            <Calendar className="size-4" />
                                            Hire Date
                                        </Label>
                                        {isEditing ? (
                                            <Input type="date" value={profileData.hireDate} onChange={(event) => setProfileData({ ...profileData, hireDate: event.target.value })} disabled={isSaving} className="h-11" />
                                        ) : (
                                            <DisplayValue value={formatDisplayDate(profileData.hireDate)} />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <Checkbox checked={profileData.isActive} onCheckedChange={(checked) => isEditing && setProfileData({ ...profileData, isActive: Boolean(checked) })} disabled={!isEditing || isSaving} />
                                        <Label className="font-bold text-slate-700">Currently Active</Label>
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
                                    descriptionPlaceholder="Major, honors, license training, or description"
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
                                    descriptionPlaceholder="Responsibilities, specialty work, or description"
                                    yearsPlaceholder="e.g., 2022 - Present"
                                    emptyText="No experience entries yet."
                                />
                            </section>

                            <section className="border-t border-slate-100 pt-8">
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-[10px] bg-[rgba(21,93,252,0.1)]">
                                        <Video className="size-5 text-[#155dfc]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[18px] font-bold text-[#101828]">Online Consultation Availability</h3>
                                        <p className="text-[14px] text-[#4a5565]">Set your available time slots by day for online consultations</p>
                                    </div>
                                </div>
                                <div className="space-y-4 rounded-[10px] border border-slate-200 bg-[#f9fafb] p-4 sm:p-6">
                                    {DAYS.map(day => (
                                        <div key={day.key} className="rounded-[10px] border border-slate-200 bg-white p-4">
                                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <h4 className="font-bold text-[#101828]">{day.label}</h4>
                                                <span className="text-[13px] text-[#4a5565]">
                                                    {(availability[day.key] || []).length} slot{(availability[day.key] || []).length === 1 ? '' : 's'} selected
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                                {TIME_SLOTS.map(time => {
                                                    const isSelected = (availability[day.key] || []).includes(time);
                                                    return (
                                                        <button
                                                            key={`${day.key}-${time}`}
                                                            type="button"
                                                            onClick={() => isEditing && toggleTimeSlot(day.key, time)}
                                                            disabled={!isEditing}
                                                            className={`rounded-[8px] px-3 py-3 text-[14px] transition-colors ${
                                                                isSelected
                                                                    ? 'bg-[#155dfc] text-white'
                                                                    : 'border border-slate-200 bg-white text-[#4a5565] hover:border-[#155dfc]'
                                                            } ${!isEditing ? 'cursor-default' : 'cursor-pointer'}`}
                                                        >
                                                            {time}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                            </section>

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
