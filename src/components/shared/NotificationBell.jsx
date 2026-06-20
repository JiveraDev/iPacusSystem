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
    Stethoscope,
    X
} from 'lucide-react';
import { Button } from '../../ui/button';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead
} from '../../services/notificationService';
import { syncPushContext } from '../../services/pushNotificationService';

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

const NOTIFICATION_PAGE_SIZE = 6;
const EMPTY_PAGE_INFO = {
    currentOffset: 0,
    currentTotal: 0,
    historyOffset: 0,
    historyTotal: 0
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

function isTodayNotification(notification) {
    return daySection(notification.createdAt) === 'Today';
}

function isCurrentNotification(notification) {
    return !notification.readAt || isTodayNotification(notification);
}

function isHistoryNotification(notification) {
    return Boolean(notification.readAt) && !isTodayNotification(notification);
}

function mergeNotifications(primary, secondary) {
    const seen = new Set();

    return [...primary, ...secondary].filter(notification => {
        const id = notification.notificationId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

function notificationCounts(data, fallbackCurrent = 0) {
    return {
        current: Number(data?.counts?.current ?? data?.pagination?.total ?? fallbackCurrent),
        history: Number(data?.counts?.history ?? 0)
    };
}

function summaryLabel(item) {
    const meta = notificationMeta(item.category);
    const count = item.unread > 0 ? item.unread : item.total;
    return `${count} ${meta.label}`;
}

export default function NotificationBell({
    user,
    navigate,
    variant = 'icon',
    label = 'Notifications',
    description = '',
    collapsed = false
}) {
    const userId = getUserId(user);
    const containerRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [summary, setSummary] = useState({ categories: [] });
    const [unreadCount, setUnreadCount] = useState(0);
    const [pageInfo, setPageInfo] = useState(EMPTY_PAGE_INFO);
    const [filter, setFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadNotifications = async ({ isAutoRefresh = false } = {}) => {
        if (!userId) return null;

        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const data = await fetchNotifications(userId, {
                limit: NOTIFICATION_PAGE_SIZE,
                offset: 0,
                scope: 'current'
            });
            const incomingNotifications = Array.isArray(data.notifications) ? data.notifications : [];
            const counts = notificationCounts(data, incomingNotifications.length);
            const nextNotifications = isAutoRefresh
                ? mergeNotifications(incomingNotifications, notifications)
                : incomingNotifications;

            setNotifications(nextNotifications);
            setPageInfo({
                currentOffset: Math.min(counts.current, nextNotifications.filter(isCurrentNotification).length),
                currentTotal: counts.current,
                historyOffset: Math.min(counts.history, nextNotifications.filter(isHistoryNotification).length),
                historyTotal: counts.history
            });
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
        if (!userId) return;

        syncPushContext(userId).catch(() => {});
    }, [userId]);

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

    const loadedUnreadCount = useMemo(
        () => notifications.filter(notification => !notification.readAt).length,
        [notifications]
    );
    const hasMoreNotifications = pageInfo.currentOffset < pageInfo.currentTotal
        || pageInfo.historyOffset < pageInfo.historyTotal;
    const canLoadMoreVisible = filter === 'unread'
        ? loadedUnreadCount < unreadCount && pageInfo.currentOffset < pageInfo.currentTotal
        : hasMoreNotifications;
    const loadMoreLabel = filter === 'unread'
        ? 'Load more unread'
        : pageInfo.currentOffset < pageInfo.currentTotal
            ? 'Load more'
            : notifications.length === 0
                ? 'View older notifications'
                : 'Load older notifications';

    const openPanel = () => {
        setIsOpen(current => !current);
        if (!isOpen) {
            loadNotifications();
        }
    };

    const handleLoadMore = async () => {
        if (!userId || isLoadingMore || !canLoadMoreVisible) return;

        const scope = pageInfo.currentOffset < pageInfo.currentTotal ? 'current' : 'history';
        const offset = scope === 'current' ? pageInfo.currentOffset : pageInfo.historyOffset;

        setIsLoadingMore(true);
        setErrorMessage('');

        try {
            const data = await fetchNotifications(userId, {
                limit: NOTIFICATION_PAGE_SIZE,
                offset,
                scope
            });
            const incomingNotifications = Array.isArray(data.notifications) ? data.notifications : [];
            const counts = notificationCounts(data);

            setNotifications(current => mergeNotifications(current, incomingNotifications));
            setPageInfo(current => ({
                currentOffset: scope === 'current'
                    ? Math.min(counts.current, current.currentOffset + incomingNotifications.length)
                    : Math.min(counts.current, current.currentOffset),
                currentTotal: counts.current,
                historyOffset: scope === 'history'
                    ? Math.min(counts.history, current.historyOffset + incomingNotifications.length)
                    : Math.min(counts.history, current.historyOffset),
                historyTotal: counts.history
            }));
            setSummary(data.summary || { categories: [] });
            setUnreadCount(Number(data.unreadCount || 0));
        } catch (error) {
            setErrorMessage(error.message || 'More notifications could not be loaded.');
        } finally {
            setIsLoadingMore(false);
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
            if (!notification.readAt && !isTodayNotification(notification)) {
                setPageInfo(current => ({
                    ...current,
                    currentOffset: Math.max(0, current.currentOffset - 1),
                    currentTotal: Math.max(0, current.currentTotal - 1),
                    historyTotal: current.historyTotal + 1
                }));
            }
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

            const redirectPath = notification.petRedirectPath || notification.redirectPath;
            if (redirectPath) {
                navigate(redirectPath);
            }
        } finally {
            setIsUpdating(false);
        }
    };

    const handleMarkAllRead = async () => {
        setIsUpdating(true);

        try {
            await markAllNotificationsRead(userId);
            setUnreadCount(0);
            setSummary(current => ({
                ...current,
                categories: Array.isArray(current.categories)
                    ? current.categories.map(item => ({ ...item, unread: 0 }))
                    : []
            }));
            await loadNotifications();
        } finally {
            setIsUpdating(false);
        }
    };

    const isNavVariant = variant === 'nav';
    const panelClassName = isNavVariant
        ? `fixed bottom-4 left-4 right-4 z-50 max-h-[calc(100vh-2rem)] md:bottom-6 md:right-auto md:w-[27rem] md:max-w-[calc(100vw-21rem)] ${
            collapsed ? 'md:left-24' : 'md:left-[19rem]'
        }`
        : 'absolute right-0 z-50 mt-2 w-[min(27rem,calc(100vw-2rem))]';
    const buttonClassName = isNavVariant
        ? `relative flex items-center rounded-xl border border-slate-200 text-left text-slate-700 shadow-sm transition hover:bg-slate-50 ${
            collapsed ? 'mx-auto size-12 justify-center bg-white p-0' : 'w-full gap-3 bg-white px-4 py-3'
        }`
        : 'relative flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50';

    return (
        <div ref={containerRef} className={`relative ${isNavVariant ? 'w-full' : ''}`}>
            <button
                type="button"
                onClick={openPanel}
                className={buttonClassName}
                aria-label="Open notifications"
                title={collapsed ? label : undefined}
            >
                <span className="relative flex size-8 shrink-0 items-center justify-center">
                    <Bell className="size-5" />
                    {(!isNavVariant || collapsed) && unreadCount > 0 && (
                        <span className="absolute -right-3 -top-3 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-black leading-5 text-white shadow-md">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </span>
                {isNavVariant && !collapsed && (
                    <>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{label}</span>
                            {description && (
                                <span className="block truncate text-xs font-semibold text-[#155dfc]">{description}</span>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-black text-red-600">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </>
                )}
                {!isNavVariant && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-black leading-5 text-white shadow-md">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className={`${panelClassName} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl`}>
                    <div className="border-b border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-lg font-black text-slate-950">Notifications</p>
                                <p className="text-xs font-semibold text-slate-500">
                                    {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsOpen(false)}
                                    aria-label="Close notifications"
                                    className="size-8 rounded-full bg-white p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
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
                        {!isLoading && !errorMessage && canLoadMoreVisible && (
                            <div className="border-t border-slate-100 bg-white px-4 py-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="h-9 w-full text-sm font-black"
                                >
                                    {isLoadingMore && <Loader2 className="size-4 animate-spin" />}
                                    {loadMoreLabel}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
