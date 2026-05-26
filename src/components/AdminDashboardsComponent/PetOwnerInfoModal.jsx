import { useEffect, useMemo, useState } from 'react';
import { Calendar, Mail, MapPin, Phone, Shield, User } from 'lucide-react';
import { calculateAge, formatDisplayDate } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function normalizeOwner(data = {}) {
    const fullName = `${data.firstName || data.first_Name || ''} ${data.lastName || data.last_Name || ''}`.trim();
    const ownerName = data.ownerName || data.name || fullName || '';
    const [firstName = '', ...lastNameParts] = ownerName.split(' ');

    return {
        id: data.ownerId || data.id || data.user_id || '',
        firstName: data.firstName || data.first_Name || firstName || '',
        lastName: data.lastName || data.last_Name || lastNameParts.join(' ') || '',
        email: data.ownerEmail || data.email || data.mail_Address || '',
        phone: data.ownerPhone || data.phone || data.phoneNumber || '',
        emergencyNumber: data.ownerEmergencyNumber || data.emergencyNumber || '',
        address: data.ownerAddress || data.address || data.personal_Address || '',
        birthdate: data.ownerBirthdate || data.birthdate || data.dateOfBirth || '',
        profileImage: data.ownerProfileImage || data.profileImage || data.setProfilePic_url || '',
        role: data.role || 'Pet Owner'
    };
}

export default function PetOwnerProfileModal({
    ownerId,
    ownerName,
    ownerEmail,
    ownerPhone,
    ownerEmergencyNumber,
    ownerAddress,
    ownerBirthdate,
    ownerProfileImage
}) {
    const initialOwner = useMemo(() => normalizeOwner({
        ownerId,
        ownerName,
        ownerEmail,
        ownerPhone,
        ownerEmergencyNumber,
        ownerAddress,
        ownerBirthdate,
        ownerProfileImage
    }), [ownerAddress, ownerBirthdate, ownerEmail, ownerEmergencyNumber, ownerId, ownerName, ownerPhone, ownerProfileImage]);
    const [owner, setOwner] = useState(initialOwner);
    const [isLoading, setIsLoading] = useState(Boolean(ownerId));
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchOwner = async () => {
            if (!ownerId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE}/api/users/${ownerId}`);
                const data = await response.json().catch(() => ({}));

                if (response.ok && isMounted) {
                    setOwner(normalizeOwner({ ...initialOwner, ...data }));
                    setImageError(false);
                }
            } catch (error) {
                console.error('Failed to load pet owner profile:', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchOwner();

        return () => {
            isMounted = false;
        };
    }, [initialOwner, ownerId]);

    const fullName = `${owner.firstName} ${owner.lastName}`.trim() || 'Unknown Owner';
    const imageUrl = imageError ? null : resolveImageUrl(owner.profileImage);

    if (isLoading) {
        return <div className="p-6 text-center text-slate-500">Loading owner profile...</div>;
    }

    return (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    <div className="size-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-xl ring-2 ring-slate-100">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={fullName}
                                className="size-full object-cover"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center bg-blue-50">
                                <User className="size-14 text-[#155dfc]" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pet Owner</p>
                        <h3 className="mt-1 break-words text-2xl font-black text-slate-900">{fullName}</h3>
                        <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-[#155dfc]">
                            {owner.role || 'Pet Owner'}
                        </p>
                    </div>
                </div>
            </div>

            <section className="rounded-2xl bg-slate-50 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                    <User className="size-5 text-[#155dfc]" />
                    <h4 className="text-lg font-bold text-[#101828]">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="First Name" value={owner.firstName} />
                    <InfoField label="Last Name" value={owner.lastName} />
                    <InfoField icon={Mail} label="Email Address" value={owner.email} className="sm:col-span-2" />
                    <InfoField icon={Phone} label="Phone Number" value={owner.phone} />
                    <InfoField icon={Shield} label="Emergency Number" value={owner.emergencyNumber} />
                    <InfoField
                        icon={Calendar}
                        label={owner.birthdate ? 'Current Age' : 'Date of Birth'}
                        value={owner.birthdate ? `${calculateAge(owner.birthdate)} (${formatDisplayDate(owner.birthdate)})` : ''}
                        className="sm:col-span-2"
                    />
                    <InfoField icon={MapPin} label="Residential Address" value={owner.address} className="sm:col-span-2" />
                </div>
            </section>
        </div>
    );
}

function InfoField({ label, value, icon: Icon, className = '' }) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                {Icon && <Icon className="size-4 text-slate-400" />}
                {label}
            </p>
            <div className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <p className="break-words text-sm font-semibold text-slate-900 sm:text-base">
                    {value || 'Not set'}
                </p>
            </div>
        </div>
    );
}
