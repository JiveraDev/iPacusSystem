import { useEffect, useMemo, useState } from 'react';
import { BellRing, Loader2, Mail, MonitorCheck, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { toast } from '../../reusecomponent/toast.jsx';
import {
    fetchNotificationPreferences,
    saveNotificationPreferences
} from '../../services/notificationService';

const DEFAULT_PREFERENCES = {
    email_enabled: true,
    in_app_enabled: true,
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
        title: 'Delivery Channels',
        description: 'Toast messages remain active for immediate screen feedback.',
        items: [
            { key: 'email_enabled', label: 'Email notifications', detail: 'Send booking, payment, and reminder emails when SMTP is configured.', icon: Mail },
            { key: 'in_app_enabled', label: 'Notification bar', detail: 'Show updates in the dashboard notification bell.', icon: MonitorCheck }
        ]
    },
    {
        title: 'Notification Topics',
        description: 'Choose which clinic events should become profile notifications.',
        items: [
            { key: 'booking_updates', label: 'Booking updates', detail: 'Confirmed, cancelled, and rescheduled bookings.' },
            { key: 'schedule_reminders', label: 'Schedule reminders', detail: 'Near-schedule reminders based on the latest adjusted time.' },
            { key: 'payment_updates', label: 'Payments and invoices', detail: 'Invoice-ready and payment-received updates.' },
            { key: 'diagnosis_updates', label: 'Diagnosis and follow-up', detail: 'Completed diagnosis records and follow-up reminders.' },
            { key: 'queue_updates', label: 'Queue updates', detail: 'Self-service queue and clinic queue status changes.' },
            { key: 'boarding_updates', label: 'Boarding updates', detail: 'Room assignment, check-in, check-out, and boarding tasks.' }
        ]
    },
    {
        title: 'Reminder Timing',
        description: 'These settings will be used by the schedule reminder runner.',
        items: [
            { key: 'reminder_24h', label: '24 hours before', detail: 'Best for appointments and boarding check-ins.' },
            { key: 'reminder_2h', label: '2 hours before', detail: 'Useful for same-day clinic visits.' },
            { key: 'reminder_same_day', label: 'Same-day reminder', detail: "Morning notice for today's schedule." }
        ]
    }
];

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function getEmail(user) {
    return user?.email || user?.mail_Address || '';
}

function normalizePreferences(preferences) {
    return Object.keys(DEFAULT_PREFERENCES).reduce((normalized, key) => ({
        ...normalized,
        [key]: Boolean(preferences?.[key] ?? DEFAULT_PREFERENCES[key])
    }), {});
}

export default function NotificationPreferencesCard({ user }) {
    const userId = getUserId(user);
    const email = getEmail(user);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState('');

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
                    setLoadError(error.message || 'Notification preferences could not be loaded.');
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

    const enabledTopicCount = useMemo(() => (
        ['booking_updates', 'schedule_reminders', 'payment_updates', 'diagnosis_updates', 'queue_updates', 'boarding_updates']
            .filter(key => preferences[key]).length
    ), [preferences]);

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
            toast.success('Notification preferences saved.');
        } catch (error) {
            toast.error(error.message || 'Failed to save notification preferences.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardContent className="flex items-center gap-2 p-6 text-sm font-semibold text-slate-500">
                    <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                    Loading notification preferences...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <BellRing className="size-5 text-[#155dfc]" />
                            <CardTitle className="text-xl font-bold text-slate-950">Notification Settings</CardTitle>
                        </div>
                        <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                            Control email and dashboard notifications for bookings, schedules, payments, diagnosis updates, and reminders.
                        </CardDescription>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                            Sending to: {email || 'No email on this profile'}
                        </p>
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                        {enabledTopicCount}/6 topics active
                    </div>
                </div>

                {loadError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                        {loadError}
                    </div>
                )}

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
                        Toast messages are system feedback and remain enabled even when email or notification topics are turned off.
                    </p>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-11 bg-[#155dfc] px-5 text-white hover:bg-[#0d4acf]"
                    >
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save Notifications
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
