import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import NotificationFeed from './NotificationFeed.jsx';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { prepareNotificationRedirect } from '../../lib/notificationRedirect';
import BrowserNotificationButton from './BrowserNotificationButton.jsx';

const NOTIFICATIONS_ROUTE = '/dashboard/notifications';
const NOTIFICATIONS_RETURN_PATH_KEY = 'ipawcus-notifications-return-path';

function shouldOpenNotificationsPage() {
    if (typeof window === 'undefined') return false;

    return window.matchMedia?.('(max-width: 959px)').matches || window.innerWidth < 960;
}

export default function NotificationBell({
    user,
    navigate,
    variant = 'icon',
    label = 'Notifications',
    description = '',
    collapsed = false
}) {
    const containerRef = useRef(null);
    const panelRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const {
        unreadCount,
        filter,
        setFilter,
        summaryItems,
        isUpdating,
        isLoading,
        isLoadingMore,
        errorMessage,
        visibleNotifications,
        notificationGroups,
        canLoadMoreVisible,
        loadMoreLabel,
        loadNotifications,
        loadMore,
        markNotificationAsOpened,
        markAllRead
    } = useNotificationCenter(user);

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            const clickedTrigger = containerRef.current?.contains(event.target);
            const clickedPanel = panelRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedPanel) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    const openPanel = () => {
        if (typeof navigate === 'function' && shouldOpenNotificationsPage()) {
            try {
                sessionStorage.setItem(NOTIFICATIONS_RETURN_PATH_KEY, window.location.pathname);
            } catch {
                // Ignore storage failures; navigation still works without a return path.
            }
            setIsOpen(false);
            navigate(NOTIFICATIONS_ROUTE);
            return;
        }

        setIsOpen(current => !current);
        if (!isOpen) {
            loadNotifications();
        }
    };

    const handleNotificationClick = async (notification) => {
        await markNotificationAsOpened(notification);
        setIsOpen(false);

        const redirectPath = prepareNotificationRedirect(notification.petRedirectPath || notification.redirectPath);
        if (redirectPath && typeof navigate === 'function') {
            navigate(redirectPath);
        }
    };

    const isNavVariant = variant === 'nav';
    const panelClassName = isNavVariant
        ? `fixed bottom-4 left-4 right-4 z-[1200] max-h-[calc(100vh-2rem)] md:bottom-6 md:right-auto md:w-[27rem] md:max-w-[calc(100vw-21rem)] ${
            collapsed ? 'md:left-24' : 'md:left-[19rem]'
        }`
        : 'absolute right-0 z-50 mt-2 w-[min(27rem,calc(100vw-2rem))]';
    const buttonClassName = isNavVariant
        ? `relative flex min-h-11 items-center rounded-xl text-left text-slate-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900 ${
            collapsed ? 'mx-auto size-11 justify-center p-0' : 'w-full gap-3 px-2.5 py-2'
        }`
        : 'relative flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

    const notificationPanel = isOpen ? (
        <div
            ref={panelRef}
            data-motion="popover"
            role="dialog"
            aria-label="Notification viewer"
            className={`${panelClassName} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900`}
        >
            <NotificationFeed
                unreadCount={unreadCount}
                filter={filter}
                onFilterChange={setFilter}
                summaryItems={summaryItems}
                isUpdating={isUpdating}
                onMarkAllRead={markAllRead}
                isLoading={isLoading}
                errorMessage={errorMessage}
                visibleNotifications={visibleNotifications}
                notificationGroups={notificationGroups}
                canLoadMoreVisible={canLoadMoreVisible}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                loadMoreLabel={loadMoreLabel}
                notificationControl={<BrowserNotificationButton user={user} />}
                onNotificationClick={handleNotificationClick}
                onClose={() => setIsOpen(false)}
            />
        </div>
    ) : null;

    return (
        <div ref={containerRef} className={`relative ${isNavVariant ? 'w-full' : ''}`}>
            <button
                type="button"
                onClick={openPanel}
                className={buttonClassName}
                aria-label="Open notifications"
                title={collapsed ? label : undefined}
            >
                <span className={`relative flex size-8 shrink-0 items-center justify-center rounded-lg ${isNavVariant ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' : ''}`}>
                    <Bell className="size-4.5" />
                    {(!isNavVariant || collapsed) && unreadCount > 0 && (
                        <span className="absolute -right-3 -top-3 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-black leading-5 text-white shadow-md">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </span>
                {isNavVariant && !collapsed && (
                    <>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{label}</span>
                            {description && (
                                <span className="block truncate text-xs font-semibold text-blue-700 dark:text-blue-300">{description}</span>
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

            {isNavVariant && typeof document !== 'undefined'
                ? createPortal(notificationPanel, document.body)
                : notificationPanel}
        </div>
    );
}
