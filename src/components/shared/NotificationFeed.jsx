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
    UserPlus,
    X
} from 'lucide-react';
import { Button } from '../../ui/button';
import {
    notificationMeta,
    relativeNotificationTime
} from '../../hooks/useNotificationCenter';

function CategoryIcon({ category, className }) {
    if (category === 'booking_updates') return <CalendarCheck className={className} />;
    if (category === 'schedule_reminders') return <CalendarClock className={className} />;
    if (category === 'payment_updates') return <CreditCard className={className} />;
    if (category === 'diagnosis_updates') return <Stethoscope className={className} />;
    if (category === 'queue_updates') return <ClipboardList className={className} />;
    if (category === 'boarding_updates') return <Hotel className={className} />;
    if (category === 'ownership_updates') return <UserPlus className={className} />;

    return <Bell className={className} />;
}

export default function NotificationFeed({
    title = 'Notifications',
    unreadCount = 0,
    filter,
    onFilterChange,
    isUpdating = false,
    onMarkAllRead,
    isLoading = false,
    errorMessage = '',
    visibleNotifications = [],
    notificationGroups = [],
    canLoadMoreVisible = false,
    isLoadingMore = false,
    onLoadMore,
    loadMoreLabel = 'Load more',
    onNotificationClick,
    onClose,
    layout = 'panel'
}) {
    const isPageLayout = layout === 'page';
    const listClassName = isPageLayout ? 'bg-white' : 'max-h-[30rem] overflow-y-auto';
    const sectionHeaderClassName = isPageLayout
        ? 'border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-400 sm:px-5'
        : 'sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-2 text-xs font-black uppercase text-slate-400';

    return (
        <div className={isPageLayout ? 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm' : ''}>
            <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-lg font-black text-slate-950">{title}</p>
                        <p className="text-xs font-semibold text-slate-500">
                            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onMarkAllRead}
                            disabled={isUpdating || unreadCount === 0}
                            className="h-8 px-2 text-xs"
                        >
                            {isUpdating ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3" />}
                            Read all
                        </Button>
                        {onClose && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={onClose}
                                aria-label="Close notifications"
                                className="size-8 rounded-full bg-white p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            >
                                <X className="size-4" />
                            </Button>
                        )}
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
                            onClick={() => onFilterChange(value)}
                            className={`h-8 flex-1 rounded-md text-sm font-black transition ${filter === value ? 'bg-white text-[#155dfc] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

            </div>

            <div className={listClassName}>
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-slate-500">
                        <Loader2 className="size-4 animate-spin" />
                        Loading notifications...
                    </div>
                ) : errorMessage ? (
                    <div className="px-4 py-6 text-sm font-semibold text-red-600">{errorMessage}</div>
                ) : visibleNotifications.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                        No notifications to show.
                    </div>
                ) : (
                    notificationGroups.map(group => (
                        <section key={group.key}>
                            <div className={sectionHeaderClassName}>
                                {group.key}
                            </div>
                            {group.notifications.map(notification => {
                                const meta = notificationMeta(notification.category);
                                const isUnread = !notification.readAt;

                                return (
                                    <button
                                        type="button"
                                        key={notification.notificationId}
                                        onClick={() => onNotificationClick(notification)}
                                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5 ${isUnread ? 'bg-blue-50/50' : 'bg-white'}`}
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
                                                        {relativeNotificationTime(notification.createdAt)}
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
                    <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onLoadMore}
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
    );
}
