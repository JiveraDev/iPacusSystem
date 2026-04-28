import { User } from 'lucide-react';

export default function PetOwnerProfileModal({ ownerName, ownerEmail }) {
    // Parse first and last name
    const nameParts = ownerName.split(' ');
    const firstName = nameParts[0] || 'Test';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    return (
        <div className="max-h-[70vh] overflow-y-auto space-y-6 pr-2">
            {/* Profile Picture */}
            <div className="flex justify-center">
                <div className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-full p-6 size-[120px] flex items-center justify-center">
                    <User className="size-16 text-white" />
                </div>
            </div>

            {/* Personal Information Section */}
            <div className="bg-[#f9fafb] rounded-[14px] p-6">
                <div className="flex items-center gap-2 mb-4">
                    <User className="size-5 text-[#155dfc]" />
                    <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
                        Personal Information
                    </h3>
                </div>

                <div className="space-y-4">
                    {/* First Name & Last Name */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                First Name
                            </p>
                            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2">
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                    {firstName}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                Last Name
                            </p>
                            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2">
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                    {lastName}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
                            Email
                        </p>
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2">
                            <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                {ownerEmail}
                            </p>
                        </div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mt-1">
                            Email cannot be changed
                        </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
                            Phone Number
                        </p>
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2">
                            <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                +63 912 345 6789
                            </p>
                        </div>
                    </div>

                    {/* Date of Birth */}
                    <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
                            Date of Birth
                        </p>
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2">
                            <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                January 15, 1990
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}