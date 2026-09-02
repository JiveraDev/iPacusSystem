import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutoRefresh } from './useAutoRefresh';
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead
} from '../services/notificationService';
import { syncPushContext } from '../services/pushNotificationService';

const DEFAULT_NOTIFICATION_PAGE_SIZE = 6;
const EMPTY_PAGE_INFO = {
    currentOffset: 0,
    currentTotal: 0,
    historyOffset: 0,
    historyTotal: 0
};

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
    },
    ownership_updates: {
        label: 'Ownership',
        tone: 'bg-indigo-50 text-indigo-700'
    },
    account_updates: {
        label: 'Accounts',
        tone: 'bg-sky-50 text-sky-700'
    },
    configuration_updates: {
        label: 'Configuration',
        tone: 'bg-slate-100 text-slate-700'
    },
    report_updates: {
        label: 'Reports',
        tone: 'bg-blue-50 text-blue-700'
    }
};

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

export function notificationMeta(category) {
    return CATEGORY_META[category] || {
        label: 'System',
        tone: 'bg-slate-100 text-slate-700'
    };
}

function parseDate(value) {
    if (!value) return null;

    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeNotificationTime(value) {
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

export function summaryLabel(item) {
    const meta = notificationMeta(item.category);
    const count = item.unread > 0 ? item.unread : item.total;
    return `${count} ${meta.label}`;
}

export function useNotificationCenter(user, {
    pageSize = DEFAULT_NOTIFICATION_PAGE_SIZE,
    autoRefresh = true,
    refreshKeyPrefix = 'notifications'
} = {}) {
    const userId = getUserId(user);
    const [notifications, setNotifications] = useState([]);
    const [summary, setSummary] = useState({ categories: [] });
    const [unreadCount, setUnreadCount] = useState(0);
    const [pageInfo, setPageInfo] = useState(EMPTY_PAGE_INFO);
    const [filter, setFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadNotifications = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!userId) return null;

        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const data = await fetchNotifications(userId, {
                limit: pageSize,
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
    }, [notifications, pageSize, userId]);

    useAutoRefresh(loadNotifications, {
        enabled: autoRefresh && Boolean(userId),
        intervalMs: 12000,
        refreshKey: `${refreshKeyPrefix}-${userId}`
    });

    useEffect(() => {
        if (!userId) return;

        syncPushContext(userId).catch(() => {});
    }, [userId]);

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

    const loadMore = useCallback(async () => {
        if (!userId || isLoadingMore || !canLoadMoreVisible) return;

        const scope = pageInfo.currentOffset < pageInfo.currentTotal ? 'current' : 'history';
        const offset = scope === 'current' ? pageInfo.currentOffset : pageInfo.historyOffset;

        setIsLoadingMore(true);
        setErrorMessage('');

        try {
            const data = await fetchNotifications(userId, {
                limit: pageSize,
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
    }, [
        canLoadMoreVisible,
        isLoadingMore,
        pageInfo.currentOffset,
        pageInfo.currentTotal,
        pageInfo.historyOffset,
        pageSize,
        userId
    ]);

    const markNotificationAsOpened = useCallback(async (notification) => {
        if (!userId || !notification?.notificationId) return;

        setIsUpdating(true);

        try {
            const wasUnread = !notification.readAt;

            if (wasUnread) {
                await markNotificationRead(notification.notificationId, userId);
            }

            setNotifications(current => current.map(item => (
                item.notificationId === notification.notificationId
                    ? { ...item, readAt: item.readAt || new Date().toISOString() }
                    : item
            )));
            setUnreadCount(current => Math.max(0, current - (wasUnread ? 1 : 0)));
            if (wasUnread && !isTodayNotification(notification)) {
                setPageInfo(current => ({
                    ...current,
                    currentOffset: Math.max(0, current.currentOffset - 1),
                    currentTotal: Math.max(0, current.currentTotal - 1),
                    historyTotal: current.historyTotal + 1
                }));
            }
            if (wasUnread) {
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
        } finally {
            setIsUpdating(false);
        }
    }, [userId]);

    const markAllRead = useCallback(async () => {
        if (!userId) return;

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
    }, [loadNotifications, userId]);

    return {
        userId,
        notifications,
        summary,
        unreadCount,
        pageInfo,
        filter,
        setFilter,
        isLoading,
        isLoadingMore,
        isUpdating,
        errorMessage,
        visibleNotifications,
        notificationGroups,
        summaryItems,
        loadedUnreadCount,
        canLoadMoreVisible,
        loadMoreLabel,
        loadNotifications,
        loadMore,
        markNotificationAsOpened,
        markAllRead
    };
}
