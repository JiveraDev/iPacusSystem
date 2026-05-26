import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { User, Mail, Phone, MapPin, Award, Calendar, Save, Video } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TIME_SLOTS = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
];

function normalizeDate(value) {
    return value ? String(value).split(' ')[0] : '';
}

function sortTimeSlots(slots) {
    return [...new Set(slots)].sort((first, second) => TIME_SLOTS.indexOf(first) - TIME_SLOTS.indexOf(second));
}

export default function VetProfile() {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [availability, setAvailability] = useState([]);
    const [profileData, setProfileData] = useState({
        fullName: '',
        email: '',
        phone: '',
        licenseNumber: '',
        specialization: '',
        education: '',
        experience: '',
        address: '',
        consultationRate: '',
        hireDate: '',
        isActive: false
    });

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const userId = currentUser.id || currentUser.user_id;
    const role = currentUser.role;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                if (!userId) return;

                const response = await fetch(`${API_BASE}/api/profile?userId=${userId}&role=${encodeURIComponent(role || '')}`);
                const data = await response.json();
                if (response.ok) {
                    const fullName = `${data.first_Name || ''} ${data.last_Name || ''}`.trim();
                    setProfileData({
                        fullName,
                        email: data.mail_Address || '',
                        phone: data.phoneNumber || '',
                        licenseNumber: data.prc_license_number || '',
                        specialization: data.specialization || '',
                        education: data.education || '',
                        experience: data.years_of_experience ? `${data.years_of_experience} years` : '',
                        address: data.personal_Address || '',
                        consultationRate: data.consultation_rate || '',
                        hireDate: normalizeDate(data.hire_date),
                        isActive: Number(data.is_active) === 1 || data.is_active === true
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

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                if (!userId) return;

                const response = await fetch(`${API_BASE}/api/vet_schedules?userId=${userId}`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    const availableSlots = data
                        .filter(schedule => Number(schedule.is_available) === 1 || schedule.is_available === true)
                        .map(schedule => schedule.time_slot)
                        .filter(Boolean);

                    setAvailability(sortTimeSlots(availableSlots));
                }
            } catch (error) {
                console.error("Failed to fetch schedules:", error);
            }
        };
        fetchSchedules();
    }, [userId]);

    const toggleTimeSlot = async (time) => {
        const isCurrentlyAvailable = availability.includes(time);
        const newStatus = !isCurrentlyAvailable;

        // Optimistically update UI
        setAvailability(prev =>
            newStatus
                ? sortTimeSlots([...prev, time])
                : prev.filter(slot => slot !== time)
        );

        try {
            const response = await fetch(`${API_BASE}/api/vet_schedules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    day: "monday", // Assuming default for now
                    time: time,
                    is_available: newStatus ? 1 : 0
                })
            });

            if (!response.ok) {
                throw new Error("Schedule update failed");
            }

            toast.success("Availability updated");
        } catch (error) {
            console.error("Failed to update schedule:", error);
            toast.error("Failed to update availability");
            // Revert UI on error
            setAvailability(prev =>
                isCurrentlyAvailable
                    ? sortTimeSlots([...prev, time])
                    : prev.filter(slot => slot !== time)
            );
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

    const handleSave = () => {
        setIsEditing(false);
        toast.success('Profile updated successfully!');
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-[24px] text-[#101828]">
                        Profile
                    </h2>
                    <p className="text-[16px] text-[#4a5565] mt-1">
                        Manage your professional information
                    </p>
                </div>
                {!isEditing && (
                    <Button
                        onClick={() => setIsEditing(true)}
                        className="bg-[#155dfc] hover:bg-[#0d4acf] h-10"
                    >
                        Edit Profile
                    </Button>
                )}
            </div>

            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] overflow-hidden">
                <div className="bg-gradient-to-r from-[#155dfc] to-[#8b5cf6] px-8 py-8">
                    <div className="flex items-center gap-6">
                        <div className="size-32 rounded-full bg-white flex items-center justify-center">
                            <User className="size-16 text-[#155dfc]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[28px] text-white mb-2">
                                {profileData.fullName}
                            </h3>
                            <p className="text-[18px] text-white/90">
                                {profileData.specialization}
                            </p>
                            <p className="text-[16px] text-white/80 mt-1">
                                License: {profileData.licenseNumber}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-8 space-y-6">
                    <div>
                        <h3 className="font-bold text-[18px] text-[#101828] mb-4">
                            Personal Information
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <User className="size-4" />
                                    Full Name
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.fullName}
                                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.fullName}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <Mail className="size-4" />
                                    Email Address
                                </Label>
                                {isEditing ? (
                                    <Input
                                        type="email"
                                        value={profileData.email}
                                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.email}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <Phone className="size-4" />
                                    Phone Number
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.phone}
                                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.phone}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <Award className="size-4" />
                                    License Number
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.licenseNumber}
                                        onChange={(e) => setProfileData({ ...profileData, licenseNumber: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.licenseNumber}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 col-span-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <MapPin className="size-4" />
                                    Address
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.address}
                                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.address}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[rgba(0,0,0,0.1)]">
                        <h3 className="font-bold text-[18px] text-[#101828] mb-4">
                            Professional Information
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <Award className="size-4" />
                                    Specialization
                                </Label>
                                {isEditing ? (
                                    <Select
                                        value={profileData.specialization}
                                        onValueChange={(value) => setProfileData({ ...profileData, specialization: value })}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {specializationOptions.map(spec => (
                                                <SelectItem key={spec} value={spec}>
                                                    {spec}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.specialization}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828] flex items-center gap-2">
                                    <Calendar className="size-4" />
                                    Years of Experience
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.experience}
                                        onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                                        className="h-10"
                                        placeholder="e.g., 5 years"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.experience}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 col-span-2">
                                <Label className="text-[16px] text-[#101828]">
                                    Education
                                </Label>
                                {isEditing ? (
                                    <Input
                                        value={profileData.education}
                                        onChange={(e) => setProfileData({ ...profileData, education: e.target.value })}
                                        className="h-10"
                                    />
                                ) : (
                                    <p className="text-[16px] text-[#4a5565] h-10 flex items-center">
                                        {profileData.education}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[rgba(0,0,0,0.1)]">
                        <h3 className="font-bold text-[18px] text-[#101828] mb-4">
                            Employment Details
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828]">Consultation Rate (₱)</Label>
                                {isEditing ? <Input type="number" value={profileData.consultationRate} onChange={(e) => setProfileData({ ...profileData, consultationRate: e.target.value })} /> : <p className="h-10 flex items-center text-[#4a5565]">{profileData.consultationRate}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[16px] text-[#101828]">Hire Date</Label>
                                {isEditing ? <Input type="date" value={profileData.hireDate} onChange={(e) => setProfileData({ ...profileData, hireDate: e.target.value })} /> : <p className="h-10 flex items-center text-[#4a5565]">{profileData.hireDate}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox checked={profileData.isActive} onCheckedChange={(checked) => isEditing && setProfileData({ ...profileData, isActive: checked })} disabled={!isEditing} />
                                <Label>Currently Active</Label>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-[rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-[rgba(21,93,252,0.1)] size-10 rounded-[10px] flex items-center justify-center">
                                <Video className="size-5 text-[#155dfc]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[18px] text-[#101828]">
                                    Online Consultation Availability
                                </h3>
                                <p className="text-[14px] text-[#4a5565]">
                                    Set your available time slots for online consultations
                                </p>
                            </div>
                        </div>

                        <div className="bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] rounded-[10px] p-6">
                            <div className="grid grid-cols-4 gap-3">
                                {TIME_SLOTS.map(time => {
                                    const isSelected = availability.includes(time);
                                    return (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => isEditing && toggleTimeSlot(time)}
                                            disabled={!isEditing}
                                            className={`px-4 py-3 rounded-[8px] text-[14px] transition-colors ${
                                                isSelected
                                                    ? 'bg-[#155dfc] text-white'
                                                    : 'bg-white border border-[rgba(0,0,0,0.1)] text-[#4a5565] hover:border-[#155dfc]'
                                            } ${!isEditing ? 'cursor-default' : 'cursor-pointer'}`}
                                        >
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex gap-4 justify-end pt-6 border-t border-[rgba(0,0,0,0.1)]">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditing(false)}
                                className="w-[140px] h-10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="bg-[#155dfc] hover:bg-[#0d4acf] w-[180px] h-10"
                            >
                                <Save className="size-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
