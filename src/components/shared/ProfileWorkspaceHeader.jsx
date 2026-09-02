import {
    Bell,
    Camera,
    Palette,
    ShieldCheck,
    User,
    UserRound,
} from 'lucide-react';

import { TabsList, TabsTrigger } from '../../ui/tabs';
import ProtectedImage from './ProtectedImage.jsx';
import ServicePetPeek from './ServicePetPeek.jsx';

const PROFILE_TABS = [
    { value: 'profile', label: 'Profile Details', icon: UserRound },
    { value: 'security', label: 'Security', icon: ShieldCheck },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'appearance', label: 'Appearance', icon: Palette },
];

export default function ProfileWorkspaceHeader({
    activeTab,
    accountLabel,
    displayName,
    secondaryLabel = '',
    imageSrc = '',
    imageUnavailable = false,
    isEditing = false,
    onImageChange,
    onImageError,
    action = null,
}) {
    return (
        <div data-motion="card" data-header-pet="enabled" className="profile-workspace-header-pet relative isolate overflow-hidden bg-slate-950 text-white">
            <ServicePetPeek kind="cat" accent="coral" />
            <span className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-blue-600/20 blur-3xl" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-24 left-1/4 size-56 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />

            <div className="relative z-20 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6 lg:px-8">
                <div className="flex items-center">
                    <p className="inline-flex w-fit rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-blue-200">
                        {accountLabel}
                    </p>
                </div>

                <div className="mt-4 flex min-w-0 items-center gap-3 border-t border-white/10 pt-4 sm:gap-4">
                    <div className="relative shrink-0">
                        <div className="size-16 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg shadow-black/20 sm:size-20">
                            {imageSrc && !imageUnavailable ? (
                                <ProtectedImage
                                    src={imageSrc}
                                    alt={displayName || 'Profile'}
                                    className="size-full object-cover"
                                    fallbackClassName="size-full bg-white/10 text-slate-400"
                                    onLoad={() => onImageError?.(false)}
                                    onLoadError={() => onImageError?.(true)}
                                />
                            ) : (
                                <div className="flex size-full items-center justify-center bg-white/10">
                                    <User className="size-7 text-slate-300 sm:size-8" />
                                </div>
                            )}
                        </div>
                        {isEditing && onImageChange ? (
                            <label
                                className="absolute -bottom-1.5 -right-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-slate-950 bg-[#155dfc] text-white shadow-md transition-colors hover:bg-blue-700 focus-within:ring-2 focus-within:ring-blue-300"
                                title="Upload profile photo"
                            >
                                <Camera className="size-3.5" />
                                <input type="file" className="sr-only" onChange={onImageChange} accept="image/*" />
                            </label>
                        ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="max-w-full break-words text-base font-bold text-white sm:text-lg">{displayName}</p>
                        {secondaryLabel ? (
                            <p className="mt-1 truncate text-sm font-semibold text-slate-400">{secondaryLabel}</p>
                        ) : null}
                        {imageUnavailable ? (
                            <p className="mt-1 text-xs font-semibold text-amber-300">Profile photo unavailable. Edit the profile to replace it.</p>
                        ) : null}
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                    <TabsList className="flex h-auto min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.06] p-1.5 scrollbar-hide">
                        {PROFILE_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.value;

                            return (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className={`h-10 flex-none gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-bold sm:px-4 sm:text-sm ${isActive
                                        ? 'bg-white text-blue-800 shadow-sm hover:bg-white'
                                        : 'bg-transparent text-slate-300 shadow-none hover:bg-white/10 hover:text-white'}`}
                                >
                                    <Icon className="size-4" />
                                    {tab.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                    {action ? (
                        <div className="flex w-full shrink-0 items-center justify-end lg:w-auto">
                            {action}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
