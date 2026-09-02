import { useEffect, useState } from 'react';
import { BellOff, BellPlus, BellRing, Check, Loader2, Mail, MonitorCheck, Smartphone } from 'lucide-react';
import { Card, CardContent, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { toast } from '../../reusecomponent/toast.jsx';
import { getUserFacingErrorMessage } from '../../lib/errorPresentation.js';
import {
    fetchNotificationPreferences,
    saveNotificationPreferences
} from '../../services/notificationService';
import {
    BROWSER_PUSH_SETTING_CHANGED_EVENT,
    getBrowserPushState,
    setBrowserPushEnabledForAccount
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
    ownership_updates: true,
    reminder_24h: true,
    reminder_2h: true,
    reminder_same_day: true
};

const DEFAULT_BROWSER_PUSH_STATE = {
    supported: true,
    permission: 'default',
    configured: false,
    needsSetup: false,
    enabled: false,
    activeSubscriptions: 0,
    error: ''
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
            { key: 'schedule_reminders', label: 'Schedule reminders', detail: 'Get push reminders for appointments, personal TODOs, boarding tasks, follow-ups, and due or overdue schedules.' },
            { key: 'payment_updates', label: 'Payments', detail: 'Know when a bill is ready or when a payment has been recorded.' },
            { key: 'diagnosis_updates', label: 'Diagnosis and follow-up', detail: 'Know when diagnosis notes or follow-up dates are available.' },
            { key: 'queue_updates', label: 'Queue status', detail: 'Follow queue approvals, cancellations, and veterinarian receiving updates.' },
            { key: 'boarding_updates', label: 'Boarding', detail: 'Follow kennel boarding and pet hotel updates, including check-in and check-out.' },
            { key: 'ownership_updates', label: 'Ownership', detail: 'Follow pet ownership, co-parent approval, and access updates.' }
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

function normalizeRole(user) {
    return String(user?.role || user?.user_role || '')
        .trim()
        .toLowerCase()
        .replace(/[ _-]+/g, '_');
}

function preferenceGroupsForRole(user) {
    const role = normalizeRole(user);
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(role);
    const allowedUpdateKeys = role === 'veterinarian' || role === 'vet'
        ? ['booking_updates', 'schedule_reminders', 'diagnosis_updates', 'queue_updates']
        : role === 'admin'
            ? ['booking_updates', 'schedule_reminders', 'diagnosis_updates', 'queue_updates', 'boarding_updates']
            : null;

    return PREFERENCE_GROUPS
        .filter(group => !isSuperAdmin || group.title === 'Where Updates Appear')
        .map(group => ({
            ...group,
            items: allowedUpdateKeys && group.title === 'Updates You Want'
                ? group.items.filter(item => allowedUpdateKeys.includes(item.key))
                : group.items
        }))
        .filter(group => group.items.length > 0);
}

function normalizePreferences(preferences) {
    return Object.keys(DEFAULT_PREFERENCES).reduce((normalized, key) => ({
        ...normalized,
        [key]: Boolean(preferences?.[key] ?? DEFAULT_PREFERENCES[key])
    }), {});
}

function browserPushMessage(state) {
    if (state.error) {
        return state.error;
    }

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
    const role = normalizeRole(user);
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(role);
    const visiblePreferenceGroups = preferenceGroupsForRole(user);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [isPushUpdating, setIsPushUpdating] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [browserPushState, setBrowserPushState] = useState(DEFAULT_BROWSER_PUSH_STATE);

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
            console.error('[iPawcus push] Notification preferences API request failed.', error);
            if (isActive) {
                setLoadError(getUserFacingErrorMessage(
                    error,
                    'Notification settings could not be loaded.',
                    { log: false }
                ));
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

            try {
                const state = await getBrowserPushState(userId);
                if (isActive) {
                    setBrowserPushState(state);
                }
            } catch (error) {
                console.error('[iPawcus push] Browser push state load failed.', error);
                if (isActive) {
                    setBrowserPushState({
                        ...DEFAULT_BROWSER_PUSH_STATE,
                        error: getUserFacingErrorMessage(
                            error,
                            'Browser notification service could not be checked.',
                            { log: false }
                        )
                    });
                }
            }
        };

        loadBrowserPushState();

        return () => {
            isActive = false;
        };
    }, [userId]);

    useEffect(() => {
        const handlePushSettingChange = (event) => {
            if (event.detail?.preferences) {
                setPreferences(normalizePreferences(event.detail.preferences));
            }
            if (event.detail?.browserState) {
                setBrowserPushState(event.detail.browserState);
            }
        };

        window.addEventListener(BROWSER_PUSH_SETTING_CHANGED_EVENT, handlePushSettingChange);
        return () => window.removeEventListener(BROWSER_PUSH_SETTING_CHANGED_EVENT, handlePushSettingChange);
    }, []);

    const updatePreference = async (key, value) => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        const previousPreferences = preferences;
        const nextPreferences = {
            ...preferences,
            [key]: Boolean(value)
        };

        setPreferences(nextPreferences);
        setIsSaving(true);
        setSaveStatus('saving');

        try {
            const data = await saveNotificationPreferences(userId, nextPreferences);
            setPreferences(normalizePreferences(data.preferences));
            setSaveStatus('saved');
        } catch (error) {
            console.error('[iPawcus push] Notification preferences save failed.', error);
            setPreferences(previousPreferences);
            setSaveStatus('error');
            toast.error(getUserFacingErrorMessage(
                error,
                'This notification setting could not be saved.',
                { log: false }
            ));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnableBrowserPush = async () => {
        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        if (browserPushState.permission === 'denied') {
            toast.info('Notifications are blocked for this site. Allow them in your browser site settings, then try again.');
            return;
        }

        setIsPushUpdating(true);
        try {
            const result = await setBrowserPushEnabledForAccount(userId, true, preferences);
            setPreferences(normalizePreferences(result.preferences));
            setBrowserPushState(result.browserState);
            toast.success('Browser notifications are now on for this account.');
        } catch (error) {
            console.error('[iPawcus push] Browser push enable failed.', error);
            const message = getUserFacingErrorMessage(
                error,
                'Browser notifications could not be turned on.',
                { log: false }
            );
            if (/blocked|not allowed/i.test(message)) {
                toast.info(message);
            } else {
                toast.error(message);
            }
            try {
                setBrowserPushState(await getBrowserPushState(userId));
            } catch (stateError) {
                console.error('[iPawcus push] Browser push state refresh after enable failure also failed.', stateError);
                setBrowserPushState({
                    ...DEFAULT_BROWSER_PUSH_STATE,
                    error: getUserFacingErrorMessage(
                        stateError,
                        'Browser notification service could not be checked.',
                        { log: false }
                    )
                });
            }
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
            const result = await setBrowserPushEnabledForAccount(userId, false, preferences);
            setPreferences(normalizePreferences(result.preferences));
            setBrowserPushState(result.browserState);
            toast.success('Browser notifications are now off for this account.');
        } catch (error) {
            console.error('[iPawcus push] Browser push disable failed.', error);
            toast.error(getUserFacingErrorMessage(
                error,
                'Browser notifications could not be turned off.',
                { log: false }
            ));
            setBrowserPushState({
                ...browserPushState,
                error: getUserFacingErrorMessage(
                    error,
                    'Browser notifications could not be turned off.',
                    { log: false }
                )
            });
        } finally {
            setIsPushUpdating(false);
        }
    };

    const canEnableBrowserPush = browserPushState.supported
        && browserPushState.secure !== false
        && browserPushState.configured
        && !browserPushState.error;
    const isBrowserPushEnabled = Boolean(preferences.browser_push_enabled && browserPushState.enabled);

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
                            {saveStatus === 'saving' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                                    <Loader2 className="size-3 animate-spin" /> Saving
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                    <Check className="size-3" /> Saved automatically
                                </span>
                            )}
                            {saveStatus === 'error' && (
                                <span className="text-xs font-bold text-red-600">Not saved</span>
                            )}
                        </div>
                    </div>
                </div>

                {loadError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                        {loadError}
                    </div>
                )}

                <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#155dfc] shadow-sm">
                                <Smartphone className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-black text-slate-950">Browser notifications</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${isBrowserPushEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {isBrowserPushEnabled ? 'On this device' : 'Off'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
                                    {browserPushMessage({ ...browserPushState, enabled: isBrowserPushEnabled })}
                                </p>
                            </div>
                        </div>
                        {isBrowserPushEnabled ? (
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

                {isSuperAdmin && (
                    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                        <h3 className="text-base font-black text-slate-950">Super Admin governance notifications</h3>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                            Your account receives personnel-account, pet-owner account, payment-method, service-catalog,
                            consent-template, and generated-report updates. Routine booking, queue, boarding, payment-status,
                            and diagnosis notifications are excluded.
                        </p>
                    </section>
                )}

                <div className="space-y-5">
                    {visiblePreferenceGroups.map(group => (
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
                                                disabled={isSaving}
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

            </CardContent>
        </Card>
    );
}
