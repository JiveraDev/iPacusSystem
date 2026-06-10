import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell,
    CalendarCheck,
    CalendarClock,
    CheckCheck,
    ClipboardList,
    CreditCard,
    Hotel,
    Loader2,
    Stethoscope
} from 'lucide-react';
import { Button } from '../../ui/button';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead
} from '../../services/notificationService';

const CATEGORY_META = {
    booking_updates: {
        label: 'Bookings',
        tone: 'bg-blue-50 text-blue-700'
    },
    schedule_reminders: {
        label: 'Schedules',
        tone: 'bg-amber-50 text-amber-700'
    },
    payment_updates: {
        label: 'Payments',
        tone: 'bg-emerald-50 text-emerald-700'
    },
    diagnosis_updates: {
        label: 'Diagnosis',
        tone: 'bg-violet-50 text-violet-700'
    },
    queue_updates: {
        label: 'Queue',
        tone: 'bg-rose-50 text-rose-700'
    },
    boarding_updates: {
        label: 'Boarding',
        tone: 'bg-cyan-50 text-cyan-700'
    }
};

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function notificationMeta(category) {
    return CATEGORY_META[category] || {
        label: 'System',
        tone: 'bg-slate-100 text-slate-700'
    };
}

function CategoryIcon({ category, className }) {
    if (category === 'booking_updates') return <CalendarCheck className={className} />;
    if (category === 'schedule_reminders') return <CalendarClock className={className} />;
    if (category === 'payment_updates') return <CreditCard className={className} />;
    if (category === 'diagnosis_updates') return <Stethoscope className={className} />;
    if (category === 'queue_updates') return <ClipboardList className={className} />;
    if (category === 'boarding_updates') return <Hotel className={className} />;

    return <Bell className={className} />;
}

function parseDate(value) {
    if (!value) return null;

    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function relativeTime(value) {
    const date = parseDate(value);
    if (!date) return '';

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString();
}

function daySection(value) {
    const date = parseDate(value);
    if (!date) return 'Earlier';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return 'Earlier';
}

function groupedNotifications(notifications) {
    const groups = new Map();

    notifications.forEach(notification => {
        const key = daySection(notification.createdAt);
        groups.set(key, [...(groups.get(key) || []), notification]);
    });

    return ['Today', 'Yesterday', 'Earlier']
        .filter(key => groups.has(key))
        .map(key => ({ key, notifications: groups.get(key) }));
}

function summaryLabel(item) {
    const meta = notificationMeta(item.category);
    const count = item.unread > 0 ? item.unread : item.total;
    return `${count} ${meta.label}`;
}

export default function NotificationBell({ user, navigate }) {
    const userId = getUserId(user);
    const containerRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [summary, setSummary] = useState({ categories: [] });
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadNotifications = async ({ isAutoRefresh = false } = {}) => {
        if (!userId) return null;

        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const data = await fetchNotifications(userId, { limit: 30 });
            setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
            setSummary(data.summary || { categories: [] });
            setUnreadCount(Number(data.unreadCount || 0));
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                setErrorMessage(error.message || 'Notifications could not be loaded.');
            }
            return null;
        } finally {
            if (!isAutoRefresh) {
                setIsLoading(false);
            }
        }
    };

    useAutoRefresh(loadNotifications, {
        enabled: Boolean(userId),
        intervalMs: 12000,
        refreshKey: `notifications-${userId}`
    });

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    const visibleNotifications = useMemo(() => (
        filter === 'unread'
            ? notifications.filter(notification => !notification.readAt)
            : notifications
    ), [filter, notifications]);

    const notificationGroups = useMemo(() => groupedNotifications(visibleNotifications), [visibleNotifications]);

    const summaryItems = useMemo(() => (
        Array.isArray(summary.categories)
            ? summary.categories.filter(item => Number(item.total) > 0).slice(0, 4)
            : []
    ), [summary]);

    const openPanel = () => {
        setIsOpen(current => !current);
        if (!isOpen) {
            loadNotifications();
        }
    };

    const handleNotificationClick = async (notification) => {
        setIsUpdating(true);

        try {
            if (!notification.readAt) {
                await markNotificationRead(notification.notificationId, userId);
            }

            setNotifications(current => current.map(item => (
                item.notificationId === notification.notificationId
                    ? { ...item, readAt: item.readAt || new Date().toISOString() }
                    : item
            )));
            setUnreadCount(current => Math.max(0, current - (notification.readAt ? 0 : 1)));
            if (!notification.readAt) {
                setSummary(current => ({
                    ...current,
                    categories: Array.isArray(current.categories)
                        ? current.categories.map(item => (
                            item.category === notification.category
                                ? { ...item, unread: Math.max(0, Number(item.unread || 0) - 1) }
                                : item
                        ))
                        : []
                }));
            }
            setIsOpen(false);

            if (notification.redirectPath) {
                navigate(notification.redirectPath);
            }
        } finally {
            setIsUpdating(false);
        }
    };

    const handleMarkAllRead = async () => {
        setIsUpdating(true);

        try {
            await markAllNotificationsRead(userId);
            setNotifications(current => current.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
            setUnreadCount(0);
            setSummary(current => ({
                ...current,
                categories: Array.isArray(current.categories)
                    ? current.categories.map(item => ({ ...item, unread: 0 }))
                    : []
            }));
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={openPanel}
                className="relative flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Open notifications"
            >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-black leading-5 text-white shadow-md">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 mt-2 w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-lg font-black text-slate-950">Notifications</p>
                                <p className="text-xs font-semibold text-slate-500">
                                    {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleMarkAllRead}
                                disabled={isUpdating || unreadCount === 0}
                                className="h-8 px-2 text-xs"
                            >
                                {isUpdating ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3" />}
                                Read all
                            </Button>
                        </div>

                        <div className="mt-4 flex gap-2 rounded-lg bg-slate-100 p-1">
                            {[
                                ['all', 'All'],
                                ['unread', 'Unread']
                            ].map(([value, label]) => (
                                <button
                                    type="button"
                                    key={value}
                                    onClick={() => setFilter(value)}
                                    className={`h-8 flex-1 rounded-md text-sm font-black transition ${filter === value ? 'bg-white text-[#155dfc] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {summaryItems.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {summaryItems.map(item => {
                                    const meta = notificationMeta(item.category);

                                    return (
                                        <div key={item.category} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${meta.tone}`}>
                                            <CategoryIcon category={item.category} className="size-4 shrink-0" />
                                            <span className="min-w-0 truncate text-xs font-black">{summaryLabel(item)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="max-h-[30rem] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-slate-500">
                                <Loader2 className="size-4 animate-spin" />
                                Loading notifications...
                            </div>
                        ) : errorMessage ? (
                            <div className="px-4 py-6 text-sm font-semibold text-red-600">{errorMessage}</div>
                        ) : visibleNotifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                                No notifications to show.
                            </div>
                        ) : (
                            notificationGroups.map(group => (
                                <section key={group.key}>
                                    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-400">
                                        {group.key}
                                    </div>
                                    {group.notifications.map(notification => {
                                        const meta = notificationMeta(notification.category);
                                        const isUnread = !notification.readAt;

                                        return (
                                            <button
                                                type="button"
                                                key={notification.notificationId}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${isUnread ? 'bg-blue-50/50' : 'bg-white'}`}
                                            >
                                                <span className="flex items-start gap-3">
                                                    <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                                                        <CategoryIcon category={notification.category} className="size-5" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-start justify-between gap-2">
                                                            <span className="break-words text-sm font-black leading-5 text-slate-950">
                                                                {notification.title}
                                                            </span>
                                                            <span className="shrink-0 text-xs font-bold text-slate-400">
                                                                {relativeTime(notification.createdAt)}
                                                            </span>
                                                        </span>
                                                        {notification.message && (
                                                            <span className="mt-1 block break-words text-sm font-medium leading-5 text-slate-600">
                                                                {notification.message}
                                                            </span>
                                                        )}
                                                        <span className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                                                            {notificationMeta(notification.category).label}
                                                            {isUnread && <span className="size-2 rounded-full bg-[#155dfc]" />}
                                                        </span>
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </section>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
