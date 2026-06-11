import { useEffect, useState } from 'react';
import { BellOff, BellPlus, BellRing, Loader2, Mail, MonitorCheck, Save, Smartphone } from 'lucide-react';
import { Card, CardContent, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { toast } from '../../reusecomponent/toast.jsx';
import {
    fetchNotificationPreferences,
    saveNotificationPreferences
} from '../../services/notificationService';
import {
    disableBrowserPush,
    enableBrowserPush,
    getBrowserPushState
} from '../../services/pushNotificationService';

const DEFAULT_PREFERENCES = {
    email_enabled: true,
    in_app_enabled: true,
    browser_push_enabled: false,
    booking_updates: true,
    schedule_reminders: true,
    payment_updates: true,
    diagnosis_updates: true,
    queue_updates: true,
    boarding_updates: true,
    reminder_24h: true,
    reminder_2h: true,
    reminder_same_day: true
};

const PREFERENCE_GROUPS = [
    {
        title: 'Where Updates Appear',
        description: 'Choose where you want to receive important clinic updates.',
        items: [
            { key: 'email_enabled', label: 'Email updates', detail: 'Send important updates to the email saved on this account.', icon: Mail },
            { key: 'in_app_enabled', label: 'Dashboard notifications', detail: 'Show updates inside the notification button in the dashboard.', icon: MonitorCheck }
        ]
    },
    {
        title: 'Updates You Want',
        description: 'Pick the kinds of pet care updates you want to follow.',
        items: [
            { key: 'booking_updates', label: 'Bookings', detail: 'Know when a booking is approved, cancelled, or moved to a new schedule.' },
            { key: 'schedule_reminders', label: 'Schedule reminders', detail: 'Get reminded before an appointment, boarding stay, or clinic schedule.' },
            { key: 'payment_updates', label: 'Payments', detail: 'Know when a bill is ready or when a payment has been recorded.' },
            { key: 'diagnosis_updates', label: 'Diagnosis and follow-up', detail: 'Know when diagnosis notes or follow-up dates are available.' },
            { key: 'queue_updates', label: 'Queue status', detail: 'Follow queue approvals, cancellations, and veterinarian receiving updates.' },
            { key: 'boarding_updates', label: 'Boarding', detail: 'Follow kennel boarding and pet hotel updates, including check-in and check-out.' }
        ]
    },
    {
        title: 'Reminder Timing',
        description: 'Choose how early you want to be reminded before a schedule.',
        items: [
            { key: 'reminder_24h', label: '24 hours before', detail: 'Helpful when you need time to prepare before the visit.' },
            { key: 'reminder_2h', label: '2 hours before', detail: 'Helpful when the schedule is happening soon.' },
            { key: 'reminder_same_day', label: 'Same-day reminder', detail: "A morning reminder for today's schedules." }
        ]
    }
];

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function normalizePreferences(preferences) {
    return Object.keys(DEFAULT_PREFERENCES).reduce((normalized, key) => ({
        ...normalized,
        [key]: Boolean(preferences?.[key] ?? DEFAULT_PREFERENCES[key])
    }), {});
}

function browserPushMessage(state) {
    if (!state.supported) {
        return 'This browser cannot receive iPawcus browser notifications.';
    }

    if (state.secure === false) {
        return 'Browser notifications need the secure live website before this device can receive alerts.';
    }

    if (state.needsSetup) {
        return 'Browser notifications are not ready on the server yet.';
    }

    if (state.permission === 'denied') {
        return 'This browser is blocking iPawcus notifications. Allow them in the browser site settings to use this device.';
    }

    if (state.enabled) {
        return 'This device can show iPawcus updates even when the dashboard is not open.';
    }

    if (state.permission === 'granted') {
        return 'This browser is allowed. Turn it on for this account to receive iPawcus alerts on this device.';
    }

    return 'Allow this device to show important iPawcus alerts from the browser.';
}

export default function NotificationPreferencesCard({ user }) {
    const userId = getUserId(user);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPushUpdating, setIsPushUpdating] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [browserPushState, setBrowserPushState] = useState({
        supported: true,
        permission: 'default',
        configured: false,
        needsSetup: false,
        enabled: false,
        activeSubscriptions: 0
    });

    useEffect(() => {
        let isActive = true;

        const loadPreferences = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setLoadError('');

            try {
                const data = await fetchNotificationPreferences(userId);
                if (isActive) {
                    setPreferences(normalizePreferences(data.preferences));
                }
            } catch (error) {
                if (isActive) {
                    setLoadError(error.message || 'Notification settings could not be loaded.');
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        loadPreferences();

        return () => {
            isActive = false;
        };
    }, [userId]);

    useEffect(() => {
        let isActive = true;

        const loadBrowserPushState = async () => {
            if (!userId) return;

            const state = await getBrowserPushState(userId);
            if (isActive) {
                setBrowserPushState(state);
            }
        };

        loadBrowserPushState();

        return () => {
            isActive = false;
        };
    }, [userId]);

    const updatePreference = (key, value) => {
        setPreferences(current => ({ ...current, [key]: Boolean(value) }));
    };

    const handleSave = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        setIsSaving(true);

        try {
            const data = await saveNotificationPreferences(userId, preferences);
            setPreferences(normalizePreferences(data.preferences));
            toast.success('Notification settings saved.');
        } catch (error) {
            toast.error(error.message || 'Failed to save notification settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnableBrowserPush = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        setIsPushUpdating(true);

        try {
            const state = await enableBrowserPush(userId);
            const nextPreferences = {
                ...preferences,
                browser_push_enabled: true
            };
            const data = await saveNotificationPreferences(userId, nextPreferences);

            setPreferences(normalizePreferences(data.preferences));
            setBrowserPushState(state);
            toast.success('Browser notifications are on for this device.');
        } catch (error) {
            toast.error(error.message || 'Browser notifications could not be turned on.');
            setBrowserPushState(await getBrowserPushState(userId));
        } finally {
            setIsPushUpdating(false);
        }
    };

    const handleDisableBrowserPush = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        setIsPushUpdating(true);

        try {
            const state = await disableBrowserPush(userId);
            const nextPreferences = {
                ...preferences,
                browser_push_enabled: false
            };
            const data = await saveNotificationPreferences(userId, nextPreferences);

            setPreferences(normalizePreferences(data.preferences));
            setBrowserPushState(state);
            toast.success('Browser notifications are off for this device.');
        } catch (error) {
            toast.error(error.message || 'Browser notifications could not be turned off.');
        } finally {
            setIsPushUpdating(false);
        }
    };

    const canEnableBrowserPush = browserPushState.supported
        && browserPushState.secure !== false
        && browserPushState.configured
        && browserPushState.permission !== 'denied';

    if (isLoading) {
        return (
            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardContent className="flex items-center gap-2 p-6 text-sm font-semibold text-slate-500">
                    <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                    Loading notification settings...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="border-b border-slate-100 pb-5">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <BellRing className="size-5 text-[#155dfc]" />
                            <CardTitle className="text-xl font-bold text-slate-950">Notification Settings</CardTitle>
                        </div>
                    </div>
                </div>

                {loadError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                        {loadError}
                    </div>
                )}

                <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#155dfc] shadow-sm">
                                <Smartphone className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-black text-slate-950">Browser notifications</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${browserPushState.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {browserPushState.enabled ? 'On this device' : 'Off'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
                                    {browserPushMessage(browserPushState)}
                                </p>
                            </div>
                        </div>
                        {browserPushState.enabled ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDisableBrowserPush}
                                disabled={isPushUpdating}
                                className="h-11 shrink-0 border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                            >
                                {isPushUpdating ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
                                Turn Off
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleEnableBrowserPush}
                                disabled={isPushUpdating || !canEnableBrowserPush}
                                className="h-11 shrink-0 bg-[#155dfc] px-4 text-white hover:bg-[#0d4acf]"
                            >
                                {isPushUpdating ? <Loader2 className="size-4 animate-spin" /> : <BellPlus className="size-4" />}
                                Allow Browser Notifications
                            </Button>
                        )}
                    </div>
                </section>

                <div className="space-y-5">
                    {PREFERENCE_GROUPS.map(group => (
                        <section key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-4">
                                <h3 className="text-base font-black text-slate-950">{group.title}</h3>
                                <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{group.description}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {group.items.map(item => {
                                    const Icon = item.icon;

                                    return (
                                        <label
                                            key={item.key}
                                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
                                        >
                                            <Checkbox
                                                checked={preferences[item.key]}
                                                onCheckedChange={(checked) => updatePreference(item.key, checked)}
                                                className="mt-1"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                                                    {Icon ? <Icon className="size-4 text-[#155dfc]" /> : null}
                                                    {item.label}
                                                </span>
                                                <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{item.detail}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold leading-5 text-slate-500">
                        Small pop-up confirmations inside the app stay on so actions like saving, booking, and cancelling still feel clear.
                    </p>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-11 bg-[#155dfc] px-5 text-white hover:bg-[#0d4acf]"
                    >
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
